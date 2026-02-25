# 1. Stop the running server
sudo systemctl stop homelab-monitor

# 2. Pull latest from GitHub (if you cloned the repo on the Pi)
cd ~/hlmon                              # /path/to/your/clone
git pull

# 3. Copy the server files over
sudo rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='data/' \
  server/ /opt/homelab-monitor/server/

# 4. Install/update dependencies
cd /opt/homelab-monitor/server
npm install --omit=dev                  # instead of --production

# 5. Restart
sudo systemctl start homelab-monitor