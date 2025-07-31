"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vitalSignsDb = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Enable verbose mode for better debugging
const sqlite = sqlite3_1.default.verbose();
class VitalSignsDatabase {
    constructor() {
        this.db = null;
        // Store database in server directory
        this.dbPath = path_1.default.join(__dirname, '../data/vital_signs_tracking.db');
    }
    async initialize() {
        return new Promise((resolve, reject) => {
            // Ensure data directory exists
            const dataDir = path_1.default.dirname(this.dbPath);
            if (!fs_1.default.existsSync(dataDir)) {
                fs_1.default.mkdirSync(dataDir, { recursive: true });
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
    async createTables() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const createTableQuery = `
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
            this.db.run(createTableQuery, (err) => {
                if (err) {
                    console.error('Error creating tables:', err);
                    reject(err);
                    return;
                }
                console.log('Vital signs tracking table created/verified');
                resolve();
            });
        });
    }
    async hasBeenProcessed(encounterId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            const query = 'SELECT COUNT(*) as count FROM processed_vital_signs WHERE encounter_id = ?';
            this.db.get(query, [encounterId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row.count > 0);
            });
        });
    }
    async markAsProcessed(encounterId, patientId, sourceEncounterId, heightValue, weightValue, heightUnit, weightUnit, success = true, errorMessage) {
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
            this.db.run(query, [encounterId, patientId, sourceEncounterId, heightValue, weightValue,
                heightUnit, weightUnit, success, errorMessage], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log(`Marked encounter ${encounterId} as processed for vital signs`);
                resolve();
            });
        });
    }
    async getProcessingStats() {
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
            this.db.get(query, [], (err, row) => {
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
    async close() {
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
exports.vitalSignsDb = new VitalSignsDatabase();
//# sourceMappingURL=database.js.map