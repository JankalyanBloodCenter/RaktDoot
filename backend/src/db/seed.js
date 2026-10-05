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
  // Drivers
  {
    id: 'user-drv-001',
    name: 'Ravi Kumar (RaktDoot 1)',
    email: 'driver1@jankalyan.com',
    password: 'RDJK@1983',
    role: 'driver',
    phone: '+91-9822012345',
    avatar_color: '#3b82f6',
    vehicle_type: 'two_wheeler',
    vehicle_number: 'MH 12 AB 1234',
  },
  {
    id: 'user-drv-002',
    name: 'Amit Shinde (RaktDoot 2)',
    email: 'driver2@jankalyan.com',
    password: 'RDJK@1983',
    role: 'driver',
    phone: '+91-9822098765',
    avatar_color: '#10b981',
    vehicle_type: 'four_wheeler',
    vehicle_number: 'MH 12 CD 5678',
  },
];

// No demo driver locations seeded by default
const initialLocations = [];

async function seedDatabase(force = false) {
  initDB();

  console.log('🌱 Ensuring admin & manager users in database...');

  // Remove old demo accounts if present
  try {
    dbRun("DELETE FROM users WHERE email IN ('admin@delivery.com', 'manager@delivery.com')");
  } catch (_) {}

  for (const u of users) {
    const existing = dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [u.email]);
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    if (existing) {
      dbRun(
        `UPDATE users SET password_hash = ?, role = ?, name = ?, phone = ?, avatar_color = ?, vehicle_type = ?, vehicle_number = ?, is_active = 1 WHERE id = ?`,
        [hash, u.role, u.name, u.phone, u.avatar_color, u.vehicle_type || 'two_wheeler', u.vehicle_number || null, existing.id]
      );
      console.log(`  🔄  Updated ${u.role.padEnd(8)} → ${u.email}`);
    } else {
      dbRun(
        `INSERT INTO users (id, name, email, password_hash, role, phone, avatar_color, vehicle_type, vehicle_number, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [u.id, u.name, u.email.toLowerCase(), hash, u.role, u.phone, u.avatar_color, u.vehicle_type || 'two_wheeler', u.vehicle_number || null]
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

  console.log('✨ Destination seed complete!');

  // Seed initial sample work logs if empty
  const existingLogsCount = dbGet('SELECT COUNT(*) as count FROM work_logs')?.count || 0;
  if (existingLogsCount === 0) {
    console.log('📋 Seeding initial completed blood runs in work logs...');
    const now = Date.now();
    const sampleWorkLogs = [
      {
        id: 'wl-seed-001',
        driver_id: 'user-drv-001',
        destination_id: 'dest-pune-sancheti',
        source_name: 'Jankalyan Blood Centre (Swargate HQ)',
        destination_name: 'Sancheti Hospital',
        destination_address: '16, Shivajinagar, Pune, Maharashtra 411005',
        urgency: 'normal',
        notes: '2 Units O-Negative Packed Red Blood Cells (PRBC) transferred safely under 4°C cold chain.',
        assigned_at: new Date(now - 3 * 3600 * 1000).toISOString(),
        accepted_at: new Date(now - 2.8 * 3600 * 1000).toISOString(),
        completed_at: new Date(now - 2.4 * 3600 * 1000).toISOString(),
        duration_mins: 24,
        distance_km: 3.8,
      },
      {
        id: 'wl-seed-002',
        driver_id: 'user-drv-002',
        destination_id: 'dest-pune-deenanath',
        source_name: 'Jankalyan Blood Centre (Swargate HQ)',
        destination_name: 'Deenanath Mangeshkar Hospital',
        destination_address: 'Near Mhatre Bridge, Erandwane, Pune 411004',
        urgency: 'urgent',
        notes: '4 Units Single Donor Platelets (SDP) for ICU oncology recipient. Maintained agitation and 22°C temperature.',
        assigned_at: new Date(now - 1.5 * 3600 * 1000).toISOString(),
        accepted_at: new Date(now - 1.4 * 3600 * 1000).toISOString(),
        completed_at: new Date(now - 1.0 * 3600 * 1000).toISOString(),
        duration_mins: 22,
        distance_km: 4.5,
      },
      {
        id: 'wl-seed-003',
        driver_id: 'user-drv-003',
        destination_id: 'dest-pune-rubyhall',
        source_name: 'Jankalyan Blood Centre (Swargate HQ)',
        destination_name: 'Ruby Hall Clinic',
        destination_address: '40, Sassoon Road, Sangamvadi, Pune 411001',
        urgency: 'emergency',
        notes: '🚨 STAT: Emergency trauma surgery blood supply (3 units AB+ and 2 units Cryoprecipitate). Priority delivery complete.',
        assigned_at: new Date(now - 45 * 60 * 1000).toISOString(),
        accepted_at: new Date(now - 42 * 60 * 1000).toISOString(),
        completed_at: new Date(now - 14 * 60 * 1000).toISOString(),
        duration_mins: 28,
        distance_km: 6.2,
      },
    ];

    for (const log of sampleWorkLogs) {
      const driverExists = dbGet("SELECT id FROM users WHERE id = ?", [log.driver_id]);
      if (!driverExists) continue;

      const assignmentId = 'assign-' + log.id;
      // Ensure the corresponding completed assignment exists in driver_assignments
      const assignExists = dbGet("SELECT id FROM driver_assignments WHERE id = ?", [assignmentId]);
      if (!assignExists) {
        dbRun(`
          INSERT INTO driver_assignments (
            id, destination_id, driver_id, assigned_by, status,
            source_name, urgency, notes, assigned_at, accepted_at, completed_at
          ) VALUES (?, ?, ?, 'user-mgr-001', 'completed', ?, ?, ?, ?, ?, ?)
        `, [
          assignmentId,
          log.destination_id,
          log.driver_id,
          log.source_name,
          log.urgency,
          log.notes,
          log.assigned_at,
          log.accepted_at,
          log.completed_at
        ]);
      }

      dbRun(`
        INSERT INTO work_logs (
          id, assignment_id, driver_id, destination_id,
          source_name, destination_name, destination_address,
          urgency, notes, assigned_at, accepted_at, completed_at,
          duration_mins, distance_km, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        log.id,
        assignmentId,
        log.driver_id,
        log.destination_id,
        log.source_name,
        log.destination_name,
        log.destination_address,
        log.urgency,
        log.notes,
        log.assigned_at,
        log.accepted_at,
        log.completed_at,
        log.duration_mins,
        log.distance_km,
      ]);
    }
    console.log(`  ✅ Seeded ${sampleWorkLogs.length} initial completed work logs with matching assignments.`);
  }

  // Seed sample rejected assignments if none exist
  const existingRejectionsCount = dbGet("SELECT COUNT(*) as count FROM driver_assignments WHERE status = 'rejected'")?.count || 0;
  if (existingRejectionsCount === 0) {
    console.log('🚫 Seeding sample rejected/declined assignments for performance audits...');
    const now = Date.now();
    const sampleRejections = [
      {
        id: 'assign-rej-001',
        destination_id: 'dest-pune-rubyhall',
        driver_id: 'user-drv-002',
        assigned_by: 'user-mgr-001',
        urgency: 'emergency',
        category: 'plasma',
        unit_count: 3,
        notes: 'Emergency STAT: 3 units FFP required for cardiac surgery patient at Ruby Hall Clinic.',
        status: 'rejected',
        assigned_at: new Date(now - 14 * 3600 * 1000).toISOString(),
        rejected_at: new Date(now - 13.95 * 3600 * 1000).toISOString(),
        rejection_reason: 'Vehicle puncture near Shivajinagar railway crossing. Unable to proceed safely.',
      },
      {
        id: 'assign-rej-002',
        destination_id: 'dest-pune-deenanath',
        driver_id: 'user-drv-001',
        assigned_by: 'user-mgr-001',
        urgency: 'urgent',
        category: 'platelets',
        unit_count: 2,
        notes: 'Urgent: SDP Platelets for oncology ward at Deenanath Mangeshkar Hospital.',
        status: 'rejected',
        assigned_at: new Date(now - 28 * 3600 * 1000).toISOString(),
        rejected_at: new Date(now - 27.9 * 3600 * 1000).toISOString(),
        rejection_reason: 'Severe traffic bottleneck on Karve Road due to metro utility maintenance.',
      },
      {
        id: 'assign-rej-003',
        destination_id: 'dest-pune-sancheti',
        driver_id: 'user-drv-002',
        assigned_by: 'user-mgr-001',
        urgency: 'normal',
        category: 'red_blood_cell',
        unit_count: 4,
        notes: 'Routine blood replenishment consignment for trauma ICU.',
        status: 'rejected',
        assigned_at: new Date(now - 52 * 3600 * 1000).toISOString(),
        rejected_at: new Date(now - 51.92 * 3600 * 1000).toISOString(),
        rejection_reason: 'Shift ending / scheduled vehicle maintenance check.',
      },
    ];

    for (const r of sampleRejections) {
      const driverExists = dbGet("SELECT id FROM users WHERE id = ?", [r.driver_id]);
      const destExists = dbGet("SELECT id FROM destinations WHERE id = ?", [r.destination_id]);
      if (!driverExists || !destExists) continue;

      dbRun(`
        INSERT OR REPLACE INTO driver_assignments (
          id, destination_id, driver_id, assigned_by, status,
          urgency, category, unit_count, notes,
          assigned_at, rejected_at, rejection_reason, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        r.id, r.destination_id, r.driver_id, r.assigned_by, r.status,
        r.urgency, r.category, r.unit_count, r.notes,
        r.assigned_at, r.rejected_at, r.rejection_reason,
      ]);
    }
    console.log(`  ✅ Seeded ${sampleRejections.length} sample rejected assignments.`);
  }

  console.log('✨ Seed check complete!');
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
