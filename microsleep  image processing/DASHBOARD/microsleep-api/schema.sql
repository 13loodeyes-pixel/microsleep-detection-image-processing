CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    face_encoding TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS microsleep_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    eyes_closed_seconds REAL NOT NULL,
    eyes_closed_count INTEGER NOT NULL,
    day_period TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_by_username
ON microsleep_events(username);

CREATE TABLE IF NOT EXISTS browser_profiles (
    name TEXT PRIMARY KEY,
    descriptor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS browser_events (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    eyes_closed_seconds REAL NOT NULL,
    eyes_closed_count INTEGER NOT NULL DEFAULT 1,
    day_period TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS browser_events_by_user ON browser_events(username);
CREATE TABLE IF NOT EXISTS login_attempts (
    ip_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    attempts INTEGER NOT NULL,
    PRIMARY KEY (ip_hash, bucket)
);

CREATE TABLE IF NOT EXISTS event_locations (
    event_id TEXT PRIMARY KEY REFERENCES browser_events(id),
    latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
    accuracy REAL NOT NULL CHECK(accuracy >= 0),
    captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_sessions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    stopped_at INTEGER,
    state TEXT NOT NULL,
    eye_ratio REAL,
    closure_seconds REAL NOT NULL DEFAULT 0,
    saved_events INTEGER NOT NULL DEFAULT 0,
    location_sharing INTEGER NOT NULL DEFAULT 0,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    location_at TEXT
);
CREATE INDEX IF NOT EXISTS monitoring_sessions_by_seen ON monitoring_sessions(last_seen);
