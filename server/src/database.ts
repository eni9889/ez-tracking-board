import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Enable verbose mode for better debugging
const sqlite = sqlite3.verbose();

class VitalSignsDatabase {
  private db: sqlite3.Database | null = null;
  private readonly dbPath: string;

  constructor() {
    // Store database in server directory
    this.dbPath = path.join(__dirname, '../data/vital_signs_tracking.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }

        console.log('Connected to SQLite database for vital signs tracking');
        
        // Create tables if they don't exist
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Create processed_vital_signs table
      const createVitalSignsTableQuery = `
        CREATE TABLE IF NOT EXISTS processed_vital_signs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          encounter_id TEXT UNIQUE NOT NULL,
          patient_id TEXT NOT NULL,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          source_encounter_id TEXT,
          height_value REAL,
          weight_value REAL,
          height_unit TEXT,
          weight_unit TEXT,
          success BOOLEAN NOT NULL DEFAULT 1,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create user_credentials table
      const createUserCredentialsTableQuery = `
        CREATE TABLE IF NOT EXISTS user_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          server_url TEXT,
          access_token TEXT,
          refresh_token TEXT,
          token_expires_at DATETIME,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Run both table creation queries
      this.db.run(createVitalSignsTableQuery, (err) => {
        if (err) {
          console.error('Error creating vital signs table:', err);
          reject(err);
          return;
        }

        this.db!.run(createUserCredentialsTableQuery, (err) => {
          if (err) {
            console.error('Error creating user credentials table:', err);
            reject(err);
            return;
          }

          console.log('Database tables created/verified: vital_signs_tracking, user_credentials');
          resolve();
        });
      });
    });
  }

  async hasBeenProcessed(encounterId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT COUNT(*) as count FROM processed_vital_signs WHERE encounter_id = ?';
      
      this.db.get(query, [encounterId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row.count > 0);
      });
    });
  }

  async markAsProcessed(
    encounterId: string,
    patientId: string,
    sourceEncounterId?: string,
    heightValue?: number,
    weightValue?: number,
    heightUnit?: string,
    weightUnit?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        INSERT OR REPLACE INTO processed_vital_signs 
        (encounter_id, patient_id, source_encounter_id, height_value, weight_value, 
         height_unit, weight_unit, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [encounterId, patientId, sourceEncounterId, heightValue, weightValue, 
         heightUnit, weightUnit, success, errorMessage],
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          console.log(`Marked encounter ${encounterId} as processed for vital signs`);
          resolve();
        }
      );
    });
  }

  async getProcessingStats(): Promise<{ total: number; successful: number; failed: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
        FROM processed_vital_signs
      `;
      
      this.db.get(query, [], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          total: row.total || 0,
          successful: row.successful || 0,
          failed: row.failed || 0
        });
      });
    });
  }

  // User credentials management methods
  async storeUserCredentials(username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = `
        INSERT OR REPLACE INTO user_credentials 
        (username, password, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(query, [username, password], (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`Stored credentials for user: ${username}`);
        resolve();
      });
    });
  }

  async getUserCredentials(username: string): Promise<{ username: string; password: string } | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT username, password FROM user_credentials WHERE username = ? AND is_active = 1';
      
      this.db.get(query, [username], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row || null);
      });
    });
  }

  async getActiveUserCredentials(): Promise<{ username: string; password: string } | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT username, password FROM user_credentials WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1';
      
      this.db.get(query, [], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row || null);
      });
    });
  }

  async storeTokens(username: string, accessToken: string, refreshToken: string, serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const expiresAt = new Date(Date.now() + 600000); // 10 minutes from now
      const query = `
        UPDATE user_credentials 
        SET access_token = ?, refresh_token = ?, server_url = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `;

      this.db.run(query, [accessToken, refreshToken, serverUrl, expiresAt.toISOString(), username], (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  async getStoredTokens(username: string): Promise<{ accessToken: string; refreshToken: string; serverUrl: string } | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const query = 'SELECT access_token, refresh_token, server_url, token_expires_at FROM user_credentials WHERE username = ? AND is_active = 1';
      
      this.db.get(query, [username], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row || !row.access_token) {
          resolve(null);
          return;
        }

        // Check if token is expired
        const expiresAt = new Date(row.token_expires_at);
        if (expiresAt < new Date()) {
          console.log('Stored token is expired');
          resolve(null);
          return;
        }

        resolve({
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          serverUrl: row.server_url
        });
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
          return;
        }

        console.log('Database connection closed');
        this.db = null;
        resolve();
      });
    });
  }
}

// Export singleton instance
export const vitalSignsDb = new VitalSignsDatabase();
