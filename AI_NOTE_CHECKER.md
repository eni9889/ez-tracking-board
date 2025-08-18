# AI Note Checker System

## Overview

The AI Note Checker system automatically reviews incomplete notes from EZDerm before they are signed and sent to billing. It uses Claude AI to analyze progress notes for correctness according to medical coding standards.

## Features

- **Automated Note Fetching**: Retrieves incomplete notes from EZDerm API
- **Intelligent Filtering**: Only processes notes that meet specific criteria:
  - Status: `PENDING_COSIGN`, `CHECKED_OUT`, or `WITH_PROVIDER`
  - Age: More than 2 hours past the date of service
- **AI Analysis**: Uses Claude 3.5 Sonnet to check notes for:
  - Chronicity matching between HPI and Assessment & Plan
  - Complete documentation plans for all assessments
- **Database Tracking**: Stores all check results and analysis for audit trails
- **RESTful API**: Complete REST API for frontend integration

## Environment Setup

### Required Environment Variables

Add these to your `.env` file:

```bash
# Claude AI API Key (required for AI analysis)
CLAUDE_API_KEY=your_claude_api_key_here
```

### Getting a Claude API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Add it to your environment variables

## API Endpoints

### Authentication
All endpoints require authentication using the existing session system.

### Core Endpoints

#### `POST /api/notes/incomplete`
Fetch incomplete notes from EZDerm
```json
{
  "fetchFrom": 0,
  "size": 50,
  "group": "ALL"
}
```

#### `GET /api/notes/eligible`
Get all encounters eligible for AI checking
```json
{
  "success": true,
  "count": 15,
  "encounters": [...]
}
```

#### `GET /api/notes/progress/:encounterId?patientId=xxx`
Get progress note details for specific encounter

#### `POST /api/notes/check/:encounterId`
Trigger AI check for specific note
```json
{
  "patientId": "uuid",
  "patientName": "John Doe",
  "chiefComplaint": "Follow-up",
  "dateOfService": "2025-01-01T10:00:00Z"
}
```

#### `POST /api/notes/check-all`
Process all eligible encounters in batch

#### `GET /api/notes/results?limit=50&offset=0`
Get note check results with pagination

#### `GET /api/notes/result/:encounterId`
Get specific note check result

## Database Schema

### `note_checks` table
- `id`: Primary key
- `encounter_id`: Unique encounter identifier
- `patient_id`: Patient identifier
- `patient_name`: Patient full name
- `chief_complaint`: Chief complaint
- `date_of_service`: Service date
- `status`: Check status (pending, completed, error)
- `ai_analysis`: JSON analysis from Claude AI
- `issues_found`: Boolean flag for issues
- `checked_at`: Timestamp of check
- `checked_by`: Username who triggered check
- `error_message`: Error details if failed

### `note_check_queue` table
- `id`: Primary key
- `encounter_id`: Unique encounter identifier
- `patient_id`: Patient identifier
- `priority`: Processing priority
- `status`: Queue status
- `created_at`: Queue entry timestamp
- `processed_at`: Processing completion timestamp

## AI Analysis Format

The Claude AI returns analysis in this format:

### Success Case
```json
{
  "status": "ok"
}
```

### Issues Found
```json
{
  "issues": [
    {
      "assessment": "Open Wound",
      "issue": "no_explicit_plan",
      "details": {
        "HPI": "Chronic ulcerations described...",
        "A&P": "Listed as 'Open wound' but no management plan",
        "correction": "Add wound care management plan"
      }
    }
  ],
  "status": "corrections_needed",
  "summary": "1 issue found requiring correction"
}
```

## Usage Examples

### Check All Eligible Notes
```bash
curl -X POST http://localhost:5001/api/notes/check-all \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Results
```bash
curl -X GET http://localhost:5001/api/notes/results \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Check Specific Note
```bash
curl -X POST http://localhost:5001/api/notes/check/ENCOUNTER_ID \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-uuid",
    "patientName": "John Doe",
    "chiefComplaint": "Follow-up",
    "dateOfService": "2025-01-01T10:00:00Z"
  }'
```

## Error Handling

The system includes comprehensive error handling:
- API authentication failures
- EZDerm API connectivity issues
- Claude AI API failures
- Database connection problems
- Invalid or malformed progress notes

All errors are logged and stored in the database for troubleshooting.

## Performance Considerations

- **Rate Limiting**: Built-in delays between API calls to respect Claude API limits
- **Batch Processing**: Efficient processing of multiple notes
- **Database Optimization**: Indexed queries for fast result retrieval
- **Caching**: Results are stored to avoid re-processing

## Security & Compliance

- **HIPAA Compliance**: All patient data handling follows HIPAA guidelines
- **Audit Trail**: Complete audit trail of all note checks
- **Access Control**: Requires authenticated session
- **Data Retention**: Configurable retention policies for check results

## Monitoring

The system logs all activities with emojis for easy monitoring:
- 🔍 Starting checks
- ✅ Successful completions
- ❌ Errors and failures
- 📊 Statistics and summaries
- 🤖 AI analysis activities

## Future Enhancements

- Background job queue for automated checking
- Email notifications for issues found
- Dashboard UI for results visualization
- Advanced filtering and search
- Custom AI prompts per specialty
- Integration with billing systems
