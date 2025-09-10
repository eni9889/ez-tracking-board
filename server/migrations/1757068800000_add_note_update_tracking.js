const shorthands = undefined;

async function up(pgm) {
  // Add note update tracking fields to note_checks table
  pgm.addColumns('note_checks', {
    // Previous MD5 hash to detect content changes
    previous_note_content_md5: { type: 'varchar(32)' },
    
    // Flag to indicate if this check was triggered by a note update
    triggered_by_update: { type: 'boolean', default: false },
    
    // Timestamp when the note was last modified (external system)
    note_last_modified: { type: 'timestamp' },
    
    // Flag to indicate if note needs re-checking due to updates
    needs_recheck: { type: 'boolean', default: false },
    
    // Auto-recheck attempts counter
    auto_recheck_attempts: { type: 'integer', default: 0 },
    
    // Maximum auto-recheck attempts before manual intervention required
    max_auto_recheck_attempts: { type: 'integer', default: 3 }
  });

  // Add index for efficient note update queries
  pgm.createIndex('note_checks', 'needs_recheck');
  pgm.createIndex('note_checks', 'note_content_md5');
  pgm.createIndex('note_checks', 'previous_note_content_md5');
  pgm.createIndex('note_checks', 'triggered_by_update');
}

async function down(pgm) {
  // Remove indexes
  pgm.dropIndex('note_checks', 'triggered_by_update');
  pgm.dropIndex('note_checks', 'previous_note_content_md5');
  pgm.dropIndex('note_checks', 'note_content_md5');
  pgm.dropIndex('note_checks', 'needs_recheck');
  
  // Remove columns
  pgm.dropColumns('note_checks', [
    'previous_note_content_md5',
    'triggered_by_update', 
    'note_last_modified',
    'needs_recheck',
    'auto_recheck_attempts',
    'max_auto_recheck_attempts'
  ]);
}

module.exports = { up, down };
