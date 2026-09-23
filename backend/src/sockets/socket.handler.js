'use strict';
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { dbGet } = require('../db/database');
const { upsertLocation, getAllDriversWithLocations } = require('../modules/drivers/drivers.service');
const { getActiveAssignmentForDriver, updateAssignmentStatus } = require('../modules/assignments/assignments.service');
const { createGeofenceNotification } = require('../modules/notifications/notifications.service');
const { getAllDestinations } = require('../modules/destinations/destinations.service');
const worklogsService = require('../modules/worklogs/worklogs.service');

/** @type {import('socket.io').Server} */
let io;

// Telemetry counters
const telemetry = {
  totalConnections: 0,
  locationUpdatesProcessed: 0,
};

// In-memory geofence state: Map<driverId, Set<destinationId>>
const driverGeofenceInside = new Map();

/**
 * Calculate distance between two lat/lng points in meters (Haversine).
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Initialize Socket.io on the HTTP server.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim());

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
          return cb(null, true);
        }
        cb(null, true);
      },
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // ─── JWT AUTH MIDDLEWARE ─────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Socket: No auth token provided.'));

    try {
      const jwtSecret = process.env.JWT_SECRET || 'delivery_tracking_super_secret_key_2024';
      const decoded = jwt.verify(token, jwtSecret);
      const user = dbGet(
        'SELECT id, name, email, role, avatar_color, vehicle_type, vehicle_number FROM users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      if (!user) return next(new Error('Socket: User not found or inactive.'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Socket: Invalid token.'));
    }
  });

  // ─── CONNECTION HANDLER ──────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { user } = socket;
    telemetry.totalConnections++;
    console.log(`[Socket] ✅ Connected: ${user.name} (${user.role}) — ${socket.id}`);

    // ── JOIN ROOMS BASED ON ROLE ──────────────────────────────────────────────
    // Allow all authenticated clients (manager, admin, driver) to monitor fleet updates
    socket.join('fleet-monitors');

    // Send complete fleet state to the new watcher
    const fleetState = getAllDriversWithLocations();
    let initialDestinations = [];
    try {
      initialDestinations = getAllDestinations();
    } catch (_) {}

    socket.emit('initial_fleet_state', {
      drivers: fleetState,
      destinations: initialDestinations,
      telemetry: {
        connectedClients: io.sockets.sockets.size,
        locationUpdatesProcessed: telemetry.locationUpdatesProcessed,
      },
    });

    if (user.role === 'driver') {
      socket.join(`driver:${user.id}`);
      socket.join('drivers');
    }

    // ── DRIVER → GPS LOCATION UPDATE ─────────────────────────────────────────
    socket.on('location_update', (data) => {
      if (user.role !== 'driver' && user.role !== 'manager' && user.role !== 'admin') return;

      const { lat, lng, speed, heading, status, address } = data;
      if (lat == null || lng == null) return;

      const { dbGet } = require('../db/database');
      let effectiveAddress = (address && typeof address === 'string' && address.trim() !== '') ? address.trim() : null;
      if (!effectiveAddress) {
        try {
          const row = dbGet('SELECT address FROM driver_locations WHERE driver_id = ?', [user.id]);
          if (row?.address) effectiveAddress = row.address;
        } catch (e) {}
      }
      if (!effectiveAddress && lat >= 18.40 && lat <= 18.68 && lng >= 73.70 && lng <= 74.05) {
        effectiveAddress = 'Pashan, Pune, Maharashtra';
      }

      try {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        const parsedSpeed = parseFloat(speed) || 0;
        const parsedHeading = parseFloat(heading) || 0;

        upsertLocation({
          driver_id: user.id,
          lat: parsedLat,
          lng: parsedLng,
          speed: parsedSpeed,
          heading: parsedHeading,
          status: status || 'active',
          address: effectiveAddress,
        });

        telemetry.locationUpdatesProcessed++;

        // Broadcast to all fleet monitors
        io.to('fleet-monitors').emit('fleet_update', {
          driver_id: user.id,
          driver_name: user.name,
          avatar_color: user.avatar_color,
          vehicle_type: user.vehicle_type,
          vehicle_number: user.vehicle_number,
          lat: parsedLat,
          lng: parsedLng,
          speed: parsedSpeed,
          heading: parsedHeading,
          status: status || 'active',
          address: effectiveAddress,
          updated_at: new Date().toISOString(),
        });

        // ── GEOFENCE PROXIMITY CHECK ─────────────────────────────────────────
        try {
          const activeAssignment = getActiveAssignmentForDriver(user.id);
          if (
            activeAssignment &&
            activeAssignment.destination_lat != null &&
            activeAssignment.destination_lng != null
          ) {
            const distance = calculateDistanceMeters(
              parsedLat,
              parsedLng,
              parseFloat(activeAssignment.destination_lat),
              parseFloat(activeAssignment.destination_lng)
            );

            if (!driverGeofenceInside.has(user.id)) {
              driverGeofenceInside.set(user.id, new Set());
            }
            const insideSet = driverGeofenceInside.get(user.id);
            const radius = parseFloat(activeAssignment.destination_radius_m) || 500;
            const isInsideNow = distance <= radius;
            const wasInside = insideSet.has(activeAssignment.destination_id);

            if (isInsideNow && !wasInside) {
              insideSet.add(activeAssignment.destination_id);
              const roundedDist = Math.round(distance);
              const message = `Driver ${user.name} is within geofence of ${activeAssignment.destination_name} (${roundedDist}m away)`;

              const notif = createGeofenceNotification({
                manager_id: activeAssignment.assigned_by || 'user-mgr-001',
                driver_id: user.id,
                destination_id: activeAssignment.destination_id,
                assignment_id: activeAssignment.id,
                type: 'geofence_enter',
                message,
                distance_m: roundedDist,
              });

              // Alert fleet monitors
              io.to('fleet-monitors').emit('geofence_alert', {
                notification: notif,
                driver_id: user.id,
                driver_name: user.name,
                destination_id: activeAssignment.destination_id,
                destination_name: activeAssignment.destination_name,
                distance_m: roundedDist,
                type: 'enter',
                timestamp: new Date().toISOString(),
              });

              // If accepted, auto-progress to in_progress
              if (activeAssignment.status === 'accepted') {
                const updatedAssignment = updateAssignmentStatus(
                  activeAssignment.id,
                  'in_progress',
                  user.id,
                  'driver'
                );
                io.to('fleet-monitors').emit('assignment_status_changed', {
                  assignment: updatedAssignment,
                });
                io.to(`driver:${user.id}`).emit('assignment_status_changed', {
                  assignment: updatedAssignment,
                });
              }
            } else if (!isInsideNow && wasInside) {
              insideSet.delete(activeAssignment.destination_id);
              io.to('fleet-monitors').emit('geofence_alert', {
                driver_id: user.id,
                driver_name: user.name,
                destination_id: activeAssignment.destination_id,
                destination_name: activeAssignment.destination_name,
                distance_m: Math.round(distance),
                type: 'exit',
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (geofenceErr) {
          console.error('[Socket] ⚠️ Geofence check warning:', geofenceErr.message);
        }
      } catch (err) {
        console.error('[Socket] ❌ Error saving location:', err.message);
      }
    });

    // ── DRIVER → STATUS CHANGE ────────────────────────────────────────────────
    socket.on('status_change', (data) => {
      if (user.role !== 'driver') return;
      const { status } = data;
      if (!status) return;

      try {
        const { dbRun } = require('../db/database');
        dbRun(
          "UPDATE driver_locations SET status = ?, updated_at = datetime('now') WHERE driver_id = ?",
          [status, user.id]
        );
        io.to('fleet-monitors').emit('driver_status_changed', {
          driver_id: user.id,
          driver_name: user.name,
          status,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket] ❌ Error updating status:', err.message);
      }
    });

    // ── DRIVER → ISSUE REPORTED (complement to REST API) ─────────────────────
    socket.on('issue_reported', (data) => {
      if (user.role !== 'driver') return;
      const issuePayload = {
        driver_id: user.id,
        driver_name: user.name,
        ...data,
        timestamp: new Date().toISOString(),
      };

      try {
        const { dbRun } = require('../db/database');
        dbRun(
          "UPDATE driver_locations SET status = 'issue', updated_at = datetime('now') WHERE driver_id = ?",
          [user.id]
        );
      } catch (_) {}

      io.emit('driver_status_changed', {
        driver_id: user.id,
        driver_name: user.name,
        status: 'issue',
        timestamp: new Date().toISOString(),
      });
      io.to('fleet-monitors').emit('driver_status_changed', {
        driver_id: user.id,
        driver_name: user.name,
        status: 'issue',
        timestamp: new Date().toISOString(),
      });

      io.emit('issue_alert', {
        ...issuePayload,
        issue: issuePayload,
      });
      io.to('fleet-monitors').emit('issue_alert', {
        ...issuePayload,
        issue: issuePayload,
      });
    });

    // ── DRIVER → TASK RESPONSE (Accept / Reject / Complete) ──────────────────
    socket.on('task_response', (data) => {
      if (user.role !== 'driver') return;
      const { assignment_id, status } = data;
      if (!assignment_id || !status) return;

      try {
        const updated = updateAssignmentStatus(assignment_id, status, user.id, 'driver');
        io.to('fleet-monitors').emit('assignment_status_changed', { assignment: updated });
        io.to('fleet-monitors').emit('request_status_updated', { assignment: updated });
        io.to(`driver:${updated.driver_id}`).emit('assignment_status_changed', { assignment: updated });

        // ONLY trigger alerts and create notifications/worklogs if status actually transitioned
        if (updated._statusChanged) {
          const status = data.status;

          // ── REJECTED ──
          if (status === 'rejected') {
            const notif = createGeofenceNotification({
              manager_id: updated.assigned_by || 'user-mgr-001',
              driver_id: updated.driver_id,
              destination_id: updated.destination_id,
              assignment_id: updated.id,
              type: 'request_rejected',
              message: `DECLINED: Driver ${updated.driver_name || user.name} rejected the collection request for ${updated.destination_name}. Please reassign to another driver.`,
              distance_m: 0,
            });

            io.to('fleet-monitors').emit('notification_new', { notification: notif });
            io.to('fleet-monitors').emit('request_rejected_alert', {
              assignment_id: updated.id,
              driver_id: updated.driver_id,
              driver_name: updated.driver_name || user.name,
              destination_id: updated.destination_id,
              destination_name: updated.destination_name,
              message: `Driver ${updated.driver_name || user.name} rejected the collection request for ${updated.destination_name}.`,
            });
          }

          // ── WORK COMPLETED: LOG TO DB & NOTIFY ──
          if (status === 'completed') {
            let durationMins = 0;
            const startTime = updated.accepted_at || updated.assigned_at;
            if (startTime) {
              const diffMs = new Date(updated.completed_at || Date.now()) - new Date(startTime);
              durationMins = Math.max(1, Math.round(diffMs / 60000));
            }

            let workLog = null;
            try {
              workLog = worklogsService.createWorkLog({
                assignment_id: updated.id,
                driver_id: updated.driver_id,
                destination_id: updated.destination_id,
                source_name: updated.source_name,
                destination_name: updated.destination_name,
                destination_address: updated.destination_address,
                urgency: updated.urgency,
                notes: updated.notes,
                assigned_at: updated.assigned_at,
                accepted_at: updated.accepted_at,
                completed_at: updated.completed_at || new Date().toISOString(),
                duration_mins: durationMins,
              });
            } catch (wlErr) {
              console.warn('[Socket] workLog creation warning:', wlErr.message);
            }

            const notif = createGeofenceNotification({
              manager_id: updated.assigned_by || 'user-mgr-001',
              driver_id: updated.driver_id,
              destination_id: updated.destination_id,
              assignment_id: updated.id,
              type: 'work_completed',
              message: `WORK COMPLETED: Driver ${updated.driver_name || user.name} delivered / collected blood at ${updated.destination_name} (${durationMins}m run). Saved in Work Log.`,
              distance_m: 0,
            });

            io.to('fleet-monitors').emit('notification_new', { notification: notif });
            io.to('fleet-monitors').emit('work_completed_alert', {
              workLog,
              assignment_id: updated.id,
              driver_id: updated.driver_id,
              driver_name: updated.driver_name || user.name,
              destination_id: updated.destination_id,
              destination_name: updated.destination_name,
              completed_at: updated.completed_at || new Date().toISOString(),
              duration_mins: durationMins,
              message: `WORK COMPLETED: Driver ${updated.driver_name || user.name} reached ${updated.destination_name} and completed blood collection! (${durationMins}m run)`,
            });
            if (workLog) {
              io.to('fleet-monitors').emit('work_log_added', { workLog });
            }
          }
        }
      } catch (err) {
        console.error('[Socket] ❌ Error handling task_response:', err.message);
      }
    });

    // ── TELEMETRY PING ────────────────────────────────────────────────────────
    socket.on('request_telemetry', () => {
      if (user.role !== 'admin') return;
      socket.emit('telemetry_update', {
        connectedClients: io.sockets.sockets.size,
        locationUpdatesProcessed: telemetry.locationUpdatesProcessed,
        totalConnections: telemetry.totalConnections,
      });
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ❌ Disconnected: ${user.name} (${user.role}) — ${reason}`);

      // Clean up geofence tracking memory
      driverGeofenceInside.delete(user.id);

      // Mark driver offline on disconnect
      if (user.role === 'driver') {
        try {
          const { dbRun } = require('../db/database');
          dbRun(
            "UPDATE driver_locations SET status = 'offline', updated_at = datetime('now') WHERE driver_id = ?",
            [user.id]
          );
          io.to('fleet-monitors').emit('driver_status_changed', {
            driver_id: user.id,
            driver_name: user.name,
            status: 'offline',
            timestamp: new Date().toISOString(),
          });
        } catch (_) {}
      }
    });
  });

  console.log('[Socket] Socket.io initialized.');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket() first.');
  return io;
}

module.exports = { initSocket, getIO };
