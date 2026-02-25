#!/bin/bash

#TODO:
# Detect OS/Arch or ask for user to confirm or select.
# Prompt user for server url and port
# Prompt user for server secret
# Prompt user for device name
# Prompt user for ping target
# Prompt user for username
# Based on OS/Arch, download the correct binary and service file from github or the server
# Update the script below to use the user inputs fo rfile modification and then install

#Stop any running agent
sudo systemctl stop homelab-agent

#Copy the agent binary to /usr/local/bin and rename
sudo cp homelab-agent-linux-amd64 /usr/local/bin/homelab-agent

#Create the config directory and copy config
sudo mkdir /etc/homelab-monitor
sudo cp agent.toml /etc/homelab-monitor/agent.toml

#Make the agent binary executable
sudo chmod +x /usr/local/bin/homelab-agent

#Edit the config file - make sure to set name or comment out so it auto names
sudo nano /etc/homelab-monitor/agent.toml

#Copy the systemd service file
sudo cp agent-systemd.service /etc/systemd/system/homelab-agent.service

#Edit the systemd service file - make sure the user is correct
sudo nano /etc/systemd/system/homelab-agent.service

#Reload systemd, enable and start the agent
sudo systemctl daemon-reload
sudo systemctl enable homelab-agent
sudo systemctl start homelab-agent

#check status and open log tail
sudo systemctl status homelab-agent
journalctl -u homelab-agent -f