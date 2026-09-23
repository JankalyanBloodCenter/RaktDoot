import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from '../components/common/ToastContainer';
import api, { SOCKET_URL } from '../services/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const { addToast } = useToast();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [fleetDrivers, setFleetDrivers] = useState({});
  const [issues, setIssues] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const reloadDestinations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/destinations');
      if (res.data?.success) {
        setDestinations(res.data.data || []);
      }
    } catch (err) {
      console.error('[Destinations] Load error:', err.message);
    }
  }, [token]);

  const reloadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        const raw = res.data.data || [];
        const seen = new Set();
        const unique = raw.filter(n => {
          const key = (n.assignment_id && n.type)
            ? `${n.assignment_id}-${n.type}`
            : `${n.driver_id || n.driver_name}-${n.destination_id || n.destination_name}-${n.type || 'work_completed'}-${(n.message || '').replace(/\s+/g, ' ').trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setNotifications(unique);
        setUnreadNotificationsCount(res.data.unreadCount != null ? res.data.unreadCount : unique.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error('[Notifications] Load error:', err.message);
    }
  }, [token]);

  const markNotificationRead = useCallback(async (id) => {
    try {
      const res = await api.patch(`/notifications/${id}/read`);
      if (res.data?.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[Notifications] Mark read error:', err.message);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      console.error('[Notifications] Mark all read error:', err.message);
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    try {
      const res = await api.delete(`/notifications/${id}`);
      if (res.data?.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (res.data.unreadCount !== undefined) {
          setUnreadNotificationsCount(res.data.unreadCount);
        } else {
          setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('[Notifications] Delete error:', err.message);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      const res = await api.delete('/notifications/clear-all');
      if (res.data?.success) {
        setNotifications([]);
        setUnreadNotificationsCount(0);
      }
    } catch (err) {
      console.error('[Notifications] Clear all error:', err.message);
    }
  }, []);

  const deleteIssue = useCallback(async (id) => {
    try {
      const res = await api.delete(`/issues/${id}`);
      if (res.data?.success) {
        setIssues(prev => prev.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error('[Issues] Delete error:', err.message);
      throw err;
    }
  }, []);

  const reloadIssues = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/issues?limit=100');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setIssues(res.data.data);
      }
    } catch (err) {
      console.error('[Issues] Load error:', err.message);
    }
  }, [token]);

  const clearIssues = useCallback(async (status) => {
    try {
      const url = status && status !== 'all' ? `/issues/clear?status=${status}` : '/issues/clear';
      const res = await api.delete(url);
      if (res.data?.success) {
        setIssues(prev => (status && status !== 'all' ? prev.filter(i => i.status !== status) : []));
      }
    } catch (err) {
      console.error('[Issues] Clear error:', err.message);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setDestinations([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
      return;
    }

    // 1. Immediately fetch initial drivers & issues via REST API so map loads without waiting for socket
    if (user.role === 'manager' || user.role === 'admin') {
      reloadDestinations();
      reloadNotifications();

      api.get('/drivers')
        .then(res => {
          if (res.data?.data && Array.isArray(res.data.data)) {
            const map = {};
            res.data.data.forEach(d => { map[d.id] = d; });
            setFleetDrivers(prev => ({ ...map, ...prev }));
          }
        })
        .catch(err => console.warn('[Fleet] Initial drivers fetch warning:', err.message));

      api.get('/issues')
        .then(res => {
          if (res.data?.data && Array.isArray(res.data.data)) {
            setIssues(res.data.data);
          }
        })
        .catch(err => console.warn('[Fleet] Initial issues fetch warning:', err.message));
    }

    // 2. Connect Socket with websocket and polling transports for maximum cloud compatibility
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('[Socket] Connected to backend at', SOCKET_URL);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => console.error('[Socket] connect_error:', err.message));

    // ── Manager / Admin events ──
    socket.on('initial_fleet_state', ({ drivers, destinations: initDests }) => {
      const map = {};
      drivers.forEach(d => {
        map[d.id] = {
          ...d,
          trail: d.lat && d.lng ? [[d.lat, d.lng]] : [],
          lastMovedTime: new Date(d.updated_at || 0).getTime(),
        };
      });
      setFleetDrivers(prev => ({ ...prev, ...map }));

      if (initDests && Array.isArray(initDests)) {
        setDestinations(initDests);
      }
    });

    socket.on('fleet_update', (update) => {
      setFleetDrivers(prev => {
        const existing = prev[update.driver_id] || {};
        const oldTrail = existing.trail || (existing.lat && existing.lng ? [[existing.lat, existing.lng]] : []);
        const newPoint = [update.lat, update.lng];

        let updatedTrail = oldTrail;
        const lastPoint = oldTrail[oldTrail.length - 1];
        if (!lastPoint || Math.abs(lastPoint[0] - newPoint[0]) > 0.00002 || Math.abs(lastPoint[1] - newPoint[1]) > 0.00002) {
          updatedTrail = [...oldTrail, newPoint].slice(-100);
        }

        return {
          ...prev,
          [update.driver_id]: {
            ...existing,
            id: update.driver_id,
            name: update.driver_name || existing.name,
            vehicle_type: update.vehicle_type || existing.vehicle_type,
            vehicle_number: update.vehicle_number || existing.vehicle_number,
            lat: update.lat,
            lng: update.lng,
            speed: update.speed != null ? update.speed : (existing.speed || 0),
            heading: update.heading != null ? update.heading : (existing.heading || 0),
            status: update.status || existing.status || 'active',
            address: (update.address && update.address.trim() !== '') ? update.address : existing.address,
            updated_at: update.updated_at || new Date().toISOString(),
            trail: updatedTrail,
            lastMovedTime: Date.now(),
          },
        };
      });
    });

    socket.on('driver_profile_updated', (data) => {
      setFleetDrivers(prev => ({
        ...prev,
        [data.driver_id]: {
          ...(prev[data.driver_id] || {}),
          id: data.driver_id,
          name: data.driver_name || prev[data.driver_id]?.name,
          phone: data.phone !== undefined ? data.phone : prev[data.driver_id]?.phone,
          vehicle_type: data.vehicle_type || prev[data.driver_id]?.vehicle_type,
          vehicle_number: data.vehicle_number !== undefined ? data.vehicle_number : prev[data.driver_id]?.vehicle_number,
          avatar_color: data.avatar_color || prev[data.driver_id]?.avatar_color,
          updated_at: data.updated_at || new Date().toISOString(),
        },
      }));
    });

    socket.on('driver_status_changed', (data) => {
      setFleetDrivers(prev => ({
        ...prev,
        [data.driver_id]: {
          ...(prev[data.driver_id] || {}),
          id: data.driver_id,
          name: data.driver_name,
          status: data.status,
          updated_at: data.timestamp,
        },
      }));
    });

    socket.on('issue_alert', (data) => {
      const issue = data?.issue || data;
      if (!issue) return;

      setIssues(prev => {
        const id = issue.id;
        if (id && prev.some(i => i.id === id)) {
          return prev.map(i => i.id === id ? { ...i, ...issue } : i);
        }
        return [issue, ...prev].slice(0, 100);
      });

      // Immediate high-visibility toast alert for manager
      addToast({
        title: `🚨 Incident Alert: ${issue.driver_name || 'Driver'}`,
        message: `${(issue.type || 'Breakdown').replace(/_/g, ' ').toUpperCase()}: ${issue.description || 'Driver reported an issue'}`,
        type: 'urgent',
        duration: 9000,
      });

      // Update fleet driver status on the map immediately
      if (issue.driver_id) {
        setFleetDrivers(prev => {
          if (!prev[issue.driver_id]) return prev;
          return {
            ...prev,
            [issue.driver_id]: {
              ...prev[issue.driver_id],
              status: 'issue',
              lastMovedTime: Date.now(),
            },
          };
        });
      }

      reloadNotifications();
    });

    socket.on('issue_updated', ({ issue }) => {
      if (!issue) return;
      setIssues(prev => prev.map(i => i.id === issue.id ? issue : i));
      if (issue.status === 'resolved' && issue.driver_id) {
        setFleetDrivers(prev => {
          if (!prev[issue.driver_id]) return prev;
          return {
            ...prev,
            [issue.driver_id]: {
              ...prev[issue.driver_id],
              status: 'active',
              lastMovedTime: Date.now(),
            },
          };
        });
      }
    });

    socket.on('issue_deleted', ({ id }) => {
      setIssues(prev => prev.filter(i => i.id !== id));
    });

    socket.on('issues_cleared', ({ status }) => {
      setIssues(prev => (status && status !== 'all' ? prev.filter(i => i.status !== status) : []));
    });

    // ── Destination & Geofence events ──
    socket.on('destination_updated', ({ action, destination, destinationId }) => {
      if (action === 'create' && destination) {
        setDestinations(prev => {
          if (prev.some(d => d.id === destination.id)) return prev;
          return [destination, ...prev];
        });
      } else if (action === 'update' && destination) {
        setDestinations(prev => prev.map(d => d.id === destination.id ? destination : d));
      } else if (action === 'delete') {
        const targetId = destinationId || destination?.id;
        setDestinations(prev => prev.filter(d => d.id !== targetId));
      }
    });

    socket.on('assignment_status_changed', ({ assignment }) => {
      // Refresh destinations to display current driver assignment states
      if (assignment) {
        setDestinations(prev =>
          prev.map(d => {
            if (d.id === assignment.destination_id) {
              return {
                ...d,
                active_assignment_id: assignment.id,
                assignment_status: assignment.status,
                assigned_driver_id: assignment.driver_id,
                assigned_driver_name: assignment.driver_name || d.assigned_driver_name,
                assigned_driver_avatar: assignment.driver_avatar || d.assigned_driver_avatar,
              };
            }
            return d;
          })
        );
      }
      reloadDestinations();
    });

    const addNotificationSafely = (n) => {
      if (!n) return;
      setNotifications(prev => {
        const nKey = (n.assignment_id && n.type)
          ? `${n.assignment_id}-${n.type}`
          : `${n.driver_id || n.driver_name}-${n.destination_id || n.destination_name}-${n.type || 'work_completed'}-${(n.message || '').replace(/\s+/g, ' ').trim()}`;

        const exists = prev.some(x => {
          if (x.id === n.id) return true;
          const xKey = (x.assignment_id && x.type)
            ? `${x.assignment_id}-${x.type}`
            : `${x.driver_id || x.driver_name}-${x.destination_id || x.destination_name}-${x.type || 'work_completed'}-${(x.message || '').replace(/\s+/g, ' ').trim()}`;
          return xKey === nKey;
        });

        if (exists) return prev;
        setUnreadNotificationsCount(count => count + 1);
        return [n, ...prev].slice(0, 100);
      });
    };

    socket.on('notification_new', (data) => {
      if (data?.notification) {
        addNotificationSafely(data.notification);
      }
    });

    socket.on('request_rejected_alert', (data) => {
      addToast({
        title: '🚨 Collection Request Declined',
        message: data.message || `Driver ${data.driver_name || 'Driver'} declined collection for ${data.destination_name || 'Destination'}.`,
        type: 'urgent',
        duration: 9000,
      });
      reloadNotifications();
      reloadDestinations();
    });

    let lastCompletedAlertTime = 0;
    let lastCompletedKey = null;

    socket.on('work_completed_alert', (data) => {
      const now = Date.now();
      const key = data.assignment_id || data.work_log_id || `${data.driver_id}-${data.destination_id}`;
      if (key && key === lastCompletedKey && now - lastCompletedAlertTime < 6000) {
        return; // Suppress duplicate toast alert
      }
      lastCompletedAlertTime = now;
      lastCompletedKey = key;

      addToast({
        title: '✅ Blood Run Completed & Logged',
        message: data.message || `Driver completed collection and saved in Work Log.`,
        type: 'completed',
        duration: 7000,
      });
      reloadNotifications();
      reloadDestinations();
    });

    socket.on('geofence_alert', (data) => {
      if (data?.notification) {
        addNotificationSafely(data.notification);
        addToast({
          title: '📍 Proximity Geofence Alert',
          message: data.notification.message,
          type: 'entry',
          duration: 6000,
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user, reloadDestinations, reloadNotifications]);

  // Emit from driver context
  const emitLocationUpdate = useCallback((data) => {
    socketRef.current?.emit('location_update', data);
  }, []);

  const emitStatusChange = useCallback((status) => {
    socketRef.current?.emit('status_change', { status });
  }, []);

  const emitIssueReported = useCallback((data) => {
    socketRef.current?.emit('issue_reported', data);
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      fleetDrivers,
      fleetDriversList: Object.values(fleetDrivers),
      issues, setIssues,
      reloadIssues,
      destinations, setDestinations,
      reloadDestinations,
      notifications, setNotifications,
      unreadNotificationsCount,
      reloadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      clearAllNotifications,
      deleteIssue,
      clearIssues,
      emitLocationUpdate, emitStatusChange, emitIssueReported,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
