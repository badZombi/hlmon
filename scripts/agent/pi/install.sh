sudo systemctl stop homelab-agent

sudo cp homelab-agent-linux-arm64 /usr/local/bin/homelab-agent
sudo mkdir /etc/homelab-monitor
sudo cp agent.toml /etc/homelab-monitor/agent.toml

sudo chmod +x /usr/local/bin/homelab-agent
sudo nano /etc/homelab-monitor/agent.toml

sudo cp agent-systemd.service /etc/systemd/system/homelab-agent.service
sudo nano /etc/systemd/system/homelab-agent.service

sudo systemctl daemon-reload
sudo systemctl enable homelab-agent
sudo systemctl start homelab-agent

sudo systemctl status homelab-agent
journalctl -u homelab-agent -f