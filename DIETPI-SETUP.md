# DietPi Kiosk Setup Guide

This guide covers setting up the Homelab Monitor server and kiosk mode on DietPi (Raspberry Pi).

## Prerequisites

Install required packages:

```bash
apt update && apt install -y build-essential python3 xorg chromium unclutter
```

## Server Setup

### 1. Copy server files to the Pi

```bash
# From your development machine
scp -r server/ root@<pi-hostname>:/opt/homelab-monitor/server/
scp -r deploy/ root@<pi-hostname>:/opt/homelab-monitor/deploy/
```

### 2. Install Node.js dependencies

```bash
cd /opt/homelab-monitor/server
npm install --omit=dev
```

### 3. Configure the server

```bash
cp .env.example .env
nano .env
```

### 4. Install the systemd service

```bash
sudo cp /opt/homelab-monitor/deploy/server-systemd.service /etc/systemd/system/homelab-monitor.service
```

Edit the service file to fix common issues:

```bash
sudo nano /etc/systemd/system/homelab-monitor.service
```

Make these changes:
- Change `User=homelab` to `User=root`
- Change `Group=homelab` to `Group=root`
- Change `ExecStart=/usr/bin/node server.js` to `ExecStart=/usr/bin/env node server.js`

### 5. Enable and start the server

```bash
sudo systemctl daemon-reload
sudo systemctl enable homelab-monitor
sudo systemctl start homelab-monitor
sudo systemctl status homelab-monitor
```

## Kiosk Setup (dietpi-autostart method)

This is the simplest method for DietPi.

### 1. Configure dietpi-autostart

```bash
dietpi-autostart
```

Select **7** - Custom script (foreground, with autologin as root)

### 2. Create the custom autostart script

```bash
nano /var/lib/dietpi/dietpi-autostart/custom.sh
```

Add:

```bash
#!/bin/bash
export DISPLAY=:0
xinit /opt/homelab-monitor/deploy/kiosk.sh http://localhost:8879 -- :0 vt1
```

Make it executable:

```bash
chmod +x /var/lib/dietpi/dietpi-autostart/custom.sh
```

### 3. Reboot

```bash
sudo reboot
```

## Troubleshooting

### "status=217/USER" error

The systemd service is configured to run as a user that doesn't exist. Edit the service file and change `User=homelab` to `User=root`.

### "status=203/EXEC" error

Node.js is not at `/usr/bin/node`. Change `ExecStart=/usr/bin/node server.js` to `ExecStart=/usr/bin/env node server.js`.

### Chromium profile lock error

If you see "The profile appears to be in use by another Chromium process", clear the lock:

```bash
pkill -9 chromium
rm -rf /root/.config/chromium/SingletonLock
rm -rf /root/.config/chromium/SingletonCookie
rm -rf /root/.config/chromium/SingletonSocket
```

### xauth "bad display name" error

This can happen after changing the hostname. The xinit method with `-- :0 vt1` avoids this issue.

### Kiosk not starting after boot

1. Check the autostart configuration:
   ```bash
   cat /var/lib/dietpi/dietpi-autostart/custom.sh
   ```

2. Test the script manually:
   ```bash
   /var/lib/dietpi/dietpi-autostart/custom.sh
   ```

3. Check logs:
   ```bash
   journalctl -b | grep -i "autostart\|startx\|kiosk"
   cat /var/log/Xorg.0.log | tail -50
   ```

## Useful Commands

```bash
# Check server status
sudo systemctl status homelab-monitor

# View server logs
sudo journalctl -u homelab-monitor -f

# Restart server
sudo systemctl restart homelab-monitor

# Test kiosk manually
startx /opt/homelab-monitor/deploy/kiosk.sh http://localhost:8879
```
