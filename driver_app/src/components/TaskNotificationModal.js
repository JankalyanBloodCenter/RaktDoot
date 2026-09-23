import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { respondToAssignment } from '../services/assignmentApi';
import { socketManager } from '../services/socket';

export default function TaskNotificationModal({
  visible,
  assignment,
  destination,
  currentLocation,
  serverUrl,
  token,
  onAccepted,
  onRejected,
  onClose,
}) {
  const [responding, setResponding] = useState(false);

  if (!visible || !assignment) return null;

  const dest = destination || {
    name: assignment.destination_name,
    address: assignment.destination_address,
    radius_m: assignment.destination_radius_m,
    description: assignment.destination_description,
    lat: assignment.destination_lat,
    lng: assignment.destination_lng,
  };

  // Calculate approximate distance
  let distanceKm = null;
  if (currentLocation?.latitude && dest?.lat && currentLocation?.longitude && dest?.lng) {
    const R = 6371;
    const dLat = ((dest.lat - currentLocation.latitude) * Math.PI) / 180;
    const dLon = ((dest.lng - currentLocation.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((currentLocation.latitude * Math.PI) / 180) *
        Math.cos((dest.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceKm = (R * c).toFixed(1);
  }

  const handleResponse = async (status) => {
    setResponding(true);
    try {
      // 1. Send via REST (which broadcasts socket events server-side)
      await respondToAssignment(serverUrl, token, assignment.id, status);

      if (status === 'accepted') {
        onAccepted?.(assignment);
      } else {
        onRejected?.(assignment);
      }
      onClose?.();
    } catch (err) {
      alert(err.message || 'Failed to update task response');
    } finally {
      setResponding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Badge */}
          <View style={[styles.header, assignment.urgency === 'emergency' && { backgroundColor: 'rgba(239, 68, 68, 0.18)', borderBottomColor: 'rgba(239, 68, 68, 0.35)' }]}>
            <View style={[styles.iconContainer, assignment.urgency === 'emergency' && { backgroundColor: 'rgba(239, 68, 68, 0.25)' }]}>
              <Text style={styles.iconText}>{assignment.urgency === 'emergency' ? '🚨' : '🩸'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.badgeText, assignment.urgency === 'emergency' && { color: '#f87171' }]}>
                  {assignment.urgency ? `${assignment.urgency.toUpperCase()} BLOOD COLLECTION REQUEST` : 'NEW DELIVERY TASK DISPATCHED'}
                </Text>
              </View>
              <Text style={styles.titleText}>{dest.name || 'Delivery Hub'}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} bounces={false}>
            {/* Route Waypoints (Source ➔ Target Hospital) */}
            <View style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderWidth: 1,
              borderColor: '#1e293b',
              marginBottom: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 12 }}>🏥</Text>
                <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '700' }}>SOURCE:</Text>
                <Text style={{ fontSize: 12, color: '#f8fafc', fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {assignment.source_name || 'Jankalyan Blood Centre (Swargate HQ)'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12 }}>🎯</Text>
                <Text style={{ fontSize: 11, color: '#38bdf8', fontWeight: '700' }}>DESTINATION:</Text>
                <Text style={{ fontSize: 12, color: '#38bdf8', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {dest.name}
                </Text>
              </View>
            </View>

            {/* Address */}
            {dest.address ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📍 HOSPITAL ADDRESS</Text>
                <Text style={styles.infoValue}>{dest.address}</Text>
              </View>
            ) : null}

            {/* Distance & Geofence metrics */}
            <View style={styles.metricsRow}>
              {distanceKm ? (
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>APPROX DISTANCE</Text>
                  <Text style={styles.metricValue}>{distanceKm} km</Text>
                </View>
              ) : null}

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>GEOFENCE RADIUS</Text>
                <Text style={styles.metricValue}>
                  {dest.radius_m ? `${dest.radius_m}m` : '500m'}
                </Text>
              </View>
            </View>

            {/* Blood Unit & Category Badge */}
            <View style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.35)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#f87171', letterSpacing: 0.5 }}>
                BLOOD COMPONENT & QUANTITY
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#ffffff', marginTop: 3 }}>
                🩸 {assignment.unit_count || 1} {(assignment.unit_count || 1) > 1 ? 'Bags' : 'Bag'} · {
                  assignment.category === 'plasma' ? 'Plasma (FFP)'
                  : assignment.category === 'cryo' ? 'Cryo (CRYO)'
                  : assignment.category === 'platelets' ? 'Platelets (SDP/RDP)'
                  : assignment.category === 'red_blood_cell' || assignment.category === 'rbc' ? 'Red Blood Cells (PRBC)'
                  : assignment.category || 'Blood Units'
                }
              </Text>
            </View>

            {/* Sample Notes / Dispatch Instructions */}
            {(assignment.notes || dest.description) ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📝 SAMPLE NOTES & INSTRUCTIONS</Text>
                <Text style={styles.notesText}>{assignment.notes || dest.description}</Text>
              </View>
            ) : null}

            <View style={styles.alertNotice}>
              <Text style={styles.alertNoticeText}>
                ⚠️ Once accepted, your live route is mapped to dispatch until marked completed at the hospital.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {assignment.status === 'pending' ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.rejectButton]}
                  onPress={() => handleResponse('rejected')}
                  disabled={responding}
                >
                  <Text style={styles.rejectButtonText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.acceptButton]}
                  onPress={() => handleResponse('accepted')}
                  disabled={responding}
                >
                  {responding ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.acceptButtonText}>✓ Accept Delivery</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#1e293b' }]}
                  onPress={onClose}
                >
                  <Text style={{ color: '#cbd5e1', fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.acceptButton]}
                  onPress={() => {
                    const lat = dest.lat || assignment.destination_lat;
                    const lng = dest.lng || assignment.destination_lng;
                    if (lat && lng) {
                      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                    }
                    onClose?.();
                  }}
                >
                  <Text style={styles.acceptButtonText}>🧭 Open GPS Navigation</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.25)',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  body: {
    padding: 18,
    maxHeight: 340,
  },
  infoRow: {
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13.5,
    color: '#f1f5f9',
    fontWeight: '600',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38bdf8',
    marginTop: 2,
  },
  notesText: {
    fontSize: 12.5,
    color: '#cbd5e1',
    lineHeight: 17,
  },
  alertNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  alertNoticeText: {
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  rejectButtonText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 14,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
