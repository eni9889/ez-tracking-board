import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export interface Migration {
  id: string;
  name: string;
  up: (pool: Pool) => Promise<void>;
  down: (pool: Pool) => Promise<void>;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;

  constructor(pool: Pool, migrationsDir: string = path.join(__dirname, 'scripts')) {
    this.pool = pool;
    this.migrationsDir = migrationsDir;
  }

  /**
   * Initialize the schema_migrations table if it doesn't exist
   */
  private async initializeMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_id VARCHAR(255) UNIQUE NOT NULL,
        migration_name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER
      )
    `;
    
    await this.pool.query(query);
    console.log('✅ Schema migrations table initialized');
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    const result = await this.pool.query(
      'SELECT migration_id FROM schema_migrations ORDER BY applied_at'
    );
    return new Set(result.rows.map(row => row.migration_id));
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(migration: Migration, executionTime: number, checksum: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO schema_migrations (migration_id, migration_name, execution_time_ms, checksum) 
       VALUES ($1, $2, $3, $4)`,
      [migration.id, migration.name, executionTime, checksum]
    );
  }

  /**
   * Remove a migration record (for rollback)
   */
  private async removeMigrationRecord(migrationId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM schema_migrations WHERE migration_id = $1',
      [migrationId]
    );
  }

  /**
   * Load migration files from the migrations directory
   */
  private async loadMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      console.log(`Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const fullPath = path.join(this.migrationsDir, file);
      try {
        const migrationModule = require(fullPath);
        const migration = migrationModule.default || migrationModule;
        
        if (migration && typeof migration.up === 'function' && typeof migration.down === 'function') {
          migrations.push(migration);
        } else {
          console.warn(`⚠️  Invalid migration file: ${file} (missing up/down functions)`);
        }
      } catch (error) {
        console.error(`❌ Error loading migration ${file}:`, error);
        throw error;
      }
    }

    return migrations;
  }

  /**
   * Generate checksum for migration content
   */
  private generateChecksum(migration: Migration): string {
    const crypto = require('crypto');
    const content = migration.up.toString() + migration.down.toString();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<void> {
    console.log('🔄 Starting database migrations...');
    
    await this.initializeMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.loadMigrations();
    
    const pendingMigrations = availableMigrations.filter(
      migration => !appliedMigrations.has(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      const startTime = Date.now();
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        console.log(`⬆️  Applying migration: ${migration.id} - ${migration.name}`);
        
        await migration.up(this.pool);
        
        const executionTime = Date.now() - startTime;
        const checksum = this.generateChecksum(migration);
        
        await this.recordMigration(migration, executionTime, checksum);
        
        await client.query('COMMIT');
        
        console.log(`✅ Migration ${migration.id} applied successfully (${executionTime}ms)`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${migration.id} failed:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('🎉 All migrations completed successfully!');
  }

  /**
   * Rollback the last migration
   */
  async rollback(): Promise<void> {
    console.log('🔄 Rolling back last migration...');
    
    await this.initializeMigrationsTable();
    
    const result = await this.pool.query(
      'SELECT migration_id, migration_name FROM schema_migrations ORDER BY applied_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      console.log('ℹ️  No migrations to rollback');
      return;
    }

    const lastMigration = result.rows[0];
    const availableMigrations = await this.loadMigrations();
    const migration = availableMigrations.find(m => m.id === lastMigration.migration_id);

    if (!migration) {
      throw new Error(`Migration file not found for: ${lastMigration.migration_id}`);
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`⬇️  Rolling back migration: ${migration.id} - ${migration.name}`);
      
      await migration.down(this.pool);
      await this.removeMigrationRecord(migration.id);
      
      await client.query('COMMIT');
      
      console.log(`✅ Migration ${migration.id} rolled back successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Rollback failed for ${migration.id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    await this.initializeMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.loadMigrations();
    
    console.log('\n📋 Migration Status:');
    console.log('==================');
    
    for (const migration of availableMigrations) {
      const status = appliedMigrations.has(migration.id) ? '✅ Applied' : '⏳ Pending';
      console.log(`${status} - ${migration.id}: ${migration.name}`);
    }
    
    const pendingCount = availableMigrations.filter(m => !appliedMigrations.has(m.id)).length;
    const appliedCount = availableMigrations.length - pendingCount;
    
    console.log(`\n📊 Summary: ${appliedCount} applied, ${pendingCount} pending`);
  }
}

// Helper function to create a new migration file
export function createMigrationFile(name: string, migrationsDir: string = path.join(__dirname, 'scripts')): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const fileName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.ts`;
  const fullPath = path.join(migrationsDir, fileName);
  
  const template = `import { Pool } from 'pg';

export default {
  id: '${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}',
  name: '${name}',
  
  async up(pool: Pool): Promise<void> {
    // Add your migration logic here
    // Example:
    // await pool.query(\`
    //   ALTER TABLE users 
    //   ADD COLUMN email VARCHAR(255) UNIQUE
    // \`);
  },
  
  async down(pool: Pool): Promise<void> {
    // Add your rollback logic here
    // Example:
    // await pool.query(\`
    //   ALTER TABLE users 
    //   DROP COLUMN email
    // \`);
  }
};
`;

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, template);
  console.log(`✅ Created migration file: ${fullPath}`);
  
  return fullPath;
}
