const db = require('../db');

function reportRoute(req, res, broadcast) {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.AUTH_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const report = req.body;

    if (!report.hostname) {
        return res.status(400).json({ error: 'Missing hostname' });
    }

    try {
        const deviceId = db.upsertDevice(report);
        db.insertMetrics(deviceId, report);

        // Fetch updated device + latest metrics to broadcast
        const device = db.getDevice(deviceId);
        broadcast({
            type: 'device_update',
            device,
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('Error processing report:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = reportRoute;
