'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDB, dbRun, dbGet } = require('./database');

initDB();

const SALT_ROUNDS = 10;

const users = [
  // Admin
  {
    id: 'user-admin-001',
    name: 'Jankalyan Central Admin',
    email: 'raktdoot@jankalyan.com',
    password: 'RDJK@1983',
    role: 'admin',
    phone: '+91-9000000001',
    avatar_color: '#ef4444',
  },
  // Managers
  {
    id: 'user-mgr-001',
    name: 'Jankalyan Dispatch Manager',
    email: 'tracker@jankalyan.com',
    password: 'RDJK@1983',
    role: 'manager',
    phone: '+91-9000000002',
    avatar_color: '#8b5cf6',
  },
];

// No demo driver locations seeded
const initialLocations = [];

async function seedDatabase(force = false) {
  initDB();

  console.log('🌱 Ensuring admin & manager users in database...');

  // Remove old demo accounts if present
  try {
    dbRun("DELETE FROM users WHERE email IN ('admin@delivery.com', 'manager@delivery.com', 'driver1@delivery.com', 'driver2@delivery.com', 'driver1@jankalyan.com', 'driver2@jankalyan.com') OR id IN ('user-drv-001', 'user-drv-002')");
  } catch (_) {}

  // If force clean requested, remove all dummy driver assignments, work logs, notifications and locations
  if (force) {
    try {
      console.log('🧹 Purging dummy drivers, assignments, work logs, and notifications...');
      dbRun("DELETE FROM driver_assignments");
      dbRun("DELETE FROM work_logs");
      dbRun("DELETE FROM geofence_notifications");
      dbRun("DELETE FROM issues");
      dbRun("DELETE FROM driver_locations");
      dbRun("DELETE FROM location_history");
      dbRun("DELETE FROM users WHERE role = 'driver'");
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  }

  for (const u of users) {
    const existing = dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [u.email]);
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    if (existing) {
      dbRun(
        `UPDATE users SET password_hash = ?, role = ?, name = ?, phone = ?, avatar_color = ?, is_active = 1 WHERE id = ?`,
        [hash, u.role, u.name, u.phone, u.avatar_color, existing.id]
      );
      console.log(`  🔄  Updated ${u.role.padEnd(8)} → ${u.email}`);
    } else {
      dbRun(
        `INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [u.id, u.name, u.email.toLowerCase(), hash, u.role, u.phone, u.avatar_color]
      );
      console.log(`  ✅  Created ${u.role.padEnd(8)} → ${u.email}`);
    }
  }

  console.log('\n🎯 Seeding sample destinations in Pune...');
  const sampleDestinations = [
    {
      id: 'dest-home-001',
      name: 'Jankalyan Blood Centre (Home Base)',
      address: 'Jankalyan Blood Donation Building, Swargate, Pune, Maharashtra 411042',
      lat: 18.5039,
      lng: 73.8524,
      radius_m: 500,
      description: 'Central Blood Bank & Donation Building. Dispatch starting point and manager operations center.',
      created_by: 'user-mgr-001',
      is_home: 1,
    },
    {
      id: 'dest-pune-sancheti',
      name: 'Sancheti Hospital',
      address: '16, Shivajinagar, Pune, Maharashtra 411005',
      lat: 18.5312,
      lng: 73.8528,
      radius_m: 500,
      description: 'Speciality Orthopaedic & Trauma Centre, Shivajinagar',
      created_by: 'user-mgr-001',
      is_home: 0,
    },
    {
      id: 'dest-pune-rubyhall',
      name: 'Ruby Hall Clinic',
      address: '40, Sassoon Rd, Sangamvadi, Pune, Maharashtra 411001',
      lat: 18.5326,
      lng: 73.8783,
      radius_m: 600,
      description: 'Major Super-Speciality Hospital & Research Centre, Pune Station',
      created_by: 'user-mgr-001',
      is_home: 0,
    },
    {
      id: 'dest-pune-deenanath',
      name: 'Deenanath Mangeshkar Hospital',
      address: 'Near Mhatre Bridge, Erandwane, Pune, Maharashtra 411004',
      lat: 18.4996,
      lng: 73.8290,
      radius_m: 500,
      description: 'Multi-speciality Hospital & Blood Transfusion Centre, Erandwane',
      created_by: 'user-mgr-001',
      is_home: 0,
    },
    {
      id: 'dest-pune-jehangir',
      name: 'Jehangir Hospital',
      address: '32, Sassoon Rd, Central Railway Colony, Pune, Maharashtra 411001',
      lat: 18.5284,
      lng: 73.8744,
      radius_m: 500,
      description: 'Acute Care & Emergency Medical Services, Sassoon Road',
      created_by: 'user-mgr-001',
      is_home: 0,
    },
  ];

  for (const dest of sampleDestinations) {
    const existing = dbGet('SELECT id FROM destinations WHERE id = ?', [dest.id]);
    if (!existing) {
      dbRun(`
        INSERT INTO destinations (id, name, address, lat, lng, radius_m, description, created_by, is_active, is_home)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [dest.id, dest.name, dest.address, dest.lat, dest.lng, dest.radius_m, dest.description, dest.created_by, dest.is_home || 0]);
      console.log(`  ✅  Destination created: ${dest.name}`);
    }
  }

  console.log('✨ Destination seed complete. No dummy drivers, assignments, or logs seeded.');
}

module.exports = { seedDatabase, users, initialLocations };

if (require.main === module) {
  seedDatabase(true).then(() => {
    console.log('✨ Manual seed complete!');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
}
