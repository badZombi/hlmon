# Homelab Monitor

A lightweight system for monitoring all machines on your Tailscale network, with a real-time dashboard running in kiosk mode on a Raspberry Pi.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Mac Agent  │────▶│              │     │  Kiosk Dashboard │
├─────────────┤     │   Server     │◀───▶│  (Chromium)      │
│ Linux Agent │────▶│  (Node.js)   │     │                  │
├─────────────┤     │   + SQLite   │     │  WebSocket live  │
│  Win Agent  │────▶│              │     │   updates        │
└─────────────┘     └──────────────┘     └─────────────────┘
       HTTP POST         Raspberry Pi
```

## Components

| Component | Language | Description |
|-----------|----------|-------------|
| **Agent** | Go | Collects CPU, memory, disk, and ping metrics. Sends JSON reports via HTTP. |
| **Server** | Node.js | Receives reports, stores in SQLite, serves dashboard, pushes updates via WebSocket. |

## Quick Start

### 1. Start the Server

```bash
cd server
cp .env.example .env    # Edit with your settings
npm install
npm run dev
```

Open `http://localhost:3000` to see the dashboard.

### 2. Build & Run the Agent

Requires [Go 1.22+](https://go.dev/dl/).

```bash
cd agent
cp agent.example.toml agent.toml   # Edit server_url and auth_token
go run .
```

Or build a binary:

```bash
cd agent
go build -o homelab-agent .
./homelab-agent -config agent.toml
```

### 3. Cross-Compile Agent Binaries

```bash
make all    # Builds for linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64
```

Binaries are placed in `dist/`.

## Configuration

### Agent (`agent.toml`)

```toml
server_url = "http://100.x.x.x:3000"
auth_token = "changeme-homelab-secret"
interval_seconds = 10
ping_target = "1.1.1.1"
```

### Server (`.env`)

```bash
PORT=3000
AUTH_TOKEN=changeme-homelab-secret
DB_PATH=./data/homelab.db
RETENTION_DAYS=7
OFFLINE_THRESHOLD_SECONDS=30
```

## Deployment

### Linux Agent (systemd)

```bash
sudo cp dist/homelab-agent-linux-amd64 /usr/local/bin/homelab-agent
sudo mkdir -p /etc/homelab-monitor
sudo cp agent/agent.example.toml /etc/homelab-monitor/agent.toml
sudo cp deploy/agent-systemd.service /etc/systemd/system/homelab-agent.service
sudo systemctl enable --now homelab-agent
```

### macOS Agent (launchd)

```bash
sudo cp dist/homelab-agent-darwin-arm64 /usr/local/bin/homelab-agent
sudo mkdir -p /etc/homelab-monitor
sudo cp agent/agent.example.toml /etc/homelab-monitor/agent.toml
sudo cp deploy/agent-launchd.plist /Library/LaunchDaemons/com.homelab.monitor.agent.plist
sudo launchctl load /Library/LaunchDaemons/com.homelab.monitor.agent.plist
```

### Raspberry Pi Server

```bash
# Copy server/ to the Pi
scp -r server/ pi@raspberrypi:/opt/homelab-monitor/server/

# On the Pi:
cd /opt/homelab-monitor/server
npm install --production
sudo cp ../deploy/server-systemd.service /etc/systemd/system/homelab-monitor.service
sudo systemctl enable --now homelab-monitor
```

### Kiosk Mode

```bash
# Install unclutter for cursor hiding
sudo apt install unclutter

# Add to ~/.config/autostart/ or run manually:
./deploy/kiosk.sh http://localhost:3000
```

## Dashboard

- **Grid View**: Shows all devices with status indicators, CPU/Memory/Disk bars, ping latency
- **Detail Panel**: Tap a device to see full metrics and historical charts
- **Real-time**: Updates instantly via WebSocket as agents report in

## Project Structure

```
homelab-monitor/
├── agent/              # Go agent (cross-platform)
│   ├── collector/      # CPU, memory, disk, ping collectors
│   ├── reporter/       # HTTP reporter
│   ├── main.go         # Entry point
│   └── config.go       # TOML config
├── server/             # Node.js server
│   ├── routes/         # REST API routes
│   ├── public/         # Dashboard (HTML/CSS/JS)
│   ├── db.js           # SQLite layer
│   ├── ws.js           # WebSocket handler
│   └── server.js       # Express app
├── deploy/             # Service configs & kiosk script
├── Makefile            # Cross-compilation
└── README.md
```

## License

MIT
