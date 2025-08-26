import { Pool } from 'pg';

export default {
  id: '20250108000001_initial_schema',
  name: 'Create initial database schema',
  
  async up(pool: Pool): Promise<void> {
    console.log('Creating initial database tables...');
    
    // Create processed_vital_signs table
    await pool.query(`
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
    `);

    // Create user_credentials table
    await pool.query(`
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
    `);

    // Create user_sessions table
    await pool.query(`
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
    `);

    // Create note_checks table
    await pool.query(`
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
    `);

    // Create note_check_queue table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS note_check_queue (
        id SERIAL PRIMARY KEY,
        encounter_id TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0
      )
    `);

    // Create created_todos table
    await pool.query(`
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
    `);

    // Create invalid_issues table
    await pool.query(`
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
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_processed_vital_signs_encounter_id 
      ON processed_vital_signs(encounter_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token 
      ON user_sessions(session_token)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_username 
      ON user_sessions(username)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_note_checks_encounter_id 
      ON note_checks(encounter_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_note_checks_status 
      ON note_checks(status)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_note_check_queue_status 
      ON note_check_queue(status)
    `);

    console.log('✅ Initial schema created successfully');
  },
  
  async down(pool: Pool): Promise<void> {
    console.log('Dropping initial database tables...');
    
    // Drop tables in reverse order to respect foreign key constraints
    await pool.query('DROP TABLE IF EXISTS invalid_issues CASCADE');
    await pool.query('DROP TABLE IF EXISTS created_todos CASCADE');
    await pool.query('DROP TABLE IF EXISTS note_check_queue CASCADE');
    await pool.query('DROP TABLE IF EXISTS note_checks CASCADE');
    await pool.query('DROP TABLE IF EXISTS user_sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS user_credentials CASCADE');
    await pool.query('DROP TABLE IF EXISTS processed_vital_signs CASCADE');
    
    console.log('✅ Initial schema dropped successfully');
  }
};
