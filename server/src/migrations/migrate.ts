#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { MigrationRunner, createMigrationFile } from './MigrationRunner';
import { appConfig } from '../config';

async function main() {
  const command = process.argv[2];
  const migrationName = process.argv[3];

  // Create database connection
  const pool = new Pool({
    host: appConfig.database.host,
    port: appConfig.database.port,
    database: appConfig.database.database,
    user: appConfig.database.user,
    password: appConfig.database.password,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const runner = new MigrationRunner(pool);

  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await runner.migrate();
        break;
        
      case 'down':
      case 'rollback':
        await runner.rollback();
        break;
        
      case 'status':
        await runner.status();
        break;
        
      case 'create':
        if (!migrationName) {
          console.error('❌ Migration name is required');
          console.log('Usage: npm run migrate:create "migration name"');
          process.exit(1);
        }
        createMigrationFile(migrationName);
        break;
        
      default:
        console.log('📋 Available commands:');
        console.log('  npm run migrate        - Run pending migrations');
        console.log('  npm run migrate:rollback - Rollback last migration');
        console.log('  npm run migrate:status  - Show migration status');
        console.log('  npm run migrate:create "name" - Create new migration file');
        break;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
