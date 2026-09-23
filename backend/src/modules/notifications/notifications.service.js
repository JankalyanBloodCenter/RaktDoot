'use strict';
const { v4: uuidv4 } = require('uuid');
const { dbAll, dbGet, dbRun } = require('../../db/database');

/**
 * Create a geofence proximity notification.
 */
function createGeofenceNotification({
  manager_id,
  driver_id,
  destination_id,
  assignment_id = null,
  type = 'geofence_enter',
  message,
  distance_m = 0,
}) {
  // 1. Prevent duplicate notifications for the same assignment event
  if (assignment_id && ['work_completed', 'request_rejected', 'request_accepted'].includes(type)) {
    const existing = dbGet(
      'SELECT id FROM geofence_notifications WHERE assignment_id = ? AND type = ?',
      [assignment_id, type]
    );
    if (existing) {
      return getNotificationById(existing.id);
    }
  }

  // 2. Prevent rapid duplicate notifications for the same driver, destination, and type within 15 seconds
  if (driver_id && destination_id && ['work_completed', 'request_rejected', 'request_accepted'].includes(type)) {
    const recent = dbGet(`
      SELECT id FROM geofence_notifications
      WHERE driver_id = ? AND destination_id = ? AND type = ?
        AND created_at >= datetime('now', '-15 seconds')
    `, [driver_id, destination_id, type]);
    if (recent) {
      return getNotificationById(recent.id);
    }
  }

  const id = uuidv4();
  dbRun(`
    INSERT INTO geofence_notifications (id, manager_id, driver_id, destination_id, assignment_id, type, message, distance_m, is_read)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [id, manager_id, driver_id, destination_id, assignment_id, type, message, distance_m]);

  return getNotificationById(id);
}

/**
 * Get notification by ID with driver and destination details.
 */
function getNotificationById(id) {
  return dbGet(`
    SELECT
      n.id, n.manager_id, n.driver_id, n.destination_id, n.assignment_id,
      n.type, n.message, n.distance_m, n.is_read, n.created_at,
      u.name AS driver_name, u.avatar_color AS driver_avatar,
      d.name AS destination_name, d.address AS destination_address
    FROM geofence_notifications n
    JOIN users u ON u.id = n.driver_id
    LEFT JOIN destinations d ON d.id = n.destination_id
    WHERE n.id = ?
  `, [id]);
}

/**
 * Get notifications for a manager, ordered newest first with SQL deduplication.
 */
function getNotifications(manager_id, { unread_only = false, limit = 50 } = {}) {
  let sql = `
    SELECT
      n.id, n.manager_id, n.driver_id, n.destination_id, n.assignment_id,
      n.type, n.message, n.distance_m, n.is_read, n.created_at,
      u.name AS driver_name, u.avatar_color AS driver_avatar,
      d.name AS destination_name, d.address AS destination_address
    FROM geofence_notifications n
    JOIN users u ON u.id = n.driver_id
    LEFT JOIN destinations d ON d.id = n.destination_id
    WHERE (n.manager_id = ? OR n.manager_id = 'all')
  `;
  const params = [manager_id];

  if (unread_only) {
    sql += ' AND n.is_read = 0';
  }

  sql += `
    GROUP BY CASE
      WHEN n.assignment_id IS NOT NULL AND n.assignment_id != '' THEN n.assignment_id || '_' || n.type
      ELSE n.driver_id || '_' || COALESCE(n.destination_id, '') || '_' || n.type || '_' || substr(n.created_at, 1, 16)
    END
    ORDER BY n.created_at DESC LIMIT ?
  `;
  params.push(parseInt(limit) || 50);

  return dbAll(sql, params);
}

/**
 * Mark a single notification as read.
 */
function markRead(id, manager_id) {
  dbRun(`
    UPDATE geofence_notifications
    SET is_read = 1
    WHERE id = ? AND (manager_id = ? OR manager_id = 'all')
  `, [id, manager_id]);

  return getNotificationById(id);
}

/**
 * Mark all notifications as read for a manager.
 */
function markAllRead(manager_id) {
  dbRun(`
    UPDATE geofence_notifications
    SET is_read = 1
    WHERE (manager_id = ? OR manager_id = 'all') AND is_read = 0
  `, [manager_id]);

  return { success: true };
}

/**
 * Get count of unread notifications for a manager.
 */
function getUnreadCount(manager_id) {
  const row = dbGet(`
    SELECT COUNT(DISTINCT CASE
      WHEN assignment_id IS NOT NULL AND assignment_id != '' THEN assignment_id || '_' || type
      ELSE driver_id || '_' || COALESCE(destination_id, '') || '_' || type || '_' || substr(created_at, 1, 16)
    END) AS count
    FROM geofence_notifications
    WHERE (manager_id = ? OR manager_id = 'all') AND is_read = 0
  `, [manager_id]);
  return row ? row.count : 0;
}

/**
 * Delete a single notification.
 */
function deleteNotification(id, manager_id) {
  dbRun(`
    DELETE FROM geofence_notifications
    WHERE id = ? AND (manager_id = ? OR manager_id = 'all')
  `, [id, manager_id]);

  return { success: true, id };
}

/**
 * Clear all notifications for a manager.
 */
function clearAllNotifications(manager_id) {
  dbRun(`
    DELETE FROM geofence_notifications
    WHERE (manager_id = ? OR manager_id = 'all')
  `, [manager_id]);

  return { success: true };
}

module.exports = {
  createGeofenceNotification,
  getNotificationById,
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  deleteNotification,
  clearAllNotifications,
};
