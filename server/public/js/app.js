/* =========================================================================
   Homelab Monitor — Dashboard Application
   ========================================================================= */

(() => {
    'use strict';

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    const state = {
        devices: {},              // id → device object
        offlineThreshold: 30,     // seconds
        selectedDeviceId: null,
        selectedMetric: null,     // 'cpu', 'mem', 'disk', 'ping'
        activeRange: '1h',
        metricRange: '1h',
        charts: {},               // chartId → Chart instance
        metricChart: null,        // single chart for metric panel
        ws: null,
        reconnectAttempts: 0,
    };

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function osIcon(os) {
        if (!os) return '🖥️';
        const o = os.toLowerCase();
        if (o.includes('darwin') || o.includes('mac')) return '🍎';
        if (o.includes('linux')) return '🐧';
        if (o.includes('windows')) return '🪟';
        return '🖥️';
    }

    function isOnline(device) {
        if (!device.last_seen) return false;
        const elapsed = (Date.now() - new Date(device.last_seen).getTime()) / 1000;
        return elapsed <= state.offlineThreshold;
    }

    function healthStatus(device) {
        if (!isOnline(device)) return 'offline';
        const cpu = device.cpu_pct ?? 0;
        const mem = device.mem_pct ?? 0;
        const diskPct = getMaxRealDiskPct(device);
        if (cpu > 95 || mem > 95 || diskPct > 95) return 'critical';
        if (cpu > 80 || mem > 80 || diskPct > 80) return 'warning';
        return 'healthy';
    }

    // Virtual/temporary mount point patterns to exclude from warnings
    const virtualMountPatterns = [
        /^\/dev($|\/)/,
        /^\/sys($|\/)/,
        /^\/proc($|\/)/,
        /^\/run($|\/)/,
        /^\/snap\//,
        /^\/var\/lib\/docker\//,
        /^\/var\/lib\/containers\//,
        /^\/boot\/efi$/,
    ];

    function isRealDisk(mount) {
        if (!mount) return false;
        return !virtualMountPatterns.some(pattern => pattern.test(mount));
    }

    function getMaxRealDiskPct(device) {
        if (!device.disk_json) return 0;
        try {
            const disks = typeof device.disk_json === 'string'
                ? JSON.parse(device.disk_json) : device.disk_json;
            if (!Array.isArray(disks) || disks.length === 0) return 0;
            const realDisks = disks.filter(d => isRealDisk(d.mount));
            if (realDisks.length === 0) return 0;
            return Math.max(...realDisks.map(d => d.usage_percent || 0));
        } catch { return 0; }
    }

    // Keep original for display purposes (shows all disks)
    function getMaxDiskPct(device) {
        if (!device.disk_json) return 0;
        try {
            const disks = typeof device.disk_json === 'string'
                ? JSON.parse(device.disk_json) : device.disk_json;
            if (!Array.isArray(disks) || disks.length === 0) return 0;
            return Math.max(...disks.map(d => d.usage_percent || 0));
        } catch { return 0; }
    }

    function formatBytes(bytes) {
        if (bytes == null) return '—';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        let val = bytes;
        while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
        return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    }

    function formatUptime(seconds) {
        if (seconds == null) return '—';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    function timeAgo(isoStr) {
        if (!isoStr) return 'never';
        const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
        if (diff < 5) return 'just now';
        if (diff < 60) return `${Math.floor(diff)}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function thresholdClass(pct) {
        if (pct == null) return '';
        if (pct > 95) return 'crit';
        if (pct > 80) return 'warn';
        return 'ok';
    }

    // -----------------------------------------------------------------------
    // DOM references
    // -----------------------------------------------------------------------
    const $grid = document.getElementById('device-grid');
    const $detailPanel = document.getElementById('detail-panel');
    const $detailOverlay = document.getElementById('detail-overlay');
    const $detailClose = document.getElementById('detail-close');
    const $metricPanel = document.getElementById('metric-panel');
    const $metricClose = document.getElementById('metric-close');
    const $onlineCount = document.getElementById('online-count');
    const $offlineCount = document.getElementById('offline-count');
    const $clock = document.getElementById('clock');

    // -----------------------------------------------------------------------
    // Clock
    // -----------------------------------------------------------------------
    function updateClock() {
        const now = new Date();
        $clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // -----------------------------------------------------------------------
    // Grid Layout — scale cards to fill the viewport
    // -----------------------------------------------------------------------

    function computeGridLayout(deviceCount) {
        if (deviceCount === 0) return;

        // Compute best cols × rows to fill the available grid area
        const headerHeight = document.getElementById('main-header').offsetHeight;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight - headerHeight;
        const padding = 48; // 24px padding on each side
        const gap = 16;
        const availW = viewportW - padding;
        const availH = viewportH - padding;

        // Try different column counts and pick the one that gives the best
        // aspect ratio for each card (target ~1.4:1 width:height)
        let bestCols = 1;
        let bestScore = Infinity;
        const targetAspect = 1.0; // square cells for circles

        for (let cols = 1; cols <= Math.min(deviceCount, 8); cols++) {
            const rows = Math.ceil(deviceCount / cols);
            const cellW = (availW - gap * (cols - 1)) / cols;
            const cellH = (availH - gap * (rows - 1)) / rows;

            if (cellW < 100 || cellH < 60) continue; // too small

            const aspect = cellW / cellH;
            const score = Math.abs(aspect - targetAspect);

            if (score < bestScore) {
                bestScore = score;
                bestCols = cols;
            }
        }

        const bestRows = Math.ceil(deviceCount / bestCols);
        $grid.style.setProperty('--grid-cols', bestCols);
        $grid.style.setProperty('--grid-rows', bestRows);
    }

    window.addEventListener('resize', () => {
        computeGridLayout(Object.keys(state.devices).length);
    });

    // -----------------------------------------------------------------------
    // Device Cards
    // -----------------------------------------------------------------------

    function renderGrid() {
        const devices = Object.values(state.devices);
        computeGridLayout(devices.length);
        let onlineN = 0, offlineN = 0;

        devices.forEach(d => {
            if (isOnline(d)) onlineN++; else offlineN++;
        });

        $onlineCount.textContent = `${onlineN} online`;
        $offlineCount.textContent = `${offlineN} offline`;

        // Build cards
        const sortedDevices = devices.sort((a, b) =>
            a.hostname.localeCompare(b.hostname)
        );

        $grid.innerHTML = '';

        sortedDevices.forEach(device => {
            const online = isOnline(device);
            const health = healthStatus(device);

            // Border class for resource issues (separate from online/offline fill)
            let borderClass = '';
            if (online && health === 'critical') borderClass = 'border-critical';
            else if (online && health === 'warning') borderClass = 'border-warning';

            const card = document.createElement('div');
            card.className = `device-card ${online ? 'online' : 'offline'} ${borderClass}`.trim();
            card.dataset.deviceId = device.id;

            card.innerHTML = `<span class="card-hostname">${device.hostname}</span>`;

            card.addEventListener('click', () => openDetail(device.id));
            $grid.appendChild(card);
        });

        // Auto-scale hostnames to fit inside circle (~70% of card width)
        requestAnimationFrame(() => {
            $grid.querySelectorAll('.device-card').forEach(card => {
                const label = card.querySelector('.card-hostname');
                if (!label) return;
                const cardW = card.clientWidth * 0.7; // inscribed width
                let size = 60;
                label.style.fontSize = size + 'px';
                while (label.scrollWidth > cardW && size > 8) {
                    size -= 1;
                    label.style.fontSize = size + 'px';
                }
            });
        });
    }

    // Auto-refresh relative times and statuses every 5s
    setInterval(renderGrid, 5000);

    // -----------------------------------------------------------------------
    // Detail Panel
    // -----------------------------------------------------------------------

    function openDetail(deviceId) {
        state.selectedDeviceId = deviceId;
        const device = state.devices[deviceId];
        if (!device) return;

        const diskPct = getMaxDiskPct(device);

        document.getElementById('detail-hostname').textContent = device.hostname;
        document.getElementById('detail-meta').textContent =
            `${device.os || '?'} / ${device.arch || '?'}`;

        // Metric circles
        setCircleMetric('detail-cpu', device.cpu_pct, '%');
        setCircleMetric('detail-mem', device.mem_pct, '%');
        setCircleMetric('detail-disk', diskPct > 0 ? diskPct : null, '%');

        const pingEl = document.getElementById('detail-ping');
        if (device.ping_ms != null) {
            pingEl.textContent = device.ping_ms.toFixed(1) + 'ms';
            pingEl.className = 'metric-value ' + (device.ping_ms > 200 ? 'crit' : device.ping_ms > 100 ? 'warn' : 'ok');
        } else {
            pingEl.textContent = '—';
            pingEl.className = 'metric-value';
        }

        document.getElementById('detail-uptime').textContent =
            `Uptime: ${formatUptime(device.uptime_s)}`;
        document.getElementById('detail-lastseen').textContent =
            `Last seen: ${timeAgo(device.last_seen)}`;

        $detailPanel.classList.remove('hidden');
    }

    function setCircleMetric(valueId, pct, suffix) {
        const valEl = document.getElementById(valueId);
        if (pct != null) {
            valEl.textContent = Math.round(pct) + (suffix || '');
            valEl.className = 'metric-value ' + thresholdClass(pct);
        } else {
            valEl.textContent = '—';
            valEl.className = 'metric-value';
        }
    }

    function closeDetail() {
        $detailPanel.classList.add('hidden');
        state.selectedDeviceId = null;
        destroyCharts();
    }

    // Close button (works reliably on touch screens)
    $detailClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDetail();
    });

    // Also handle touch events explicitly for better touch response
    $detailClose.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeDetail();
    });

    // Click on overlay/background to close (with improved touch handling)
    $detailPanel.addEventListener('click', (e) => {
        // Only close if clicking directly on the panel background, not on content
        if (e.target === $detailPanel || e.target === $detailOverlay) {
            closeDetail();
        }
    });

    // Metric circle clicks - open metric detail panel
    document.querySelectorAll('.metric-circle').forEach(circle => {
        circle.addEventListener('click', (e) => {
            e.stopPropagation();
            const metric = circle.dataset.metric;
            if (metric && state.selectedDeviceId) {
                openMetricDetail(metric);
            }
        });
        
        circle.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const metric = circle.dataset.metric;
            if (metric && state.selectedDeviceId) {
                openMetricDetail(metric);
            }
        });
    });

    // Time range buttons
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeRange = btn.dataset.range;
            if (state.selectedDeviceId) {
                loadCharts(state.selectedDeviceId, state.activeRange);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Metric Detail Panel
    // -----------------------------------------------------------------------

    const metricLabels = {
        cpu: 'CPU',
        mem: 'Memory',
        disk: 'Disk',
        ping: 'Network Ping'
    };

    function openMetricDetail(metric) {
        state.selectedMetric = metric;
        const device = state.devices[state.selectedDeviceId];
        if (!device) return;

        const $title = document.getElementById('metric-title');
        const $deviceName = document.getElementById('metric-device');
        const $summary = document.getElementById('metric-summary');

        $title.textContent = metricLabels[metric] || metric;
        $title.className = metric;
        $deviceName.textContent = device.hostname;

        // Build summary content based on metric type
        $summary.innerHTML = buildMetricSummary(metric, device);

        $metricPanel.classList.remove('hidden');
        loadMetricChart(metric, state.metricRange);
    }

    function buildMetricSummary(metric, device) {
        switch (metric) {
            case 'cpu':
                return `
                    <div class="metric-summary-item">
                        <span class="label">Usage</span>
                        <span class="value ${thresholdClass(device.cpu_pct)}">${device.cpu_pct != null ? Math.round(device.cpu_pct) + '%' : '—'}</span>
                    </div>
                    <div class="metric-summary-item">
                        <span class="label">Cores</span>
                        <span class="value">${device.cpu_cores || '—'}</span>
                    </div>
                `;

            case 'mem':
                const memTotal = device.mem_total;
                const memUsed = device.mem_used;
                return `
                    <div class="metric-summary-item">
                        <span class="label">Usage</span>
                        <span class="value ${thresholdClass(device.mem_pct)}">${device.mem_pct != null ? Math.round(device.mem_pct) + '%' : '—'}</span>
                    </div>
                    <div class="metric-summary-item">
                        <span class="label">Used</span>
                        <span class="value">${formatBytes(memUsed)}</span>
                    </div>
                    <div class="metric-summary-item">
                        <span class="label">Total</span>
                        <span class="value">${formatBytes(memTotal)}</span>
                    </div>
                `;

            case 'disk':
                return buildDiskSummary(device);

            case 'ping':
                const ping = device.ping_ms;
                const pingClass = ping != null ? (ping > 200 ? 'crit' : ping > 100 ? 'warn' : 'ok') : '';
                return `
                    <div class="metric-summary-item">
                        <span class="label">Latency</span>
                        <span class="value ${pingClass}">${ping != null ? ping.toFixed(1) + 'ms' : '—'}</span>
                    </div>
                    <div class="metric-summary-item">
                        <span class="label">Target</span>
                        <span class="value">${device.ping_target || '1.1.1.1'}</span>
                    </div>
                    <div class="metric-summary-item">
                        <span class="label">Status</span>
                        <span class="value ${ping != null ? 'ok' : 'crit'}">${ping != null ? 'OK' : 'Failed'}</span>
                    </div>
                `;

            default:
                return '';
        }
    }

    function buildDiskSummary(device) {
        if (!device.disk_json) return '<div class="metric-summary-item"><span class="label">No Data</span><span class="value">—</span></div>';

        try {
            const disks = typeof device.disk_json === 'string'
                ? JSON.parse(device.disk_json) : device.disk_json;

            if (!Array.isArray(disks) || disks.length === 0) {
                return '<div class="metric-summary-item"><span class="label">No Disks</span><span class="value">—</span></div>';
            }

            // Filter to show only real disks (non-virtual mounts)
            const realDisks = disks.filter(d => isRealDisk(d.mount));

            return realDisks.map(d => `
                <div class="metric-summary-item">
                    <span class="label">${d.mount}</span>
                    <span class="value ${thresholdClass(d.usage_percent)}">${Math.round(d.usage_percent)}%</span>
                </div>
            `).join('') || '<div class="metric-summary-item"><span class="label">No Real Disks</span><span class="value">—</span></div>';
        } catch {
            return '<div class="metric-summary-item"><span class="label">Error</span><span class="value">—</span></div>';
        }
    }

    function closeMetricDetail() {
        $metricPanel.classList.add('hidden');
        state.selectedMetric = null;
        if (state.metricChart) {
            state.metricChart.destroy();
            state.metricChart = null;
        }
    }

    // Close button for metric panel
    $metricClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMetricDetail();
    });

    $metricClose.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMetricDetail();
    });

    // Click on background to close metric panel
    $metricPanel.addEventListener('click', (e) => {
        if (e.target === $metricPanel) {
            closeMetricDetail();
        }
    });

    // Metric panel range buttons
    document.querySelectorAll('.range-btn-metric').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.range-btn-metric').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.metricRange = btn.dataset.range;
            if (state.selectedMetric && state.selectedDeviceId) {
                loadMetricChart(state.selectedMetric, state.metricRange);
            }
        });
    });

    async function loadMetricChart(metric, range) {
        if (state.metricChart) {
            state.metricChart.destroy();
            state.metricChart = null;
        }

        const deviceId = state.selectedDeviceId;
        if (!deviceId) return;

        try {
            const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/history?range=${range}`);
            if (!res.ok) return;
            const { history } = await res.json();
            if (!history || history.length === 0) return;

            const labels = history.map(h => {
                const d = new Date(h.timestamp);
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });

            let data, color, unit, label, maxY;

            switch (metric) {
                case 'cpu':
                    data = history.map(h => h.cpu_pct);
                    color = chartColors.cpu;
                    unit = '%';
                    label = 'CPU %';
                    maxY = 100;
                    break;
                case 'mem':
                    data = history.map(h => h.mem_pct);
                    color = chartColors.mem;
                    unit = '%';
                    label = 'Memory %';
                    maxY = 100;
                    break;
                case 'disk':
                    data = history.map(h => {
                        if (!h.disk_json) return null;
                        try {
                            const disks = JSON.parse(h.disk_json);
                            const realDisks = disks.filter(d => isRealDisk(d.mount));
                            if (realDisks.length === 0) return null;
                            return Math.max(...realDisks.map(d => d.usage_percent || 0));
                        } catch { return null; }
                    });
                    color = chartColors.disk;
                    unit = '%';
                    label = 'Disk %';
                    maxY = 100;
                    break;
                case 'ping':
                    data = history.map(h => h.ping_ms);
                    color = chartColors.ping;
                    unit = 'ms';
                    label = 'Ping (ms)';
                    maxY = null;
                    break;
                default:
                    return;
            }

            const ctx = document.getElementById('metric-chart').getContext('2d');
            state.metricChart = new Chart(ctx, buildSmoothChartConfig(label, data, labels, color, unit, maxY));
        } catch (err) {
            console.error('Failed to load metric chart:', err);
        }
    }

    // Smooth chart config with better animations
    function buildSmoothChartConfig(label, data, labels, color, unit, maxY) {
        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    borderColor: color.border,
                    backgroundColor: color.bg,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 10,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 400,
                    easing: 'easeOutQuart',
                },
                transitions: {
                    active: {
                        animation: { duration: 200 }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a2332',
                        titleColor: '#e4e8f0',
                        bodyColor: '#8b95a8',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y?.toFixed(1) ?? '—'}${unit}`
                        }
                    },
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#5a6478', maxRotation: 0, maxTicksLimit: 6, font: { size: 11 } },
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            color: '#5a6478',
                            font: { size: 11 },
                            callback: (v) => v + (unit || '')
                        },
                        beginAtZero: true,
                        max: maxY,
                    },
                },
            },
        };
    }

    // -----------------------------------------------------------------------
    // Charts (Chart.js)
    // -----------------------------------------------------------------------

    const chartColors = {
        cpu: { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        mem: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        disk: { border: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
        ping: { border: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    };

    const defaultChartOpts = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1a2332',
                titleColor: '#e4e8f0',
                bodyColor: '#8b95a8',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
            },
        },
        scales: {
            x: {
                type: 'category',
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#5a6478', maxRotation: 0, maxTicksLimit: 8, font: { size: 10 } },
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#5a6478', font: { size: 10 } },
                beginAtZero: true,
            },
        },
        elements: {
            point: { radius: 0, hitRadius: 8 },
            line: { tension: 0.3, borderWidth: 2 },
        },
    };

    function buildChartConfig(label, data, labels, color, unit, maxY) {
        const cfg = JSON.parse(JSON.stringify(defaultChartOpts));
        if (maxY != null) cfg.scales.y.max = maxY;
        cfg.scales.y.ticks.callback = (v) => v + (unit || '');
        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    borderColor: color.border,
                    backgroundColor: color.bg,
                    fill: true,
                }],
            },
            options: cfg,
        };
    }

    function destroyCharts() {
        Object.values(state.charts).forEach(c => c.destroy());
        state.charts = {};
    }

    async function loadCharts(deviceId, range) {
        destroyCharts();

        try {
            const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/history?range=${range}`);
            if (!res.ok) return;
            const { history } = await res.json();
            if (!history || history.length === 0) return;

            const labels = history.map(h => {
                const d = new Date(h.timestamp);
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });

            const cpuData = history.map(h => h.cpu_pct);
            const memData = history.map(h => h.mem_pct);
            const pingData = history.map(h => h.ping_ms);

            // Disk: use max disk % from each snapshot
            const diskData = history.map(h => {
                if (!h.disk_json) return null;
                try {
                    const disks = JSON.parse(h.disk_json);
                    return Math.max(...disks.map(d => d.usage_percent || 0));
                } catch { return null; }
            });

            state.charts.cpu = new Chart(
                document.getElementById('chart-cpu'),
                buildChartConfig('CPU %', cpuData, labels, chartColors.cpu, '%', 100)
            );
            state.charts.mem = new Chart(
                document.getElementById('chart-mem'),
                buildChartConfig('Memory %', memData, labels, chartColors.mem, '%', 100)
            );
            state.charts.disk = new Chart(
                document.getElementById('chart-disk'),
                buildChartConfig('Disk %', diskData, labels, chartColors.disk, '%', 100)
            );
            state.charts.ping = new Chart(
                document.getElementById('chart-ping'),
                buildChartConfig('Ping ms', pingData, labels, chartColors.ping, 'ms', null)
            );
        } catch (err) {
            console.error('Failed to load charts:', err);
        }
    }

    // -----------------------------------------------------------------------
    // WebSocket
    // -----------------------------------------------------------------------

    function connectWS() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${location.host}/ws`;

        console.log('[WS] Connecting to', url);
        const ws = new WebSocket(url);
        state.ws = ws;

        ws.onopen = () => {
            console.log('[WS] Connected');
            state.reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleWSMessage(msg);
            } catch (err) {
                console.error('[WS] Bad message:', err);
            }
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected');
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            console.error('[WS] Error:', err);
            ws.close();
        };
    }

    function scheduleReconnect() {
        const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 30000);
        state.reconnectAttempts++;
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts})`);
        setTimeout(connectWS, delay);
    }

    function handleWSMessage(msg) {
        switch (msg.type) {
            case 'device_update':
                if (msg.device) {
                    state.devices[msg.device.id] = msg.device;
                    renderGrid();

                    // If detail panel is showing this device, refresh it
                    if (state.selectedDeviceId === msg.device.id) {
                        openDetail(msg.device.id);
                    }
                }
                break;

            case 'device_offline':
                // Just re-render — isOnline() check handles it
                renderGrid();
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Initial Load
    // -----------------------------------------------------------------------

    async function init() {
        // Fetch config
        try {
            const cfgRes = await fetch('/api/config');
            if (cfgRes.ok) {
                const cfg = await cfgRes.json();
                state.offlineThreshold = cfg.offlineThresholdSeconds || 30;
            }
        } catch { }

        // Fetch initial devices
        try {
            const res = await fetch('/api/devices');
            if (res.ok) {
                const devices = await res.json();
                devices.forEach(d => { state.devices[d.id] = d; });
                renderGrid();
            }
        } catch (err) {
            console.error('Failed to fetch initial devices:', err);
        }

        // Connect WebSocket
        connectWS();
    }

    init();
})();
