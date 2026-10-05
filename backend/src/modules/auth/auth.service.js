'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbRun } = require('../../db/database');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'delivery_tracking_super_secret_key_2024';

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

async function register({ name, email, password, role = 'driver', phone, vehicle_type = 'two_wheeler', vehicle_number = null }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const existing = dbGet('SELECT id, name FROM users WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
  if (existing) {
    const err = new Error('Account already exists for this email! Please sign in with your password.');
    err.status = 409;
    err.code = 'ACCOUNT_EXISTS';
    throw err;
  }

  const id = uuidv4();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#84cc16', '#8b5cf6'];
  const avatar_color = colors[Math.floor(Math.random() * colors.length)];

  dbRun(
    `INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color, vehicle_type, vehicle_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      (name || '').trim(),
      cleanEmail,
      hash,
      role,
      phone ? phone.trim() : null,
      avatar_color,
      vehicle_type || 'two_wheeler',
      vehicle_number ? vehicle_number.trim().toUpperCase() : null,
    ]
  );

  // If registering as driver, create default location row
  if (role === 'driver') {
    dbRun(
      `INSERT OR IGNORE INTO driver_locations (driver_id, lat, lng, speed, heading, status)
       VALUES (?, 0, 0, 0, 0, 'offline')`,
      [id]
    );
  }

  const user = dbGet('SELECT * FROM users WHERE id = ?', [id]);
  const token = signToken(id);

  try {
    const { syncUser } = require('../../db/supabase_sync');
    syncUser(user);
  } catch (_) {}

  return { token, user: sanitizeUser(user) };
}

async function login({ email, password }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const user = dbGet('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
  if (!user) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('Account is deactivated. Contact your administrator.');
    err.status = 403;
    throw err;
  }

  const token = signToken(user.id);
  return { token, user: sanitizeUser(user) };
}

function getMe(userId) {
  const user = dbGet('SELECT id, name, email, role, phone, avatar_color, vehicle_type, vehicle_number, is_active, created_at FROM users WHERE id = ?', [userId]);
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  return user;
}

module.exports = { register, login, getMe };
