const { Pool } = require('pg');

const up = async (pool) => {
  const client = await pool.connect();
  try {
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
    
    await client.query(createToDoCompletionTrackingTableQuery);
    console.log('✅ Created todo_completion_tracking table');
  } finally {
    client.release();
  }
};

const down = async (pool) => {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS todo_completion_tracking CASCADE');
    console.log('✅ Dropped todo_completion_tracking table');
  } finally {
    client.release();
  }
};

module.exports = { up, down };
