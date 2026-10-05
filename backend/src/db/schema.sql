-- =========================================================
-- Delivery Tracking System — SQLite Schema
-- =========================================================

-- ─── USERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('driver', 'manager', 'admin')),
  phone       TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  push_token  TEXT,
  vehicle_type TEXT DEFAULT 'two_wheeler',
  vehicle_number TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── DRIVER LOCATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id   TEXT PRIMARY KEY,
  lat         REAL NOT NULL DEFAULT 0,
  lng         REAL NOT NULL DEFAULT 0,
  speed       REAL NOT NULL DEFAULT 0,
  heading     REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('active', 'idle', 'issue', 'offline')),
  address     TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── DELIVERY HISTORY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id   TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  speed       REAL NOT NULL DEFAULT 0,
  heading     REAL NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── ISSUES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
  id          TEXT PRIMARY KEY,
  driver_id   TEXT NOT NULL,
  type        TEXT DEFAULT 'vehicle_breakdown',
  severity    TEXT DEFAULT 'medium',
  description TEXT NOT NULL,
  image_path  TEXT,
  lat         REAL,
  lng         REAL,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── DESTINATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS destinations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  radius_m    REAL NOT NULL DEFAULT 500,
  description TEXT,
  created_by  TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  is_home     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ─── DRIVER ASSIGNMENTS & COLLECTION REQUESTS ──────────────
CREATE TABLE IF NOT EXISTS driver_assignments (
  id              TEXT PRIMARY KEY,
  destination_id  TEXT NOT NULL,
  driver_id       TEXT NOT NULL,
  assigned_by     TEXT NOT NULL,
  source_name     TEXT DEFAULT 'Jankalyan Blood Centre (Swargate HQ)',
  source_lat      REAL DEFAULT 18.5039,
  source_lng      REAL DEFAULT 73.8524,
  urgency         TEXT DEFAULT 'normal' CHECK(urgency IN ('normal', 'urgent', 'emergency')),
  category        TEXT DEFAULT 'red_blood_cell',
  unit_count      INTEGER DEFAULT 1,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','accepted','rejected','in_progress','completed','cancelled')),
  assigned_at     TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at     TEXT,
  completed_at    TEXT,
  rejected_at     TEXT,
  rejection_reason TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE,
  FOREIGN KEY (driver_id)      REFERENCES users(id),
  FOREIGN KEY (assigned_by)    REFERENCES users(id)
);

-- ─── GEOFENCE NOTIFICATIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_notifications (
  id              TEXT PRIMARY KEY,
  manager_id      TEXT NOT NULL,
  driver_id       TEXT NOT NULL,
  destination_id  TEXT NOT NULL,
  assignment_id   TEXT,
  type            TEXT NOT NULL DEFAULT 'geofence_enter',
  message         TEXT NOT NULL,
  distance_m      REAL,
  is_read         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (manager_id)     REFERENCES users(id),
  FOREIGN KEY (driver_id)      REFERENCES users(id),
  FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
);

-- ─── INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_driver_locations_status ON driver_locations(status);
CREATE INDEX IF NOT EXISTS idx_issues_driver ON issues(driver_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_location_history_driver ON location_history(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver ON driver_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_dest ON driver_assignments(destination_id);
CREATE INDEX IF NOT EXISTS idx_geofence_notifications_mgr ON geofence_notifications(manager_id, is_read);

