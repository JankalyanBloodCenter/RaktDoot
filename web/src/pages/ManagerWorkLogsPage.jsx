import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, Shield,
  Search, Filter, Download, RefreshCw, Calendar, ArrowRight,
  Truck, User, MapPin, Building2, Flame, ChevronRight, X, ExternalLink, Droplet, MessageSquare
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/common/LanguageToggle';
import api from '../services/api';
import harbingerLogo from '../assets/harbinger_logo_actual.png';

export default function ManagerWorkLogsPage() {
  const { socket } = useSocket();
  const { t } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_completed: 0,
    total_duration_mins: 0,
    active_drivers: 0,
    emergency_runs: 0,
    urgent_runs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchWorkLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        api.get('/work-logs?limit=200'),
        api.get('/work-logs/stats'),
      ]);
      if (logsRes.data?.success) {
        setLogs(logsRes.data.data || []);
      }
      if (statsRes.data?.success) {
        setStats(statsRes.data.data || {});
      }
    } catch (err) {
      console.error('[WorkLogs] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkLogs();
  }, [fetchWorkLogs]);

  // Real-time updates when driver completes any run
  useEffect(() => {
    if (!socket) return;
    const handleWorkLogAdded = ({ workLog }) => {
      if (workLog) {
        setLogs(prev => {
          const exists = prev.some(l =>
            l.id === workLog.id ||
            (workLog.assignment_id && l.assignment_id === workLog.assignment_id) ||
            (l.driver_id === workLog.driver_id && l.destination_id === workLog.destination_id && Math.abs(new Date(l.completed_at || l.created_at || Date.now()) - new Date(workLog.completed_at || workLog.created_at || Date.now())) < 30000)
          );
          if (exists) return prev;
          return [workLog, ...prev];
        });
        setStats(prev => ({
          ...prev,
          total_completed: (Number(prev.total_completed) || 0) + 1,
          total_duration_mins: (Number(prev.total_duration_mins) || 0) + (Number(workLog.duration_mins) || 0),
          emergency_runs: workLog.urgency === 'emergency' ? (Number(prev.emergency_runs) || 0) + 1 : prev.emergency_runs,
        }));
      }
    };

    socket.on('work_log_added', handleWorkLogAdded);
    return () => {
      socket.off('work_log_added', handleWorkLogAdded);
    };
  }, [socket]);

  // Filtered logs with deduplication
  const filteredLogs = useMemo(() => {
    const seen = new Set();
    return logs.filter(log => {
      if (urgencyFilter !== 'all' && log.urgency !== urgencyFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = (
          (log.destination_name && log.destination_name.toLowerCase().includes(q)) ||
          (log.driver_name && log.driver_name.toLowerCase().includes(q)) ||
          (log.notes && log.notes.toLowerCase().includes(q)) ||
          (log.destination_address && log.destination_address.toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      const key = (log.assignment_id && log.assignment_id.trim() !== '')
        ? `assign-${log.assignment_id}`
        : `${log.driver_id || log.driver_name}-${log.destination_id || log.destination_name}-${(log.completed_at || log.created_at || '').slice(0, 16)}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [logs, urgencyFilter, searchQuery]);

  // Export CSV
  const exportToCSV = () => {
    if (!filteredLogs.length) return;
    const headers = ['Log ID', 'Driver Name', 'Driver Phone', 'Destination', 'Address', 'Urgency', 'Blood Category', 'Units (Bags)', 'Duration (Mins)', 'Completed At', 'Notes'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${(l.driver_name || '').replace(/"/g, '""')}"`,
      `"${(l.driver_phone || '').replace(/"/g, '""')}"`,
      `"${(l.destination_name || '').replace(/"/g, '""')}"`,
      `"${(l.destination_address || '').replace(/"/g, '""')}"`,
      l.urgency,
      `"${(l.category || 'red_blood_cell').toUpperCase()}"`,
      l.unit_count || 1,
      l.duration_mins || 0,
      l.completed_at || '',
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RaktDoot_Work_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' · ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return isoStr;
    }
  };

  const formatHoursMins = (totalMins) => {
    const mins = Number(totalMins) || 0;
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="page-content-full" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              flexShrink: 0,
            }}
          >
            <ClipboardList size={18} />
          </div>
          <div>
            <div className="topbar-title" style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{t.workLogs || 'Completed Work Logs'}</span>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontWeight: 700,
                }}
              >
                LIVE AUDIT
              </span>
            </div>
            <div className="topbar-subtitle" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Permanent record of completed blood transport missions, delivery timestamps & driver run metrics
            </div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={fetchWorkLogs}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            title="Refresh logs"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#059669', borderColor: '#10b981' }}
            title="Export to CSV Spreadsheet"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <LanguageToggle />
          <div style={{ height: 24, width: 1, background: 'var(--border-default)' }} />
          <img src={harbingerLogo} alt="Harbinger Group" style={{ height: 26, objectFit: 'contain', display: 'block' }} />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Metric Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* Card 1: Completed Runs */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Total Completed Runs
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                {stats.total_completed || 0}
              </div>
            </div>
          </div>

          {/* Card 2: Total Transit Time */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Total Transit Time
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                {formatHoursMins(stats.total_duration_mins)}
              </div>
            </div>
          </div>

          {/* Card 3: Emergency Runs */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Flame size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Emergency STAT Runs
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                {stats.emergency_runs || 0}
              </div>
            </div>
          </div>

          {/* Card 4: Active Drivers Recorded */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Truck size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Drivers Contributing
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                {stats.active_drivers || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--bg-card)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hospital, driver name, or notes..."
              className="input"
              style={{ paddingLeft: 36, height: 38, fontSize: 13, width: '100%' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Urgency Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={13} /> Urgency:
            </span>
            {[
              { key: 'all', label: 'All' },
              { key: 'normal', label: 'Normal' },
              { key: 'urgent', label: 'Urgent' },
              { key: 'emergency', label: '🚨 Emergency' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setUrgencyFilter(tab.key)}
                className={`btn btn-xs ${urgencyFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontWeight: urgencyFilter === tab.key ? 700 : 500,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Work Logs Table */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          {loading && logs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              <div>Loading completed work logs...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <ClipboardList size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>No work logs found</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {searchQuery || urgencyFilter !== 'all'
                  ? 'Try adjusting your filters or search terms.'
                  : 'Completed blood transport missions will automatically appear here.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                      Completed Time
                    </th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                      Driver
                    </th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                      Destination & Route
                    </th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                      Urgency
                    </th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                      Duration
                    </th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const isEmergency = log.urgency === 'emergency';
                    const isUrgent = log.urgency === 'urgent';

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Completed Date / Time */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f8fafc', fontWeight: 600 }}>
                            <Calendar size={13} style={{ color: '#94a3b8' }} />
                            <span>{formatDateTime(log.completed_at)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Ref: {log.id.slice(0, 12)}
                          </div>
                        </td>

                        {/* Driver */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: log.driver_avatar || '#06b6d4',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#ffffff',
                                flexShrink: 0,
                              }}
                            >
                              {log.driver_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'D'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                                {log.driver_name || 'Driver'}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                {log.driver_phone || 'No phone'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Destination */}
                        <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#f8fafc' }}>
                            <Building2 size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.destination_name}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.destination_address || 'Pune Hub'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: log.category === 'plasma' ? 'rgba(245, 158, 11, 0.15)'
                                : log.category === 'cryo' ? 'rgba(56, 189, 248, 0.15)'
                                : log.category === 'platelets' ? 'rgba(168, 85, 247, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                              border: log.category === 'plasma' ? '1px solid rgba(245, 158, 11, 0.3)'
                                : log.category === 'cryo' ? '1px solid rgba(56, 189, 248, 0.3)'
                                : log.category === 'platelets' ? '1px solid rgba(168, 85, 247, 0.3)'
                                : '1px solid rgba(239, 68, 68, 0.3)',
                              color: log.category === 'plasma' ? '#fbbf24'
                                : log.category === 'cryo' ? '#38bdf8'
                                : log.category === 'platelets' ? '#c084fc'
                                : '#fca5a5',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}>
                              <Droplet size={11} style={{
                                color: log.category === 'plasma' ? '#fbbf24'
                                  : log.category === 'cryo' ? '#38bdf8'
                                  : log.category === 'platelets' ? '#c084fc'
                                  : '#f87171',
                              }} />
                              <span>{log.unit_count || 1} {(log.unit_count || 1) > 1 ? 'Bags' : 'Bag'} · {
                                log.category === 'plasma' ? 'Plasma'
                                : log.category === 'cryo' ? 'Cryo'
                                : log.category === 'platelets' ? 'Platelets'
                                : log.category === 'red_blood_cell' || log.category === 'rbc' ? 'Red Blood Cell'
                                : log.category || 'Red Blood Cell'
                              }</span>
                            </span>
                          </div>
                          {log.notes && (
                            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MessageSquare size={11} style={{ color: '#94a3b8' }} />
                              <span>{log.notes.slice(0, 65)}{log.notes.length > 65 ? '...' : ''}</span>
                            </div>
                          )}
                        </td>

                        {/* Urgency */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 12,
                              background: isEmergency
                                ? 'rgba(239, 68, 68, 0.2)'
                                : isUrgent
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(59, 130, 246, 0.15)',
                              color: isEmergency ? '#f87171' : isUrgent ? '#fbbf24' : '#60a5fa',
                              border: isEmergency
                                ? '1px solid rgba(239, 68, 68, 0.4)'
                                : isUrgent
                                ? '1px solid rgba(245, 158, 11, 0.4)'
                                : '1px solid rgba(59, 130, 246, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {isEmergency && <Flame size={12} />}
                            {log.urgency ? log.urgency.toUpperCase() : 'NORMAL'}
                          </span>
                        </td>

                        {/* Duration */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f8fafc', fontWeight: 600 }}>
                            <Clock size={13} style={{ color: '#34d399' }} />
                            <span>{log.duration_mins || 1} mins</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 9px',
                              borderRadius: 12,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={12} />
                            COMPLETED
                          </span>
                        </td>

                        {/* Action View */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="btn btn-secondary btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                          >
                            <span>Details</span>
                            <ChevronRight size={13} />
                          </button>
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

      {/* Details Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 16,
              maxWidth: 560,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ClipboardList size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                    Work Log Audit Entry
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Reference ID: {selectedLog.id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Route Card */}
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                  Mission Route
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                  <span>{selectedLog.source_name || 'Jankalyan Blood Centre (Swargate HQ)'}</span>
                  <ArrowRight size={14} style={{ color: '#38bdf8' }} />
                  <span style={{ color: '#38bdf8' }}>{selectedLog.destination_name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  📍 {selectedLog.destination_address}
                </div>
              </div>

              {/* Driver & Urgency Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Assigned Driver
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                    {selectedLog.driver_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    📞 {selectedLog.driver_phone || 'No phone'}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Urgency & Transit Time
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: selectedLog.urgency === 'emergency' ? '#f87171' : '#34d399', marginTop: 4 }}>
                    {selectedLog.urgency?.toUpperCase() || 'NORMAL'} · {selectedLog.duration_mins || 0} mins
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    Status: Verified Completed
                  </div>
                </div>
              </div>

              {/* Timeline Timestamps */}
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                  Timestamps Timeline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  {selectedLog.assigned_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span>Dispatched At:</span>
                      <span style={{ color: '#f8fafc' }}>{formatDateTime(selectedLog.assigned_at)}</span>
                    </div>
                  )}
                  {selectedLog.accepted_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span>Driver Accepted:</span>
                      <span style={{ color: '#f8fafc' }}>{formatDateTime(selectedLog.accepted_at)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Mission Completed:</span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>{formatDateTime(selectedLog.completed_at)}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Notes */}
              {selectedLog.notes && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase' }}>
                    Blood Collection / Clinical Notes
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4, lineHeight: 1.5 }}>
                    {selectedLog.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
