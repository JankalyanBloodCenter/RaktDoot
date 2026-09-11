'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const { getDB } = require('./database');

let pool = null;
let syncInterval = null;

function isSupabaseConfigured() {
  return !!(
    process.env.SUPABASE_DB_HOST ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_USER
  );
}

function getPool() {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
  } else {
    pool = new Pool({
      host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-northeast-2.pooler.supabase.com',
      port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
      database: process.env.SUPABASE_DB_NAME || 'postgres',
      user: process.env.SUPABASE_DB_USER || 'postgres.erqhzfnlppmdjktisprp',
      password: process.env.SUPABASE_DB_PASSWORD || 'rajniniranjan@',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
  }

  pool.on('error', (err) => {
    console.warn('[Supabase Sync] Pool background error (handled):', err.message);
  });

  pool.on('connect', (client) => {
    client.on('error', (err) => {
      console.warn('[Supabase Sync] Client connection drop (handled):', err.message);
    });
  });

  return pool;
}

/**
 * Hydrates local SQLite from Supabase PostgreSQL on startup.
 * Ensures persistence even when Render or cloud containers restart.
 */
async function pullFromSupabase() {
  const p = getPool();
  const client = await p.connect();
  const sqlite = getDB();

  try {
    console.log('[Supabase Sync] 🔄 Pulling latest cloud state into local storage...');

    // 1. Users
    const uRes = await client.query('SELECT * FROM users');
    for (const u of uRes.rows) {
      sqlite.run(
        `INSERT OR REPLACE INTO users (id, name, email, password_hash, role, phone, avatar_color, push_token, vehicle_type, vehicle_number, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.name, u.email, u.password_hash, u.role, u.phone, u.avatar_color, u.push_token, u.vehicle_type, u.vehicle_number, u.is_active]
      );
    }

    // 2. Destinations
    const dRes = await client.query('SELECT * FROM destinations');
    for (const d of dRes.rows) {
      sqlite.run(
        `INSERT OR REPLACE INTO destinations (id, name, address, lat, lng, radius_m, description, created_by, is_active, is_home)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.name, d.address, d.lat, d.lng, d.radius_m, d.description, d.created_by, d.is_active, d.is_home]
      );
    }

    // 3. Blood Categories
    const cRes = await client.query('SELECT * FROM blood_categories');
    for (const c of cRes.rows) {
      sqlite.run(
        `INSERT OR REPLACE INTO blood_categories (id, code, name, description, is_active, display_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [c.id, c.code, c.name, c.description, c.is_active, c.display_order]
      );
    }

    // 4. Assignments
    const aRes = await client.query('SELECT * FROM driver_assignments');
    for (const a of aRes.rows) {
      sqlite.run(
        `INSERT OR REPLACE INTO driver_assignments (id, destination_id, driver_id, assigned_by, source_name, source_lat, source_lng, urgency, notes, category, unit_count, status, assigned_at, accepted_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id, a.destination_id, a.driver_id, a.assigned_by, a.source_name, a.source_lat, a.source_lng,
          a.urgency, a.notes, a.category, a.unit_count, a.status,
          a.assigned_at ? new Date(a.assigned_at).toISOString() : null,
          a.accepted_at ? new Date(a.accepted_at).toISOString() : null,
          a.completed_at ? new Date(a.completed_at).toISOString() : null
        ]
      );
    }

    // 5. Work Logs
    const wRes = await client.query('SELECT * FROM work_logs');
    for (const w of wRes.rows) {
      sqlite.run(
        `INSERT OR REPLACE INTO work_logs (id, assignment_id, driver_id, destination_id, source_name, destination_name, destination_address, urgency, category, unit_count, notes, assigned_at, accepted_at, completed_at, duration_mins, distance_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.id, w.assignment_id, w.driver_id, w.destination_id, w.source_name, w.destination_name, w.destination_address,
          w.urgency, w.category, w.unit_count, w.notes,
          w.assigned_at ? new Date(w.assigned_at).toISOString() : null,
          w.accepted_at ? new Date(w.accepted_at).toISOString() : null,
          w.completed_at ? new Date(w.completed_at).toISOString() : null,
          w.duration_mins, w.distance_km
        ]
      );
    }

    // 6. Driver Locations
    const lRes = await client.query('SELECT * FROM driver_locations');
    for (const l of lRes.rows) {
      sqlite.run(
        `INSERT OR REPLACE INTO driver_locations (driver_id, lat, lng, speed, heading, status, address, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.driver_id, l.lat, l.lng, l.speed, l.heading, l.status, l.address, l.updated_at ? new Date(l.updated_at).toISOString() : null]
      );
    }

    console.log(`[Supabase Sync] ✅ State hydrated successfully (${uRes.rows.length} users, ${dRes.rows.length} destinations, ${cRes.rows.length} categories, ${aRes.rows.length} assignments, ${lRes.rows.length} driver locations).`);
  } catch (err) {
    console.warn('[Supabase Sync] Pull error:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Pushes local SQLite data to Supabase (periodic background sync).
 */
async function pushToSupabase() {
  const p = getPool();
  const client = await p.connect();
  const sqlite = getDB();

  try {
    // 0. Driver Locations
    const locations = sqlite.prepare('SELECT * FROM driver_locations').all();
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

    // 1. Users
    const users = sqlite.prepare('SELECT * FROM users').all();
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

    // 2. Destinations
    const destinations = sqlite.prepare('SELECT * FROM destinations').all();
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

    // 3. Blood Categories
    const categories = sqlite.prepare('SELECT * FROM blood_categories').all();
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

    // 4. Assignments
    const assignments = sqlite.prepare('SELECT * FROM driver_assignments').all();
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

    // 5. Work Logs
    const worklogs = sqlite.prepare('SELECT * FROM work_logs').all();
    for (const w of worklogs) {
      await client.query(`
        INSERT INTO work_logs (id, assignment_id, driver_id, destination_id, source_name, destination_name, destination_address, urgency, category, unit_count, notes, duration_mins, distance_km)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          destination_name = EXCLUDED.destination_name,
          category = EXCLUDED.category,
          unit_count = EXCLUDED.unit_count
      `, [w.id, w.assignment_id, w.driver_id, w.destination_id, w.source_name, w.destination_name, w.destination_address, w.urgency, w.category, w.unit_count, w.notes, w.duration_mins, w.distance_km]);
    }
  } catch (err) {
    console.warn('[Supabase Sync] Periodic push error:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Immediately push an assignment mutation to Supabase.
 */
async function syncAssignment(assignment) {
  if (!isSupabaseConfigured() || !assignment) return;
  try {
    const p = getPool();
    await p.query(`
      INSERT INTO driver_assignments (id, destination_id, driver_id, assigned_by, source_name, source_lat, source_lng, urgency, notes, category, unit_count, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        category = EXCLUDED.category,
        unit_count = EXCLUDED.unit_count
    `, [
      assignment.id, assignment.destination_id, assignment.driver_id, assignment.assigned_by,
      assignment.source_name, assignment.source_lat, assignment.source_lng,
      assignment.urgency, assignment.notes, assignment.category, assignment.unit_count, assignment.status
    ]);
  } catch (err) {
    console.warn('[Supabase Sync] syncAssignment error:', err.message);
  }
}

/**
 * Immediately push a destination mutation to Supabase.
 */
async function syncDestination(d) {
  if (!isSupabaseConfigured() || !d) return;
  try {
    const p = getPool();
    await p.query(`
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
  } catch (err) {
    console.warn('[Supabase Sync] syncDestination error:', err.message);
  }
}

/**
 * Immediately push a user registration/update to Supabase.
 */
async function syncUser(u) {
  if (!isSupabaseConfigured() || !u) return;
  try {
    const p = getPool();
    await p.query(`
      INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color, push_token, vehicle_type, vehicle_number, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        vehicle_type = EXCLUDED.vehicle_type,
        vehicle_number = EXCLUDED.vehicle_number,
        is_active = EXCLUDED.is_active
    `, [u.id, u.name, u.email, u.password_hash, u.role, u.phone, u.avatar_color, u.push_token, u.vehicle_type, u.vehicle_number, u.is_active]);

    if (u.role === 'driver') {
      await p.query(`
        INSERT INTO driver_locations (driver_id, lat, lng, speed, heading, status)
        VALUES ($1, 0, 0, 0, 0, 'offline')
        ON CONFLICT (driver_id) DO NOTHING
      `, [u.id]);
    }
  } catch (err) {
    console.warn('[Supabase Sync] syncUser error:', err.message);
  }
}

/**
 * Immediately push a completed work log to Supabase.
 */
async function syncWorkLog(w) {
  if (!isSupabaseConfigured() || !w) return;
  try {
    const p = getPool();
    await p.query(`
      INSERT INTO work_logs (id, assignment_id, driver_id, destination_id, source_name, destination_name, destination_address, urgency, category, unit_count, notes, duration_mins, distance_km)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING
    `, [w.id, w.assignment_id, w.driver_id, w.destination_id, w.source_name, w.destination_name, w.destination_address, w.urgency, w.category, w.unit_count, w.notes, w.duration_mins, w.distance_km]);
  } catch (err) {
    console.warn('[Supabase Sync] syncWorkLog error:', err.message);
  }
}

/**
 * Immediately push a category edit to Supabase.
 */
async function syncCategory(c) {
  if (!isSupabaseConfigured() || !c) return;
  try {
    const p = getPool();
    await p.query(`
      INSERT INTO blood_categories (id, code, name, description, is_active, display_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active,
        display_order = EXCLUDED.display_order
    `, [c.id, c.code, c.name, c.description, c.is_active, c.display_order]);
  } catch (err) {
    console.warn('[Supabase Sync] syncCategory error:', err.message);
  }
}

/**
 * Initialize Supabase bidirectional sync.
 */
async function initSupabaseSync() {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase Sync] No Supabase credentials found. Running in local SQLite mode.');
    return;
  }

  console.log('[Supabase Sync] 🚀 Initializing Supabase PostgreSQL Cloud Sync...');
  try {
    // 1. Pull latest cloud data into local SQLite
    await pullFromSupabase();

    // 2. Start periodic 60s background sync
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => {
      pushToSupabase().catch(err => console.warn('[Supabase Sync] Periodic push err:', err.message));
    }, 60000);

    console.log('[Supabase Sync] ✅ Cloud sync active and running every 60s.');
  } catch (err) {
    console.warn('[Supabase Sync] Initialization warning:', err.message);
  }
}

module.exports = {
  isSupabaseConfigured,
  getPool,
  initSupabaseSync,
  pullFromSupabase,
  pushToSupabase,
  syncAssignment,
  syncDestination,
  syncUser,
  syncWorkLog,
  syncCategory,
};
