require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const db = require('./db');
const ws = require('./ws');
const reportRoute = require('./routes/report');
const devicesRouter = require('./routes/devices');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const DB_PATH = process.env.DB_PATH || './data/homelab.db';
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS, 10) || 7;
const OFFLINE_THRESHOLD_SECONDS = parseInt(process.env.OFFLINE_THRESHOLD_SECONDS, 10) || 30;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
db.init(DB_PATH);

const app = express();
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.post('/api/report', (req, res) => reportRoute(req, res, ws.broadcast));
app.use('/api/devices', devicesRouter);

// Config endpoint — so the dashboard knows the offline threshold
app.get('/api/config', (req, res) => {
    res.json({ offlineThresholdSeconds: OFFLINE_THRESHOLD_SECONDS });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
ws.init(server);

// ---------------------------------------------------------------------------
// Periodic tasks
// ---------------------------------------------------------------------------

// Offline detection — check every 10s, broadcast device_offline events
setInterval(() => {
    const devices = db.getAllDevices();
    const now = Date.now();

    devices.forEach((device) => {
        if (!device.last_seen) return;
        const lastSeenMs = new Date(device.last_seen).getTime();
        const elapsed = (now - lastSeenMs) / 1000;

        if (elapsed > OFFLINE_THRESHOLD_SECONDS) {
            ws.broadcast({
                type: 'device_offline',
                device_id: device.id,
                last_seen: device.last_seen,
            });
        }
    });
}, 10000);

// Retention pruning — run every hour
setInterval(() => {
    const pruned = db.pruneOldMetrics(RETENTION_DAYS);
    if (pruned > 0) {
        console.log(`[Retention] Pruned ${pruned} old metric rows`);
    }
}, 3600000);

// ---------------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Homelab Monitor listening on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Dashboard: http://localhost:${PORT}`);
    console.log(`[Server] Offline threshold: ${OFFLINE_THRESHOLD_SECONDS}s`);
    console.log(`[Server] Retention: ${RETENTION_DAYS} days`);
});
