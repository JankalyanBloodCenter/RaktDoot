import { Platform } from 'react-native';

// Default backend URL: dynamically uses current origin on web or live cloud Render backend
export const DEFAULT_SERVER_URL = (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' && !window.location.origin.includes(':8081'))
  ? window.location.origin
  : 'https://raktdoot-backend-g8fz.onrender.com';

export const PRESET_SERVER_URLS = [
  { label: 'Cloud Live (Render)', url: 'https://raktdoot-backend-g8fz.onrender.com' },
  { label: 'Local PC Wi-Fi (192.168.1.107:5000)', url: 'http://192.168.1.107:5000' },
  { label: 'Localhost (5000)', url: 'http://localhost:5000' },
  { label: 'Android Emulator (10.0.2.2)', url: 'http://10.0.2.2:5000' },
];

export const STATUS_COLORS = {
  active: '#10b981', // Green
  idle: '#f59e0b',   // Amber
  issue: '#ef4444',  // Red
  offline: '#6b7280',// Gray
};

export const ISSUE_TYPES = [
  { id: 'vehicle_breakdown', label: 'Vehicle Breakdown', emoji: '🔧' },
  { id: 'flat_tire', label: 'Flat Tire / Puncture', emoji: '🛞' },
  { id: 'accident', label: 'Accident / Collision', emoji: '💥' },
  { id: 'traffic_delay', label: 'Severe Traffic Jam', emoji: '🚦' },
  { id: 'cargo_damage', label: 'Cargo / Package Damaged', emoji: '📦' },
  { id: 'fuel_empty', label: 'Fuel / Battery Depleted', emoji: '⛽' },
];

export const SEVERITIES = [
  { id: 'low', label: 'Low', color: '#3b82f6' },
  { id: 'medium', label: 'Medium', color: '#f59e0b' },
  { id: 'high', label: 'High', color: '#f97316' },
  { id: 'critical', label: 'Critical', color: '#ef4444' },
];
