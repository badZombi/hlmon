const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function init(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id          TEXT PRIMARY KEY,
      hostname    TEXT NOT NULL,
      os          TEXT,
      arch        TEXT,
      first_seen  TEXT NOT NULL,
      last_seen   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id   TEXT NOT NULL REFERENCES devices(id),
      timestamp   TEXT NOT NULL,
      cpu_pct     REAL,
      cpu_cores   INTEGER,
      mem_pct     REAL,
      mem_used    INTEGER,
      mem_total   INTEGER,
      disk_json   TEXT,
      ping_ms     REAL,
      ping_ok     INTEGER,
      ping_target TEXT,
      uptime_s    INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_device_time
      ON metrics(device_id, timestamp);
  `);

  // Migrate existing databases — add new columns if they don't exist
  migrate(db);

  return db;
}

function migrate(db) {
  // Check existing columns and add missing ones
  const columns = db.prepare("PRAGMA table_info(metrics)").all();
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('cpu_cores')) {
    db.exec('ALTER TABLE metrics ADD COLUMN cpu_cores INTEGER');
    console.log('[DB] Added cpu_cores column');
  }
  if (!columnNames.includes('ping_target')) {
    db.exec('ALTER TABLE metrics ADD COLUMN ping_target TEXT');
    console.log('[DB] Added ping_target column');
  }
}

function getDb() {
  if (!db) throw new Error('Database not initialized — call init() first');
  return db;
}

// ---------------------------------------------------------------------------
// Device operations
// ---------------------------------------------------------------------------

function upsertDevice(report) {
  const now = new Date().toISOString();
  const id = report.hostname;

  const existing = getDb().prepare('SELECT id FROM devices WHERE id = ?').get(id);

  if (existing) {
    getDb().prepare(`
      UPDATE devices SET hostname = ?, os = ?, arch = ?, last_seen = ? WHERE id = ?
    `).run(report.hostname, report.os, report.arch, now, id);
  } else {
    getDb().prepare(`
      INSERT INTO devices (id, hostname, os, arch, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, report.hostname, report.os, report.arch, now, now);
  }

  return id;
}

function getAllDevices() {
  return getDb().prepare(`
    SELECT d.*,
           m.cpu_pct, m.cpu_cores, m.mem_pct, m.mem_used, m.mem_total,
           m.disk_json, m.ping_ms, m.ping_ok, m.ping_target, m.uptime_s,
           m.timestamp AS metric_ts
    FROM devices d
    LEFT JOIN metrics m ON m.device_id = d.id
      AND m.timestamp = (
        SELECT MAX(m2.timestamp) FROM metrics m2 WHERE m2.device_id = d.id
      )
    ORDER BY d.hostname
  `).all();
}

function getDevice(id) {
  return getDb().prepare(`
    SELECT d.*,
           m.cpu_pct, m.cpu_cores, m.mem_pct, m.mem_used, m.mem_total,
           m.disk_json, m.ping_ms, m.ping_ok, m.ping_target, m.uptime_s,
           m.timestamp AS metric_ts
    FROM devices d
    LEFT JOIN metrics m ON m.device_id = d.id
      AND m.timestamp = (
        SELECT MAX(m2.timestamp) FROM metrics m2 WHERE m2.device_id = d.id
      )
    WHERE d.id = ?
  `).get(id);
}

// ---------------------------------------------------------------------------
// Metrics operations
// ---------------------------------------------------------------------------

function insertMetrics(deviceId, report) {
  const ts = report.timestamp || new Date().toISOString();

  getDb().prepare(`
    INSERT INTO metrics (device_id, timestamp, cpu_pct, cpu_cores, mem_pct, mem_used, mem_total,
                         disk_json, ping_ms, ping_ok, ping_target, uptime_s)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deviceId,
    ts,
    report.cpu?.usage_percent ?? null,
    report.cpu?.cores ?? null,
    report.memory?.usage_percent ?? null,
    report.memory?.used_bytes ?? null,
    report.memory?.total_bytes ?? null,
    report.disks ? JSON.stringify(report.disks) : null,
    report.ping?.latency_ms ?? null,
    report.ping?.success ? 1 : 0,
    report.ping?.target ?? null,
    report.uptime_seconds ?? null
  );
}

function getHistory(deviceId, since) {
  return getDb().prepare(`
    SELECT timestamp, cpu_pct, cpu_cores, mem_pct, mem_used, mem_total,
           disk_json, ping_ms, ping_ok, ping_target, uptime_s
    FROM metrics
    WHERE device_id = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `).all(deviceId, since);
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

function pruneOldMetrics(retentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  const result = getDb().prepare('DELETE FROM metrics WHERE timestamp < ?').run(cutoff);
  return result.changes;
}

module.exports = { init, getDb, upsertDevice, getAllDevices, getDevice, insertMetrics, getHistory, pruneOldMetrics };
