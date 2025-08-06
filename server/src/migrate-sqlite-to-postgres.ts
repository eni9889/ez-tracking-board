#!/usr/bin/env ts-node

/**
 * Migration script to move data from SQLite to PostgreSQL
 * 
 * Usage:
 * 1. Ensure your PostgreSQL database is set up and running
 * 2. Set your PostgreSQL connection details in environment variables
 * 3. Place your SQLite database file at the specified path
 * 4. Run: npx ts-node src/migrate-sqlite-to-postgres.ts
 */

import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

interface ProcessedVitalSign {
  id: number;
  encounter_id: string;
  patient_id: string;
  processed_at: string;
  source_encounter_id: string | null;
  height_value: number | null;
  weight_value: number | null;
  height_unit: string | null;
  weight_unit: string | null;
  success: number; // SQLite uses 0/1 for boolean
  error_message: string | null;
  created_at: string;
}

interface UserCredential {
  id: number;
  username: string;
  password: string;
  server_url: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: number; // SQLite uses 0/1 for boolean
  created_at: string;
  updated_at: string;
}

interface UserSession {
  id: number;
  session_token: string;
  username: string;
  created_at: string;
  expires_at: string;
  last_accessed: string;
  user_agent: string | null;
  ip_address: string | null;
  is_active: number; // SQLite uses 0/1 for boolean
}

class SQLiteToPostgreSQLMigrator {
  private sqliteDb: sqlite3.Database | null = null;
  private pgPool: Pool | null = null;
  private sqlitePath: string;

  constructor(sqlitePath?: string) {
    this.sqlitePath = sqlitePath || path.join(__dirname, '../data/vital_signs_tracking.db');
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing migration...');

    // Initialize PostgreSQL connection
    this.pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'vital_signs_tracking',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    // Test PostgreSQL connection
    try {
      const client = await this.pgPool.connect();
      client.release();
      console.log('✅ PostgreSQL connection established');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }

    // Initialize SQLite connection
    return new Promise<void>((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(this.sqlitePath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          console.error('❌ Failed to connect to SQLite:', err);
          reject(err);
          return;
        }
        console.log('✅ SQLite connection established');
        resolve();
      });
    });
  }

  private async readSQLiteTable<T>(tableName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.sqliteDb) {
        reject(new Error('SQLite database not initialized'));
        return;
      }

             const query = `SELECT * FROM ${tableName}`;
       this.sqliteDb.all(query, [], (err: Error | null, rows: T[]) => {
         if (err) {
           reject(err);
           return;
         }
         resolve(rows || []);
       });
    });
  }

  private async migrateProcessedVitalSigns(): Promise<void> {
    console.log('📊 Migrating processed_vital_signs...');

    try {
      const records = await this.readSQLiteTable<ProcessedVitalSign>('processed_vital_signs');
      console.log(`Found ${records.length} records in processed_vital_signs`);

      if (records.length === 0) {
        console.log('No records to migrate in processed_vital_signs');
        return;
      }

      const query = `
        INSERT INTO processed_vital_signs 
        (encounter_id, patient_id, processed_at, source_encounter_id, height_value, weight_value, 
         height_unit, weight_unit, success, error_message, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (encounter_id) DO NOTHING
      `;

      let migrated = 0;
      for (const record of records) {
        try {
          await this.pgPool!.query(query, [
            record.encounter_id,
            record.patient_id,
            record.processed_at,
            record.source_encounter_id,
            record.height_value,
            record.weight_value,
            record.height_unit,
            record.weight_unit,
            record.success === 1, // Convert SQLite integer to boolean
            record.error_message,
            record.created_at
          ]);
          migrated++;
        } catch (error) {
          console.warn(`Failed to migrate vital signs record ${record.id}:`, error);
        }
      }

      console.log(`✅ Migrated ${migrated}/${records.length} processed_vital_signs records`);
    } catch (error) {
      console.error('❌ Error migrating processed_vital_signs:', error);
      throw error;
    }
  }

  private async migrateUserCredentials(): Promise<void> {
    console.log('👤 Migrating user_credentials...');

    try {
      const records = await this.readSQLiteTable<UserCredential>('user_credentials');
      console.log(`Found ${records.length} records in user_credentials`);

      if (records.length === 0) {
        console.log('No records to migrate in user_credentials');
        return;
      }

      const query = `
        INSERT INTO user_credentials 
        (username, password, server_url, access_token, refresh_token, token_expires_at, 
         is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (username) DO UPDATE SET
          password = EXCLUDED.password,
          server_url = EXCLUDED.server_url,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `;

      let migrated = 0;
      for (const record of records) {
        try {
          await this.pgPool!.query(query, [
            record.username,
            record.password,
            record.server_url,
            record.access_token,
            record.refresh_token,
            record.token_expires_at,
            record.is_active === 1, // Convert SQLite integer to boolean
            record.created_at,
            record.updated_at
          ]);
          migrated++;
        } catch (error) {
          console.warn(`Failed to migrate user credentials record ${record.id}:`, error);
        }
      }

      console.log(`✅ Migrated ${migrated}/${records.length} user_credentials records`);
    } catch (error) {
      console.error('❌ Error migrating user_credentials:', error);
      throw error;
    }
  }

  private async migrateUserSessions(): Promise<void> {
    console.log('🔐 Migrating user_sessions...');

    try {
      const records = await this.readSQLiteTable<UserSession>('user_sessions');
      console.log(`Found ${records.length} records in user_sessions`);

      if (records.length === 0) {
        console.log('No records to migrate in user_sessions');
        return;
      }

      // Only migrate active, non-expired sessions
      const activeRecords = records.filter(record => {
        const isActive = record.is_active === 1;
        const isNotExpired = new Date(record.expires_at) > new Date();
        return isActive && isNotExpired;
      });

      console.log(`Found ${activeRecords.length} active, non-expired sessions to migrate`);

      if (activeRecords.length === 0) {
        console.log('No active sessions to migrate');
        return;
      }

      const query = `
        INSERT INTO user_sessions 
        (session_token, username, created_at, expires_at, last_accessed, user_agent, ip_address, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_token) DO NOTHING
      `;

      let migrated = 0;
      for (const record of activeRecords) {
        try {
          await this.pgPool!.query(query, [
            record.session_token,
            record.username,
            record.created_at,
            record.expires_at,
            record.last_accessed,
            record.user_agent,
            record.ip_address,
            record.is_active === 1 // Convert SQLite integer to boolean
          ]);
          migrated++;
        } catch (error) {
          console.warn(`Failed to migrate user session record ${record.id}:`, error);
        }
      }

      console.log(`✅ Migrated ${migrated}/${activeRecords.length} user_sessions records`);
    } catch (error) {
      console.error('❌ Error migrating user_sessions:', error);
      throw error;
    }
  }

  async migrate(): Promise<void> {
    console.log('🔄 Starting migration from SQLite to PostgreSQL...');

    try {
      await this.initialize();

      // Migrate each table
      await this.migrateProcessedVitalSigns();
      await this.migrateUserCredentials();
      await this.migrateUserSessions();

      console.log('🎉 Migration completed successfully!');
    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up connections...');

         if (this.sqliteDb) {
       await new Promise<void>((resolve) => {
         this.sqliteDb!.close((err: Error | null) => {
           if (err) {
             console.warn('Warning: Error closing SQLite connection:', err);
           }
           resolve();
         });
       });
     }

    if (this.pgPool) {
      await this.pgPool.end();
    }

    console.log('✅ Cleanup completed');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migrator = new SQLiteToPostgreSQLMigrator();
  
  migrator.migrate()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { SQLiteToPostgreSQLMigrator }; 