'use strict';
const { dbAll, dbGet } = require('../../db/database');

/**
 * Helper to compute start and end timestamps based on period presets
 */
function resolveDateRange(period = 'last_30_days', customStart = null, customEnd = null) {
  const now = new Date();
  let start = new Date();
  let end = new Date(now.getTime() + 86400000); // end of today

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'last_7_days') {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'last_30_days') {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'custom' && customStart && customEnd) {
    start = new Date(customStart);
    end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'all') {
    start = new Date('2024-01-01T00:00:00.000Z');
  } else {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }

  const startIso = start.toISOString().replace('T', ' ').slice(0, 19);
  const endIso = end.toISOString().replace('T', ' ').slice(0, 19);
  return { startIso, endIso, period };
}

/**
 * Generate Driver Personal & Performance Report
 */
function getDriverReport({ driverId = 'all', period = 'last_30_days', startDate = null, endDate = null }) {
  const { startIso, endIso } = resolveDateRange(period, startDate, endDate);

  // List of active drivers for filtering dropdown
  const driversList = dbAll(`
    SELECT id, name, email, phone, avatar_color, vehicle_type, vehicle_number, is_active
    FROM users
    WHERE role = 'driver'
    ORDER BY name ASC
  `);

  let targetDriver = null;
  if (driverId && driverId !== 'all') {
    targetDriver = dbGet(`
      SELECT id, name, email, phone, avatar_color, vehicle_type, vehicle_number, is_active, created_at
      FROM users
      WHERE id = ? AND role = 'driver'
    `, [driverId]);

    if (!targetDriver) {
      const err = new Error('Driver not found');
      err.status = 404;
      throw err;
    }
  }

  // Query assignments
  let assignSql = `
    SELECT
      da.id, da.destination_id, da.driver_id, da.source_name, da.urgency, da.notes,
      da.status, da.assigned_at, da.accepted_at, da.completed_at,
      d.name as destination_name, d.address as destination_address,
      u.name as driver_name, u.vehicle_type, u.vehicle_number
    FROM driver_assignments da
    JOIN destinations d ON d.id = da.destination_id
    JOIN users u ON u.id = da.driver_id
    WHERE da.assigned_at >= ? AND da.assigned_at <= ?
  `;
  const assignParams = [startIso, endIso];
  if (targetDriver) {
    assignSql += ' AND da.driver_id = ?';
    assignParams.push(targetDriver.id);
  }
  assignSql += ' ORDER BY da.assigned_at DESC';
  const assignments = dbAll(assignSql, assignParams);

  // Query completed work logs
  let workSql = `
    SELECT
      wl.id, wl.assignment_id, wl.driver_id, wl.destination_id, wl.source_name,
      wl.destination_name, wl.destination_address, wl.urgency, wl.notes,
      wl.assigned_at, wl.accepted_at, wl.completed_at, wl.duration_mins, wl.distance_km,
      u.name as driver_name, u.vehicle_type, u.vehicle_number
    FROM work_logs wl
    JOIN users u ON u.id = wl.driver_id
    WHERE wl.completed_at >= ? AND wl.completed_at <= ?
  `;
  const workParams = [startIso, endIso];
  if (targetDriver) {
    workSql += ' AND wl.driver_id = ?';
    workParams.push(targetDriver.id);
  }
  workSql += `
    GROUP BY CASE
      WHEN wl.assignment_id IS NOT NULL AND wl.assignment_id != '' THEN wl.assignment_id
      ELSE wl.driver_id || '_' || wl.destination_id || '_' || substr(wl.completed_at, 1, 16)
    END
    ORDER BY wl.completed_at DESC
  `;
  const workLogs = dbAll(workSql, workParams);

  // Query issues reported
  let issuesSql = `
    SELECT i.id, i.driver_id, i.type, i.severity, i.description, i.status, i.created_at,
           u.name as driver_name
    FROM issues i
    JOIN users u ON u.id = i.driver_id
    WHERE i.created_at >= ? AND i.created_at <= ?
  `;
  const issuesParams = [startIso, endIso];
  if (targetDriver) {
    issuesSql += ' AND i.driver_id = ?';
    issuesParams.push(targetDriver.id);
  }
  issuesSql += ' ORDER BY i.created_at DESC';
  const issues = dbAll(issuesSql, issuesParams);

  // Calculate analytical KPIs
  const totalAssigned = assignments.length;
  const completedCount = workLogs.length;
  const rejectedCount = assignments.filter(a => a.status === 'rejected').length;
  const inProgressCount = assignments.filter(a => ['accepted', 'in_progress'].includes(a.status)).length;
  const pendingCount = assignments.filter(a => a.status === 'pending').length;

  const totalDistanceKm = workLogs.reduce((acc, cur) => acc + (parseFloat(cur.distance_km) || 0), 0);
  const totalDurationMins = workLogs.reduce((acc, cur) => acc + (parseInt(cur.duration_mins, 10) || 0), 0);
  const avgDurationMins = completedCount > 0 ? Math.round(totalDurationMins / completedCount) : 0;

  const emergencyCount = assignments.filter(a => a.urgency === 'emergency').length;
  const urgentCount = assignments.filter(a => a.urgency === 'urgent').length;
  const normalCount = assignments.filter(a => a.urgency === 'normal' || !a.urgency).length;

  const acceptanceRate = totalAssigned > 0
    ? Math.round(((totalAssigned - rejectedCount) / totalAssigned) * 100)
    : 100;

  const completionRate = totalAssigned > 0
    ? Math.round((completedCount / totalAssigned) * 100)
    : 100;

  const avgSpeedKmh = totalDurationMins > 0
    ? Math.round((totalDistanceKm / (totalDurationMins / 60)) * 10) / 10
    : 0;

  // Per-driver breakdown if viewing all drivers
  const driverBreakdowns = [];
  if (!targetDriver) {
    for (const d of driversList) {
      const dWork = workLogs.filter(w => w.driver_id === d.id);
      const dAssign = assignments.filter(a => a.driver_id === d.id);
      const dIssues = issues.filter(i => i.driver_id === d.id);

      const dDist = dWork.reduce((acc, cur) => acc + (parseFloat(cur.distance_km) || 0), 0);
      const dMins = dWork.reduce((acc, cur) => acc + (parseInt(cur.duration_mins, 10) || 0), 0);
      const dRej = dAssign.filter(a => a.status === 'rejected').length;

      driverBreakdowns.push({
        id: d.id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        vehicle_type: d.vehicle_type || 'two_wheeler',
        vehicle_number: d.vehicle_number || null,
        total_assigned: dAssign.length,
        completed_count: dWork.length,
        rejected_count: dRej,
        acceptance_rate: dAssign.length > 0 ? Math.round(((dAssign.length - dRej) / dAssign.length) * 100) : 100,
        total_distance_km: Math.round(dDist * 10) / 10,
        total_duration_mins: dMins,
        total_duration_hours: (dMins / 60).toFixed(1),
        avg_duration_mins: dWork.length > 0 ? Math.round(dMins / dWork.length) : 0,
        issues_count: dIssues.length,
      });
    }
  }

  return {
    period,
    startDate: startIso,
    endDate: endIso,
    targetDriver,
    driversList,
    summary: {
      total_assigned: totalAssigned,
      completed_count: completedCount,
      rejected_count: rejectedCount,
      in_progress_count: inProgressCount,
      pending_count: pendingCount,
      acceptance_rate: acceptanceRate,
      completion_rate: completionRate,
      total_distance_km: Math.round(totalDistanceKm * 10) / 10,
      total_duration_mins: totalDurationMins,
      total_duration_hours: (totalDurationMins / 60).toFixed(1),
      avg_duration_mins: avgDurationMins,
      avg_speed_kmh: avgSpeedKmh,
      emergency_count: emergencyCount,
      urgent_count: urgentCount,
      normal_count: normalCount,
      total_issues: issues.length,
      urgency_breakdown: {
        emergency: emergencyCount,
        urgent: urgentCount,
        normal: normalCount,
      },
    },
    driverBreakdowns: !targetDriver ? driverBreakdowns : null,
    workLogs,
    assignments,
    issues,
  };
}

/**
 * Generate Hospital Delivery Wise Report
 */
function getHospitalReport({ destinationId = 'all', period = 'last_30_days', startDate = null, endDate = null }) {
  const { startIso, endIso } = resolveDateRange(period, startDate, endDate);

  // List of active destination hospitals for dropdown
  const hospitalsList = dbAll(`
    SELECT id, name, address, lat, lng, radius_m, is_home
    FROM destinations
    WHERE is_home = 0
    ORDER BY name ASC
  `);

  let targetHospital = null;
  if (destinationId && destinationId !== 'all') {
    targetHospital = dbGet(`
      SELECT id, name, address, lat, lng, radius_m, description, created_at
      FROM destinations
      WHERE id = ?
    `, [destinationId]);

    if (!targetHospital) {
      const err = new Error('Hospital destination not found');
      err.status = 404;
      throw err;
    }
  }

  // Query completed deliveries from work_logs
  let workSql = `
    SELECT
      wl.id, wl.assignment_id, wl.driver_id, wl.destination_id, wl.source_name,
      wl.destination_name, wl.destination_address, wl.urgency, wl.notes,
      wl.assigned_at, wl.accepted_at, wl.completed_at, wl.duration_mins, wl.distance_km,
      u.name as driver_name, u.phone as driver_phone, u.vehicle_type, u.vehicle_number
    FROM work_logs wl
    JOIN users u ON u.id = wl.driver_id
    WHERE wl.completed_at >= ? AND wl.completed_at <= ?
  `;
  const workParams = [startIso, endIso];
  if (targetHospital) {
    workSql += ' AND wl.destination_id = ?';
    workParams.push(targetHospital.id);
  }
  workSql += `
    GROUP BY CASE
      WHEN wl.assignment_id IS NOT NULL AND wl.assignment_id != '' THEN wl.assignment_id
      ELSE wl.driver_id || '_' || wl.destination_id || '_' || substr(wl.completed_at, 1, 16)
    END
    ORDER BY wl.completed_at DESC
  `;
  const deliveries = dbAll(workSql, workParams);

  // Query all assignments (including pending/in_progress)
  let assignSql = `
    SELECT
      da.id, da.destination_id, da.driver_id, da.source_name, da.urgency,
      da.status, da.assigned_at, da.accepted_at, da.completed_at,
      d.name as destination_name, d.address as destination_address,
      u.name as driver_name, u.phone as driver_phone, u.vehicle_type, u.vehicle_number
    FROM driver_assignments da
    JOIN destinations d ON d.id = da.destination_id
    JOIN users u ON u.id = da.driver_id
    WHERE da.assigned_at >= ? AND da.assigned_at <= ?
  `;
  const assignParams = [startIso, endIso];
  if (targetHospital) {
    assignSql += ' AND da.destination_id = ?';
    assignParams.push(targetHospital.id);
  }
  assignSql += ' ORDER BY da.assigned_at DESC';
  const allAssignments = dbAll(assignSql, assignParams);

  // Query geofence proximity arrival notifications
  let notifSql = `
    SELECT gn.id, gn.destination_id, gn.driver_id, gn.type, gn.message, gn.distance_m, gn.created_at,
           d.name as destination_name, u.name as driver_name
    FROM geofence_notifications gn
    JOIN destinations d ON d.id = gn.destination_id
    JOIN users u ON u.id = gn.driver_id
    WHERE gn.created_at >= ? AND gn.created_at <= ?
  `;
  const notifParams = [startIso, endIso];
  if (targetHospital) {
    notifSql += ' AND gn.destination_id = ?';
    notifParams.push(targetHospital.id);
  }
  notifSql += ' ORDER BY gn.created_at DESC';
  const geofenceAlerts = dbAll(notifSql, notifParams);

  // Summary Metrics
  const totalDeliveries = deliveries.length;
  const totalAssignments = allAssignments.length;
  const emergencyCount = deliveries.filter(d => d.urgency === 'emergency').length;
  const urgentCount = deliveries.filter(d => d.urgency === 'urgent').length;
  const normalCount = deliveries.filter(d => d.urgency === 'normal' || !d.urgency).length;

  const totalDistanceKm = deliveries.reduce((acc, cur) => acc + (parseFloat(cur.distance_km) || 0), 0);
  const totalDurationMins = deliveries.reduce((acc, cur) => acc + (parseInt(cur.duration_mins, 10) || 0), 0);
  const avgDeliveryMins = totalDeliveries > 0 ? Math.round(totalDurationMins / totalDeliveries) : 0;

  // Distinct drivers deployed
  const uniqueDriversSet = new Set(deliveries.map(d => d.driver_id));
  const uniqueDriversCount = uniqueDriversSet.size;

  // Vehicle type distribution for hospital deliveries
  const twoWheelerDeliveries = deliveries.filter(d => (d.vehicle_type || 'two_wheeler') === 'two_wheeler').length;
  const fourWheelerDeliveries = deliveries.filter(d => d.vehicle_type === 'four_wheeler').length;

  // Per-hospital breakdown if viewing all hospitals
  const hospitalBreakdowns = [];
  if (!targetHospital) {
    for (const h of hospitalsList) {
      const hDeliveries = deliveries.filter(w => w.destination_id === h.id);
      const hAssign = allAssignments.filter(a => a.destination_id === h.id);
      const hAlerts = geofenceAlerts.filter(g => g.destination_id === h.id);

      const hDist = hDeliveries.reduce((acc, cur) => acc + (parseFloat(cur.distance_km) || 0), 0);
      const hMins = hDeliveries.reduce((acc, cur) => acc + (parseInt(cur.duration_mins, 10) || 0), 0);
      const hDrivers = new Set(hDeliveries.map(w => w.driver_id)).size;

      hospitalBreakdowns.push({
        id: h.id,
        name: h.name,
        address: h.address,
        total_deliveries: hDeliveries.length,
        total_requests: hAssign.length,
        emergency_count: hDeliveries.filter(w => w.urgency === 'emergency').length,
        urgent_count: hDeliveries.filter(w => w.urgency === 'urgent').length,
        normal_count: hDeliveries.filter(w => w.urgency === 'normal' || !w.urgency).length,
        avg_delivery_mins: hDeliveries.length > 0 ? Math.round(hMins / hDeliveries.length) : 0,
        total_distance_km: Math.round(hDist * 10) / 10,
        unique_drivers: hDrivers,
        geofence_arrivals: hAlerts.length,
      });
    }
  }

  return {
    period,
    startDate: startIso,
    endDate: endIso,
    targetHospital,
    hospitalsList,
    summary: {
      total_deliveries: totalDeliveries,
      total_requests: totalAssignments,
      emergency_count: emergencyCount,
      urgent_count: urgentCount,
      normal_count: normalCount,
      avg_delivery_mins: avgDeliveryMins,
      total_distance_km: Math.round(totalDistanceKm * 10) / 10,
      unique_drivers_count: uniqueDriversCount,
      geofence_arrivals_count: geofenceAlerts.length,
      vehicle_breakdown: {
        two_wheeler: twoWheelerDeliveries,
        four_wheeler: fourWheelerDeliveries,
      },
    },
    hospitalBreakdowns: !targetHospital ? hospitalBreakdowns : null,
    deliveries,
    allAssignments,
    geofenceAlerts,
  };
}

module.exports = {
  resolveDateRange,
  getDriverReport,
  getHospitalReport,
};
