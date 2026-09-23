'use strict';
const { v4: uuidv4 } = require('uuid');
const { dbAll, dbGet, dbRun } = require('../../db/database');

/**
 * Get all work logs with driver & destination details, newest first.
 */
function getAllWorkLogs({ driver_id, destination_id, urgency, search, limit = 100 } = {}) {
  let sql = `
    SELECT
      wl.id, wl.assignment_id, wl.driver_id, wl.destination_id,
      wl.source_name, wl.destination_name, wl.destination_address,
      wl.urgency, wl.category, wl.unit_count, wl.notes, wl.assigned_at, wl.accepted_at, wl.completed_at,
      wl.duration_mins, wl.distance_km, wl.created_at,
      u.name AS driver_name, u.email AS driver_email, u.phone AS driver_phone,
      u.avatar_color AS driver_avatar
    FROM work_logs wl
    JOIN users u ON u.id = wl.driver_id
    WHERE 1=1
  `;
  const params = [];

  if (driver_id) {
    sql += ' AND wl.driver_id = ?';
    params.push(driver_id);
  }
  if (destination_id) {
    sql += ' AND wl.destination_id = ?';
    params.push(destination_id);
  }
  if (urgency && urgency !== 'all') {
    sql += ' AND wl.urgency = ?';
    params.push(urgency);
  }
  if (search && search.trim() !== '') {
    sql += ' AND (wl.destination_name LIKE ? OR u.name LIKE ? OR wl.source_name LIKE ? OR wl.notes LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY wl.completed_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);

  return dbAll(sql, params);
}

/**
 * Get a single work log entry by ID.
 */
function getWorkLogById(id) {
  const row = dbGet(`
    SELECT
      wl.*,
      u.name AS driver_name, u.email AS driver_email, u.phone AS driver_phone,
      u.avatar_color AS driver_avatar
    FROM work_logs wl
    JOIN users u ON u.id = wl.driver_id
    WHERE wl.id = ?
  `, [id]);
  return row || null;
}

/**
 * Record a completed work log entry.
 */
function createWorkLog({
  assignment_id,
  driver_id,
  destination_id,
  source_name = 'Jankalyan Blood Centre (Swargate HQ)',
  destination_name,
  destination_address = null,
  urgency = 'normal',
  category = 'red_blood_cell',
  unit_count = 1,
  notes = null,
  assigned_at = null,
  accepted_at = null,
  completed_at = null,
  duration_mins = 0,
  distance_km = 0,
}) {
  // Prevent duplicate work logs for the same completed assignment
  if (assignment_id) {
    const existing = dbGet('SELECT id FROM work_logs WHERE assignment_id = ?', [assignment_id]);
    if (existing) {
      return getWorkLogById(existing.id);
    }
  }

  const id = 'wl-' + uuidv4();
  const completedTimestamp = completed_at || new Date().toISOString();

  dbRun(`
    INSERT INTO work_logs (
      id, assignment_id, driver_id, destination_id,
      source_name, destination_name, destination_address,
      urgency, category, unit_count, notes, assigned_at, accepted_at, completed_at,
      duration_mins, distance_km, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    id,
    assignment_id,
    driver_id,
    destination_id,
    source_name,
    destination_name,
    destination_address,
    urgency,
    category || 'red_blood_cell',
    parseInt(unit_count, 10) || 1,
    notes,
    assigned_at,
    accepted_at,
    completedTimestamp,
    duration_mins,
    distance_km,
  ]);

  return getWorkLogById(id);
}

/**
 * Aggregated analytics for work log overview cards.
 */
function getWorkLogStats() {
  const totals = dbGet(`
    SELECT
      COUNT(*) AS total_completed,
      COALESCE(SUM(duration_mins), 0) AS total_duration_mins,
      COUNT(DISTINCT driver_id) AS active_drivers,
      SUM(CASE WHEN urgency = 'emergency' THEN 1 ELSE 0 END) AS emergency_runs,
      SUM(CASE WHEN urgency = 'urgent' THEN 1 ELSE 0 END) AS urgent_runs
    FROM work_logs
  `) || { total_completed: 0, total_duration_mins: 0, active_drivers: 0, emergency_runs: 0, urgent_runs: 0 };

  return totals;
}

module.exports = {
  getAllWorkLogs,
  getWorkLogById,
  createWorkLog,
  getWorkLogStats,
};
