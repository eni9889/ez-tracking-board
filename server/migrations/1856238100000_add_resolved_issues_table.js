/**
 * Migration: Add resolved_issues table
 * 
 * This migration adds a table to track issues that have been marked as resolved by users.
 * Similar to invalid_issues but for tracking resolved status.
 */

exports.up = async function(pgm) {
  // Create resolved_issues table
  pgm.createTable('resolved_issues', {
    id: 'id',
    encounter_id: { type: 'text', notNull: true },
    check_id: { type: 'integer', notNull: true },
    issue_index: { type: 'integer', notNull: true },
    issue_type: { type: 'varchar(100)', notNull: true },
    assessment: { type: 'text', notNull: true },
    issue_hash: { type: 'varchar(64)', notNull: true },
    marked_resolved_by: { type: 'varchar(255)', notNull: true },
    marked_resolved_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    reason: { type: 'text' }
  });

  // Add unique constraint to prevent duplicate resolved markings
  pgm.addConstraint('resolved_issues', 'resolved_issues_encounter_check_issue_unique', {
    unique: ['encounter_id', 'check_id', 'issue_index']
  });

  // Add foreign key constraint to note_checks table
  pgm.addConstraint('resolved_issues', 'resolved_issues_check_id_fkey', {
    foreignKeys: {
      columns: 'check_id',
      references: 'note_checks(id)',
      onDelete: 'CASCADE'
    }
  });

  // Create index for better performance
  pgm.createIndex('resolved_issues', 'encounter_id');
  pgm.createIndex('resolved_issues', ['encounter_id', 'check_id']);

  console.log('✅ Created resolved_issues table with constraints and indexes');
};

exports.down = async function(pgm) {
  // Drop the resolved_issues table
  pgm.dropTable('resolved_issues', { cascade: true });
  
  console.log('✅ Dropped resolved_issues table');
};
