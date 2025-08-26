const shorthands = undefined;

async function up(pgm) {
  // Create refresh_tokens table
  pgm.createTable('refresh_tokens', {
    id: 'id',
    refresh_token: { type: 'text', unique: true, notNull: true },
    username: { type: 'text', notNull: true },
    session_token: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    expires_at: { type: 'timestamp', notNull: true },
    is_active: { type: 'boolean', default: true }
  });

  // Add foreign key constraint
  pgm.addConstraint('refresh_tokens', 'refresh_tokens_session_token_fkey', {
    foreignKeys: {
      columns: 'session_token',
      references: 'user_sessions(session_token)',
      onDelete: 'CASCADE'
    }
  });

  // Create indexes for better performance
  pgm.createIndex('refresh_tokens', 'refresh_token');
  pgm.createIndex('refresh_tokens', 'session_token');
  pgm.createIndex('refresh_tokens', 'username');
}

async function down(pgm) {
  // Drop refresh_tokens table
  pgm.dropTable('refresh_tokens', { cascade: true });
}

module.exports = { up, down, shorthands };
