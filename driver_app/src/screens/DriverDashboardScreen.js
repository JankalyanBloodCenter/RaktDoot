import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Platform, ActivityIndicator, Image, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STATUS_COLORS } from '../config/constants';
import { socketManager } from '../services/socket';
import { createIssue, getDriverIssues } from '../services/api';
import { getActiveAssignment, respondToAssignment, getHomeLocation, DEFAULT_HOME_LOCATION } from '../services/assignmentApi';
import { getExactCurrentLocation, startLocationWatcher, requestLocationPermissions } from '../services/realLocation';
import ReportIssueModal from '../components/ReportIssueModal';
import IssuesHistoryModal from '../components/IssuesHistoryModal';
import TaskNotificationModal from '../components/TaskNotificationModal';
import RouteMappingModal from '../components/RouteMappingModal';
import VehicleProfileModal from '../components/VehicleProfileModal';

const omDropImg = require('../../assets/om_blood_drop_logo.jpg');
const nabhBadgeImg = require('../../assets/nabh_badge_logo.jpg');
const harbingerLogo = require('../../assets/harbinger_logo.png');

const translations = {
  en: {
    tag: 'RAKTDOOT TRACKER',
    centreTitle: 'Jankalyan Blood Centre',
    location: 'Pune, Maharashtra',
    connected: 'Connected (Live)',
    reconnecting: 'Reconnecting...',
    exit: 'Sign Out',
    shiftStatus: 'Shift Status',
    online: 'Online',
    break: 'Break',
    offDuty: 'Off Duty',
    telemetryTitle: 'Live Vehicle Telemetry',
    gpsLocked: 'GPS Locked',
    acquiringGps: 'Acquiring GPS...',
    gpsDenied: 'Permission Denied',
    speed: 'SPEED',
    heading: 'HEADING',
    bearing: 'BEARING',
    coordsAddress: 'PHYSICAL COORDINATES & LOCATION',
    liveGps: 'LIVE GPS',
    resolvingLocation: 'Resolving physical address...',
    refreshGps: 'Acquire / Refresh Exact GPS',
    lockingGps: 'Locking Real Physical GPS...',
    packetsSent: 'Telemetry Packets Sent',
    synced: 'Synced',
    reportIncident: 'Report Breakdown / Delay',
    incidentLogs: 'Incident Logs',
    alertDispatchedTitle: 'Alert Dispatched',
    alertDispatchedBody: 'Your incident has been transmitted live to the manager console.',
    notificationTitle: 'Destination Requests & Tasks',
    noPendingRequests: 'No pending requests. When dispatch requests you to go to a destination hospital, it will appear here.',
    pendingDestinationRequest: 'DESTINATION REQUEST',
    actionRequired: 'Action Required · Dispatch Request',
    acceptAndStart: '✓ Accept & Start Route',
    viewDetails: '📋 View Details',
    footer: '© 2026 Jankalyan Blood Centre, Pune | Powered by Harbinger Systems Pvt. Ltd.',
  },
  mr: {
    tag: 'रक्तदूत ट्रॅकर',
    centreTitle: 'जनकल्याण रक्तपेढी',
    location: 'पुणे, महाराष्ट्र',
    connected: 'लाईव्ह कनेक्टेड',
    reconnecting: 'पुन्हा जोडत आहे...',
    exit: 'बाहेर पडा',
    shiftStatus: 'शिफ्ट स्थिती (Shift Status)',
    online: 'सक्रिय (Online)',
    break: 'विश्रांती (Break)',
    offDuty: 'ऑफ ड्युटी (Off Duty)',
    telemetryTitle: 'लाईव्ह वाहन टेलीमेट्री',
    gpsLocked: 'GPS अचूक लॉक',
    acquiringGps: 'GPS शोधत आहे...',
    gpsDenied: 'परवानगी नाकारली',
    speed: 'वेग (SPEED)',
    heading: 'दिशा (HEADING)',
    bearing: 'अंश दिशा',
    coordsAddress: 'अचूक अक्षांश, रेखांश व ठिकाण',
    liveGps: 'लाईव्ह GPS',
    resolvingLocation: 'ठिकाणाचा पत्ता शोधत आहे...',
    refreshGps: 'अचूक GPS स्थान अद्ययावत करा',
    lockingGps: 'GPS सिग्नल लॉक करत आहे...',
    packetsSent: 'पाठवलेले टेलीमेट्री पॅकेट्स',
    synced: 'अद्ययावत वेळ',
    reportIncident: 'आणीबाणी / बिघाड नोंदवा',
    incidentLogs: 'तक्रार नोंदी',
    alertDispatchedTitle: 'अलर्ट पाठवला',
    alertDispatchedBody: 'तुमची तक्रार थेट व्यवस्थापक डॅशबोर्डवर पाठवली गेली आहे.',
    notificationTitle: 'गंतव्य स्थान विनंत्या व कार्ये',
    noPendingRequests: 'सध्या कोणतीही नवीन विनंती प्रलंबित नाही. व्यवस्थापकाकडून नवीन गंतव्य स्थान पाठवले की येथे दिसेल.',
    pendingDestinationRequest: 'नवीन गंतव्य स्थान विनंती',
    actionRequired: 'तात्काळ प्रतिसाद आवश्यक',
    acceptAndStart: '✓ स्वीकारा व मार्ग सुरू करा',
    viewDetails: '📋 तपशील पहा',
    footer: '© २०२६ जनकल्याण रक्तपेढी, पुणे | हार्बिंजर सिस्टीम्स प्रा. लि.',
  },
};

export default function DriverDashboardScreen({
  user,
  token,
  serverUrl,
  onLogout,
}) {
  const [lang, setLang] = useState('en');
  const [driverStatus, setDriverStatus] = useState('active'); // active, idle, offline
  const [socketConnected, setSocketConnected] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('acquiring'); // acquiring, locked, denied, error
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [currentTelemetry, setCurrentTelemetry] = useState({
    lat: 18.5204,
    lng: 73.8567,
    speed: 0,
    heading: 0,
    address: 'Acquiring Real Device GPS...',
  });
  const [pingsCount, setPingsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [issuesHistory, setIssuesHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(user);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  // Sync user prop if updated from outside
  useEffect(() => {
    if (user) setCurrentUser(user);
  }, [user]);

  // Prompt vehicle profile setup if driver has no vehicle registered
  useEffect(() => {
    if (currentUser && !currentUser.vehicle_number) {
      const timer = setTimeout(() => {
        setShowVehicleModal(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.vehicle_number]);

  // Assignment & Task states
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [incomingTask, setIncomingTask] = useState(null);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [completingTask, setCompletingTask] = useState(false);
  const [homeLocation, setHomeLocation] = useState(DEFAULT_HOME_LOCATION);
  const [showRouteMappingModal, setShowRouteMappingModal] = useState(false);

  const hasPendingTask = (activeAssignment?.status === 'pending') || (incomingTask?.status === 'pending');
  const hasActiveTask = activeAssignment && ['accepted', 'in_progress'].includes(activeAssignment.status);

  // Poll / Refresh active assignment helper
  const refreshActiveAssignment = useCallback(() => {
    if (!token || !serverUrl) return;
    getActiveAssignment(serverUrl, token)
      .then(assignment => {
        if (assignment) {
          setActiveAssignment(assignment);
          if (assignment.status === 'pending') {
            setIncomingTask(assignment);
          }
        } else {
          setActiveAssignment(null);
        }
      })
      .catch(err => console.warn('[Driver Assignment Poll]:', err.message));
  }, [token, serverUrl]);

  // Quick Accept helper
  const handleQuickAcceptTask = async (taskToAccept) => {
    const task = taskToAccept || incomingTask || activeAssignment;
    if (!task) return;
    try {
      await respondToAssignment(serverUrl, token, task.id, 'accepted');
      const updated = { ...task, status: 'accepted' };
      setActiveAssignment(updated);
      setIncomingTask(null);
      setIsTaskModalVisible(false);
      Alert.alert(
        'Request Accepted',
        `Destination request for ${task.destination_name} has been accepted. Route navigation and geofence tracking are now active.`
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to accept destination request');
    }
  };

  // Helper: Haversine straight-line distance in km
  const calculateDistanceKm = useCallback((lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }, []);

  // Helper: Open turn-by-turn navigation in native maps
  const handleOpenNavigation = useCallback((lat, lng, name) => {
    if (!lat || !lng) return;
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(name || 'Delivery Destination');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latLng}`,
      android: `geo:0,0?q=${latLng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latLng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latLng}`);
    });
  }, []);

  // Live distance calculations
  const distFromHome = (currentTelemetry?.lat && homeLocation?.lat)
    ? calculateDistanceKm(currentTelemetry.lat, currentTelemetry.lng, homeLocation.lat, homeLocation.lng)
    : null;
  const isAtHomeBase = distFromHome != null && parseFloat(distFromHome) <= 0.2; // Within 200m

  const distToDest = (currentTelemetry?.lat && activeAssignment && (activeAssignment.destination_lat || activeAssignment.lat))
    ? calculateDistanceKm(
        currentTelemetry.lat,
        currentTelemetry.lng,
        activeAssignment.destination_lat || activeAssignment.lat,
        activeAssignment.destination_lng || activeAssignment.lng
      )
    : null;

  // Live GPS tracking reference
  const watcherCleanupRef = useRef(null);

  // Load language preference
  useEffect(() => {
    AsyncStorage.getItem('@driver_lang').then(saved => {
      if (saved === 'mr' || saved === 'en') {
        setLang(saved);
      }
    }).catch(() => {});
  }, []);

  const changeLang = (newLang) => {
    setLang(newLang);
    AsyncStorage.setItem('@driver_lang', newLang).catch(() => {});
  };

  const t = translations[lang] || translations.en;

  // ── Helper: Stop tracking ──
  const stopTracking = useCallback(() => {
    if (watcherCleanupRef.current) {
      watcherCleanupRef.current();
      watcherCleanupRef.current = null;
    }
  }, []);

  // ── Helper: Transmit location packet to backend ──
  const transmitLocation = useCallback((locationData, status) => {
    const payload = {
      lat: locationData.lat,
      lng: locationData.lng,
      speed: locationData.speed || 0,
      heading: locationData.heading || 0,
      status: status || driverStatus,
      address: locationData.address || null,
    };

    setCurrentTelemetry(locationData);
    setLastSyncTime(new Date());
    setPingsCount(prev => prev + 1);

    socketManager.emitLocationUpdate(payload);
  }, [driverStatus]);

  // ── Helper: Start real hardware / browser GPS tracking ──
  const startTracking = useCallback(() => {
    stopTracking();

    if (driverStatus === 'offline') return;

    // Real Hardware / Browser GPS via realLocation service
    setGpsStatus('acquiring');
    setGpsErrorMsg('');

    const cleanup = startLocationWatcher(
      (location) => {
        setGpsStatus('locked');
        setGpsAccuracy(location.accuracy);
        setGpsErrorMsg('');
        transmitLocation(location, driverStatus);
      },
      (err) => {
        console.warn('[GPS Watcher Error]:', err.message);
        if (err.message.includes('denied') || err.message.includes('permission')) {
          setGpsStatus('denied');
          setGpsErrorMsg('Location access was denied. Please allow GPS permission in your device/browser settings.');
        } else {
          setGpsStatus('error');
          setGpsErrorMsg(err.message || 'GPS signal unavailable');
        }
      }
    );

    watcherCleanupRef.current = cleanup;
  }, [driverStatus, transmitLocation, stopTracking]);

  // Handle immediate one-shot GPS refresh
  const handleRefreshExactGps = async () => {
    try {
      setIsRefreshingGps(true);
      const exactLoc = await getExactCurrentLocation();
      setGpsStatus('locked');
      setGpsAccuracy(exactLoc.accuracy);
      setGpsErrorMsg('');
      transmitLocation(exactLoc, driverStatus);
    } catch (err) {
      console.warn('[GPS Exact Refresh]:', err.message);
      if (err.message.includes('denied') || err.message.includes('permission')) {
        setGpsStatus('denied');
        setGpsErrorMsg('GPS access was denied by your device. Please allow location permissions in settings.');
      }
    } finally {
      setIsRefreshingGps(false);
    }
  };

  // ── Setup Socket & Start Real Tracking ──
  useEffect(() => {
    if (!token || !serverUrl) return;

    socketManager.connect(serverUrl, token, (isConnected) => {
      setSocketConnected(isConnected);
    });

    // Initial GPS permission check and acquire
    requestLocationPermissions().then(hasPerms => {
      if (hasPerms) {
        handleRefreshExactGps();
      }
    });

    // Start hardware GPS watcher
    startTracking();

    // Fetch driver's past issues
    getDriverIssues(serverUrl, token)
      .then(setIssuesHistory)
      .catch(console.error);

    // Fetch permanent Home Base (Blood Donation Building)
    getHomeLocation(serverUrl, token)
      .then(setHomeLocation)
      .catch(() => {});

    // Fetch current active delivery assignment
    getActiveAssignment(serverUrl, token)
      .then(assignment => {
        if (assignment) {
          setActiveAssignment(assignment);
          if (assignment.status === 'pending') {
            setIncomingTask(assignment);
            setIsTaskModalVisible(true);
          }
        }
      })
      .catch(err => console.warn('[Driver Assignment Load]:', err.message));

    // Socket listener: incoming new assignment / collection request
    const handleNewTask = (data) => {
      if (data?.assignment) {
        setIncomingTask(data.assignment);
        setIsTaskModalVisible(true);
      }
    };

    socketManager.on('task_assigned', handleNewTask);
    socketManager.on('new_collection_request', handleNewTask);

    // Socket listener: assignment status changes
    socketManager.on('assignment_status_changed', (data) => {
      if (data?.assignment) {
        if (['cancelled', 'rejected', 'completed'].includes(data.assignment.status)) {
          setActiveAssignment(null);
          setShowRouteMappingModal(false);
        } else {
          setActiveAssignment(data.assignment);
        }
      }
    });

    // Periodic polling to guarantee real-time sync
    const pollInterval = setInterval(() => {
      refreshActiveAssignment();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      stopTracking();
      socketManager.off('task_assigned', handleNewTask);
      socketManager.off('new_collection_request', handleNewTask);
      socketManager.off('assignment_status_changed');
      socketManager.disconnect();
    };
  }, [token, serverUrl, refreshActiveAssignment]);

  // Complete active task ("MARK WORK COMPLETED / REACHED HOSPITAL")
  const handleCompleteTask = async () => {
    if (!activeAssignment) return;
    try {
      setCompletingTask(true);
      await respondToAssignment(serverUrl, token, activeAssignment.id, 'completed');
      setActiveAssignment(null);
      setShowRouteMappingModal(false);
      Alert.alert(
        'Work Completed',
        'Task marked completed! Reached hospital and finished blood collection delivery. Dispatch console has been updated live in real time.'
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to complete task');
    } finally {
      setCompletingTask(false);
    }
  };

  // Restart tracking on driverStatus changes
  useEffect(() => {
    startTracking();
  }, [driverStatus, startTracking]);

  // ── Change Status ──
  const handleStatusChange = (newStatus) => {
    setDriverStatus(newStatus);
    socketManager.emitStatusChange(newStatus);

    if (newStatus === 'offline') {
      stopTracking();
    }
  };

  // ── Submit Incident ──
  const handleReportIssue = async (issueData) => {
    const created = await createIssue(serverUrl, token, {
      ...issueData,
      status: 'open',
    });

    socketManager.emitIssueAlert({
      ...created,
      driver_name: user?.name,
      driver_id: user?.id,
    });

    setDriverStatus('issue');
    socketManager.emitStatusChange('issue');

    setIssuesHistory(prev => [created, ...prev]);

    Alert.alert(
      t.alertDispatchedTitle,
      t.alertDispatchedBody
    );
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <View style={styles.container}>
      {/* 1. Institutional Top Bar — Responsive 2-Row Layout (Zero Squishing on Mobile) */}
      <View style={styles.institutionalHeader}>
        {/* Row 1: Brand Identity & Logos */}
        <View style={styles.brandRow}>
          <View style={styles.brandIdentity}>
            <Image source={omDropImg} style={styles.omDropLogo} resizeMode="contain" />
            <Image source={nabhBadgeImg} style={styles.nabhBadgeLogo} resizeMode="cover" />
            <View style={styles.brandTextGroup}>
              <Text style={styles.brandTitle} numberOfLines={1}>{t.tag}</Text>
              <Text style={styles.brandSubtitle} numberOfLines={1}>
                {t.centreTitle} · {t.location}
              </Text>
            </View>
          </View>
          <Image source={harbingerLogo} style={styles.harbingerLogoImg} resizeMode="contain" />
        </View>

        {/* Row 2: Language Capsule & Sign Out */}
        <View style={styles.brandControlsRow}>
          <View style={styles.langToggleWrap}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'mr' && styles.langBtnActive]}
              onPress={() => changeLang('mr')}
              activeOpacity={0.8}
            >
              <Text style={[styles.langBtnText, lang === 'mr' && styles.langBtnTextActive]}>मराठी</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => changeLang('en')}
              activeOpacity={0.8}
            >
              <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>English</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.8}>
            <Text style={styles.logoutText}>{t.exit}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Driver Profile & Live Connection Status Bar */}
      <View style={styles.driverSubBar}>
        <View style={[styles.driverProfile, { flex: 1, marginRight: 8 }]}>
          <View style={[styles.avatar, { backgroundColor: currentUser?.avatar_color || user?.avatar_color || '#dc2626' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.driverName} numberOfLines={1}>{currentUser?.name || user?.name || 'Delivery Driver'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <View style={styles.socketIndicator}>
                <View style={[styles.dot, { backgroundColor: socketConnected ? '#10b981' : '#ef4444' }]} />
                <Text style={styles.socketText}>
                  {socketConnected ? t.connected : t.reconnecting}
                </Text>
              </View>

              {/* Vehicle profile badge */}
              <TouchableOpacity
                style={[styles.vehiclePill, !currentUser?.vehicle_number && styles.vehiclePillMissing]}
                onPress={() => setShowVehicleModal(true)}
                activeOpacity={0.75}
              >
                <Text style={[styles.vehiclePillText, !currentUser?.vehicle_number && styles.vehiclePillTextMissing]}>
                  {currentUser?.vehicle_number
                    ? `${currentUser?.vehicle_type === 'four_wheeler' ? '🚐' : '🛵'} ${currentUser.vehicle_number}`
                    : '⚠️ Set Vehicle'}
                </Text>
                <Text style={styles.vehiclePillEdit}>✏️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Notification Bell Button in driver sub-bar */}
          <TouchableOpacity
            style={[styles.subBarBellBtn, hasPendingTask && styles.subBarBellBtnPulse]}
            onPress={() => {
              if (activeAssignment || incomingTask) {
                setIncomingTask(activeAssignment || incomingTask);
                setIsTaskModalVisible(true);
              } else {
                Alert.alert(
                  t.notificationTitle,
                  t.noPendingRequests
                );
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 19 }}>🔔</Text>
            {hasPendingTask ? (
              <View style={styles.bellBadgeRed}>
                <Text style={styles.bellBadgeText}>1</Text>
              </View>
            ) : hasActiveTask ? (
              <View style={styles.bellBadgeGreen}>
                <Text style={styles.bellBadgeText}>✓</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[driverStatus]}22`, borderColor: STATUS_COLORS[driverStatus] }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[driverStatus] }]} />
            <Text style={[styles.statusPillText, { color: STATUS_COLORS[driverStatus] }]}>
              {driverStatus.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 0. INCOMING PENDING DESTINATION REQUEST BANNER ── */}
        {(activeAssignment?.status === 'pending' || incomingTask?.status === 'pending') && (
          <View style={styles.pendingRequestBanner}>
            <View style={styles.pendingHeaderRow}>
              <View style={styles.pendingBadgeWrap}>
                <View style={styles.livePulseDotRed} />
                <Text style={styles.pendingBadgeText}>
                  {(incomingTask?.urgency === 'emergency' || activeAssignment?.urgency === 'emergency')
                    ? '🚨 STAT / EMERGENCY DESTINATION REQUEST'
                    : '⚡ NEW DESTINATION REQUEST'}
                </Text>
              </View>
              <Text style={styles.pendingActionNotice}>{t.actionRequired}</Text>
            </View>

            <Text style={styles.pendingDestTitle}>
              🎯 {incomingTask?.destination_name || activeAssignment?.destination_name}
            </Text>

            <Text style={styles.pendingDestAddress} numberOfLines={2}>
              📍 {incomingTask?.destination_address || activeAssignment?.destination_address || 'Address specified by dispatch'}
            </Text>

            <View style={styles.pendingMetaRow}>
              <Text style={styles.pendingMetaText}>
                Pickup: <Text style={{ color: '#f8fafc', fontWeight: '700' }}>{incomingTask?.source_name || activeAssignment?.source_name || 'Jankalyan Blood Centre (Swargate HQ)'}</Text>
              </Text>
              <Text style={styles.pendingMetaText}>
                Geofence: <Text style={{ color: '#f8fafc', fontWeight: '700' }}>{(incomingTask?.destination_radius_m || activeAssignment?.destination_radius_m || 500)}m</Text>
              </Text>
            </View>

            <View style={styles.pendingActionsRow}>
              <TouchableOpacity
                style={styles.pendingAcceptBtn}
                onPress={() => handleQuickAcceptTask(incomingTask || activeAssignment)}
                activeOpacity={0.85}
              >
                <Text style={styles.pendingAcceptBtnText}>{t.acceptAndStart}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pendingDetailsBtn}
                onPress={() => {
                  setIncomingTask(incomingTask || activeAssignment);
                  setIsTaskModalVisible(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.pendingDetailsBtnText}>{t.viewDetails}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Shift Control Card (100% Emoji-Free) */}
        <View style={styles.shiftCard}>
          <View style={styles.shiftHeader}>
            <Text style={styles.shiftCardTitle}>{t.shiftStatus}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[driverStatus] }]} />
              <Text style={{ color: STATUS_COLORS[driverStatus], fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                {driverStatus}
              </Text>
            </View>
          </View>

          {/* Professional Status Buttons */}
          <View style={styles.shiftButtonsRow}>
            {/* Online */}
            <TouchableOpacity
              style={[styles.shiftBtn, driverStatus === 'active' && styles.shiftBtnActive]}
              onPress={() => handleStatusChange('active')}
              activeOpacity={0.8}
            >
              <View style={[styles.indicatorCircle, { backgroundColor: driverStatus === 'active' ? '#10b981' : '#1e293b', borderColor: '#10b981' }]} />
              <Text style={[styles.shiftBtnLabel, driverStatus === 'active' && styles.shiftBtnLabelActive]}>
                {t.online}
              </Text>
            </TouchableOpacity>

            {/* Break */}
            <TouchableOpacity
              style={[styles.shiftBtn, driverStatus === 'idle' && styles.shiftBtnIdle]}
              onPress={() => handleStatusChange('idle')}
              activeOpacity={0.8}
            >
              <View style={[styles.indicatorCircle, { backgroundColor: driverStatus === 'idle' ? '#f59e0b' : '#1e293b', borderColor: '#f59e0b' }]} />
              <Text style={[styles.shiftBtnLabel, driverStatus === 'idle' && { color: '#f59e0b', fontWeight: '700' }]}>
                {t.break}
              </Text>
            </TouchableOpacity>

            {/* Off Duty */}
            <TouchableOpacity
              style={[styles.shiftBtn, driverStatus === 'offline' && styles.shiftBtnOffline]}
              onPress={() => handleStatusChange('offline')}
              activeOpacity={0.8}
            >
              <View style={[styles.indicatorCircle, { backgroundColor: driverStatus === 'offline' ? '#94a3b8' : '#1e293b', borderColor: '#94a3b8' }]} />
              <Text style={[styles.shiftBtnLabel, driverStatus === 'offline' && { color: '#94a3b8', fontWeight: '700' }]}>
                {t.offDuty}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 1. HOME LOCATION (BLOOD DONATION BUILDING / DISPATCH ORIGIN) ── */}
        <View style={styles.homeBaseCard}>
          <View style={styles.homeBaseHeader}>
            <View style={styles.homeBaseIconWrap}>
              <Text style={{ fontSize: 18 }}>🏥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.homeBaseBadge}>BLOOD DONATION BUILDING · HOME BASE</Text>
              </View>
              <Text style={styles.homeBaseTitle}>
                {homeLocation?.name || 'Jankalyan Blood Centre (Home Base)'}
              </Text>
              <Text style={styles.homeBaseAddress} numberOfLines={1}>
                {homeLocation?.address || 'Jankalyan Blood Donation Building, Central Complex, Mumbai'}
              </Text>
            </View>
            <View style={[styles.homeStatusPill, { backgroundColor: isAtHomeBase ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', borderColor: isAtHomeBase ? '#10b981' : '#f59e0b' }]}>
              <View style={[styles.statusDot, { backgroundColor: isAtHomeBase ? '#10b981' : '#f59e0b' }]} />
              <Text style={[styles.homeStatusText, { color: isAtHomeBase ? '#34d399' : '#fbbf24' }]}>
                {isAtHomeBase ? 'At Home Base' : (distFromHome ? `${distFromHome} km` : 'Base')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 2. ACTIVE DELIVERY TASK & ROUTE MAPPING (ONLY ACTIVE TILL DONE) ── */}
        {activeAssignment && ['accepted', 'in_progress'].includes(activeAssignment.status) && (
          <View style={[styles.activeTaskCard, activeAssignment.urgency === 'emergency' && { borderColor: '#ef4444' }]}>
            <View style={styles.activeTaskHeader}>
              <View style={[styles.activeTaskBadge, activeAssignment.urgency === 'emergency' && { backgroundColor: 'rgba(239, 68, 68, 0.18)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
                <View style={[styles.statusDot, { backgroundColor: activeAssignment.urgency === 'emergency' ? '#ef4444' : '#10b981' }]} />
                <Text style={[styles.activeTaskBadgeText, activeAssignment.urgency === 'emergency' && { color: '#f87171' }]}>
                  {activeAssignment.urgency ? `${activeAssignment.urgency.toUpperCase()} BLOOD COLLECTION` : (activeAssignment.status === 'in_progress' ? 'EN ROUTE / APPROACHING' : 'ACTIVE DELIVERY TASK')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.livePulseDot} />
                <Text style={styles.activeTaskRadius}>
                  Geofence: {activeAssignment.destination_radius_m || 500}m
                </Text>
              </View>
            </View>

            {/* Route Mapping Waypoints & Distance */}
            <View style={styles.routeTransitBox}>
              <View style={styles.routeWaypointRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text style={{ fontSize: 13 }}>🏥</Text>
                  <Text style={styles.routeWaypointText} numberOfLines={1}>
                    {activeAssignment.source_name || homeLocation?.name || 'Blood Donation Building'}
                  </Text>
                </View>
                <Text style={styles.routeArrow}>➔</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={{ fontSize: 13 }}>🎯</Text>
                  <Text style={[styles.routeWaypointText, { color: '#38bdf8' }]} numberOfLines={1}>
                    {activeAssignment.destination_name}
                  </Text>
                </View>
              </View>

              {distToDest && (
                <View style={styles.distRemainingRow}>
                  <Text style={styles.distRemainingLabel}>LIVE ROUTE MAPPING TO DESTINATION:</Text>
                  <Text style={styles.distRemainingVal}>{distToDest} km remaining</Text>
                </View>
              )}
            </View>

            <Text style={styles.activeTaskTitle}>
              {activeAssignment.destination_name}
            </Text>

            {activeAssignment.destination_address ? (
              <Text style={styles.activeTaskAddress}>
                📍 {activeAssignment.destination_address}
              </Text>
            ) : null}

            {(activeAssignment.notes || activeAssignment.destination_description) ? (
              <Text style={styles.activeTaskNotes}>
                📝 {activeAssignment.notes || activeAssignment.destination_description}
              </Text>
            ) : null}

            {/* Navigation & Route Mapping Buttons */}
            <View style={styles.taskNavActionsRow}>
              <TouchableOpacity
                style={styles.openNavBtn}
                onPress={() => handleOpenNavigation(
                  activeAssignment.destination_lat || activeAssignment.lat,
                  activeAssignment.destination_lng || activeAssignment.lng,
                  activeAssignment.destination_name || activeAssignment.name
                )}
                activeOpacity={0.85}
              >
                <Text style={styles.openNavBtnText}>🧭 Open GPS Navigation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewMapBtn}
                onPress={() => setShowRouteMappingModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.viewMapBtnText}>🗺️ View Route</Text>
              </TouchableOpacity>
            </View>

            {/* Complete Task Button ("MARK WORK COMPLETED / REACHED HOSPITAL") */}
            <TouchableOpacity
              style={[styles.completeTaskBtn, completingTask && { opacity: 0.7 }]}
              onPress={handleCompleteTask}
              disabled={completingTask}
              activeOpacity={0.85}
            >
              {completingTask ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.completeTaskBtnText}>✓ MARK WORK COMPLETED / REACHED HOSPITAL</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Live Telemetry HUD (100% Emoji-Free) */}
        <View style={styles.hudCard}>
          <View style={styles.hudHeader}>
            <Text style={styles.hudTitle}>{t.telemetryTitle}</Text>
            {gpsStatus === 'locked' ? (
              <View style={[styles.gpsBadge, { backgroundColor: '#10b98122', borderColor: '#10b981' }]}>
                <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.gpsBadgeText, { color: '#10b981' }]}>
                  {t.gpsLocked} {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                </Text>
              </View>
            ) : gpsStatus === 'denied' ? (
              <View style={[styles.gpsBadge, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}>
                <Text style={[styles.gpsBadgeText, { color: '#ef4444' }]}>{t.gpsDenied}</Text>
              </View>
            ) : (
              <View style={[styles.gpsBadge, { backgroundColor: 'rgba(185, 28, 28, 0.15)', borderColor: '#b91c1c' }]}>
                <ActivityIndicator size="small" color="#f87171" style={{ transform: [{ scale: 0.7 }] }} />
                <Text style={[styles.gpsBadgeText, { color: '#f87171' }]}>{t.acquiringGps}</Text>
              </View>
            )}
          </View>

          {/* Location Permission Denied Alert Card */}
          {gpsStatus === 'denied' && (
            <View style={styles.gpsDeniedBox}>
              <Text style={styles.gpsDeniedTitle}>Location Access Required</Text>
              <Text style={styles.gpsDeniedText}>
                {gpsErrorMsg || 'Device GPS permission is required to stream real-time blood delivery coordinates to dispatch. Please enable location services in your device settings.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: '#b91c1c' }]}
                  onPress={handleRefreshExactGps}
                >
                  <Text style={styles.smallActionBtnText}>Grant & Retry GPS</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.hudGrid}>
            {/* Speedometer */}
            <View style={styles.hudTile}>
              <Text style={styles.tileLabel}>{t.speed}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.speedValue}>{Math.round(currentTelemetry.speed)}</Text>
                <Text style={styles.unitText}>km/h</Text>
              </View>
            </View>

            {/* Compass / Heading */}
            <View style={styles.hudTile}>
              <Text style={styles.tileLabel}>{t.heading}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.headingValue}>{currentTelemetry.heading}°</Text>
                <Text style={styles.unitText}>{t.bearing}</Text>
              </View>
            </View>
          </View>

          {/* Coordinates & Physical Address */}
          <View style={styles.routeBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.routeBoxHeaderLabel}>{t.coordsAddress}</Text>
              <View style={styles.liveTag}>
                <Text style={styles.liveTagText}>{t.liveGps}</Text>
              </View>
            </View>
            <Text style={styles.coordsText}>
              {currentTelemetry.lat ? currentTelemetry.lat.toFixed(5) : '0.00000'}, {currentTelemetry.lng ? currentTelemetry.lng.toFixed(5) : '0.00000'}
            </Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {currentTelemetry.address || t.resolvingLocation}
            </Text>
          </View>

          {/* Tactile GPS Refresh Button (No Emoji) */}
          <TouchableOpacity
            style={[styles.refreshGpsBtn, isRefreshingGps && { opacity: 0.7 }]}
            onPress={handleRefreshExactGps}
            disabled={isRefreshingGps}
            activeOpacity={0.8}
          >
            {isRefreshingGps && (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.refreshGpsBtnText}>
              {isRefreshingGps ? t.lockingGps : t.refreshGps}
            </Text>
          </TouchableOpacity>

          {/* Pings & Sync */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>
              {t.packetsSent}: <Text style={{ color: '#818cf8', fontWeight: '700' }}>{pingsCount}</Text>
            </Text>
            <Text style={styles.metaLabel}>
              {t.synced}: {lastSyncTime.toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {/* Action Buttons (100% Emoji-Free) */}
        <View style={styles.actionsContainer}>
          {/* Emergency / Breakdown Alert Button */}
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => setShowReportModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.emergencyIconDot} />
            <Text style={styles.emergencyBtnText}>{t.reportIncident}</Text>
          </TouchableOpacity>

          {/* Incident Log Button */}
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => setShowHistoryModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.historyBtnText}>
              {t.incidentLogs} ({issuesHistory.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Global Footer */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>{t.footer}</Text>
        </View>
      </ScrollView>

      {/* Incident Modals */}
      <ReportIssueModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportIssue}
        currentLocation={currentTelemetry}
        lang={lang}
      />

      <IssuesHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        issues={issuesHistory}
        lang={lang}
      />

      {/* Task Notification Modal */}
      <TaskNotificationModal
        visible={isTaskModalVisible}
        assignment={incomingTask}
        destination={incomingTask ? {
          name: incomingTask.destination_name,
          address: incomingTask.destination_address,
          radius_m: incomingTask.destination_radius_m,
          description: incomingTask.destination_description,
          lat: incomingTask.destination_lat,
          lng: incomingTask.destination_lng,
        } : null}
        currentLocation={currentTelemetry}
        serverUrl={serverUrl}
        token={token}
        onAccepted={(assignment) => {
          setActiveAssignment(assignment);
          setIsTaskModalVisible(false);
        }}
        onRejected={() => {
          setIsTaskModalVisible(false);
        }}
        onClose={() => setIsTaskModalVisible(false)}
      />

      {/* Live Route Mapping Modal */}
      <RouteMappingModal
        visible={showRouteMappingModal}
        onClose={() => setShowRouteMappingModal(false)}
        driverLocation={currentTelemetry}
        destination={activeAssignment}
        homeLocation={homeLocation}
        remainingDistanceKm={distToDest}
      />

      {/* Driver Vehicle Profile Modal */}
      <VehicleProfileModal
        visible={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
        user={currentUser}
        serverUrl={serverUrl}
        token={token}
        lang={lang}
        onSaveSuccess={(updated) => {
          setCurrentUser(prev => ({ ...prev, ...updated }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
  },

  // Notification Bell & Badges
  bellBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBtnPulse: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  subBarBellBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  subBarBellBtnPulse: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderColor: '#ef4444',
  },
  bellBadgeRed: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0a0b10',
  },
  bellBadgeGreen: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0a0b10',
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },

  // Pending Destination Request Banner
  pendingRequestBanner: {
    backgroundColor: '#181216',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pendingBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  livePulseDotRed: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f87171',
    letterSpacing: 0.5,
  },
  pendingActionNotice: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
  },
  pendingDestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  pendingDestAddress: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 10,
  },
  pendingMetaRow: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
  pendingMetaText: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  pendingActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pendingAcceptBtn: {
    flex: 1.3,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  pendingAcceptBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  pendingDetailsBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDetailsBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },

  // Active Task Card Styles
  activeTaskCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  activeTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeTaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  activeTaskBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  activeTaskRadius: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeTaskTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  activeTaskAddress: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 6,
  },
  activeTaskNotes: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 8,
  },
  completeTaskBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  completeTaskBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Home Base Card Styles
  homeBaseCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  homeBaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  homeBaseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBaseBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 0.6,
  },
  homeBaseTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  homeBaseAddress: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  homeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  homeStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Route Transit Box inside Active Task Card
  routeTransitBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  routeWaypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  routeWaypointText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  routeArrow: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
  },
  distRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  distRemainingLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  distRemainingVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
  },
  taskNavActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  openNavBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openNavBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12.5,
  },
  viewMapBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMapBtnText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 12.5,
  },

  // 1. Institutional Top Bar
  institutionalHeader: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 48 : 10,
    paddingBottom: 8,
    backgroundColor: '#11131c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  brandIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  omDropLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
  },
  nabhBadgeLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
  },
  brandTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  brandControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 2,
  },
  harbingerLogoImg: {
    height: 22,
    width: 104,
    flexShrink: 0,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  logoutText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },

  // Language Selector Capsule
  langToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 2,
  },
  langBtn: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 11,
  },
  langBtnActive: {
    backgroundColor: '#dc2626',
  },
  langBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  langBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // 2. Driver Sub-Bar
  driverSubBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#161822',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  driverProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  avatarText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  driverName: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '700',
  },
  socketIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  socketText: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '500',
  },
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vehiclePillMissing: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  vehiclePillText: {
    color: '#f8fafc',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  vehiclePillTextMissing: {
    color: '#fde68a',
  },
  vehiclePillEdit: {
    fontSize: 9.5,
    opacity: 0.8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Scroll Body
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },

  // Shift Control Card
  shiftCard: {
    backgroundColor: '#161822',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  shiftCardTitle: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '700',
  },
  shiftButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shiftBtn: {
    flex: 1,
    backgroundColor: '#0f111a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  shiftBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  shiftBtnIdle: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  shiftBtnOffline: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
    borderColor: '#6b7280',
  },
  indicatorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  shiftBtnLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  shiftBtnLabelActive: {
    color: '#34d399',
    fontWeight: '700',
  },

  // Telemetry HUD Card
  hudCard: {
    backgroundColor: '#161822',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hudTitle: {
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '700',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  gpsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gpsDeniedBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  gpsDeniedTitle: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  gpsDeniedText: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 16,
  },
  smallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallActionBtnText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },

  hudGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  hudTile: {
    flex: 1,
    backgroundColor: '#0f111a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tileLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  speedValue: {
    color: '#38bdf8',
    fontSize: 30,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headingValue: {
    color: '#a78bfa',
    fontSize: 30,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  unitText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },

  routeBox: {
    backgroundColor: '#0f111a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  routeBoxHeaderLabel: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  coordsText: {
    color: '#34d399',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    lineHeight: 16,
  },
  liveTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveTagText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  refreshGpsBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 11,
  },

  // Action Buttons
  actionsContainer: {
    gap: 10,
    marginTop: 6,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  emergencyIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  emergencyBtnText: {
    color: 'white',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161822',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  historyBtnText: {
    color: '#cbd5e1',
    fontSize: 13.5,
    fontWeight: '600',
  },

  // Global Footer
  footerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  footerText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
  },
});
