'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbAll, dbGet, dbRun } = require('../../db/database');
const { getIO } = require('../../sockets/socket.handler');

const SALT_ROUNDS = 10;

function listUsers({ role, search, page = 1, limit = 20 } = {}) {
  let sql = `
    SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_color, u.vehicle_type, u.vehicle_number, u.is_active, u.created_at,
           dl.status AS location_status, dl.updated_at AS last_seen
    FROM users u
    LEFT JOIN driver_locations dl ON dl.driver_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (role) { sql += ' AND u.role = ?'; params.push(role); }
  if (search) {
    sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.vehicle_number LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const countResult = dbGet(`SELECT COUNT(*) as total FROM (${sql})`, params);
  const total = countResult ? countResult.total : 0;

  const offset = (page - 1) * limit;
  sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const users = dbAll(sql, params);
  return { users, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

async function createUser({ name, email, password, role, phone, vehicle_type, vehicle_number }) {
  if (!name || !email || !password || !role) {
    const err = new Error('name, email, password, and role are required.');
    err.status = 400;
    throw err;
  }
  const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    const err = new Error('Email already registered.');
    err.status = 409;
    throw err;
  }
  const id = uuidv4();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#84cc16', '#8b5cf6', '#ef4444'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];

  dbRun(
    `INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color, vehicle_type, vehicle_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      email,
      hash,
      role,
      phone || null,
      avatar_color,
      vehicle_type || 'two_wheeler',
      vehicle_number ? vehicle_number.trim().toUpperCase() : null,
    ]
  );
  if (role === 'driver') {
    dbRun(`INSERT OR IGNORE INTO driver_locations (driver_id, lat, lng, speed, heading, status) VALUES (?, 0, 0, 0, 0, 'offline')`, [id]);
  }
  const created = dbGet('SELECT * FROM users WHERE id = ?', [id]);
  try {
    const { syncUser } = require('../../db/supabase_sync');
    syncUser(created);
  } catch (_) {}
  return dbGet('SELECT id, name, email, role, phone, avatar_color, vehicle_type, vehicle_number, is_active, created_at FROM users WHERE id = ?', [id]);
}

async function updateUser(userId, { name, email, phone, role, is_active, password, vehicle_type, vehicle_number }) {
  const user = dbGet('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    const err = new Error('User not found.'); err.status = 404; throw err;
  }
  if (email && email !== user.email) {
    const dup = dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (dup) { const err = new Error('Email already in use.'); err.status = 409; throw err; }
  }
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (vehicle_type !== undefined) { updates.push('vehicle_type = ?'); params.push(vehicle_type); }
  if (vehicle_number !== undefined) {
    updates.push('vehicle_number = ?');
    params.push(vehicle_number ? vehicle_number.trim().toUpperCase() : null);
  }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (password) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    updates.push('password_hash = ?'); params.push(hash);
  }
  if (updates.length === 0) { const err = new Error('No fields to update.'); err.status = 400; throw err; }
  params.push(userId);
  dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = dbGet('SELECT * FROM users WHERE id = ?', [userId]);
  try {
    const { syncUser } = require('../../db/supabase_sync');
    syncUser(updated);
  } catch (_) {}
  return dbGet('SELECT id, name, email, role, phone, avatar_color, vehicle_type, vehicle_number, is_active, created_at FROM users WHERE id = ?', [userId]);
}

async function deleteUser(userId, requesterId) {
  if (userId === requesterId) {
    const err = new Error('Cannot delete your own account.');
    err.status = 400;
    throw err;
  }
  const user = dbGet('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  // 1. Cascade delete all child/dependent records to avoid foreign key errors
  try { dbRun('DELETE FROM driver_locations WHERE driver_id = ?', [userId]); } catch (_) {}
  try { dbRun('DELETE FROM location_history WHERE driver_id = ?', [userId]); } catch (_) {}
  try { dbRun('DELETE FROM geofence_notifications WHERE driver_id = ?', [userId]); } catch (_) {}
  try { dbRun('DELETE FROM notifications WHERE user_id = ?', [userId]); } catch (_) {}
  try { dbRun('DELETE FROM driver_assignments WHERE driver_id = ? OR assigned_by = ?', [userId, userId]); } catch (_) {}
  try { dbRun('DELETE FROM issues WHERE driver_id = ? OR resolved_by = ?', [userId, userId]); } catch (_) {}
  try { dbRun('DELETE FROM work_logs WHERE driver_id = ?', [userId]); } catch (_) {}
  try { dbRun('UPDATE destinations SET created_by = NULL WHERE created_by = ?', [userId]); } catch (_) {}

  // 2. Delete user from local SQLite
  dbRun('DELETE FROM users WHERE id = ?', [userId]);

  // 3. Asynchronously cascade delete from Supabase PostgreSQL
  try {
    const { getPool } = require('../../db/supabase_sync');
    const pool = getPool();
    if (pool) {
      pool.query(`
        DELETE FROM driver_locations WHERE driver_id = $1;
        DELETE FROM location_history WHERE driver_id = $1;
        DELETE FROM geofence_notifications WHERE driver_id = $1;
        DELETE FROM notifications WHERE user_id = $1;
        DELETE FROM driver_assignments WHERE driver_id = $1 OR assigned_by = $1;
        DELETE FROM issues WHERE driver_id = $1 OR resolved_by = $1;
        DELETE FROM work_logs WHERE driver_id = $1;
        UPDATE destinations SET created_by = NULL WHERE created_by = $1;
        DELETE FROM users WHERE id = $1;
      `, [userId]).catch(e => console.warn('[Supabase Delete User Sync]:', e.message));
    }
  } catch (_) {}

  // 4. Broadcast driver removal to fleet monitors
  try {
    const { getIO } = require('../../sockets/socket.handler');
    const io = getIO();
    if (io) {
      io.to('fleet-monitors').emit('driver_removed', { driver_id: userId });
    }
  } catch (_) {}

  return { deleted: userId };
}

async function changeUserPassword(userId, newPassword) {
  const user = dbGet('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);

  // Sync to Supabase immediately
  try {
    const { getPool } = require('../../db/supabase_sync');
    const pool = getPool();
    if (pool) {
      pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId])
        .catch(e => console.warn('[Supabase Change Password Sync]:', e.message));
    }
  } catch (_) {}

  return dbGet('SELECT id, name, email, role, phone, avatar_color, vehicle_type, vehicle_number, is_active, created_at FROM users WHERE id = ?', [userId]);
}

function getTelemetry() {
  let socketCount = 0;
  try { const io = getIO(); socketCount = io.sockets.sockets.size; } catch (_) {}

  const totalUsers = dbGet('SELECT COUNT(*) as c FROM users').c;
  const totalDrivers = dbGet("SELECT COUNT(*) as c FROM users WHERE role='driver'").c;
  const activeDrivers = dbGet("SELECT COUNT(*) as c FROM driver_locations WHERE status='active'").c;
  const totalIssues = dbGet('SELECT COUNT(*) as c FROM issues').c;
  const openIssues = dbGet("SELECT COUNT(*) as c FROM issues WHERE status='open'").c;
  const totalLocations = dbGet('SELECT COUNT(*) as c FROM location_history').c;

  return {
    sockets: socketCount,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    totalUsers,
    totalDrivers,
    activeDrivers,
    totalIssues,
    openIssues,
    resolvedIssues: totalIssues - openIssues,
    totalLocationUpdates: totalLocations,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { listUsers, createUser, updateUser, changeUserPassword, deleteUser, getTelemetry };
