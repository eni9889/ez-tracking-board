import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create processed_vital_signs table
  pgm.createTable('processed_vital_signs', {
    id: 'id',
    encounter_id: { type: 'text', unique: true, notNull: true },
    patient_id: { type: 'text', notNull: true },
    processed_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    source_encounter_id: { type: 'text' },
    height_value: { type: 'real' },
    weight_value: { type: 'real' },
    height_unit: { type: 'text' },
    weight_unit: { type: 'text' },
    success: { type: 'boolean', notNull: true, default: true },
    error_message: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
  });

  // Create user_credentials table
  pgm.createTable('user_credentials', {
    id: 'id',
    username: { type: 'text', unique: true, notNull: true },
    password: { type: 'text', notNull: true },
    server_url: { type: 'text' },
    access_token: { type: 'text' },
    refresh_token: { type: 'text' },
    token_expires_at: { type: 'timestamp' },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
  });

  // Create user_sessions table
  pgm.createTable('user_sessions', {
    id: 'id',
    session_token: { type: 'text', unique: true, notNull: true },
    username: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    expires_at: { type: 'timestamp', notNull: true },
    last_accessed: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    user_agent: { type: 'text' },
    ip_address: { type: 'text' },
    is_active: { type: 'boolean', default: true }
  });

  // Create note_checks table
  pgm.createTable('note_checks', {
    id: 'id',
    encounter_id: { type: 'text', unique: true, notNull: true },
    patient_id: { type: 'text', notNull: true },
    patient_name: { type: 'text', notNull: true },
    chief_complaint: { type: 'text' },
    date_of_service: { type: 'timestamp', notNull: true },
    status: { type: 'varchar(50)', default: 'pending' },
    ai_analysis: { type: 'jsonb' },
    issues_found: { type: 'boolean', default: false },
    checked_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    checked_by: { type: 'varchar(255)', notNull: true },
    error_message: { type: 'text' },
    note_content_md5: { type: 'varchar(32)' },
    note_content: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
  });

  // Create note_check_queue table
  pgm.createTable('note_check_queue', {
    id: 'id',
    encounter_id: { type: 'text', unique: true, notNull: true },
    patient_id: { type: 'text', notNull: true },
    status: { type: 'varchar(50)', default: 'pending' },
    priority: { type: 'integer', default: 1 },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    processed_at: { type: 'timestamp' },
    error_message: { type: 'text' },
    retry_count: { type: 'integer', default: 0 }
  });

  // Create created_todos table
  pgm.createTable('created_todos', {
    id: 'id',
    encounter_id: { type: 'text', notNull: true },
    patient_id: { type: 'text', notNull: true },
    patient_name: { type: 'text', notNull: true },
    ezderm_todo_id: { type: 'text', notNull: true },
    subject: { type: 'text', notNull: true },
    description: { type: 'text', notNull: true },
    assigned_to: { type: 'text', notNull: true },
    assigned_to_name: { type: 'text', notNull: true },
    cc_list: { type: 'jsonb' },
    issues_count: { type: 'integer', default: 0 },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
  });

  // Create invalid_issues table
  pgm.createTable('invalid_issues', {
    id: 'id',
    encounter_id: { type: 'text', notNull: true },
    check_id: { type: 'integer', notNull: true },
    issue_index: { type: 'integer', notNull: true },
    issue_type: { type: 'varchar(100)', notNull: true },
    assessment: { type: 'text', notNull: true },
    issue_hash: { type: 'varchar(64)', notNull: true },
    marked_invalid_by: { type: 'varchar(255)', notNull: true },
    marked_invalid_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    reason: { type: 'text' }
  });

  // Add constraints
  pgm.addConstraint('created_todos', 'created_todos_encounter_ezderm_unique', {
    unique: ['encounter_id', 'ezderm_todo_id']
  });

  pgm.addConstraint('invalid_issues', 'invalid_issues_encounter_check_issue_unique', {
    unique: ['encounter_id', 'check_id', 'issue_index']
  });

  pgm.addConstraint('invalid_issues', 'invalid_issues_check_id_fkey', {
    foreignKeys: {
      columns: 'check_id',
      references: 'note_checks(id)',
      onDelete: 'CASCADE'
    }
  });

  // Create indexes for better performance
  pgm.createIndex('processed_vital_signs', 'encounter_id');
  pgm.createIndex('user_sessions', 'session_token');
  pgm.createIndex('user_sessions', 'username');
  pgm.createIndex('note_checks', 'encounter_id');
  pgm.createIndex('note_checks', 'status');
  pgm.createIndex('note_check_queue', 'status');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop tables in reverse order to respect foreign key constraints
  pgm.dropTable('invalid_issues', { cascade: true });
  pgm.dropTable('created_todos', { cascade: true });
  pgm.dropTable('note_check_queue', { cascade: true });
  pgm.dropTable('note_checks', { cascade: true });
  pgm.dropTable('user_sessions', { cascade: true });
  pgm.dropTable('user_credentials', { cascade: true });
  pgm.dropTable('processed_vital_signs', { cascade: true });
}
