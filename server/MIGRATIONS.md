# Database Migrations Guide

This document explains how to manage database schema changes using our migration system.

## Overview

The migration system provides a structured way to:
- Track database schema changes over time
- Apply changes consistently across environments
- Rollback changes when needed
- Ensure all team members have the same database structure

## Migration Files

Migration files are stored in `src/migrations/scripts/` and follow this naming convention:
```
YYYYMMDDHHMMSS_migration_name.ts
```

Example: `20250108120000_add_user_email_column.ts`

## Creating Migrations

### 1. Create a New Migration

```bash
# Development
npm run migrate:create "add user email column"

# This creates a file like: 20250108120000_add_user_email_column.ts
```

### 2. Edit the Migration File

```typescript
import { Pool } from 'pg';

export default {
  id: '20250108120000_add_user_email_column',
  name: 'Add email column to users table',
  
  async up(pool: Pool): Promise<void> {
    await pool.query(`
      ALTER TABLE user_credentials 
      ADD COLUMN email VARCHAR(255) UNIQUE
    `);
    
    await pool.query(`
      CREATE INDEX idx_user_credentials_email 
      ON user_credentials(email)
    `);
  },
  
  async down(pool: Pool): Promise<void> {
    await pool.query(`
      DROP INDEX IF EXISTS idx_user_credentials_email
    `);
    
    await pool.query(`
      ALTER TABLE user_credentials 
      DROP COLUMN email
    `);
  }
};
```

## Running Migrations

### Development

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback
```

### Production

Migrations run automatically when the application starts in production mode (`NODE_ENV=production`).

You can also run them manually:
```bash
npm run migrate:prod
```

## Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run pending migrations |
| `npm run migrate:status` | Show migration status |
| `npm run migrate:rollback` | Rollback last migration |
| `npm run migrate:create "name"` | Create new migration file |
| `npm run migrate:prod` | Run migrations in production |

## Migration Best Practices

### 1. Always Write Both Up and Down

Every migration must have both `up` (apply) and `down` (rollback) functions.

### 2. Make Migrations Idempotent

Use `IF EXISTS` and `IF NOT EXISTS` when possible:

```sql
-- Good
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Bad (will fail if column exists)
ALTER TABLE users ADD COLUMN email VARCHAR(255);
```

### 3. Use Transactions

Migrations automatically run in transactions, but be aware of DDL limitations in PostgreSQL.

### 4. Test Rollbacks

Always test that your `down` function properly reverses the `up` function:

```bash
npm run migrate          # Apply migration
npm run migrate:rollback # Test rollback
npm run migrate          # Apply again
```

### 5. Backward Compatibility

When possible, make migrations backward compatible:

```typescript
// Good: Add column with default value
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';

// Better: Add column as nullable first, then update, then make NOT NULL
// Migration 1: Add nullable column
ALTER TABLE users ADD COLUMN status VARCHAR(20);

// Migration 2: Update existing rows
UPDATE users SET status = 'active' WHERE status IS NULL;

// Migration 3: Make column NOT NULL
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

### 6. Data Migrations

For data migrations, consider the impact on large tables:

```typescript
// For large tables, consider batching
async up(pool: Pool): Promise<void> {
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const result = await pool.query(`
      UPDATE users 
      SET status = 'active' 
      WHERE status IS NULL 
        AND id IN (
          SELECT id FROM users 
          WHERE status IS NULL 
          ORDER BY id 
          LIMIT $1 OFFSET $2
        )
    `, [batchSize, offset]);
    
    if (result.rowCount === 0) break;
    offset += batchSize;
    
    // Add delay to reduce load
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

## Schema Migrations Table

The system uses a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_id VARCHAR(255) UNIQUE NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL,
  execution_time_ms INTEGER
);
```

## Deployment Strategy

### DigitalOcean App Platform

1. **Automatic Migrations**: Migrations run automatically on app startup in production
2. **Zero-Downtime**: New migrations are applied before the new app version starts
3. **Rollback Safety**: Always test rollbacks in staging first

### Local Development

1. **Manual Control**: Run migrations manually using npm scripts
2. **Easy Rollbacks**: Test rollbacks frequently during development
3. **Fresh Starts**: Drop and recreate database when needed

## Troubleshooting

### Migration Fails

1. Check the error message in logs
2. Verify database connectivity
3. Check if migration was partially applied
4. Fix the migration and try again

### Rollback Fails

1. Manually inspect database state
2. Create a new migration to fix the issue
3. Never edit existing migration files

### Missing Migration Files

If a migration is recorded but the file is missing:

```sql
-- Remove from migrations table (use carefully!)
DELETE FROM schema_migrations 
WHERE migration_id = 'missing_migration_id';
```

### Reset Migrations (Development Only)

```bash
# Drop all tables and start fresh
npm run migrate:create "reset_all_tables"
# Edit the migration to drop all tables
npm run migrate
```

## Examples

### Adding a New Table

```typescript
async up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await pool.query(`
    CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id)
  `);
}

async down(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS user_profiles CASCADE');
}
```

### Adding an Index

```typescript
async up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE INDEX CONCURRENTLY idx_note_checks_date_created 
    ON note_checks(date_of_service, created_at)
  `);
}

async down(pool: Pool): Promise<void> {
  await pool.query('DROP INDEX IF EXISTS idx_note_checks_date_created');
}
```

### Modifying Column Type

```typescript
async up(pool: Pool): Promise<void> {
  // Safely change column type
  await pool.query('ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(50)');
}

async down(pool: Pool): Promise<void> {
  // Make sure this is safe for your data
  await pool.query('ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(20)');
}
```

## See Also

- [Database Schema](../src/database.ts) - Current table definitions
- [Migration Runner](../src/migrations/MigrationRunner.ts) - Migration system implementation
- [DigitalOcean Deployment](../../.do/app.yaml) - Production deployment configuration
