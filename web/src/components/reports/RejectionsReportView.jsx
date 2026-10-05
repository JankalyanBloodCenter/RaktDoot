import { useState } from 'react';
import {
  XCircle, AlertTriangle, Clock, Users,
  Phone, Mail, Search, Zap,
  TrendingDown, ShieldAlert, ArrowUpRight,
  Hospital, UserX, AlertOctagon, HelpCircle,
  FileSpreadsheet, Check
} from 'lucide-react';
import { format } from 'date-fns';

export default function RejectionsReportView({ data, loading }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div
          className="animate-spin"
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--border-default)',
            borderTopColor: '#ef4444',
            borderRadius: '50%',
            margin: '0 auto 16px',
          }}
        />
        <div>Generating declined & rejected requests report...</div>
      </div>
    );
  }

  if (!data) return null;

  const { targetDriver, targetHospital, summary, driverBreakdowns, rejections } = data;

  const filteredRejections = (rejections || []).filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.destination_name?.toLowerCase().includes(term) ||
      r.driver_name?.toLowerCase().includes(term) ||
      r.assigned_by_name?.toLowerCase().includes(term) ||
      r.rejection_reason?.toLowerCase().includes(term) ||
      r.vehicle_number?.toLowerCase().includes(term) ||
      r.urgency?.toLowerCase().includes(term) ||
      r.category?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* 1. Header Scope Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(15, 23, 42, 0.7) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 14,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
            }}
          >
            <XCircle size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                {targetDriver
                  ? `Decline History · ${targetDriver.name}`
                  : targetHospital
                  ? `Hospital Declines · ${targetHospital.name}`
                  : 'Declined & Rejected Requests Analysis'}
              </span>

              {targetDriver && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: targetDriver.vehicle_type === 'four_wheeler' ? '#38bdf8' : '#34d399',
                    background:
                      targetDriver.vehicle_type === 'four_wheeler'
                        ? 'rgba(56, 189, 248, 0.15)'
                        : 'rgba(52, 211, 153, 0.15)',
                    border: `1px solid ${
                      targetDriver.vehicle_type === 'four_wheeler'
                        ? 'rgba(56, 189, 248, 0.4)'
                        : 'rgba(52, 211, 153, 0.4)'
                    }`,
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  {targetDriver.vehicle_type === 'four_wheeler' ? '🚐 Four Wheeler' : '🛵 Two Wheeler'}
                  {targetDriver.vehicle_number ? ` · ${targetDriver.vehicle_number}` : ''}
                </span>
              )}

              {targetHospital && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.18)',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  {targetHospital.address || 'Hospital Location'}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginTop: 4,
                fontSize: 12,
                color: 'var(--text-muted)',
                flexWrap: 'wrap',
              }}
            >
              <span>
                Report Window: <strong style={{ color: 'var(--text-primary)' }}>{data.startDate.slice(0, 10)}</strong>{' '}
                to <strong style={{ color: 'var(--text-primary)' }}>{data.endDate.slice(0, 10)}</strong>
              </span>
              <span>•</span>
              <span>
                Total Dispatches Audited: <strong style={{ color: 'var(--text-primary)' }}>{summary.total_assigned}</strong>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              EMERGENCY SHARE
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: summary.emergency_share_percent > 0 ? '#ef4444' : '#34d399',
              }}
            >
              {summary.emergency_share_percent}%
            </div>
          </div>

          <div style={{ height: 32, width: 1, background: 'var(--border-default)' }} />

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              TOTAL DECLINED
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>
              {summary.total_rejected}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Analytical KPI Summary Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {/* Card 1: Total Declines */}
        <div
          className="stat-card"
          style={{
            padding: '14px 16px',
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Declines
            </span>
            <XCircle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{summary.total_rejected}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Out of {summary.total_assigned} total dispatches
          </div>
        </div>

        {/* Card 2: Emergency STAT Declines */}
        <div
          className="stat-card"
          style={{
            padding: '14px 16px',
            background: summary.emergency_count > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)',
            borderRadius: 12,
            border: `1px solid ${summary.emergency_count > 0 ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-default)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
              Emergency STAT 🚨
            </span>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171' }}>{summary.emergency_count}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.emergency_count > 0 ? 'Critical life-saving requests rejected' : 'Zero emergency declines'}
          </div>
        </div>

        {/* Card 3: Overall Decline Rate */}
        <div
          className="stat-card"
          style={{
            padding: '14px 16px',
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Decline Rate
            </span>
            <TrendingDown size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: summary.overall_decline_rate > 15 ? '#ef4444' : summary.overall_decline_rate > 5 ? '#f59e0b' : '#10b981',
            }}
          >
            {summary.overall_decline_rate}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Fleet-wide task rejection ratio
          </div>
        </div>

        {/* Card 4: Average Response Turnaround */}
        <div
          className="stat-card"
          style={{
            padding: '14px 16px',
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Avg Decline Speed
            </span>
            <Clock size={16} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>{summary.avg_lag_formatted}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Time from dispatch to decline
          </div>
        </div>

        {/* Card 5: Unique Drivers Who Declined */}
        <div
          className="stat-card"
          style={{
            padding: '14px 16px',
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Drivers With Declines
            </span>
            <UserX size={16} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#a855f7' }}>
            {summary.unique_drivers_declined}
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
              {' '}/ {summary.total_drivers_count}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Drivers who declined at least 1 task
          </div>
        </div>
      </div>

      {/* 3. Driver Rejection Leaderboard / Comparative Matrix (Visible when All Drivers is selected) */}
      {!targetDriver && driverBreakdowns && driverBreakdowns.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 14,
            padding: '16px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserX size={16} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Driver Rejection Comparative Matrix
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Ordered by total declines & decline percentage
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>Vehicle</th>
                  <th style={{ textAlign: 'center' }}>Total Dispatched</th>
                  <th style={{ textAlign: 'center' }}>Declined Requests</th>
                  <th style={{ textAlign: 'center' }}>Decline Rate (%)</th>
                  <th style={{ textAlign: 'center' }}>Emergency Declines</th>
                  <th style={{ textAlign: 'center' }}>Avg Response Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {driverBreakdowns.map((d) => {
                  const initials = d.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'DR';
                  const isTopDecliner = summary.top_declining_driver?.id === d.id && d.rejected_count > 0;

                  return (
                    <tr
                      key={d.id}
                      style={{
                        background: isTopDecliner ? 'rgba(239, 68, 68, 0.04)' : undefined,
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            className="user-avatar"
                            style={{
                              background: d.avatar_color || '#ef4444',
                              width: 32,
                              height: 32,
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 8,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {d.name}
                              {isTopDecliner && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                  }}
                                >
                                  Highest Declines
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.phone || d.email}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: 11.5 }}>
                          {d.vehicle_type === 'four_wheeler' ? '🚐 4W' : '🛵 2W'}
                          {d.vehicle_number ? ` · ${d.vehicle_number}` : ''}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{d.total_assigned}</td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: d.rejected_count > 0 ? '#ef4444' : '#10b981',
                            fontSize: 13,
                          }}
                        >
                          {d.rejected_count}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 48,
                              height: 6,
                              background: 'var(--bg-card-hover)',
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, d.decline_rate)}%`,
                                height: '100%',
                                background: d.decline_rate > 15 ? '#ef4444' : d.decline_rate > 5 ? '#f59e0b' : '#10b981',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontWeight: 700,
                              color: d.decline_rate > 15 ? '#ef4444' : d.decline_rate > 5 ? '#f59e0b' : '#10b981',
                            }}
                          >
                            {d.decline_rate}%
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {d.emergency_count > 0 ? (
                          <span
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: 11.5,
                            }}
                          >
                            🚨 {d.emergency_count} STAT
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {d.rejected_count > 0 ? d.avg_lag_formatted : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Detailed Line-Item Rejection Logs Table */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 14,
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Detailed Rejection & Decline Log Records ({filteredRejections.length})
            </span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: 280 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
              placeholder="Search by hospital, driver, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredRejections.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
            }}
          >
            <Check size={28} style={{ color: '#10b981', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
              No Declined Requests Found
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {searchTerm
                ? 'No rejected dispatches match your search filters.'
                : 'Excellent! No collection requests were declined during this time period.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Timing & Turnaround</th>
                  <th>Driver Details</th>
                  <th>Dispatched By</th>
                  <th>Destination Hospital</th>
                  <th>Urgency & Units</th>
                  <th>Reason / Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRejections.map((r) => {
                  const assignedDate = r.assigned_at ? new Date(r.assigned_at) : null;
                  const rejectedDate = r.effective_rejected_at ? new Date(r.effective_rejected_at) : null;
                  const initials = r.driver_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'DR';

                  return (
                    <tr key={r.id}>
                      {/* Timing & Lag */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={12} />
                            {rejectedDate ? format(rejectedDate, 'dd MMM yyyy, HH:mm') : 'N/A'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Dispatched: {assignedDate ? format(assignedDate, 'HH:mm:ss') : 'N/A'}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              padding: '1px 5px',
                              borderRadius: 4,
                              display: 'inline-block',
                              width: 'fit-content',
                              marginTop: 2,
                            }}
                          >
                            ⏱️ Declined in {r.response_lag_formatted}
                          </span>
                        </div>
                      </td>

                      {/* Driver Details */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            className="user-avatar"
                            style={{
                              background: r.driver_avatar || '#ef4444',
                              width: 28,
                              height: 28,
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 7,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.driver_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {r.vehicle_type === 'four_wheeler' ? '🚐 4W' : '🛵 2W'}
                              {r.vehicle_number ? ` · ${r.vehicle_number}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Dispatched By */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.assigned_by_name || 'System Dispatch'}
                        </div>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: '#a855f7',
                            textTransform: 'uppercase',
                          }}
                        >
                          {r.assigned_by_role || 'Manager'}
                        </span>
                      </td>

                      {/* Destination Hospital */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.destination_name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            maxWidth: 200,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={r.destination_address}
                        >
                          {r.destination_address || 'Pune, Maharashtra'}
                        </div>
                      </td>

                      {/* Urgency & Units */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span
                            className={`badge badge-${
                              r.urgency === 'emergency' ? 'danger' : r.urgency === 'urgent' ? 'warning' : 'primary'
                            }`}
                            style={{ width: 'fit-content', fontSize: 11, fontWeight: 700 }}
                          >
                            {r.urgency === 'emergency'
                              ? '🚨 EMERGENCY'
                              : r.urgency === 'urgent'
                              ? '⚠️ URGENT'
                              : 'NORMAL'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.category?.replace(/_/g, ' ').toUpperCase() || 'RBC'} · {r.unit_count || 1} Bag(s)
                          </span>
                        </div>
                      </td>

                      {/* Reason / Notes */}
                      <td>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#f8fafc',
                            background: 'rgba(255, 255, 255, 0.03)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-subtle)',
                            maxWidth: 240,
                          }}
                        >
                          {r.rejection_reason || r.notes || 'Driver declined request'}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            padding: '3px 8px',
                            borderRadius: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <XCircle size={12} /> DECLINED
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
