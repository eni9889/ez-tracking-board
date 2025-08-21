import { Pool, PoolClient, QueryResult } from 'pg';
import { appConfig } from './config';

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
        ssl: appConfig.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test the connection
      const client = await this.pool.connect();
      client.release();
      
      console.log('Connected to PostgreSQL database for vital signs tracking');
      
      // Create tables if they don't exist
      await this.createTables();
    } catch (error) {
      console.error('Error connecting to PostgreSQL database:', error);
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

      // Execute table creation queries
      await client.query(createVitalSignsTableQuery);
      await client.query(createUserCredentialsTableQuery);
      await client.query(createUserSessionsTableQuery);
      await client.query(createNoteChecksTableQuery);
      await client.query(createNoteCheckQueueTableQuery);
      await client.query(createCreatedTodosTableQuery);
      await client.query(createInvalidIssuesTableQuery);

      // Add MD5 and note content columns if they don't exist (migration)
      const addMd5ColumnQuery = `
        ALTER TABLE note_checks 
        ADD COLUMN IF NOT EXISTS note_content_md5 VARCHAR(32),
        ADD COLUMN IF NOT EXISTS note_content TEXT
      `;
      await client.query(addMd5ColumnQuery);

      console.log('Database tables created/verified: processed_vital_signs, user_credentials, user_sessions, note_checks, note_check_queue, created_todos, invalid_issues');
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
  async storeUserCredentials(username: string, password: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = `
      INSERT INTO user_credentials 
      (username, password, updated_at) 
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (username) 
      DO UPDATE SET 
        password = EXCLUDED.password,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [username, password]);
    console.log(`Stored credentials for user: ${username}`);
  }

  async getUserCredentials(username: string): Promise<{ username: string; password: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT username, password FROM user_credentials WHERE username = $1 AND is_active = true';
    const result = await this.pool.query(query, [username]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getActiveUserCredentials(): Promise<{ username: string; password: string } | null> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT username, password FROM user_credentials WHERE is_active = true ORDER BY updated_at DESC LIMIT 1';
    const result = await this.pool.query(query);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async storeTokens(username: string, accessToken: string, refreshToken: string, serverUrl: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    const expiresAt = new Date(Date.now() + 600000); // 10 minutes from now
    const query = `
      UPDATE user_credentials 
      SET access_token = $1, refresh_token = $2, server_url = $3, token_expires_at = $4, updated_at = CURRENT_TIMESTAMP
      WHERE username = $5
    `;

    await this.pool.query(query, [accessToken, refreshToken, serverUrl, expiresAt, username]);
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

    return result.rows[0].id;
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

  async close(): Promise<void> {
    if (this.pool) {
      console.log('Closing PostgreSQL database connection pool');
      await this.pool.end();
      this.pool = null;
      console.log('Database connection pool closed');
    }
  }
}

// Export singleton instance
export const vitalSignsDb = new VitalSignsDatabase();
