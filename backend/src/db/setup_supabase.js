'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const { initDB, getDB } = require('./database');

const supabaseConfig = {
  host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres.erqhzfnlppmdjktisprp',
  password: process.env.SUPABASE_DB_PASSWORD || 'rajniniranjan@',
  ssl: { rejectUnauthorized: false },
};

const pool = new Pool(supabaseConfig);

const CREATE_TABLES_SQL = `
-- USERS
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK(role IN ('driver', 'manager', 'admin')),
  phone          TEXT,
  avatar_color   TEXT DEFAULT '#6366f1',
  push_token     TEXT,
  vehicle_type   TEXT DEFAULT 'two_wheeler',
  vehicle_number TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DRIVER LOCATIONS
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng         DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed       DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading     DOUBLE PRECISION NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('active', 'idle', 'issue', 'offline')),
  address     TEXT,
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- LOCATION HISTORY
CREATE TABLE IF NOT EXISTS location_history (
  id          SERIAL PRIMARY KEY,
  driver_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  speed       DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading     DOUBLE PRECISION NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DESTINATIONS
CREATE TABLE IF NOT EXISTS destinations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  radius_m    DOUBLE PRECISION NOT NULL DEFAULT 500,
  description TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  is_active   INTEGER NOT NULL DEFAULT 1,
  is_home     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DRIVER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS driver_assignments (
  id              TEXT PRIMARY KEY,
  destination_id  TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  driver_id       TEXT NOT NULL REFERENCES users(id),
  assigned_by     TEXT NOT NULL REFERENCES users(id),
  source_name     TEXT DEFAULT 'Jankalyan Blood Centre (Swargate HQ)',
  source_lat      DOUBLE PRECISION DEFAULT 18.5039,
  source_lng      DOUBLE PRECISION DEFAULT 73.8524,
  urgency         TEXT DEFAULT 'normal' CHECK(urgency IN ('normal', 'urgent', 'emergency')),
  notes           TEXT,
  category        TEXT DEFAULT 'red_blood_cell',
  unit_count      INTEGER DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','accepted','rejected','in_progress','completed','cancelled')),
  assigned_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at     TIMESTAMP WITH TIME ZONE,
  completed_at    TIMESTAMP WITH TIME ZONE,
  rejected_at     TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ISSUES
CREATE TABLE IF NOT EXISTS issues (
  id          TEXT PRIMARY KEY,
  driver_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT DEFAULT 'vehicle_breakdown',
  severity    TEXT DEFAULT 'medium',
  description TEXT NOT NULL,
  image_path  TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- GEOFENCE NOTIFICATIONS
CREATE TABLE IF NOT EXISTS geofence_notifications (
  id              TEXT PRIMARY KEY,
  manager_id      TEXT NOT NULL REFERENCES users(id),
  driver_id       TEXT NOT NULL REFERENCES users(id),
  destination_id  TEXT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  assignment_id   TEXT,
  type            TEXT NOT NULL DEFAULT 'geofence_enter',
  message         TEXT NOT NULL,
  distance_m      DOUBLE PRECISION,
  is_read         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- WORK LOGS
CREATE TABLE IF NOT EXISTS work_logs (
  id                  TEXT PRIMARY KEY,
  assignment_id       TEXT NOT NULL,
  driver_id           TEXT NOT NULL REFERENCES users(id),
  destination_id      TEXT NOT NULL REFERENCES destinations(id),
  source_name         TEXT DEFAULT 'Jankalyan Blood Centre (Swargate HQ)',
  destination_name    TEXT NOT NULL,
  destination_address TEXT,
  urgency             TEXT DEFAULT 'normal',
  category            TEXT DEFAULT 'red_blood_cell',
  unit_count          INTEGER DEFAULT 1,
  notes               TEXT,
  assigned_at         TIMESTAMP WITH TIME ZONE,
  accepted_at         TIMESTAMP WITH TIME ZONE,
  completed_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_mins       INTEGER DEFAULT 0,
  distance_km         DOUBLE PRECISION DEFAULT 0,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- BLOOD CATEGORIES
CREATE TABLE IF NOT EXISTS blood_categories (
  id            TEXT PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_driver_locations_status ON driver_locations(status);
CREATE INDEX IF NOT EXISTS idx_issues_driver ON issues(driver_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_location_history_driver ON location_history(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver ON driver_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_dest ON driver_assignments(destination_id);
CREATE INDEX IF NOT EXISTS idx_geofence_notifications_mgr ON geofence_notifications(manager_id, is_read);
CREATE INDEX IF NOT EXISTS idx_work_logs_driver ON work_logs(driver_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_logs_completed_at ON work_logs(completed_at DESC);

-- ROW LEVEL SECURITY (Protects PostgREST public endpoint while allowing backend DB access)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_categories ENABLE ROW LEVEL SECURITY;
`;

async function setupSupabase() {
  const client = await pool.connect();
  try {
    console.log('⚡ Creating tables on Supabase PostgreSQL...');
    await client.query(CREATE_TABLES_SQL);
    console.log('✅ Supabase PostgreSQL schema initialized successfully!');

    // Initialize SQLite to read existing data for migration
    initDB();
    const sqliteDb = getDB();

    // 1. Migrate Users
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    console.log(`📦 Found ${users.length} users in local SQLite to sync...`);
    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color, push_token, vehicle_type, vehicle_number, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          phone = EXCLUDED.phone,
          vehicle_type = EXCLUDED.vehicle_type,
          vehicle_number = EXCLUDED.vehicle_number
      `, [u.id, u.name, u.email, u.password_hash, u.role, u.phone, u.avatar_color, u.push_token, u.vehicle_type, u.vehicle_number, u.is_active]);
    }

    // 2. Migrate Driver Locations
    const locations = sqliteDb.prepare('SELECT * FROM driver_locations').all();
    for (const l of locations) {
      await client.query(`
        INSERT INTO driver_locations (driver_id, lat, lng, speed, heading, status, address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (driver_id) DO UPDATE SET
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          speed = EXCLUDED.speed,
          heading = EXCLUDED.heading,
          status = EXCLUDED.status,
          address = EXCLUDED.address
      `, [l.driver_id, l.lat, l.lng, l.speed, l.heading, l.status, l.address]);
    }

    // 3. Migrate Destinations
    const destinations = sqliteDb.prepare('SELECT * FROM destinations').all();
    console.log(`📍 Found ${destinations.length} destinations to sync...`);
    for (const d of destinations) {
      await client.query(`
        INSERT INTO destinations (id, name, address, lat, lng, radius_m, description, created_by, is_active, is_home)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          radius_m = EXCLUDED.radius_m,
          description = EXCLUDED.description,
          is_home = EXCLUDED.is_home
      `, [d.id, d.name, d.address, d.lat, d.lng, d.radius_m, d.description, d.created_by, d.is_active, d.is_home]);
    }

    // 4. Migrate Blood Categories
    const categories = sqliteDb.prepare('SELECT * FROM blood_categories').all();
    console.log(`🩸 Found ${categories.length} blood categories to sync...`);
    for (const c of categories) {
      await client.query(`
        INSERT INTO blood_categories (id, code, name, description, is_active, display_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          display_order = EXCLUDED.display_order
      `, [c.id, c.code, c.name, c.description, c.is_active, c.display_order]);
    }

    // 5. Migrate Assignments (if any)
    const assignments = sqliteDb.prepare('SELECT * FROM driver_assignments').all();
    console.log(`📋 Found ${assignments.length} assignments to sync...`);
    for (const a of assignments) {
      await client.query(`
        INSERT INTO driver_assignments (id, destination_id, driver_id, assigned_by, source_name, source_lat, source_lng, urgency, notes, category, unit_count, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          category = EXCLUDED.category,
          unit_count = EXCLUDED.unit_count
      `, [a.id, a.destination_id, a.driver_id, a.assigned_by, a.source_name, a.source_lat, a.source_lng, a.urgency, a.notes, a.category, a.unit_count, a.status]);
    }

    // Check counts on Supabase
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const destCount = await client.query('SELECT COUNT(*) FROM destinations');
    const catCount = await client.query('SELECT COUNT(*) FROM blood_categories');

    console.log('\n🎉 ALL TABLES CREATED & SYNCED TO SUPABASE POSTGRESQL:');
    console.log(`   - Users: ${userCount.rows[0].count}`);
    console.log(`   - Destinations: ${destCount.rows[0].count}`);
    console.log(`   - Blood Categories: ${catCount.rows[0].count}`);

  } catch (err) {
    console.error('❌ Supabase setup error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupSupabase();
