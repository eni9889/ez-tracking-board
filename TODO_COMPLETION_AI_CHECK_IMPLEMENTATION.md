# ToDo Completion AI Check Implementation

## Overview

This implementation adds the functionality to automatically trigger a new AI check when a ToDo created for note deficiencies has been completed. This ensures that after staff addresses the issues identified in the original AI check, the system automatically verifies that the fixes have been properly implemented.

## Key Components

### 1. Database Changes

#### New Table: `todo_completion_tracking`
- Tracks when ToDo completions are detected
- Prevents duplicate processing
- Links to follow-up AI checks

```sql
CREATE TABLE todo_completion_tracking (
  id SERIAL PRIMARY KEY,
  encounter_id TEXT NOT NULL,
  ezderm_todo_id TEXT NOT NULL,
  completed_status VARCHAR(20) NOT NULL,
  completion_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  followup_ai_check_triggered BOOLEAN DEFAULT FALSE,
  followup_ai_check_id INTEGER,
  UNIQUE(encounter_id, ezderm_todo_id),
  FOREIGN KEY (followup_ai_check_id) REFERENCES note_checks(id) ON DELETE SET NULL
);
```

#### New Database Functions
- `trackToDoCompletion()` - Records when a ToDo completion is detected
- `isToDoCompletionTracked()` - Checks if completion was already processed
- `getToDosForStatusCheck()` - Gets ToDos that need status checking

### 2. Job Processing

#### New Job Type: `ToDoCompletionCheckJobData`
- Periodically scans for completed ToDos
- Triggers follow-up AI checks when completion is detected

#### New Queue: `todoCompletionCheckQueue`
- Handles ToDo completion checking jobs
- Runs every 15 minutes
- Processes up to 50 ToDos per scan

#### Process Flow
1. **Scan Phase**: Identify ToDos that need status checking
2. **Status Check**: Query EZDerm API for each ToDo's current status
3. **Completion Detection**: Check if status is `COMPLETED` or `CLOSED`
4. **Follow-up Trigger**: If completed and previous AI check exists, queue new AI check with `force=true`
5. **Tracking**: Record completion to prevent duplicate processing

### 3. API Integration

#### New Endpoint: `POST /todos/jobs/completion-check`
- Manually trigger ToDo completion check
- Requires authentication
- Returns scan ID for tracking

#### Enhanced Worker System
- New worker: `todoCompletionCheckWorker`
- Integrated into startup/shutdown procedures
- Proper error handling and logging

### 4. Implementation Details

#### Completion Detection Logic
```typescript
const isCompleted = todoStatus.status === 'COMPLETED' || todoStatus.status === 'CLOSED';

if (isCompleted) {
  // Track this completion
  await vitalSignsDb.trackToDoCompletion(
    todo.encounterId,
    todo.ezDermToDoId,
    todoStatus.status
  );
  
  // Check if there was a previous AI check
  const previousAiCheck = await vitalSignsDb.getNoteCheckResult(todo.encounterId);
  
  if (previousAiCheck) {
    // Queue follow-up AI check with force=true
    await aiNoteCheckQueue.add('todo-completion-followup-check', {
      encounterId: todo.encounterId,
      patientId: todo.patientId,
      patientName: todo.patientName,
      chiefComplaint: 'ToDo Completion Follow-up',
      dateOfService: new Date().toISOString(),
      scanId: `todo-followup-${Date.now()}`,
      force: true
    });
  }
}
```

#### Force AI Check
- Uses `force=true` to bypass MD5 duplicate detection
- Ensures fresh analysis of potentially modified notes
- Proper job staggering to avoid API overload

### 5. Benefits

1. **Automated Verification**: No manual intervention needed to verify fixes
2. **Quality Assurance**: Ensures issues are properly addressed
3. **Audit Trail**: Complete tracking of ToDo lifecycle
4. **Scalable**: Handles multiple ToDos efficiently
5. **Resilient**: Proper error handling and retry logic

### 6. Configuration

#### Timing
- Completion checks run every **15 minutes**
- Follow-up AI checks are staggered by **10 seconds**
- Only processes ToDos created within **30 days**

#### Batch Processing
- Maximum **50 ToDos** processed per scan
- Configurable batch size via job data
- Prevents system overload

### 7. Monitoring

#### Logging
- Comprehensive logging for debugging
- Status tracking for each phase
- Error reporting with context

#### Statistics
- Total ToDos checked
- Completed ToDos found  
- Follow-up checks triggered
- Processing timestamps

### 8. Testing

#### Manual Testing
```bash
# Trigger manual completion check
curl -X POST http://localhost:3001/todos/jobs/completion-check \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### Database Verification
```sql
-- Check completion tracking
SELECT * FROM todo_completion_tracking ORDER BY completion_detected_at DESC;

-- Verify follow-up AI checks
SELECT nc.* FROM note_checks nc 
JOIN todo_completion_tracking tct ON nc.id = tct.followup_ai_check_id
ORDER BY nc.checked_at DESC;
```

## Migration

The implementation includes a migration file:
`migrations/1756400000000_add_todo_completion_tracking_table.js`

Run migrations before deployment:
```bash
npm run migrate
```

## Deployment Notes

1. **Database Migration**: Run migration to create the new table
2. **Worker Restart**: Restart the job processing worker to enable new functionality
3. **Monitoring**: Watch logs for completion check activity
4. **Testing**: Verify with a completed ToDo to ensure follow-up AI checks trigger

The system will automatically start processing ToDo completions once deployed, with no additional configuration required.
