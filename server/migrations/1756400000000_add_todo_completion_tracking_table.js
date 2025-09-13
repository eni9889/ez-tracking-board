/**
 * Migration: Add todo_completion_tracking table
 * 
 * This migration adds a table to track when we've detected ToDo completion
 * and whether we've triggered follow-up AI checks.
 */

const shorthands = undefined;

async function up(pgm) {
  // Create todo_completion_tracking table
  pgm.createTable('todo_completion_tracking', {
    id: 'id',
    encounter_id: { type: 'text', notNull: true },
    ezderm_todo_id: { type: 'text', notNull: true },
    completed_status: { type: 'varchar(20)', notNull: true },
    completion_detected_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    followup_ai_check_triggered: { type: 'boolean', default: false },
    followup_ai_check_id: { type: 'integer' }
  }, {
    ifNotExists: true
  });

  // Add unique constraint to prevent duplicate completion tracking
  pgm.addConstraint('todo_completion_tracking', 'todo_completion_tracking_encounter_ezderm_unique', {
    unique: ['encounter_id', 'ezderm_todo_id']
  }, {
    ifNotExists: true
  });

  // Add foreign key constraint to note_checks table
  pgm.addConstraint('todo_completion_tracking', 'todo_completion_tracking_followup_ai_check_id_fkey', {
    foreignKeys: {
      columns: 'followup_ai_check_id',
      references: 'note_checks(id)',
      onDelete: 'SET NULL'
    }
  }, {
    ifNotExists: true
  });

  // Create indexes for better performance
  pgm.createIndex('todo_completion_tracking', 'encounter_id', { ifNotExists: true });
  pgm.createIndex('todo_completion_tracking', 'ezderm_todo_id', { ifNotExists: true });
  pgm.createIndex('todo_completion_tracking', ['encounter_id', 'ezderm_todo_id'], { ifNotExists: true });

  console.log('✅ Created todo_completion_tracking table with constraints and indexes');
}

async function down(pgm) {
  // Drop the todo_completion_tracking table
  pgm.dropTable('todo_completion_tracking', { cascade: true });
  
  console.log('✅ Dropped todo_completion_tracking table');
}

module.exports = { up, down, shorthands };
