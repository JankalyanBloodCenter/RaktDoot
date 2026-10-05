'use strict';
const reportsService = require('./reports.service');

function getDriverReport(req, res, next) {
  try {
    const { driverId, period, startDate, endDate } = req.query;
    const report = reportsService.getDriverReport({ driverId, period, startDate, endDate });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

function getHospitalReport(req, res, next) {
  try {
    const { destinationId, period, startDate, endDate } = req.query;
    const report = reportsService.getHospitalReport({ destinationId, period, startDate, endDate });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

function getRejectionsReport(req, res, next) {
  try {
    const { driverId, destinationId, urgency, period, startDate, endDate } = req.query;
    const report = reportsService.getRejectionsReport({ driverId, destinationId, urgency, period, startDate, endDate });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

function csvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function toCsvRow(arr) {
  return arr.map(csvCell).join(',');
}

function exportCSV(req, res, next) {
  try {
    const { type, driverId, destinationId, urgency, period, startDate, endDate } = req.query;
    const nowIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

    if (type === 'rejections') {
      const data = reportsService.getRejectionsReport({ driverId, destinationId, urgency, period, startDate, endDate });
      const rows = [];

      // 1. Executive Metadata Header
      rows.push(toCsvRow(['RAKTDOOT COLD-CHAIN FLEET TRACKER - JANKALYAN BLOOD CENTRE PUNE']));
      rows.push(toCsvRow(['DECLINED & REJECTED DISPATCH REQUESTS PERFORMANCE REPORT']));
      rows.push(toCsvRow(['------------------------------------------------------------------------------------------------']));
      rows.push(toCsvRow(['Reporting Period:', `${data.period.replace(/_/g, ' ').toUpperCase()} (${data.startDate} to ${data.endDate})`]));
      rows.push(toCsvRow(['Report Generation Time:', `${nowIst} IST`]));
      if (data.targetDriver) {
        rows.push(toCsvRow(['Target Driver:', data.targetDriver.name]));
        rows.push(toCsvRow(['Driver Contact:', data.targetDriver.phone || 'N/A']));
        rows.push(toCsvRow(['Vehicle Assigned:', `${data.targetDriver.vehicle_type === 'four_wheeler' ? 'Four Wheeler (Van/Car)' : 'Two Wheeler (Bike)'} - ${data.targetDriver.vehicle_number || 'N/A'}`]));
      } else {
        rows.push(toCsvRow(['Target Driver Scope:', 'ALL FLEET DRIVERS']));
      }
      if (data.targetHospital) {
        rows.push(toCsvRow(['Target Destination:', data.targetHospital.name]));
      } else {
        rows.push(toCsvRow(['Target Destination Scope:', 'ALL HOSPITALS & COLLECTION CENTERS']));
      }
      if (urgency && urgency !== 'all') {
        rows.push(toCsvRow(['Urgency Filter:', urgency.toUpperCase()]));
      }
      rows.push(toCsvRow([])); // blank row

      // 2. Key Performance Indicators (KPI Summary)
      rows.push(toCsvRow(['==================== KEY PERFORMANCE INDICATORS (KPIS) ====================']));
      rows.push(toCsvRow(['METRIC NAME', 'VALUE', 'UNIT / DESCRIPTION']));
      rows.push(toCsvRow(['Total Dispatched Tasks', data.summary.total_assigned, 'Total collection requests dispatched in this window']));
      rows.push(toCsvRow(['Total Declined / Rejected Requests', data.summary.total_rejected, 'Dispatches rejected by drivers']));
      rows.push(toCsvRow(['Overall Fleet Decline Rate', `${data.summary.overall_decline_rate}%`, 'Percentage of dispatched tasks rejected by fleet']));
      rows.push(toCsvRow(['Emergency STAT Declines', data.summary.emergency_count, 'Critical emergency blood requests that were declined']));
      rows.push(toCsvRow(['Urgent Declines', data.summary.urgent_count, 'High-priority collection requests declined']));
      rows.push(toCsvRow(['Normal Routine Declines', data.summary.normal_count, 'Standard routine collection requests declined']));
      rows.push(toCsvRow(['Emergency Share %', `${data.summary.emergency_share_percent}%`, 'Share of declined tasks that were critical emergencies']));
      rows.push(toCsvRow(['Average Turnaround Time to Decline', `${data.summary.avg_lag_mins} mins`, `Drivers took on average ${data.summary.avg_lag_formatted} to reject requests`]));
      rows.push(toCsvRow(['Unique Drivers with Declines', data.summary.unique_drivers_declined, `Out of ${data.summary.total_drivers_count} registered drivers`]));
      if (data.summary.top_declining_driver) {
        rows.push(toCsvRow(['Driver With Most Declines', `${data.summary.top_declining_driver.name} (${data.summary.top_declining_driver.rejected_count} declines, ${data.summary.top_declining_driver.decline_rate}% decline rate)`]));
      }
      rows.push(toCsvRow([])); // blank row

      // 3. Driver Comparison Matrix
      if (!data.targetDriver && data.driverBreakdowns && data.driverBreakdowns.length > 0) {
        rows.push(toCsvRow(['==================== DRIVER REJECTION COMPARATIVE MATRIX ====================']));
        rows.push(toCsvRow([
          'Driver Name',
          'Phone',
          'Vehicle Type',
          'Vehicle Plate Number',
          'Total Dispatched Tasks',
          'Declined Tasks',
          'Decline Rate (%)',
          'Emergency STAT Declines',
          'Urgent Declines',
          'Normal Routine Declines',
          'Avg Response Turnaround'
        ]));

        for (const d of data.driverBreakdowns) {
          rows.push(toCsvRow([
            d.name,
            d.phone || 'N/A',
            d.vehicle_type === 'four_wheeler' ? 'Four Wheeler' : 'Two Wheeler',
            d.vehicle_number || 'N/A',
            d.total_assigned,
            d.rejected_count,
            `${d.decline_rate}%`,
            d.emergency_count,
            d.urgent_count,
            d.normal_count,
            d.avg_lag_formatted
          ]));
        }
        rows.push(toCsvRow([])); // blank row
      }

      // 4. Detailed Line-Item Rejection Logs
      rows.push(toCsvRow(['==================== DETAILED LINE-ITEM REJECTION LOGS ====================']));
      rows.push(toCsvRow([
        'Request ID',
        'Declined Date & Time',
        'Dispatched Date & Time',
        'Response Turnaround Lag',
        'Driver Name',
        'Driver Contact',
        'Vehicle Type',
        'Vehicle Number',
        'Dispatched By (Manager / Admin)',
        'Destination Hospital',
        'Destination Address',
        'Urgency Level',
        'Blood Category & Units',
        'Rejection Reason / Notes',
        'Dispatch Status'
      ]));

      if (data.rejections.length === 0) {
        rows.push(toCsvRow(['No declined requests recorded within the selected period.', '', '', '', '', '', '', '', '', '', '', '', '', '', '']));
      } else {
        for (const r of data.rejections) {
          rows.push(toCsvRow([
            r.id,
            r.effective_rejected_at || 'N/A',
            r.assigned_at || 'N/A',
            r.response_lag_formatted || 'N/A',
            r.driver_name || 'N/A',
            r.driver_phone || 'N/A',
            r.vehicle_type === 'four_wheeler' ? 'Four Wheeler (Van/Car)' : 'Two Wheeler (Bike)',
            r.vehicle_number || 'N/A',
            `${r.assigned_by_name || 'N/A'} (${(r.assigned_by_role || 'Manager').toUpperCase()})`,
            r.destination_name || 'N/A',
            r.destination_address || 'Pune, Maharashtra',
            (r.urgency || 'normal').toUpperCase(),
            `${r.category || 'Red Blood Cells'} (${r.unit_count || 1} units)`,
            r.rejection_reason || 'Driver declined request',
            'REJECTED / DECLINED'
          ]));
        }
      }

      // Prepend UTF-8 BOM (\uFEFF)
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const filename = data.targetDriver
        ? `raktdoot-rejections-driver-${data.targetDriver.name.replace(/\s+/g, '_')}-${Date.now()}.csv`
        : `raktdoot-all-rejections-report-${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);

    } else if (type === 'driver') {
      const data = reportsService.getDriverReport({ driverId, period, startDate, endDate });
      const rows = [];

      // 1. Executive Metadata Header
      rows.push(toCsvRow(['RAKTDOOT COLD-CHAIN FLEET TRACKER - JANKALYAN BLOOD CENTRE PUNE']));
      rows.push(toCsvRow(['DRIVER PERSONAL PERFORMANCE & ANALYTICS REPORT']));
      rows.push(toCsvRow(['------------------------------------------------------------------------------------------------']));
      rows.push(toCsvRow(['Reporting Period:', `${data.period.replace(/_/g, ' ').toUpperCase()} (${data.startDate} to ${data.endDate})`]));
      rows.push(toCsvRow(['Report Generation Time:', `${nowIst} IST`]));
      if (data.targetDriver) {
        rows.push(toCsvRow(['Target Driver:', data.targetDriver.name]));
        rows.push(toCsvRow(['Driver Contact:', data.targetDriver.phone || 'N/A']));
        rows.push(toCsvRow(['Assigned Vehicle:', `${data.targetDriver.vehicle_type === 'four_wheeler' ? 'Four Wheeler (Van/Car)' : 'Two Wheeler (Bike)'} - ${data.targetDriver.vehicle_number || 'N/A'}`]));
        rows.push(toCsvRow(['Account Status:', data.targetDriver.is_active ? 'ACTIVE' : 'INACTIVE']));
      } else {
        rows.push(toCsvRow(['Target Scope:', 'ALL FLEET DRIVERS (Consolidated Report)']));
        rows.push(toCsvRow(['Total Registered Drivers:', data.driversList ? data.driversList.length : 'N/A']));
      }
      rows.push(toCsvRow([])); // blank row

      // 2. Key Performance Indicators (KPI Summary)
      rows.push(toCsvRow(['==================== KEY PERFORMANCE INDICATORS (KPIS) ====================']));
      rows.push(toCsvRow(['METRIC NAME', 'VALUE', 'UNIT / DESCRIPTION']));
      rows.push(toCsvRow(['Total Assigned Delivery Tasks', data.summary.total_assigned, 'Total tasks dispatched']));
      rows.push(toCsvRow(['Completed Deliveries', data.summary.completed_count, 'Successfully delivered blood shipments']));
      rows.push(toCsvRow(['Task Acceptance Rate', `${data.summary.acceptance_rate}%`, 'Percentage of dispatched tasks accepted']));
      rows.push(toCsvRow(['Task Completion Rate', `${data.summary.completion_rate}%`, 'Percentage of completed vs assigned tasks']));
      rows.push(toCsvRow(['Total Distance Traversed', `${data.summary.total_distance_km} km`, 'Recorded cold-chain transit mileage']));
      rows.push(toCsvRow(['Total Active Transit Time', `${data.summary.total_duration_hours} hrs`, `${data.summary.total_duration_mins} total minutes in transit`]));
      rows.push(toCsvRow(['Average Trip Duration', `${data.summary.avg_duration_mins} mins`, 'Average minutes taken per delivery']));
      rows.push(toCsvRow(['Average Transit Velocity', `${data.summary.avg_speed_kmh} km/h`, 'Fleet cold-chain travel velocity']));
      rows.push(toCsvRow(['Emergency STAT Deliveries', data.summary.emergency_count, 'Critical life-saving deliveries performed']));
      rows.push(toCsvRow(['Urgent Deliveries', data.summary.urgent_count, 'High-priority deliveries performed']));
      rows.push(toCsvRow(['Normal Routine Deliveries', data.summary.normal_count, 'Standard scheduled deliveries performed']));
      rows.push(toCsvRow(['Vehicle Issues & Breakdowns', data.summary.total_issues, 'Total breakdown/hazard reports logged']));
      rows.push(toCsvRow([])); // blank row

      // 3. Driver Comparison Matrix (if All Drivers selected)
      if (!data.targetDriver && data.driverBreakdowns && data.driverBreakdowns.length > 0) {
        rows.push(toCsvRow(['==================== DRIVER COMPARATIVE PERFORMANCE MATRIX ====================']));
        rows.push(toCsvRow([
          'Driver Name',
          'Phone',
          'Vehicle Type',
          'Vehicle Plate Number',
          'Assigned Tasks',
          'Completed Deliveries',
          'Acceptance Rate (%)',
          'Total Distance (km)',
          'Total Transit (hrs)',
          'Avg Trip (mins)',
          'Breakdown Issues'
        ]));

        for (const d of data.driverBreakdowns) {
          rows.push(toCsvRow([
            d.name,
            d.phone || 'N/A',
            d.vehicle_type === 'four_wheeler' ? 'Four Wheeler' : 'Two Wheeler',
            d.vehicle_number || 'N/A',
            d.total_assigned,
            d.completed_count,
            `${d.acceptance_rate}%`,
            d.total_distance_km,
            d.total_duration_hours,
            d.avg_duration_mins,
            d.issues_count
          ]));
        }
        rows.push(toCsvRow([])); // blank row
      }

      // 4. Detailed Trip & Delivery Logs
      rows.push(toCsvRow(['==================== DETAILED TRIP & DELIVERY LOGS ====================']));
      rows.push(toCsvRow([
        'Delivery ID',
        'Completed Date & Time',
        'Assigned Date & Time',
        'Driver Name',
        'Vehicle Type',
        'Vehicle Number',
        'Origin Dispatch Hub',
        'Destination Hospital / Center',
        'Destination Address',
        'Urgency Level',
        'Distance (km)',
        'Duration (mins)',
        'Delivery Status',
        'Notes / Instructions'
      ]));

      const trips = data.workLogs.length > 0 ? data.workLogs : data.assignments;
      if (trips.length === 0) {
        rows.push(toCsvRow(['No delivery trips recorded within the selected period.', '', '', '', '', '', '', '', '', '', '', '', '', '']));
      } else {
        for (const t of trips) {
          rows.push(toCsvRow([
            t.id || t.assignment_id || 'N/A',
            t.completed_at || 'N/A',
            t.assigned_at || 'N/A',
            t.driver_name || (data.targetDriver ? data.targetDriver.name : 'N/A'),
            (t.vehicle_type || (data.targetDriver ? data.targetDriver.vehicle_type : '')) === 'four_wheeler' ? 'Four Wheeler (Van/Car)' : 'Two Wheeler (Bike)',
            t.vehicle_number || (data.targetDriver ? data.targetDriver.vehicle_number : 'N/A') || 'N/A',
            t.source_name || 'Jankalyan Blood Centre Pune',
            t.destination_name || 'N/A',
            t.destination_address || 'Pune, Maharashtra',
            (t.urgency || 'normal').toUpperCase(),
            parseFloat(t.distance_km || 0).toFixed(1),
            t.duration_mins || 0,
            (t.status || 'completed').toUpperCase(),
            t.notes || 'None'
          ]));
        }
      }

      // Prepend UTF-8 BOM (\uFEFF) for immediate Excel encoding recognition
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const filename = data.targetDriver
        ? `raktdoot-driver-${data.targetDriver.name.replace(/\s+/g, '_')}-${Date.now()}.csv`
        : `raktdoot-all-drivers-report-${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);

    } else {
      // Hospital Report CSV
      const data = reportsService.getHospitalReport({ destinationId, period, startDate, endDate });
      const rows = [];

      // 1. Executive Metadata Header
      rows.push(toCsvRow(['RAKTDOOT COLD-CHAIN FLEET TRACKER - JANKALYAN BLOOD CENTRE PUNE']));
      rows.push(toCsvRow(['HOSPITAL & DESTINATION DELIVERY PERFORMANCE REPORT']));
      rows.push(toCsvRow(['------------------------------------------------------------------------------------------------']));
      rows.push(toCsvRow(['Reporting Period:', `${data.period.replace(/_/g, ' ').toUpperCase()} (${data.startDate} to ${data.endDate})`]));
      rows.push(toCsvRow(['Report Generation Time:', `${nowIst} IST`]));
      if (data.targetHospital) {
        rows.push(toCsvRow(['Target Destination:', data.targetHospital.name]));
        rows.push(toCsvRow(['Hospital Address:', data.targetHospital.address || 'Pune, Maharashtra']));
        rows.push(toCsvRow(['Geofence Perimeter Radius:', `${data.targetHospital.radius_m} meters`]));
        rows.push(toCsvRow(['Destination Coordinates:', `${data.targetHospital.lat}, ${data.targetHospital.lng}`]));
      } else {
        rows.push(toCsvRow(['Target Scope:', 'ALL HOSPITALS & BLOOD STORAGE CENTERS']));
        rows.push(toCsvRow(['Total Registered Destinations:', data.hospitalsList ? data.hospitalsList.length : 'N/A']));
      }
      rows.push(toCsvRow([])); // blank row

      // 2. Key Performance Indicators (KPI Summary)
      rows.push(toCsvRow(['==================== KEY PERFORMANCE INDICATORS (KPIS) ====================']));
      rows.push(toCsvRow(['METRIC NAME', 'VALUE', 'UNIT / DESCRIPTION']));
      rows.push(toCsvRow(['Total Completed Blood Deliveries', data.summary.total_deliveries, 'Successfully fulfilled hospital consignments']));
      rows.push(toCsvRow(['Emergency STAT Deliveries', data.summary.emergency_count, 'Critical emergency blood units dispatched']));
      rows.push(toCsvRow(['Urgent Deliveries', data.summary.urgent_count, 'High-priority blood consignments']));
      rows.push(toCsvRow(['Normal Routine Deliveries', data.summary.normal_count, 'Standard scheduled replenishments']));
      rows.push(toCsvRow(['Average Delivery Transit Time', `${data.summary.avg_delivery_mins} mins`, 'Mean duration from hub dispatch to arrival']));
      rows.push(toCsvRow(['Total Delivery Distance Traversed', `${data.summary.total_distance_km} km`, 'Cumulative cold-chain transit mileage']));
      rows.push(toCsvRow(['Active Drivers Deployed', data.summary.unique_drivers_count, 'Unique fleet drivers assigned to this destination']));
      rows.push(toCsvRow(['Geofence Perimeter Arrival Hits', data.summary.geofence_arrivals_count, 'Automated GPS geofence arrival triggers']));
      rows.push(toCsvRow(['Two-Wheeler Deliveries', data.summary.vehicle_breakdown?.two_wheeler ?? 0, 'Dispatches via Bike/Motorcycle']));
      rows.push(toCsvRow(['Four-Wheeler Deliveries', data.summary.vehicle_breakdown?.four_wheeler ?? 0, 'Dispatches via Van/Ambulance/Car']));
      rows.push(toCsvRow([])); // blank row

      // 3. Hospital Comparison Breakdown (if All Hospitals selected)
      if (!data.targetHospital && data.hospitalBreakdowns && data.hospitalBreakdowns.length > 0) {
        rows.push(toCsvRow(['==================== HOSPITAL BREAKDOWN & VOLUME COMPARISON ====================']));
        rows.push(toCsvRow([
          'Hospital Destination',
          'Address',
          'Total Deliveries',
          'Emergency STAT',
          'Urgent',
          'Normal Routine',
          'Total Distance (km)',
          'Avg Transit (mins)',
          'Unique Drivers'
        ]));

        for (const h of data.hospitalBreakdowns) {
          rows.push(toCsvRow([
            h.name,
            h.address || 'Pune',
            h.total_deliveries,
            h.emergency_count,
            h.urgent_count,
            h.normal_count,
            h.total_distance_km,
            h.avg_delivery_mins,
            h.unique_drivers
          ]));
        }
        rows.push(toCsvRow([])); // blank row
      }

      // 4. Detailed Hospital Deliveries Log
      rows.push(toCsvRow(['==================== DETAILED HOSPITAL DELIVERY RECORDS ====================']));
      rows.push(toCsvRow([
        'Delivery ID',
        'Completed Date & Time',
        'Destination Hospital',
        'Destination Address',
        'Assigned Driver',
        'Driver Phone',
        'Vehicle Type',
        'Vehicle Number',
        'Origin Dispatch Hub',
        'Urgency Level',
        'Distance (km)',
        'Delivery Duration (mins)',
        'Status',
        'Notes / Instructions'
      ]));

      if (data.deliveries.length === 0) {
        rows.push(toCsvRow(['No deliveries recorded for this destination within the selected period.', '', '', '', '', '', '', '', '', '', '', '', '', '']));
      } else {
        for (const d of data.deliveries) {
          rows.push(toCsvRow([
            d.id || d.assignment_id || 'N/A',
            d.completed_at || 'N/A',
            d.destination_name || (data.targetHospital ? data.targetHospital.name : 'N/A'),
            d.destination_address || (data.targetHospital ? data.targetHospital.address : 'Pune'),
            d.driver_name || 'N/A',
            d.driver_phone || 'N/A',
            d.vehicle_type === 'four_wheeler' ? 'Four Wheeler (Van/Car)' : 'Two Wheeler (Bike)',
            d.vehicle_number || 'N/A',
            d.source_name || 'Jankalyan Blood Centre Pune',
            (d.urgency || 'normal').toUpperCase(),
            parseFloat(d.distance_km || 0).toFixed(1),
            d.duration_mins || 0,
            'COMPLETED',
            d.notes || 'None'
          ]));
        }
      }

      // Prepend UTF-8 BOM (\uFEFF)
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const filename = data.targetHospital
        ? `raktdoot-hospital-${data.targetHospital.name.replace(/\s+/g, '_')}-${Date.now()}.csv`
        : `raktdoot-all-hospitals-report-${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDriverReport,
  getHospitalReport,
  getRejectionsReport,
  exportCSV,
};
