import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, MapPin, Radio, Shield, Clock,
  ExternalLink, Check, Navigation, AlertCircle, Trash2
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/common/LanguageToggle';
import harbingerLogo from '../assets/harbinger_logo_actual.png';

export default function ManagerNotificationsPage() {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
  } = useSocket();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [filterUnread, setFilterUnread] = useState(false);

  const displayedNotifications = useMemo(() => {
    const list = filterUnread ? notifications.filter((n) => !n.is_read) : notifications;
    const seen = new Set();
    return list.filter((n) => {
      const key = (n.assignment_id && n.type)
        ? `${n.assignment_id}-${n.type}`
        : `${n.driver_id || n.driver_name}-${n.destination_id || n.destination_name}-${n.type || 'work_completed'}-${(n.message || '').replace(/\s+/g, ' ').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [notifications, filterUnread]);

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' · ' +
        d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <div className="page-content-full">
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              flexShrink: 0,
            }}
          >
            <Bell size={16} />
          </div>
          <div>
            <div className="topbar-title" style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
              {t.proximityAlerts || 'Proximity & Geofence Alerts'}
            </div>
            <div className="topbar-subtitle" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t.proximitySubtitle || 'Real-time arrival alerts when drivers enter delivery zones'}
            </div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {unreadNotificationsCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <CheckCheck size={14} style={{ color: '#10b981' }} />
              <span>{t.markAllRead || 'Mark All Read'}</span>
            </button>
          )}

          <LanguageToggle />
          <div style={{ height: 24, width: 1, background: 'var(--border-default)' }} />
          <img src={harbingerLogo} alt="Harbinger Group" style={{ height: 26, objectFit: 'contain', display: 'block' }} />
        </div>
      </div>

      {/* Main Container */}
      <div className="page-content">
        <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
          {/* Controls Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFilterUnread(false)}
              className={`btn btn-sm ${!filterUnread ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              All Alerts ({notifications.length})
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`btn btn-sm ${filterUnread ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              Unread ({unreadNotificationsCount})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total notifications: <strong>{notifications.length}</strong>
            </span>
            {notifications.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all notifications?')) {
                    clearAllNotifications();
                  }
                }}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: 11.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Clear all alerts"
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {displayedNotifications.length === 0 ? (
          <div
            style={{
              padding: 50,
              textAlign: 'center',
              background: 'var(--bg-card)',
              borderRadius: 12,
              border: '1px solid var(--border-default)',
            }}
          >
            <Bell size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
              {filterUnread ? 'No unread notifications' : 'No notifications yet'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {filterUnread
                ? 'All alerts have been read. Switch to "All Alerts" to review past events.'
                : 'Proximity alerts will trigger here automatically when drivers enter destination geofences.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayedNotifications.map((notif) => {
              const isUnread = !notif.is_read;
              const isRejected = notif.type === 'request_rejected';
              const isCompleted = notif.type === 'work_completed';

              const borderAccentColor = isRejected
                ? '#ef4444'
                : isCompleted
                ? '#10b981'
                : '#3b82f6';

              return (
                <div
                  key={notif.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: isUnread
                      ? (isRejected ? 'rgba(239, 68, 68, 0.08)' : 'rgba(30, 41, 59, 0.7)')
                      : 'var(--bg-card)',
                    border: isUnread
                      ? (isRejected ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)')
                      : '1px solid var(--border-default)',
                    borderLeft: isUnread ? `4px solid ${borderAccentColor}` : '1px solid var(--border-default)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {/* Driver Avatar */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: notif.driver_avatar || '#06b6d4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'white',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {notif.driver_name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>

                    {/* Details */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13.5 }}>
                          {notif.driver_name}
                        </span>

                        {isRejected ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: 'rgba(239, 68, 68, 0.18)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                            }}
                          >
                            🚫 Request Declined
                          </span>
                        ) : isCompleted ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: 'rgba(16, 185, 129, 0.18)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                            }}
                          >
                            ✅ Work Completed
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            📍 Entered Geofence
                          </span>
                        )}

                        {notif.distance_m != null && notif.distance_m > 0 && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            ({notif.distance_m}m away)
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>
                        {notif.message}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 11, color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} style={{ color: '#ef4444' }} />
                          {notif.destination_name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {formatTimestamp(notif.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {isRejected && (
                      <button
                        onClick={() => navigate('/manager/destinations')}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, background: '#ef4444', borderColor: '#f87171' }}
                        title="Reassign to another driver"
                      >
                        <span>Reassign Driver</span>
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        onClick={() => navigate('/manager/work-logs')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                        title="View completed run in work logs"
                      >
                        <ExternalLink size={13} />
                        <span>View Work Log</span>
                      </button>
                    )}

                    <button
                      onClick={() => navigate('/manager/map')}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                      title="View live fleet on map"
                    >
                      <ExternalLink size={13} />
                      <span>Map</span>
                    </button>

                    {isUnread && (
                      <button
                        onClick={() => markNotificationRead(notif.id)}
                        className="btn btn-secondary btn-icon btn-sm"
                        title="Mark as read"
                      >
                        <Check size={14} style={{ color: '#10b981' }} />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (window.confirm('Delete this notification?')) {
                          deleteNotification(notif.id);
                        }
                      }}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: '#94a3b8', padding: '6px' }}
                      title="Delete notification"
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
