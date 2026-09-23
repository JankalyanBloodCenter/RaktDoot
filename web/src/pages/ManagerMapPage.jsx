import { useState, useEffect, useRef, useCallback } from 'react';
import { Map as MapIcon, PanelLeftClose, PanelLeft, Plus, Send, Shield, Smartphone, Download } from 'lucide-react';
import FleetMap from '../components/map/FleetMap';
import DriverList from '../components/manager/DriverList';
import DriverDetailsDrawer from '../components/manager/DriverDetailsDrawer';
import DestinationModal from '../components/manager/DestinationModal';
import AssignDriverModal from '../components/manager/AssignDriverModal';
import CreateCollectionRequestModal from '../components/manager/CreateCollectionRequestModal';
import GeofenceControlPanel, { getHaversineDistanceKm } from '../components/manager/GeofenceControlPanel';
import { useToast } from '../components/common/ToastContainer';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/common/LanguageToggle';
import harbingerLogo from '../assets/harbinger_logo_actual.png';

const DEFAULT_HOME_CENTER = {
  id: 'default-home',
  name: 'Jankalyan Blood Centre (Swargate HQ)',
  address: 'Swargate, Pune, Maharashtra 411042',
  lat: 18.5039,
  lng: 73.8524,
};

function ManagerMapContent() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket, fleetDriversList, destinations, reloadDestinations } = useSocket();
  const { addToast } = useToast();

  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [showDriverList, setShowDriverList] = useState(true);
  const [showGeofencePanel, setShowGeofencePanel] = useState(false);

  // Geofence states: 1 to 30 KM radius, centered on Jankalyan Swargate HQ by default
  const [geofenceCenter, setGeofenceCenter] = useState(DEFAULT_HOME_CENTER);
  const [radiusKm, setRadiusKm] = useState(5);

  // Modals
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);
  const [assigningDestination, setAssigningDestination] = useState(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionModalDriverId, setCollectionModalDriverId] = useState(null);
  const [collectionModalDestination, setCollectionModalDestination] = useState(null);

  // ── Hysteresis Proximity Entry Detection State Machine ──
  // driverProximityState: Map<driverId, boolean (isCurrentlyInside)>
  const driverProximityState = useRef(new Map());
  const prevGeofenceParams = useRef({ radiusKm, centerName: geofenceCenter?.name });

  useEffect(() => {
    if (!fleetDriversList || fleetDriversList.length === 0) return;

    // If geofence radius or center changes, reset baseline to prevent false transition toasts
    if (prevGeofenceParams.current.radiusKm !== radiusKm || prevGeofenceParams.current.centerName !== geofenceCenter?.name) {
      prevGeofenceParams.current = { radiusKm, centerName: geofenceCenter?.name };
      driverProximityState.current.clear();
    }

    // Evaluate proximity transitions on every live telemetry update
    fleetDriversList.forEach(driver => {
      if (!driver.lat || !driver.lng || (driver.lat === 0 && driver.lng === 0)) return;

      const dist = getHaversineDistanceKm(geofenceCenter.lat, geofenceCenter.lng, driver.lat, driver.lng);
      if (dist == null) return;

      const isInsideNow = dist <= radiusKm;
      const wasInside = driverProximityState.current.get(driver.id);

      // Baseline registration: on first seeing this driver, record current state without firing false entry toast
      if (wasInside === undefined) {
        driverProximityState.current.set(driver.id, isInsideNow);
        return;
      }

      // Transition: Outside ➔ Inside (only fire when driver was confirmed outside in previous check)
      if (isInsideNow && wasInside === false) {
        driverProximityState.current.set(driver.id, true);
        addToast({
          type: 'entry',
          title: `🔔 Geofence Entry Alert (${radiusKm} KM)`,
          message: `Driver ${driver.name} has entered the ${radiusKm} KM radius of ${geofenceCenter.name}! (${dist} km away)`,
          duration: 7000,
        });
      }
      // Transition: Inside ➔ Outside (re-enables alert when driver re-enters later)
      else if (!isInsideNow && wasInside === true) {
        driverProximityState.current.set(driver.id, false);
      }
    });
  }, [fleetDriversList, radiusKm, geofenceCenter, addToast]);

  // ── Real-time Socket Event Handlers ──
  useEffect(() => {
    if (!socket) return;

    // Live assignment / collection request updates
    const handleRequestUpdated = (data) => {
      reloadDestinations();
    };

    socket.on('request_status_updated', handleRequestUpdated);

    return () => {
      socket.off('request_status_updated', handleRequestUpdated);
    };
  }, [socket, addToast, reloadDestinations]);

  // Dispatch request handler for a specific driver
  const handleOpenCollectionRequest = useCallback((driverId = null, destination = null) => {
    setCollectionModalDriverId(driverId);
    setCollectionModalDestination(destination);
    setIsCollectionModalOpen(true);
  }, []);

  return (
    <div className="page-content-full">
      {/* Streamlined, elegant Topbar */}
      <div className="topbar" style={{ padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* Toggle Fleet List Button */}
          <button
            onClick={() => setShowDriverList(prev => !prev)}
            className="btn btn-ghost btn-icon btn-sm"
            title={showDriverList ? "Collapse Fleet Panel" : "Show Fleet Panel"}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-default)',
              color: showDriverList ? 'var(--color-primary-light)' : 'var(--text-muted)',
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            {showDriverList ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
              {t.liveBloodTransportTracking}
            </span>
          </div>
        </div>

        {/* Right side: Action Buttons, Language Toggle & Corporate Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* New Collection Request Button */}
          <button
            id="btn-map-new-request"
            onClick={() => handleOpenCollectionRequest()}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
            title="Create and dispatch a blood sample collection request"
          >
            <Send size={12} />
            <span>New Request</span>
          </button>

          {/* Add Destination Button */}
          <button
            id="btn-map-add-dest"
            onClick={() => setIsAddDestinationOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 9px',
              fontSize: 11.5,
              borderRadius: 6,
              whiteSpace: 'nowrap'
            }}
            title="Create a new delivery destination"
          >
            <Plus size={13} />
            <span>{t.addDestination || 'Add Destination'}</span>
          </button>

          <div style={{ height: 16, width: 1, background: 'var(--border-default)', margin: '0 2px' }} />

          <LanguageToggle />

          <div style={{ height: 16, width: 1, background: 'var(--border-default)', margin: '0 2px' }} />

          <img
            src={harbingerLogo}
            alt="Harbinger Group"
            style={{ height: 26, objectFit: 'contain', display: 'block' }}
            title="Harbinger Group"
          />
        </div>
      </div>

      {/* Map + Driver list split */}
      <div className="map-panel-split" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {showDriverList && (
          <DriverList
            selectedId={selectedDriverId}
            onSelect={setSelectedDriverId}
            onClose={() => setShowDriverList(false)}
          />
        )}

        <div className="map-panel-map" style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', position: 'relative' }}>
          {/* Interactive Geofence Radius Control Panel */}
          {showGeofencePanel && (
            <GeofenceControlPanel
              geofenceCenter={geofenceCenter}
              onChangeCenter={setGeofenceCenter}
              radiusKm={radiusKm}
              onChangeRadius={setRadiusKm}
              destinations={destinations}
              drivers={fleetDriversList}
              selectedDriverId={selectedDriverId}
              onSelectDriver={setSelectedDriverId}
              onClose={() => setShowGeofencePanel(false)}
            />
          )}

          <FleetMap
            selectedDriverId={selectedDriverId}
            onSelectDriver={setSelectedDriverId}
            isListCollapsed={!showDriverList}
            destinations={destinations}
            geofenceCenter={geofenceCenter}
            radiusKm={radiusKm}
            onToggleGeofence={() => setShowGeofencePanel(prev => !prev)}
            isGeofenceOpen={showGeofencePanel}
            onAssignDriver={(dest) => setAssigningDestination(dest)}
            onEditDestination={(dest) => setEditingDestination(dest)}
            onCreateCollectionRequest={(driverId) => handleOpenCollectionRequest(driverId)}
          />
        </div>

        {/* Driver details panel (docked on the right inside the map layout) */}
        {selectedDriverId && (
          <DriverDetailsDrawer
            driverId={selectedDriverId}
            onClose={() => setSelectedDriverId(null)}
          />
        )}
      </div>

      {/* Modals */}
      <CreateCollectionRequestModal
        isOpen={isCollectionModalOpen}
        onClose={() => {
          setIsCollectionModalOpen(false);
          setCollectionModalDriverId(null);
          setCollectionModalDestination(null);
        }}
        initialDriverId={collectionModalDriverId}
        initialDestination={collectionModalDestination}
      />

      <DestinationModal
        isOpen={isAddDestinationOpen}
        onClose={() => setIsAddDestinationOpen(false)}
      />

      <DestinationModal
        isOpen={Boolean(editingDestination)}
        destination={editingDestination}
        onClose={() => setEditingDestination(null)}
      />

      <AssignDriverModal
        isOpen={Boolean(assigningDestination)}
        destination={assigningDestination}
        onClose={() => setAssigningDestination(null)}
      />
    </div>
  );
}

export default function ManagerMapPage() {
  return <ManagerMapContent />;
}
