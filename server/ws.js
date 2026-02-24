const WebSocket = require('ws');

let wss;

function init(server) {
    wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        console.log(`[WS] Client connected from ${ip}`);

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('close', () => {
            console.log(`[WS] Client disconnected from ${ip}`);
        });
    });

    // Heartbeat — detect dead connections every 30s
    const heartbeat = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(heartbeat));

    console.log('[WS] WebSocket server initialized');
}

function broadcast(data) {
    if (!wss) return;

    const payload = JSON.stringify(data);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

module.exports = { init, broadcast };
