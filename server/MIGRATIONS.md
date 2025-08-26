# Database Migrations Guide

This document explains how to manage database schema changes using `node-pg-migrate`.

## Overview

We use [node-pg-migrate](https://github.com/theoephraim/node-pg-migrate) for database migrations, which provides:
- Track database schema changes over time
- Apply changes consistently across environments
- Rollback changes when needed
- Ensure all team members have the same database structure
- Battle-tested PostgreSQL-specific migration framework

## Migration Files

Migration files are stored in `migrations/` and follow this naming convention:
```
TIMESTAMP_migration_name.ts
```

Example: `1704672000000_add_user_email_column.ts`

## Creating Migrations

### 1. Create a New Migration

```bash
# Create a TypeScript migration
npm run migrate:create "add user email column" -- --migration-file-language ts

# This creates a file like: 1704672000000_add_user_email_column.ts
```

### 2. Edit the Migration File

```typescript
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('user_credentials', {
    email: { type: 'varchar(255)', unique: true }
  });
  
  pgm.createIndex('user_credentials', 'email');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('user_credentials', 'email');
  pgm.dropColumns('user_credentials', ['email']);
}
```

## Running Migrations

### Development

```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Redo last migration (down then up)
npm run migrate:redo

# Show what would be run (without executing)
npm run migrate:dry-run
```

### Production

Migrations run automatically when the application starts in production mode (`NODE_ENV=production`).

You can also run them manually:
```bash
npm run migrate
```

## Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run pending migrations |
| `npm run migrate:up` | Run pending migrations (same as migrate) |
| `npm run migrate:down` | Rollback last migration |
| `npm run migrate:redo` | Redo last migration (down then up) |
| `npm run migrate:create "name"` | Create new migration file |
| `npm run migrate:dry-run` | Show what would be executed without running |

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
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('user_profiles', {
    id: 'id',
    user_id: { 
      type: 'integer', 
      notNull: true,
      references: 'user_credentials(id)',
      onDelete: 'CASCADE'
    },
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' },
    phone: { type: 'varchar(20)' },
    created_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', default: pgm.func('CURRENT_TIMESTAMP') }
  });
  
  pgm.createIndex('user_profiles', 'user_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('user_profiles', { cascade: true });
}
```

### Adding an Index

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createIndex('note_checks', ['date_of_service', 'created_at'], {
    name: 'idx_note_checks_date_created',
    concurrently: true
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('note_checks', ['date_of_service', 'created_at'], {
    name: 'idx_note_checks_date_created'
  });
}
```

### Modifying Column Type

```typescript
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('users', 'phone', { type: 'varchar(50)' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('users', 'phone', { type: 'varchar(20)' });
}
```

## See Also

- [node-pg-migrate Documentation](https://github.com/theoephraim/node-pg-migrate) - Complete API reference
- [Database Schema](../src/database.ts) - Current table definitions
- [Migration Configuration](../.pgmigrate.json) - Migration settings
- [DigitalOcean Deployment](../../.do/app.yaml) - Production deployment configuration
