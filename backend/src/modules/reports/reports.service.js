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

/**
 * Generate Declined / Rejected Requests Report
 */
function getRejectionsReport({
  driverId = 'all',
  destinationId = 'all',
  urgency = 'all',
  period = 'last_30_days',
  startDate = null,
  endDate = null,
}) {
  const { startIso, endIso } = resolveDateRange(period, startDate, endDate);

  // List of active drivers for filtering dropdown
  const driversList = dbAll(`
    SELECT id, name, email, phone, avatar_color, vehicle_type, vehicle_number, is_active
    FROM users
    WHERE role = 'driver'
    ORDER BY name ASC
  `);

  // List of active destinations for filtering dropdown
  const hospitalsList = dbAll(`
    SELECT id, name, address, lat, lng, radius_m, is_home
    FROM destinations
    WHERE is_home = 0
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

  // 1. Query all assignments in period (to calculate base dispatch volume & decline rate)
  let allAssignSql = `
    SELECT id, driver_id, destination_id, urgency, status, assigned_at
    FROM driver_assignments
    WHERE assigned_at >= ? AND assigned_at <= ?
  `;
  const allAssignParams = [startIso, endIso];
  if (targetDriver) {
    allAssignSql += ' AND driver_id = ?';
    allAssignParams.push(targetDriver.id);
  }
  if (targetHospital) {
    allAssignSql += ' AND destination_id = ?';
    allAssignParams.push(targetHospital.id);
  }
  if (urgency && urgency !== 'all') {
    allAssignSql += ' AND urgency = ?';
    allAssignParams.push(urgency);
  }
  const allAssignments = dbAll(allAssignSql, allAssignParams);

  // 2. Query rejected requests in period
  let rejectionsSql = `
    SELECT
      da.id, da.destination_id, da.driver_id, da.assigned_by, da.status,
      da.source_name, da.source_lat, da.source_lng, da.urgency, da.category, da.unit_count, da.notes,
      da.assigned_at, da.accepted_at, da.completed_at, da.rejected_at, da.rejection_reason, da.updated_at,
      COALESCE(da.rejected_at, da.updated_at, da.assigned_at) AS effective_rejected_at,
      d.name AS destination_name, d.address AS destination_address,
      u_driver.name AS driver_name, u_driver.email AS driver_email, u_driver.phone AS driver_phone,
      u_driver.avatar_color AS driver_avatar, u_driver.vehicle_type, u_driver.vehicle_number,
      u_mgr.name AS assigned_by_name, u_mgr.email AS assigned_by_email, u_mgr.role AS assigned_by_role
    FROM driver_assignments da
    JOIN destinations d ON d.id = da.destination_id
    JOIN users u_driver ON u_driver.id = da.driver_id
    JOIN users u_mgr ON u_mgr.id = da.assigned_by
    WHERE da.status = 'rejected'
      AND COALESCE(da.rejected_at, da.updated_at, da.assigned_at) >= ?
      AND COALESCE(da.rejected_at, da.updated_at, da.assigned_at) <= ?
  `;
  const rejectionsParams = [startIso, endIso];
  if (targetDriver) {
    rejectionsSql += ' AND da.driver_id = ?';
    rejectionsParams.push(targetDriver.id);
  }
  if (targetHospital) {
    rejectionsSql += ' AND da.destination_id = ?';
    rejectionsParams.push(targetHospital.id);
  }
  if (urgency && urgency !== 'all') {
    rejectionsSql += ' AND da.urgency = ?';
    rejectionsParams.push(urgency);
  }
  rejectionsSql += ' ORDER BY COALESCE(da.rejected_at, da.updated_at, da.assigned_at) DESC';
  const rejections = dbAll(rejectionsSql, rejectionsParams);

  // 3. Compute response turnaround lag for each rejection
  let totalLagSeconds = 0;
  for (const r of rejections) {
    const assignedTime = new Date(r.assigned_at).getTime();
    const rejectedTime = new Date(r.effective_rejected_at).getTime();
    let lagSeconds = 0;
    if (!isNaN(assignedTime) && !isNaN(rejectedTime) && rejectedTime >= assignedTime) {
      lagSeconds = Math.round((rejectedTime - assignedTime) / 1000);
    }
    const lagMins = Math.round((lagSeconds / 60) * 10) / 10;

    let responseLagFormatted = '';
    if (lagSeconds < 60) {
      responseLagFormatted = `${lagSeconds}s`;
    } else if (lagMins < 60) {
      const mins = Math.floor(lagSeconds / 60);
      const secs = lagSeconds % 60;
      responseLagFormatted = `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(lagMins / 60);
      const mins = Math.round(lagMins % 60);
      responseLagFormatted = `${hours}h ${mins}m`;
    }

    r.response_lag_seconds = lagSeconds;
    r.response_lag_mins = lagMins;
    r.response_lag_formatted = responseLagFormatted;
    r.rejection_reason = r.rejection_reason || 'Driver declined request';
    totalLagSeconds += lagSeconds;
  }

  // 4. Summary KPIs
  const totalRejected = rejections.length;
  const totalAssigned = allAssignments.length;
  const emergencyCount = rejections.filter(r => r.urgency === 'emergency').length;
  const urgentCount = rejections.filter(r => r.urgency === 'urgent').length;
  const normalCount = rejections.filter(r => r.urgency === 'normal' || !r.urgency).length;
  const emergencySharePercent = totalRejected > 0 ? Math.round((emergencyCount / totalRejected) * 100) : 0;
  const overallDeclineRate = totalAssigned > 0 ? Math.round((totalRejected / totalAssigned) * 100) : 0;
  const avgLagSeconds = totalRejected > 0 ? Math.round(totalLagSeconds / totalRejected) : 0;
  const avgLagMins = Math.round((avgLagSeconds / 60) * 10) / 10;

  let avgLagFormatted = '0s';
  if (avgLagSeconds < 60) {
    avgLagFormatted = `${avgLagSeconds}s`;
  } else if (avgLagMins < 60) {
    avgLagFormatted = `${Math.floor(avgLagSeconds / 60)}m ${avgLagSeconds % 60}s`;
  } else {
    avgLagFormatted = `${Math.floor(avgLagMins / 60)}h ${Math.round(avgLagMins % 60)}m`;
  }

  const uniqueDriversDeclined = new Set(rejections.map(r => r.driver_id)).size;

  // 5. Driver Comparison Breakdown
  const driverBreakdowns = [];
  for (const d of driversList) {
    const dAssigned = allAssignments.filter(a => a.driver_id === d.id);
    const dRejections = rejections.filter(r => r.driver_id === d.id);
    const dEmergency = dRejections.filter(r => r.urgency === 'emergency').length;
    const dUrgent = dRejections.filter(r => r.urgency === 'urgent').length;
    const dNormal = dRejections.filter(r => r.urgency === 'normal' || !r.urgency).length;
    const dLagSum = dRejections.reduce((acc, r) => acc + (r.response_lag_seconds || 0), 0);
    const dAvgLagSec = dRejections.length > 0 ? Math.round(dLagSum / dRejections.length) : 0;
    const dAvgLagMin = Math.round((dAvgLagSec / 60) * 10) / 10;
    const dDeclineRate = dAssigned.length > 0 ? Math.round((dRejections.length / dAssigned.length) * 100) : 0;

    driverBreakdowns.push({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      vehicle_type: d.vehicle_type || 'two_wheeler',
      vehicle_number: d.vehicle_number || null,
      avatar_color: d.avatar_color,
      total_assigned: dAssigned.length,
      rejected_count: dRejections.length,
      emergency_count: dEmergency,
      urgent_count: dUrgent,
      normal_count: dNormal,
      decline_rate: dDeclineRate,
      avg_lag_seconds: dAvgLagSec,
      avg_lag_mins: dAvgLagMin,
      avg_lag_formatted: dAvgLagSec < 60 ? `${dAvgLagSec}s` : `${Math.floor(dAvgLagSec / 60)}m ${dAvgLagSec % 60}s`,
    });
  }

  // Sort by highest rejections first
  driverBreakdowns.sort((a, b) => b.rejected_count - a.rejected_count || b.decline_rate - a.decline_rate);

  const topDecliningDriver = driverBreakdowns.find(d => d.rejected_count > 0) || null;

  return {
    period,
    startDate: startIso,
    endDate: endIso,
    targetDriver,
    targetHospital,
    driversList,
    hospitalsList,
    summary: {
      total_rejected: totalRejected,
      total_assigned: totalAssigned,
      overall_decline_rate: overallDeclineRate,
      emergency_count: emergencyCount,
      urgent_count: urgentCount,
      normal_count: normalCount,
      emergency_share_percent: emergencySharePercent,
      avg_lag_seconds: avgLagSeconds,
      avg_lag_mins: avgLagMins,
      avg_lag_formatted: avgLagFormatted,
      unique_drivers_declined: uniqueDriversDeclined,
      total_drivers_count: driversList.length,
      top_declining_driver: topDecliningDriver,
    },
    driverBreakdowns: !targetDriver ? driverBreakdowns : null,
    rejections,
  };
}

module.exports = {
  resolveDateRange,
  getDriverReport,
  getHospitalReport,
  getRejectionsReport,
};
