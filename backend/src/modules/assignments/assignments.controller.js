'use strict';
const assignmentsService = require('./assignments.service');
const notificationsService = require('../notifications/notifications.service');
const worklogsService = require('../worklogs/worklogs.service');
const { getIO } = require('../../sockets/socket.handler');

function getAllAssignments(req, res, next) {
  try {
    const { status, driver_id, destination_id, limit } = req.query;
    const assignments = assignmentsService.getAllAssignments({
      status,
      driver_id,
      destination_id,
      limit,
    });
    res.json({ success: true, data: assignments, count: assignments.length });
  } catch (err) {
    next(err);
  }
}

function getActiveAssignment(req, res, next) {
  try {
    const assignment = assignmentsService.getActiveAssignmentForDriver(req.user.id);
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

function getAssignmentById(req, res, next) {
  try {
    const assignment = assignmentsService.getAssignmentById(req.params.id);
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

const { sendDriverCollectionPush } = require('../../services/pushNotification.service');

function createAssignment(req, res, next) {
  try {
    const {
      destination_id,
      driver_id,
      source_name,
      source_lat,
      source_lng,
      urgency,
      category,
      unit_count,
      notes,
    } = req.body;

    const assignment = assignmentsService.createAssignment({
      destination_id,
      driver_id,
      assigned_by: req.user.id,
      source_name,
      source_lat,
      source_lng,
      urgency,
      category: category || 'red_blood_cell',
      unit_count: parseInt(unit_count, 10) || 1,
      notes,
    });

    try {
      const io = getIO();
      const payload = {
        assignment,
        destination: {
          id: assignment.destination_id,
          name: assignment.destination_name,
          address: assignment.destination_address,
          lat: assignment.destination_lat,
          lng: assignment.destination_lng,
          radius_m: assignment.destination_radius_m,
          description: assignment.destination_description,
        },
      };

      // Notify driver in their private room
      io.to(`driver:${driver_id}`).emit('task_assigned', payload);
      io.to(`driver:${driver_id}`).emit('new_collection_request', payload);

      // Broadcast update to fleet monitors
      io.to('fleet-monitors').emit('assignment_status_changed', { assignment });
      io.to('fleet-monitors').emit('request_status_updated', { assignment });
    } catch (_) {}

    // Send Expo Push Notification asynchronously
    const urgencyLabel = assignment.urgency === 'emergency' ? '🚨 STAT / EMERGENCY' : assignment.urgency === 'urgent' ? '⚠️ URGENT' : '🩸';
    sendDriverCollectionPush({
      driverId: driver_id,
      title: `${urgencyLabel} Blood Collection Request`,
      body: `Pickup: ${assignment.source_name || 'Jankalyan HQ'} ➔ Destination: ${assignment.destination_name}`,
      data: {
        type: 'collection_request',
        assignmentId: assignment.id,
        destinationId: assignment.destination_id,
      },
    }).catch(() => {});

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

function updateAssignmentStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const assignment = assignmentsService.updateAssignmentStatus(
      req.params.id,
      status,
      req.user.id,
      req.user.role
    );

    try {
      const io = getIO();
      io.to('fleet-monitors').emit('assignment_status_changed', { assignment });
      io.to('fleet-monitors').emit('request_status_updated', { assignment });
      io.to(`driver:${assignment.driver_id}`).emit('assignment_status_changed', { assignment });

      // ONLY broadcast alerts and create DB records if status actually transitioned
      if (assignment._statusChanged) {
        // ── DRIVER REJECTED REQUEST: NOTIFY MANAGER ──
        if (status === 'rejected') {
          const notif = notificationsService.createGeofenceNotification({
            manager_id: assignment.assigned_by || 'user-mgr-001',
            driver_id: assignment.driver_id,
            destination_id: assignment.destination_id,
            assignment_id: assignment.id,
            type: 'request_rejected',
            message: `DECLINED: Driver ${assignment.driver_name} rejected the collection request for ${assignment.destination_name}. Please reassign to another driver.`,
            distance_m: 0,
          });

          io.to('fleet-monitors').emit('notification_new', { notification: notif });
          io.to('fleet-monitors').emit('request_rejected_alert', {
            assignment_id: assignment.id,
            driver_id: assignment.driver_id,
            driver_name: assignment.driver_name,
            destination_id: assignment.destination_id,
            destination_name: assignment.destination_name,
            message: `Driver ${assignment.driver_name} rejected the collection request for ${assignment.destination_name}.`,
          });
        }

        // ── WORK COMPLETED: STORE IN WORK LOG & NOTIFY MANAGER ──
        if (status === 'completed') {
          let durationMins = 0;
          const startTime = assignment.accepted_at || assignment.assigned_at;
          if (startTime) {
            const diffMs = new Date(assignment.completed_at || Date.now()) - new Date(startTime);
            durationMins = Math.max(1, Math.round(diffMs / 60000));
          }

          const workLog = worklogsService.createWorkLog({
            assignment_id: assignment.id,
            driver_id: assignment.driver_id,
            destination_id: assignment.destination_id,
            source_name: assignment.source_name,
            destination_name: assignment.destination_name,
            destination_address: assignment.destination_address,
            urgency: assignment.urgency,
            category: assignment.category,
            unit_count: assignment.unit_count,
            notes: assignment.notes,
            assigned_at: assignment.assigned_at,
            accepted_at: assignment.accepted_at,
            completed_at: assignment.completed_at || new Date().toISOString(),
            duration_mins: durationMins,
          });

          const notif = notificationsService.createGeofenceNotification({
            manager_id: assignment.assigned_by || 'user-mgr-001',
            driver_id: assignment.driver_id,
            destination_id: assignment.destination_id,
            assignment_id: assignment.id,
            type: 'work_completed',
            message: `WORK COMPLETED: Driver ${assignment.driver_name} delivered / collected blood at ${assignment.destination_name} (${durationMins}m run). Saved in Work Log.`,
            distance_m: 0,
          });

          io.to('fleet-monitors').emit('notification_new', { notification: notif });
          io.to('fleet-monitors').emit('work_completed_alert', {
            assignment_id: assignment.id,
            driver_id: assignment.driver_id,
            driver_name: assignment.driver_name,
            destination_id: assignment.destination_id,
            destination_name: assignment.destination_name,
            completed_at: assignment.completed_at || new Date().toISOString(),
            duration_mins: durationMins,
            work_log_id: workLog?.id,
            message: `WORK COMPLETED: Driver ${assignment.driver_name} reached ${assignment.destination_name} and completed the blood collection task!`,
          });
          io.to('fleet-monitors').emit('work_log_added', { workLog });
        }
      }
    } catch (broadcastErr) {
      console.warn('[Assignments] Socket broadcast / notification error:', broadcastErr.message);
    }

    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

function updateAssignmentDetails(req, res, next) {
  try {
    const { urgency, category, unit_count, notes, driver_id } = req.body;
    const assignment = assignmentsService.updateAssignmentDetails(req.params.id, {
      urgency,
      category,
      unit_count,
      notes,
      driver_id,
    });

    try {
      const io = getIO();
      io.to('fleet-monitors').emit('assignment_updated', { assignment });
      io.to(`driver-${assignment.driver_id}`).emit('assignment_updated', { assignment });
    } catch (socketErr) {
      console.warn('[Assignments] Socket emit error on update:', socketErr.message);
    }

    res.json({ success: true, data: assignment, message: 'Assignment details updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllAssignments,
  getActiveAssignment,
  getAssignmentById,
  createAssignment,
  updateAssignmentDetails,
  updateAssignmentStatus,
};
