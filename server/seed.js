// Seed script — inject 8 mock devices into the server
const http = require('http');

const devices = [
    { hostname: 'jzb-macbook', os: 'darwin', arch: 'arm64', cpu: { usage_percent: 23.5, cores: 10 }, memory: { total_bytes: 17179869184, used_bytes: 8589934592, usage_percent: 50.0 }, disks: [{ mount: '/', total_bytes: 499963174912, used_bytes: 250000000000, usage_percent: 50.0 }], ping: { target: '1.1.1.1', latency_ms: 12.3, success: true }, uptime_seconds: 432000 },
    { hostname: 'media-server', os: 'linux', arch: 'amd64', cpu: { usage_percent: 67.2, cores: 8 }, memory: { total_bytes: 34359738368, used_bytes: 28991029248, usage_percent: 84.4 }, disks: [{ mount: '/', total_bytes: 1000204886016, used_bytes: 752000000000, usage_percent: 75.2 }, { mount: '/mnt/storage', total_bytes: 4000787030016, used_bytes: 3600000000000, usage_percent: 90.0 }], ping: { target: '1.1.1.1', latency_ms: 5.1, success: true }, uptime_seconds: 1296000 },
    { hostname: 'win-desktop', os: 'windows', arch: 'amd64', cpu: { usage_percent: 12.0, cores: 16 }, memory: { total_bytes: 68719476736, used_bytes: 20000000000, usage_percent: 29.1 }, disks: [{ mount: 'C:\\', total_bytes: 500107862016, used_bytes: 200000000000, usage_percent: 40.0 }, { mount: 'D:\\', total_bytes: 2000398934016, used_bytes: 1200000000000, usage_percent: 60.0 }], ping: { target: '1.1.1.1', latency_ms: 18.7, success: true }, uptime_seconds: 172800 },
    { hostname: 'nas-synology', os: 'linux', arch: 'amd64', cpu: { usage_percent: 8.3, cores: 4 }, memory: { total_bytes: 8589934592, used_bytes: 5100000000, usage_percent: 59.4 }, disks: [{ mount: '/volume1', total_bytes: 8001563222016, used_bytes: 6800000000000, usage_percent: 85.0 }, { mount: '/volume2', total_bytes: 4000787030016, used_bytes: 3000000000000, usage_percent: 75.0 }], ping: { target: '1.1.1.1', latency_ms: 3.2, success: true }, uptime_seconds: 5184000 },
    { hostname: 'pi-dashboard', os: 'linux', arch: 'arm64', cpu: { usage_percent: 15.7, cores: 4 }, memory: { total_bytes: 4294967296, used_bytes: 1800000000, usage_percent: 41.9 }, disks: [{ mount: '/', total_bytes: 31914983424, used_bytes: 12000000000, usage_percent: 37.6 }], ping: { target: '1.1.1.1', latency_ms: 8.9, success: true }, uptime_seconds: 864000 },
    { hostname: 'docker-host', os: 'linux', arch: 'amd64', cpu: { usage_percent: 88.1, cores: 12 }, memory: { total_bytes: 68719476736, used_bytes: 52000000000, usage_percent: 75.6 }, disks: [{ mount: '/', total_bytes: 500107862016, used_bytes: 320000000000, usage_percent: 64.0 }, { mount: '/var/lib/docker', total_bytes: 1000204886016, used_bytes: 550000000000, usage_percent: 55.0 }], ping: { target: '1.1.1.1', latency_ms: 4.5, success: true }, uptime_seconds: 2592000 },
    { hostname: 'gaming-pc', os: 'windows', arch: 'amd64', cpu: { usage_percent: 3.2, cores: 24 }, memory: { total_bytes: 68719476736, used_bytes: 12000000000, usage_percent: 17.5 }, disks: [{ mount: 'C:\\', total_bytes: 1000204886016, used_bytes: 450000000000, usage_percent: 45.0 }, { mount: 'D:\\', total_bytes: 2000398934016, used_bytes: 1600000000000, usage_percent: 80.0 }], ping: { target: '1.1.1.1', latency_ms: 22.1, success: true }, uptime_seconds: 86400 },
    { hostname: 'dev-laptop', os: 'darwin', arch: 'arm64', cpu: { usage_percent: 42.8, cores: 8 }, memory: { total_bytes: 34359738368, used_bytes: 26000000000, usage_percent: 75.7 }, disks: [{ mount: '/', total_bytes: 499963174912, used_bytes: 380000000000, usage_percent: 76.0 }], ping: { target: '1.1.1.1', latency_ms: 15.6, success: true }, uptime_seconds: 259200 },
];

async function send(device) {
    device.timestamp = new Date().toISOString();
    const body = JSON.stringify(device);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost', port: 3333, path: '/api/report',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer changeme-homelab-secret' },
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { console.log(`${device.hostname}: ${data}`); resolve(); });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    for (const d of devices) await send(d);
    console.log('All 8 devices seeded!');
})();
