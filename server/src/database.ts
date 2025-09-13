import { Pool, PoolClient, QueryResult } from 'pg';
import { appConfig } from './config';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper function to get SSL configuration
function getSSLConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  
  try {
    const caCertPath = join(__dirname, '..', 'certs', 'ca-certificate.crt');
    const ca = readFileSync(caCertPath, 'utf8');
    return {
      rejectUnauthorized: true,
      ca: ca,
    };
  } catch (error) {
    console.warn('⚠️ Could not load CA certificate, falling back to rejectUnauthorized: false');
    return { rejectUnauthorized: false };
  }
}

class VitalSignsDatabase {
  private pool: Pool | null = null;

  constructor() {
    // Configuration is now handled by the config module
  }

  async initialize(): Promise<void> {
    try {
      // Create connection pool
      this.pool = new Pool({
        host: appConfig.database.host,
        port: appConfig.database.port,
        database: appConfig.database.database,
        user: appConfig.database.user,
        password: appConfig.database.password,
        ssl: getSSLConfig(),
        max: 8, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test the connection
      const client = await this.pool.connect();
      client.release();
      
      console.log('Connected to PostgreSQL database for vital signs tracking');
      
      // In production, run migrations automatically
      // In development with Docker Compose, migrations are handled by dedicated service
      // For local development without Docker, create tables directly
      if (process.env.NODE_ENV === 'production') {
        console.log('Running database migrations...');
        await this.runMigrations();
      } else if (process.env.RUN_MIGRATIONS === 'true') {
        console.log('Running database migrations (RUN_MIGRATIONS=true)...');
        await this.runMigrations();
      } else {
        console.log('Development mode: Creating tables directly (migrations handled by dedicated service)...');
        // Create tables if they don't exist (for backward compatibility in local development)
        await this.createTables();
      }
    } catch (error) {
      console.error('Error connecting to PostgreSQL database:', error);
      throw error;
    }
  }

  /**
   * Run database migrations using node-pg-migrate
   */
  async runMigrations(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const startTime = Date.now();

    try {
      console.log('🔄 [DEBUG] Starting database migrations...');
      console.log(`🔍 [DEBUG] Migration start time: ${new Date().toISOString()}`);
      
      // Import node-pg-migrate with proper typing for production builds
      console.log('📦 [DEBUG] Importing node-pg-migrate...');
      const { runner } = require('node-pg-migrate');
      const path = require('path');
      console.log('✅ [DEBUG] node-pg-migrate imported successfully');
      
      const migrationDir = path.join(__dirname, '../migrations');
      console.log(`📁 [DEBUG] Migration directory: ${migrationDir}`);
      
      // Use existing pool to get a client instead of creating a new one
      console.log('🔗 [DEBUG] Getting client from existing pool...');
      const dbClient = await this.pool.connect();
      console.log('✅ [DEBUG] Client obtained from pool successfully');

      try {
        // Check if migrations table exists
        console.log('🔍 [DEBUG] Checking for existing migrations...');
        const tableCheck = await dbClient.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'pgmigrations'
        `);
        console.log(`📋 [DEBUG] Migrations table exists: ${tableCheck.rows.length > 0}`);
        
        // List migration files
        const fs = require('fs');
        const migrationFiles = fs.readdirSync(migrationDir);
        console.log(`📄 [DEBUG] Found ${migrationFiles.length} migration files:`, migrationFiles);
        
        // Add timeout to migration process
        console.log('🚀 [DEBUG] Starting migration runner...');
        const runnerStart = Date.now();
        
        const migrationPromise = runner({
          dbClient,
          dir: migrationDir,
          direction: 'up',
          migrationsTable: 'pgmigrations',
          schema: 'public',
          createSchema: true,
          checkOrder: true,
          singleTransaction: true,
          lock: true,
          verbose: true,
        });
        
        // Set a timeout for migrations (60 seconds for debugging)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            const elapsed = Date.now() - runnerStart;
            reject(new Error(`Migration timeout after 60 seconds (elapsed: ${elapsed}ms)`));
          }, 60000);
        });
        
        console.log('⏱️ [DEBUG] Racing migration vs timeout...');
        await Promise.race([migrationPromise, timeoutPromise]);
        
        const runnerTime = Date.now() - runnerStart;
        console.log(`✅ [DEBUG] Migration runner completed in ${runnerTime}ms`);
        
      } finally {
        // Release the client back to the pool
        console.log('🔌 [DEBUG] Releasing client back to pool...');
        dbClient.release();
        console.log('✅ [DEBUG] Client released back to pool');
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ [DEBUG] Database migrations completed successfully in ${totalTime}ms`);
      console.log(`🔍 [DEBUG] Migration end time: ${new Date().toISOString()}`);
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [DEBUG] Database migration failed after ${totalTime}ms:`, error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      // Create processed_vital_signs table
      const createVitalSignsTableQuery = `
        CREATE TABLE IF NOT EXISTS processed_vital_signs (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          source_encounter_id TEXT,
          height_value REAL,
          weight_value REAL,
          height_unit TEXT,
          weight_unit TEXT,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create user_credentials table
      const createUserCredentialsTableQuery = `
        CREATE TABLE IF NOT EXISTS user_credentials (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          server_url TEXT,
          access_token TEXT,
          refresh_token TEXT,
          token_expires_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create user_sessions table
      const createUserSessionsTableQuery = `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          session_token TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          user_agent TEXT,
          ip_address TEXT,
          is_active BOOLEAN DEFAULT true
        )
      `;

      // Create refresh_tokens table
      const createRefreshTokensTableQuery = `
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id SERIAL PRIMARY KEY,
          refresh_token TEXT UNIQUE NOT NULL,
          username TEXT NOT NULL,
          session_token TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT true,
          FOREIGN KEY (session_token) REFERENCES user_sessions(session_token) ON DELETE CASCADE
        )
      `;

      // Create note_checks table
      const createNoteChecksTableQuery = `
        CREATE TABLE IF NOT EXISTS note_checks (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          patient_name TEXT NOT NULL,
          chief_complaint TEXT,
          date_of_service TIMESTAMP NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          ai_analysis JSONB,
          issues_found BOOLEAN DEFAULT false,
          checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checked_by VARCHAR(255) NOT NULL,
          error_message TEXT,
          note_content_md5 VARCHAR(32),
          note_content TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create note_check_queue table
      const createNoteCheckQueueTableQuery = `
        CREATE TABLE IF NOT EXISTS note_check_queue (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          priority INTEGER DEFAULT 1,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP,
          error_message TEXT
        )
      `;

      // Create created_todos table to track ToDos created in EZDerm
      const createCreatedTodosTableQuery = `
        CREATE TABLE IF NOT EXISTS created_todos (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          patient_name TEXT NOT NULL,
          ezderm_todo_id TEXT NOT NULL,
          subject TEXT NOT NULL,
          description TEXT NOT NULL,
          assigned_to TEXT NOT NULL,
          assigned_to_name TEXT NOT NULL,
          cc_list JSONB,
          issues_count INTEGER DEFAULT 0,
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(encounter_id, ezderm_todo_id)
        )
      `;

      // Create invalid_issues table to track issues marked as invalid by users
      const createInvalidIssuesTableQuery = `
        CREATE TABLE IF NOT EXISTS invalid_issues (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT NOT NULL,
          check_id INTEGER NOT NULL,
          issue_index INTEGER NOT NULL,
          issue_type VARCHAR(100) NOT NULL,
          assessment TEXT NOT NULL,
          issue_hash VARCHAR(64) NOT NULL,
          marked_invalid_by VARCHAR(255) NOT NULL,
          marked_invalid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reason TEXT,
          UNIQUE(encounter_id, check_id, issue_index),
          FOREIGN KEY (check_id) REFERENCES note_checks(id) ON DELETE CASCADE
        )
      `;

      // Create resolved_issues table to track issues marked as resolved by users
      const createResolvedIssuesTableQuery = `
        CREATE TABLE IF NOT EXISTS resolved_issues (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT NOT NULL,
          check_id INTEGER NOT NULL,
          issue_index INTEGER NOT NULL,
          issue_type VARCHAR(100) NOT NULL,
          assessment TEXT NOT NULL,
          issue_hash VARCHAR(64) NOT NULL,
          marked_resolved_by VARCHAR(255) NOT NULL,
          marked_resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reason TEXT,
          UNIQUE(encounter_id, check_id, issue_index),
          FOREIGN KEY (check_id) REFERENCES note_checks(id) ON DELETE CASCADE
        )
      `;

      // Create todo_completion_tracking table to track when we've detected ToDo completion
      const createToDoCompletionTrackingTableQuery = `
        CREATE TABLE IF NOT EXISTS todo_completion_tracking (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT NOT NULL,
          ezderm_todo_id TEXT NOT NULL,
          completed_status VARCHAR(20) NOT NULL,
          completion_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          followup_ai_check_triggered BOOLEAN DEFAULT FALSE,
          followup_ai_check_id INTEGER,
          UNIQUE(encounter_id, ezderm_todo_id),
          FOREIGN KEY (followup_ai_check_id) REFERENCES note_checks(id) ON DELETE SET NULL
        )
      `;

      // Create processed_benefits_eligibility table
      const createBenefitsEligibilityTableQuery = `
        CREATE TABLE IF NOT EXISTS processed_benefits_eligibility (
          id SERIAL PRIMARY KEY,
          encounter_id TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checks_enqueued INTEGER DEFAULT 0,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Execute table creation queries
      await client.query(createVitalSignsTableQuery);
      await client.query(createUserCredentialsTableQuery);
      await client.query(createUserSessionsTableQuery);
      await client.query(createRefreshTokensTableQuery);
      await client.query(createNoteChecksTableQuery);
      await client.query(createNoteCheckQueueTableQuery);
      await client.query(createCreatedTodosTableQuery);
      await client.query(createInvalidIssuesTableQuery);
      await client.query(createResolvedIssuesTableQuery);
      await client.query(createToDoCompletionTrackingTableQuery);
      await client.query(createBenefitsEligibilityTableQuery);

      // Add MD5 and note content columns if they don't exist (migration)
      const addMd5ColumnQuery = `
        ALTER TABLE note_checks 
        ADD COLUMN IF NOT EXISTS note_content_md5 VARCHAR(32),
        ADD COLUMN IF NOT EXISTS note_content TEXT
      `;
      await client.query(addMd5ColumnQuery);

      console.log('Database tables created/verified: processed_vital_signs, user_credentials, user_sessions, refresh_tokens, note_checks, note_check_queue, created_todos, invalid_issues, resolved_issues, todo_completion_tracking, processed_benefits_eligibility');
    } finally {
      client.release();
    }
  }

  async hasBeenProcessed(encounterId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT COUNT(*) as count FROM processed_vital_signs WHERE encounter_id = $1';
    const result = await this.pool.query(query, [encounterId]);
    return parseInt(result.rows[0].count) > 0;
  }

  async markAsProcessed(
    encounterId: string,
    patientId: string,
    sourceEncounterId?: string,
    heightValue?: number,
    weightValue?: number,
    heightUnit?: string,
    weightUnit?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO processed_vital_signs 
      (encounter_id, patient_id, source_encounter_id, height_value, weight_value, 
       height_unit, weight_unit, success, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (encounter_id) 
      DO UPDATE SET 
        patient_id = EXCLUDED.patient_id,
        source_encounter_id = EXCLUDED.source_encounter_id,
        height_value = EXCLUDED.height_value,
        weight_value = EXCLUDED.weight_value,
        height_unit = EXCLUDED.height_unit,
        weight_unit = EXCLUDED.weight_unit,
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message,
        processed_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      encounterId, patientId, sourceEncounterId, heightValue, weightValue, 
      heightUnit, weightUnit, success, errorMessage
    ]);

    console.log(`Marked encounter ${encounterId} as processed for vital signs`);
  }

  async getProcessingStats(): Promise<{ total: number; successful: number; failed: number }> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
      FROM processed_vital_signs
    `;
    
    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      total: parseInt(row.total) || 0,
      successful: parseInt(row.successful) || 0,
      failed: parseInt(row.failed) || 0
    };
  }

  // User credentials management methods
  async storeUserCredentials(username: string, password: string, emrProvider: string = 'EZDERM'): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO user_credentials 
      (username, password, emr_provider, updated_at) 
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (username) 
      DO UPDATE SET 
        password = EXCLUDED.password,
        emr_provider = EXCLUDED.emr_provider,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [username, password, emrProvider]);
    console.log(`Stored credentials for user: ${username} (${emrProvider})`);
  }

  async getUserCredentials(username: string): Promise<{ username: string; password: string; emrProvider?: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT username, password, emr_provider FROM user_credentials WHERE username = $1 AND is_active = true';
    const result = await this.pool.query(query, [username]);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        username: row.username,
        password: row.password,
        emrProvider: row.emr_provider || 'EZDERM'
      };
    }
    return null;
  }

  async getActiveUserCredentials(): Promise<{ username: string; password: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT username, password FROM user_credentials WHERE is_active = true ORDER BY updated_at DESC LIMIT 1';
    const result = await this.pool.query(query);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async storeTokens(username: string, accessToken: string, refreshToken: string, serverUrl: string, emrProvider: string = 'EZDERM'): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const expiresAt = new Date(Date.now() + 600000); // 10 minutes from now
    const query = `
      UPDATE user_credentials 
      SET access_token = $1, refresh_token = $2, server_url = $3, token_expires_at = $4, emr_provider = $6, updated_at = CURRENT_TIMESTAMP
      WHERE username = $5
    `;

    await this.pool.query(query, [accessToken, refreshToken, serverUrl, expiresAt, username, emrProvider]);
  }

  async getStoredTokens(username: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT access_token, refresh_token, server_url, token_expires_at FROM user_credentials WHERE username = $1 AND is_active = true';
    const result = await this.pool.query(query, [username]);
    
    if (result.rows.length === 0 || !result.rows[0].access_token) {
      return null;
    }

    const row = result.rows[0];
    
    // Check if token is expired
    const expiresAt = new Date(row.token_expires_at);
    if (expiresAt < new Date()) {
      console.log('Stored token is expired');
      return null;
    }

    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      serverUrl: row.server_url
    };
  }

  // Get stored tokens even if expired (for refresh purposes)
  async getStoredTokensIgnoreExpiry(username: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT access_token, refresh_token, server_url FROM user_credentials WHERE username = $1 AND is_active = true';
    const result = await this.pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      serverUrl: row.server_url
    };
  }

  // Session management methods
  async createSession(sessionToken: string, username: string, expiresAt: Date, userAgent?: string, ipAddress?: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO user_sessions 
      (session_token, username, expires_at, user_agent, ip_address) 
      VALUES ($1, $2, $3, $4, $5)
    `;

    await this.pool.query(query, [sessionToken, username, expiresAt, userAgent, ipAddress]);
    console.log(`Created session for user: ${username}`);
  }

  async createRefreshToken(refreshToken: string, sessionToken: string, username: string, expiresAt: Date): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO refresh_tokens 
      (refresh_token, session_token, username, expires_at) 
      VALUES ($1, $2, $3, $4)
    `;

    await this.pool.query(query, [refreshToken, sessionToken, username, expiresAt]);
    console.log(`Created refresh token for user: ${username}`);
  }

  async validateRefreshToken(refreshToken: string): Promise<{ username: string; sessionToken: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    console.log('🔍 DB: Validating refresh token:', refreshToken.substring(0, 20) + '...');

    const query = `
      SELECT rt.username, rt.session_token, rt.expires_at
      FROM refresh_tokens rt
      JOIN user_sessions us ON rt.session_token = us.session_token
      WHERE rt.refresh_token = $1 
        AND rt.is_active = true 
        AND rt.expires_at > NOW()
        AND us.is_active = true
    `;
    
    const result = await this.pool.query(query, [refreshToken]);

    if (result.rows.length === 0) {
      console.log('❌ DB: No valid refresh token found');
      return null;
    }

    const row = result.rows[0];
    console.log('✅ DB: Valid refresh token found for user:', row.username);

    return {
      username: row.username,
      sessionToken: row.session_token
    };
  }

  async invalidateRefreshToken(refreshToken: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      UPDATE refresh_tokens 
      SET is_active = false 
      WHERE refresh_token = $1
    `;

    await this.pool.query(query, [refreshToken]);
    console.log(`Invalidated refresh token: ${refreshToken.substring(0, 20)}...`);
  }

  async invalidateAllRefreshTokensForSession(sessionToken: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      UPDATE refresh_tokens 
      SET is_active = false 
      WHERE session_token = $1
    `;

    await this.pool.query(query, [sessionToken]);
    console.log(`Invalidated all refresh tokens for session: ${sessionToken.substring(0, 20)}...`);
  }

  async validateSession(sessionToken: string): Promise<{ username: string; expiresAt: Date } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    console.log('🔍 DB: Validating session token:', sessionToken.substring(0, 20) + '...');

    const query = `
      SELECT username, expires_at 
      FROM user_sessions 
      WHERE session_token = $1 AND is_active = true AND expires_at > NOW()
    `;
    
    const result = await this.pool.query(query, [sessionToken]);

    if (result.rows.length === 0) {
      console.log('❌ DB: No valid session found for token');
      
      // Debug query to check if the session exists at all
      const debugQuery = 'SELECT username, expires_at, is_active FROM user_sessions WHERE session_token = $1';
      const debugResult = await this.pool.query(debugQuery, [sessionToken]);
      
      if (debugResult.rows.length > 0) {
        const debugRow = debugResult.rows[0];
        console.log('🔍 DB: Session exists but invalid:', {
          username: debugRow.username,
          expires_at: debugRow.expires_at,
          is_active: debugRow.is_active,
          current_time: new Date().toISOString()
        });
      } else {
        console.log('🚫 DB: Session token not found in database at all');
      }
      
      return null;
    }

    const row = result.rows[0];
    console.log('✅ DB: Valid session found:', {
      username: row.username,
      expires_at: row.expires_at
    });

    // Update last accessed time
    this.updateSessionAccess(sessionToken).catch(console.error);

    return {
      username: row.username,
      expiresAt: new Date(row.expires_at)
    };
  }

  async updateSessionAccess(sessionToken: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      UPDATE user_sessions 
      SET last_accessed = CURRENT_TIMESTAMP 
      WHERE session_token = $1 AND is_active = true
    `;

    await this.pool.query(query, [sessionToken]);
  }

  async deleteSession(sessionToken: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE session_token = $1
    `;

    await this.pool.query(query, [sessionToken]);
    console.log(`Deleted session: ${sessionToken}`);
  }

  async deleteAllUserSessions(username: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE username = $1
    `;

    await this.pool.query(query, [username]);
    console.log(`Deleted all sessions for user: ${username}`);
  }

  async cleanupExpiredSessions(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      DELETE FROM user_sessions 
      WHERE expires_at < NOW() OR is_active = false
    `;

    await this.pool.query(query);
    console.log('Cleaned up expired sessions');
  }

  async getAllSessions(): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT session_token, username, created_at, expires_at, last_accessed, is_active
      FROM user_sessions 
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query);

    // Truncate session tokens for security
    const safeSessions = result.rows.map(row => ({
      ...row,
      session_token: row.session_token.substring(0, 20) + '...'
    }));

    return safeSessions;
  }

  // Note checking methods
  async saveNoteCheckResult(
    encounterId: string,
    patientId: string,
    patientName: string,
    chiefComplaint: string,
    dateOfService: Date,
    status: 'pending' | 'completed' | 'error',
    checkedBy: string,
    aiAnalysis?: any,
    issuesFound: boolean = false,
    errorMessage?: string,
    noteContentMd5?: string,
    noteContent?: string
  ): Promise<number> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO note_checks 
      (encounter_id, patient_id, patient_name, chief_complaint, date_of_service, 
       status, ai_analysis, issues_found, checked_by, error_message, note_content_md5, note_content, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      ON CONFLICT (encounter_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        ai_analysis = EXCLUDED.ai_analysis,
        issues_found = EXCLUDED.issues_found,
        checked_by = EXCLUDED.checked_by,
        error_message = EXCLUDED.error_message,
        note_content_md5 = EXCLUDED.note_content_md5,
        note_content = EXCLUDED.note_content,
        checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      encounterId, patientId, patientName, chiefComplaint, dateOfService,
      status, JSON.stringify(aiAnalysis), issuesFound, checkedBy, errorMessage, noteContentMd5, noteContent
    ]);

    const savedId = result.rows[0].id;
    console.log(`💾 Database: Saved note check result for encounter ${encounterId}, status: ${status}, issues: ${issuesFound}, id: ${savedId}`);
    
    return savedId;
  }

  async findNoteCheckByMd5(noteContentMd5: string): Promise<any | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT * FROM note_checks 
      WHERE note_content_md5 = $1 
      ORDER BY checked_at DESC 
      LIMIT 1
    `;

    const result = await this.pool.query(query, [noteContentMd5]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getNoteCheckByEncounterId(encounterId: string): Promise<any | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT * FROM note_checks 
      WHERE encounter_id = $1 
      ORDER BY checked_at DESC 
      LIMIT 1
    `;

    const result = await this.pool.query(query, [encounterId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getNoteCheckResult(encounterId: string): Promise<any | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT id, encounter_id, patient_id, patient_name, chief_complaint, 
             date_of_service, status, ai_analysis, issues_found, 
             checked_at, checked_by, error_message
      FROM note_checks 
      WHERE encounter_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [encounterId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      chiefComplaint: row.chief_complaint,
      dateOfService: row.date_of_service,
      status: row.status,
      aiAnalysis: row.ai_analysis,
      issuesFound: row.issues_found,
      checkedAt: row.checked_at,
      checkedBy: row.checked_by,
      errorMessage: row.error_message
    };
  }

  async getNoteCheckHistory(encounterId: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT id, encounter_id, patient_id, patient_name, chief_complaint, 
             date_of_service, status, ai_analysis, issues_found, 
             checked_at, checked_by, error_message
      FROM note_checks 
      WHERE encounter_id = $1
      ORDER BY checked_at DESC
    `;

    const result = await this.pool.query(query, [encounterId]);
    
    return result.rows.map(row => ({
      id: row.id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      chiefComplaint: row.chief_complaint,
      dateOfService: row.date_of_service,
      status: row.status,
      aiAnalysis: row.ai_analysis,
      issuesFound: row.issues_found,
      checkedAt: row.checked_at,
      checkedBy: row.checked_by,
      errorMessage: row.error_message
    }));
  }

  async getNoteCheckResults(limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT id, encounter_id, patient_id, patient_name, chief_complaint, 
             date_of_service, status, ai_analysis, issues_found, 
             checked_at, checked_by, error_message
      FROM note_checks 
      ORDER BY checked_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    
    return result.rows.map(row => ({
      id: row.id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      chiefComplaint: row.chief_complaint,
      dateOfService: row.date_of_service,
      status: row.status,
      aiAnalysis: row.ai_analysis,
      issuesFound: row.issues_found,
      checkedAt: row.checked_at,
      checkedBy: row.checked_by,
      errorMessage: row.error_message
    }));
  }

  async addToNoteCheckQueue(encounterId: string, patientId: string, priority: number = 1): Promise<number> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO note_check_queue (encounter_id, patient_id, priority)
      VALUES ($1, $2, $3)
      ON CONFLICT (encounter_id) DO NOTHING
      RETURNING id
    `;

    const result = await this.pool.query(query, [encounterId, patientId, priority]);
    return result.rows.length > 0 ? result.rows[0].id : 0;
  }

  async getNextQueueItem(): Promise<any | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT id, encounter_id, patient_id, priority, created_at
      FROM note_check_queue 
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `;

    const result = await this.pool.query(query);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async updateQueueItemStatus(queueId: number, status: 'processing' | 'completed' | 'error', errorMessage?: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      UPDATE note_check_queue 
      SET status = $1, processed_at = CURRENT_TIMESTAMP, error_message = $2
      WHERE id = $3
    `;

    await this.pool.query(query, [status, errorMessage || null, queueId]);
  }

  async cleanupOldNoteChecks(daysOld: number = 30): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      DELETE FROM note_checks 
      WHERE checked_at < NOW() - INTERVAL '${daysOld} days'
    `;

    await this.pool.query(query);
    console.log(`Cleaned up note checks older than ${daysOld} days`);
  }

  async saveCreatedToDo(
    encounterId: string,
    patientId: string,
    patientName: string,
    ezDermToDoId: string,
    subject: string,
    description: string,
    assignedTo: string,
    assignedToName: string,
    ccList: any[],
    issuesCount: number,
    createdBy: string
  ): Promise<number> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO created_todos (
        encounter_id, patient_id, patient_name, ezderm_todo_id, 
        subject, description, assigned_to, assigned_to_name, 
        cc_list, issues_count, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const result = await this.pool.query(query, [
      encounterId,
      patientId,
      patientName,
      ezDermToDoId,
      subject,
      description,
      assignedTo,
      assignedToName,
      JSON.stringify(ccList),
      issuesCount,
      createdBy
    ]);

    return result.rows[0].id;
  }

  async getCreatedToDosForEncounter(encounterId: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT id, encounter_id, patient_id, patient_name, ezderm_todo_id,
             subject, description, assigned_to, assigned_to_name, cc_list,
             issues_count, created_by, created_at
      FROM created_todos 
      WHERE encounter_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [encounterId]);
    
    return result.rows.map(row => ({
      id: row.id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      ezDermToDoId: row.ezderm_todo_id,
      subject: row.subject,
      description: row.description,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      ccList: row.cc_list,
      issuesCount: row.issues_count,
      createdBy: row.created_by,
      createdAt: row.created_at
    }));
  }

  async hasCreatedToDoForEncounter(encounterId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 1 FROM created_todos 
      WHERE encounter_id = $1 
      LIMIT 1
    `;

    const result = await this.pool.query(query, [encounterId]);
    return result.rows.length > 0;
  }

  /**
   * Mark an issue as invalid
   */
  async markIssueAsInvalid(
    encounterId: string,
    checkId: number,
    issueIndex: number,
    issueType: string,
    assessment: string,
    issueHash: string,
    markedBy: string,
    reason?: string
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO invalid_issues (encounter_id, check_id, issue_index, issue_type, assessment, issue_hash, marked_invalid_by, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (encounter_id, check_id, issue_index) 
      DO UPDATE SET
        marked_invalid_by = EXCLUDED.marked_invalid_by,
        marked_invalid_at = CURRENT_TIMESTAMP,
        reason = EXCLUDED.reason
    `;

    await this.pool.query(query, [
      encounterId,
      checkId,
      issueIndex,
      issueType,
      assessment,
      issueHash,
      markedBy,
      reason || null
    ]);
  }

  /**
   * Remove invalid marking from an issue
   */
  async unmarkIssueAsInvalid(encounterId: string, checkId: number, issueIndex: number): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      DELETE FROM invalid_issues 
      WHERE encounter_id = $1 AND check_id = $2 AND issue_index = $3
    `;

    await this.pool.query(query, [encounterId, checkId, issueIndex]);
  }

  /**
   * Get invalid issues for an encounter
   */
  async getInvalidIssuesForEncounter(encounterId: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT * FROM invalid_issues 
      WHERE encounter_id = $1 
      ORDER BY marked_invalid_at ASC
    `;

    const result = await this.pool.query(query, [encounterId]);
    return result.rows.map(row => ({
      id: row.id,
      encounterId: row.encounter_id,
      checkId: row.check_id,
      issueIndex: row.issue_index,
      issueType: row.issue_type,
      assessment: row.assessment,
      issueHash: row.issue_hash,
      markedInvalidBy: row.marked_invalid_by,
      markedInvalidAt: row.marked_invalid_at,
      reason: row.reason
    }));
  }

  /**
   * Check if a specific issue is marked as invalid
   */
  async isIssueMarkedInvalid(encounterId: string, checkId: number, issueIndex: number): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 1 FROM invalid_issues 
      WHERE encounter_id = $1 AND check_id = $2 AND issue_index = $3
      LIMIT 1
    `;

    const result = await this.pool.query(query, [encounterId, checkId, issueIndex]);
    return result.rows.length > 0;
  }

  /**
   * Mark an issue as resolved
   */
  async markIssueAsResolved(
    encounterId: string,
    checkId: number,
    issueIndex: number,
    issueType: string,
    assessment: string,
    issueHash: string,
    markedBy: string,
    reason?: string
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO resolved_issues (encounter_id, check_id, issue_index, issue_type, assessment, issue_hash, marked_resolved_by, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (encounter_id, check_id, issue_index) 
      DO UPDATE SET
        marked_resolved_by = EXCLUDED.marked_resolved_by,
        marked_resolved_at = CURRENT_TIMESTAMP,
        reason = EXCLUDED.reason
    `;

    await this.pool.query(query, [
      encounterId,
      checkId,
      issueIndex,
      issueType,
      assessment,
      issueHash,
      markedBy,
      reason || null
    ]);
  }

  /**
   * Remove resolved marking from an issue
   */
  async unmarkIssueAsResolved(encounterId: string, checkId: number, issueIndex: number): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      DELETE FROM resolved_issues 
      WHERE encounter_id = $1 AND check_id = $2 AND issue_index = $3
    `;

    await this.pool.query(query, [encounterId, checkId, issueIndex]);
  }

  /**
   * Get all resolved issues for an encounter
   */
  async getResolvedIssues(encounterId: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT * FROM resolved_issues 
      WHERE encounter_id = $1 
      ORDER BY marked_resolved_at ASC
    `;

    const result = await this.pool.query(query, [encounterId]);
    return result.rows.map(row => ({
      id: row.id,
      encounterId: row.encounter_id,
      checkId: row.check_id,
      issueIndex: row.issue_index,
      issueType: row.issue_type,
      assessment: row.assessment,
      issueHash: row.issue_hash,
      markedResolvedBy: row.marked_resolved_by,
      markedResolvedAt: row.marked_resolved_at,
      reason: row.reason
    }));
  }

  /**
   * Check if a specific issue is marked as resolved
   */
  async isIssueMarkedResolved(encounterId: string, checkId: number, issueIndex: number): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 1 FROM resolved_issues 
      WHERE encounter_id = $1 AND check_id = $2 AND issue_index = $3
      LIMIT 1
    `;

    const result = await this.pool.query(query, [encounterId, checkId, issueIndex]);
    return result.rows.length > 0;
  }

  /**
   * Check if an encounter has any valid (non-invalid) issues
   */
  async hasValidIssues(encounterId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    // Get the latest check result for this encounter that found issues
    const checkQuery = `
      SELECT id, ai_analysis, issues_found
      FROM note_checks 
      WHERE encounter_id = $1 AND issues_found = true
      ORDER BY checked_at DESC 
      LIMIT 1
    `;

    const checkResult = await this.pool.query(checkQuery, [encounterId]);
    
    if (checkResult.rows.length === 0) {
      return false; // No issues found at all
    }

    const check = checkResult.rows[0];
    const aiAnalysis = check.ai_analysis;
    
    if (!aiAnalysis || !aiAnalysis.issues || aiAnalysis.issues.length === 0) {
      return false; // No issues in the analysis
    }

    // Check each issue to see if any are still valid (not marked as invalid)
    for (let issueIndex = 0; issueIndex < aiAnalysis.issues.length; issueIndex++) {
      const isInvalid = await this.isIssueMarkedInvalid(encounterId, check.id, issueIndex);
      if (!isInvalid) {
        return true; // Found at least one valid issue
      }
    }

    return false; // All issues have been marked as invalid
  }

  // Benefits eligibility tracking methods
  async hasBenefitsEligibilityBeenProcessed(encounterId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT COUNT(*) as count FROM processed_benefits_eligibility WHERE encounter_id = $1';
    const result = await this.pool.query(query, [encounterId]);
    return parseInt(result.rows[0].count) > 0;
  }

  async markBenefitsEligibilityAsProcessed(
    encounterId: string,
    patientId: string,
    checksEnqueued: number = 0,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO processed_benefits_eligibility 
      (encounter_id, patient_id, checks_enqueued, success, error_message)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (encounter_id) 
      DO UPDATE SET 
        patient_id = EXCLUDED.patient_id,
        checks_enqueued = EXCLUDED.checks_enqueued,
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message,
        processed_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      encounterId, patientId, checksEnqueued, success, errorMessage
    ]);

    console.log(`Marked encounter ${encounterId} as processed for benefits eligibility check`);
  }

  async getBenefitsEligibilityStats(): Promise<{ total: number; successful: number; failed: number; totalChecksEnqueued: number }> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed,
        SUM(checks_enqueued) as total_checks_enqueued
      FROM processed_benefits_eligibility
    `;
    
    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      total: parseInt(row.total) || 0,
      successful: parseInt(row.successful) || 0,
      failed: parseInt(row.failed) || 0,
      totalChecksEnqueued: parseInt(row.total_checks_enqueued) || 0
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      console.log('Closing PostgreSQL database connection pool');
      await this.pool.end();
      this.pool = null;
      console.log('Database connection pool closed');
    }
  }
  /**
   * Track ToDo completion detection
   */
  async trackToDoCompletion(
    encounterId: string,
    ezDermToDoId: string,
    completedStatus: string,
    followupAiCheckId?: number
  ): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO todo_completion_tracking (
        encounter_id, ezderm_todo_id, completed_status, 
        followup_ai_check_triggered, followup_ai_check_id
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (encounter_id, ezderm_todo_id) 
      DO UPDATE SET
        completed_status = EXCLUDED.completed_status,
        completion_detected_at = CURRENT_TIMESTAMP,
        followup_ai_check_triggered = EXCLUDED.followup_ai_check_triggered,
        followup_ai_check_id = EXCLUDED.followup_ai_check_id
    `;

    await this.pool.query(query, [
      encounterId,
      ezDermToDoId,
      completedStatus,
      followupAiCheckId ? true : false,
      followupAiCheckId || null
    ]);
  }

  /**
   * Check if ToDo completion has already been tracked
   */
  async isToDoCompletionTracked(encounterId: string, ezDermToDoId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 1 FROM todo_completion_tracking 
      WHERE encounter_id = $1 AND ezderm_todo_id = $2 
      LIMIT 1
    `;

    const result = await this.pool.query(query, [encounterId, ezDermToDoId]);
    return result.rows.length > 0;
  }

  /**
   * Get ToDos that need status checking (have not been checked for completion)
   */
  async getToDosForStatusCheck(): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT ct.encounter_id, ct.patient_id, ct.ezderm_todo_id, ct.patient_name,
             ct.subject, ct.created_at
      FROM created_todos ct
      LEFT JOIN todo_completion_tracking tct 
        ON ct.encounter_id = tct.encounter_id AND ct.ezderm_todo_id = tct.ezderm_todo_id
      WHERE tct.id IS NULL
        AND ct.created_at > NOW() - INTERVAL '30 days'
      ORDER BY ct.created_at ASC
      LIMIT 50
    `;

    const result = await this.pool.query(query);
    
    return result.rows.map(row => ({
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      ezDermToDoId: row.ezderm_todo_id,
      patientName: row.patient_name,
      subject: row.subject,
      createdAt: row.created_at
    }));
  }
}

// Export singleton instance
export const vitalSignsDb = new VitalSignsDatabase();
