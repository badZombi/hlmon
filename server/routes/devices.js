const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/devices — list all devices with latest metrics
router.get('/', (req, res) => {
    try {
        const devices = db.getAllDevices();
        res.json(devices);
    } catch (err) {
        console.error('Error fetching devices:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/devices/:id — single device with latest metrics
router.get('/:id', (req, res) => {
    try {
        const device = db.getDevice(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(device);
    } catch (err) {
        console.error('Error fetching device:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/devices/:id/history?range=1h|6h|24h|7d
router.get('/:id/history', (req, res) => {
    try {
        const device = db.getDevice(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const range = req.query.range || '1h';
        const now = Date.now();
        let sinceMs;

        switch (range) {
            case '6h': sinceMs = now - 6 * 3600000; break;
            case '24h': sinceMs = now - 24 * 3600000; break;
            case '7d': sinceMs = now - 7 * 86400000; break;
            case '1h':
            default: sinceMs = now - 3600000; break;
        }

        const since = new Date(sinceMs).toISOString();
        const history = db.getHistory(req.params.id, since);

        res.json({ device, history });
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
