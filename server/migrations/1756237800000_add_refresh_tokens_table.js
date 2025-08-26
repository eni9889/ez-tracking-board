const shorthands = undefined;

async function up(pgm) {
  // Create refresh_tokens table (node-pg-migrate handles IF NOT EXISTS automatically)
  pgm.createTable('refresh_tokens', {
    id: 'id',
    refresh_token: { type: 'text', unique: true, notNull: true },
    username: { type: 'text', notNull: true },
    session_token: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    expires_at: { type: 'timestamp', notNull: true },
    is_active: { type: 'boolean', default: true }
  }, {
    ifNotExists: true  // This tells node-pg-migrate to add IF NOT EXISTS
  });

  // Add foreign key constraint (only if table was created)
  pgm.addConstraint('refresh_tokens', 'refresh_tokens_session_token_fkey', {
    foreignKeys: {
      columns: 'session_token',
      references: 'user_sessions(session_token)',
      onDelete: 'CASCADE'
    }
  }, {
    ifNotExists: true
  });

  // Create indexes for better performance (only if they don't exist)
  pgm.createIndex('refresh_tokens', 'refresh_token', { ifNotExists: true });
  pgm.createIndex('refresh_tokens', 'session_token', { ifNotExists: true });
  pgm.createIndex('refresh_tokens', 'username', { ifNotExists: true });
}

async function down(pgm) {
  // Drop refresh_tokens table
  pgm.dropTable('refresh_tokens', { cascade: true });
}

module.exports = { up, down, shorthands };
