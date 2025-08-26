const shorthands = undefined;

async function up(pgm) {
  // Check if refresh_tokens table already exists
  const tableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'refresh_tokens'
    );
  `);

  if (!tableExists.rows[0].exists) {
    // Create refresh_tokens table only if it doesn't exist
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
    
    console.log('Created refresh_tokens table with constraints and indexes');
  } else {
    console.log('refresh_tokens table already exists, skipping creation');
  }
}

async function down(pgm) {
  // Drop refresh_tokens table
  pgm.dropTable('refresh_tokens', { cascade: true });
}

module.exports = { up, down, shorthands };
