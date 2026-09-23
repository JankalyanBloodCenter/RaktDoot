'use strict';
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(process.env.DB_PATH || './delivery.db');

/** @type {import('node-sqlite3-wasm').Database} */
let db;

function initDB() {
  db = new Database(DB_PATH);

  // Performance pragmas
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');
  db.run('PRAGMA synchronous=NORMAL');
  db.run('PRAGMA cache_size=-32000');

  // Create schema — split by semicolon and run each statement
  const schemaSQL = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
  const statements = schemaSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  for (const stmt of statements) {
    db.run(stmt);
  }

  // Safe schema migrations for issues table and new features
  try { db.run('ALTER TABLE issues ADD COLUMN type TEXT DEFAULT "vehicle_breakdown"'); } catch (_) {}
  try { db.run('ALTER TABLE issues ADD COLUMN severity TEXT DEFAULT "medium"'); } catch (_) {}
  try { db.run('ALTER TABLE issues ADD COLUMN address TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE destinations ADD COLUMN radius_m REAL NOT NULL DEFAULT 500'); } catch (_) {}
  try { db.run('ALTER TABLE destinations ADD COLUMN address TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE destinations ADD COLUMN description TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE destinations ADD COLUMN is_home INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN status TEXT NOT NULL DEFAULT "pending"'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN source_name TEXT DEFAULT "Jankalyan Blood Centre (Swargate HQ)"'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN source_lat REAL DEFAULT 18.5039'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN source_lng REAL DEFAULT 73.8524'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN urgency TEXT DEFAULT "normal"'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN notes TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN category TEXT DEFAULT "red_blood_cell"'); } catch (_) {}
  try { db.run('ALTER TABLE driver_assignments ADD COLUMN unit_count INTEGER DEFAULT 1'); } catch (_) {}
  try { db.run('ALTER TABLE users ADD COLUMN push_token TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE users ADD COLUMN vehicle_type TEXT DEFAULT "two_wheeler"'); } catch (_) {}
  try { db.run('ALTER TABLE users ADD COLUMN vehicle_number TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE geofence_notifications ADD COLUMN distance_m REAL'); } catch (_) {}
  try {
    db.run(`
      DELETE FROM geofence_notifications
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM geofence_notifications
        GROUP BY COALESCE(assignment_id, id), type, message
      )
    `);
  } catch (_) {}

  try {
    db.run(`
      DELETE FROM work_logs
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM work_logs
        GROUP BY CASE
          WHEN assignment_id IS NOT NULL AND assignment_id != '' THEN assignment_id
          ELSE driver_id || '_' || destination_id || '_' || substr(completed_at, 1, 16)
        END
      )
    `);
  } catch (_) {}

  // Work Logs Table for completed delivery & collection task records
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS work_logs (
        id                  TEXT PRIMARY KEY,
        assignment_id       TEXT NOT NULL,
        driver_id           TEXT NOT NULL,
        destination_id      TEXT NOT NULL,
        source_name         TEXT DEFAULT 'Jankalyan Blood Centre (Swargate HQ)',
        destination_name    TEXT NOT NULL,
        destination_address TEXT,
        urgency             TEXT DEFAULT 'normal',
        category            TEXT DEFAULT 'red_blood_cell',
        unit_count          INTEGER DEFAULT 1,
        notes               TEXT,
        assigned_at         TEXT,
        accepted_at         TEXT,
        completed_at        TEXT NOT NULL DEFAULT (datetime('now')),
        duration_mins       INTEGER DEFAULT 0,
        distance_km         REAL DEFAULT 0,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (driver_id) REFERENCES users(id),
        FOREIGN KEY (destination_id) REFERENCES destinations(id)
      )
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_work_logs_driver ON work_logs(driver_id, completed_at DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_work_logs_completed_at ON work_logs(completed_at DESC)');
  } catch (err) {
    console.warn('[DB] work_logs table init warning:', err.message);
  }
  try { db.run('ALTER TABLE work_logs ADD COLUMN category TEXT DEFAULT "red_blood_cell"'); } catch (_) {}
  try { db.run('ALTER TABLE work_logs ADD COLUMN unit_count INTEGER DEFAULT 1'); } catch (_) {}

  // Blood Categories Table (Manageable & Editable by Admin)
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS blood_categories (
        id            TEXT PRIMARY KEY,
        code          TEXT UNIQUE NOT NULL,
        name          TEXT NOT NULL,
        description   TEXT,
        is_active     INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Seed default categories if empty
    const catCheck = db.prepare('SELECT COUNT(*) as count FROM blood_categories');
    const catCount = catCheck.get()?.count || 0;
    catCheck.finalize();

    if (catCount === 0) {
      const defaultCategories = [
        { id: 'bcat-plasma', code: 'plasma', name: 'Plasma', description: 'Fresh Frozen Plasma (FFP)', order: 1 },
        { id: 'bcat-rbc', code: 'red_blood_cell', name: 'Red Blood Cell', description: 'Packed Red Blood Cells (PRBC)', order: 2 },
        { id: 'bcat-cryo', code: 'cryo', name: 'Cryo', description: 'Cryoprecipitate Antihemophilic Factor', order: 3 },
        { id: 'bcat-platelets', code: 'platelets', name: 'Platelets', description: 'Single Donor Platelets / Random Donor (SDP / RDP)', order: 4 },
      ];

      for (const cat of defaultCategories) {
        db.run(
          'INSERT OR IGNORE INTO blood_categories (id, code, name, description, display_order, is_active) VALUES (?, ?, ?, ?, ?, 1)',
          [cat.id, cat.code, cat.name, cat.description, cat.order]
        );
      }
      console.log('🩸 Default blood categories seeded (Plasma, Red Blood Cell, Cryo, Platelets)');
    }
  } catch (err) {
    console.warn('[DB] blood_categories table init warning:', err.message);
  }

  // Ensure permanent Home Location (Jankalyan Blood Centre HQ, Swargate, Pune) is configured
  try {
    const homeStmt = db.prepare("SELECT id FROM destinations WHERE is_home = 1 OR id = 'dest-home-001'");
    const existingHome = homeStmt.get();
    homeStmt.finalize();

    if (!existingHome) {
      const insStmt = db.prepare(`
        INSERT INTO destinations (id, name, address, lat, lng, radius_m, description, created_by, is_active, is_home)
        VALUES (
          'dest-home-001',
          'Jankalyan Blood Centre (Home Base)',
          'Jankalyan Blood Donation Building, Swargate, Pune, Maharashtra 411042',
          18.5039,
          73.8524,
          500,
          'Central Blood Bank & Donation Building. Dispatch starting point and manager operations center.',
          'user-mgr-001',
          1,
          1
        )
      `);
      insStmt.run();
      insStmt.finalize();
      console.log('[DB] Permanent Home Base (Swargate Pune HQ) initialized');
    } else {
      // Update coordinates to Pune Swargate if previously set to Mumbai
      db.run(`
        UPDATE destinations SET
          name = 'Jankalyan Blood Centre (Home Base)',
          address = 'Jankalyan Blood Donation Building, Swargate, Pune, Maharashtra 411042',
          lat = 18.5039,
          lng = 73.8524,
          is_home = 1
        WHERE id = 'dest-home-001' OR is_home = 1
      `);
    }

    // Auto-seed key Pune hospitals for instant collection workflow
    const puneHospitals = [
      {
        id: 'dest-pune-sancheti',
        name: 'Sancheti Hospital',
        address: '16, Shivajinagar, Pune, Maharashtra 411005',
        lat: 18.5312,
        lng: 73.8528,
        radius_m: 500,
        description: 'Speciality Orthopaedic & Trauma Centre, Shivajinagar',
      },
      {
        id: 'dest-pune-rubyhall',
        name: 'Ruby Hall Clinic',
        address: '40, Sassoon Rd, Sangamvadi, Pune, Maharashtra 411001',
        lat: 18.5326,
        lng: 73.8783,
        radius_m: 600,
        description: 'Major Super-Speciality Hospital & Research Centre, Pune Station',
      },
      {
        id: 'dest-pune-deenanath',
        name: 'Deenanath Mangeshkar Hospital',
        address: 'Near Mhatre Bridge, Erandwane, Pune, Maharashtra 411004',
        lat: 18.4996,
        lng: 73.8290,
        radius_m: 500,
        description: 'Multi-speciality Hospital & Blood Transfusion Centre, Erandwane',
      },
      {
        id: 'dest-pune-jehangir',
        name: 'Jehangir Hospital',
        address: '32, Sassoon Rd, Central Railway Colony, Pune, Maharashtra 411001',
        lat: 18.5284,
        lng: 73.8744,
        radius_m: 500,
        description: 'Acute Care & Emergency Medical Services, Sassoon Road',
      },
    ];

    for (const h of puneHospitals) {
      const chk = db.prepare('SELECT id FROM destinations WHERE id = ?');
      const found = chk.get([h.id]);
      chk.finalize();
      if (!found) {
        const ins = db.prepare(`
          INSERT INTO destinations (id, name, address, lat, lng, radius_m, description, created_by, is_active, is_home)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'user-mgr-001', 1, 0)
        `);
        ins.run([h.id, h.name, h.address, h.lat, h.lng, h.radius_m, h.description]);
        ins.finalize();
        console.log(`[DB] Seeded Pune hospital: ${h.name}`);
      }
    }
  } catch (err) {
    console.warn('[DB] Destination init check warning:', err.message);
  }

  console.log(`[DB] SQLite (WASM) initialized at: ${DB_PATH}`);
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

/**
 * Returns multiple rows as array of objects.
 * @param {string} sql
 * @param {any[]} params
 */
function dbAll(sql, params = []) {
  const stmt = getDB().prepare(sql);
  const rows = stmt.all(params);
  stmt.finalize();
  return rows;
}

/**
 * Returns single row or undefined.
 * @param {string} sql
 * @param {any[]} params
 */
function dbGet(sql, params = []) {
  const stmt = getDB().prepare(sql);
  const row = stmt.get(params);
  stmt.finalize();
  return row;
}

/**
 * Executes a mutation (INSERT/UPDATE/DELETE).
 * @param {string} sql
 * @param {any[]} params
 */
function dbRun(sql, params = []) {
  const stmt = getDB().prepare(sql);
  stmt.run(params);
  stmt.finalize();
}

/**
 * Execute multiple operations in a transaction.
 * @param {() => void} fn
 */
function dbTransaction(fn) {
  getDB().run('BEGIN');
  try {
    fn();
    getDB().run('COMMIT');
  } catch (err) {
    getDB().run('ROLLBACK');
    throw err;
  }
}

module.exports = { initDB, getDB, dbAll, dbGet, dbRun, dbTransaction };
