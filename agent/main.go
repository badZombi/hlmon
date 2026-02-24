package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"homelab-monitor/agent/collector"
	"homelab-monitor/agent/reporter"

	"github.com/shirou/gopsutil/v3/host"
)

func main() {
	configPath := flag.String("config", "agent.toml", "Path to config file")
	flag.Parse()

	cfg, err := LoadConfig(*configPath)
	if err != nil {
		log.Printf("[WARN] Could not load config from %s: %v (using defaults)", *configPath, err)
		cfg = DefaultConfig()
	}

	log.Printf("[Agent] Starting homelab-monitor agent")
	log.Printf("[Agent] Hostname: %s", cfg.Hostname)
	log.Printf("[Agent] Server: %s", cfg.ServerURL)
	log.Printf("[Agent] Interval: %ds", cfg.Interval)
	log.Printf("[Agent] Ping target: %s", cfg.PingTarget)

	rep := reporter.NewHTTPReporter(cfg.ServerURL, cfg.AuthToken)

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	defer ticker.Stop()

	// Collect & send immediately on start, then on each tick
	collect(cfg, rep)

	for {
		select {
		case <-ticker.C:
			collect(cfg, rep)
		case sig := <-sigCh:
			log.Printf("[Agent] Received %s, shutting down", sig)
			os.Exit(0)
		}
	}
}

func collect(cfg Config, rep *reporter.HTTPReporter) {
	now := time.Now().UTC().Format(time.RFC3339)

	// Collect CPU
	cpuMetrics, err := collector.CollectCPU()
	if err != nil {
		log.Printf("[WARN] CPU collection failed: %v", err)
	}

	// Collect Memory
	memMetrics, err := collector.CollectMemory()
	if err != nil {
		log.Printf("[WARN] Memory collection failed: %v", err)
	}

	// Collect Disks
	diskMetrics, err := collector.CollectDisks()
	if err != nil {
		log.Printf("[WARN] Disk collection failed: %v", err)
	}

	// Collect Ping
	pingMetrics := collector.CollectPing(cfg.PingTarget, cfg.PingTimeoutMs)

	// Collect uptime
	uptimeSec, err := host.Uptime()
	if err != nil {
		uptimeSec = 0
	}

	report := reporter.Report{
		Hostname:      cfg.Hostname,
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
		Timestamp:     now,
		CPU:           cpuMetrics,
		Memory:        memMetrics,
		Disks:         diskMetrics,
		Ping:          pingMetrics,
		UptimeSeconds: uptimeSec,
	}

	if err := rep.Send(report); err != nil {
		log.Printf("[ERROR] Failed to send report: %v", err)
	} else {
		log.Printf("[Agent] Report sent — CPU: %.1f%% | Mem: %.1f%% | Ping: %.1fms",
			cpuMetrics.UsagePercent, memMetrics.UsagePercent, pingMetrics.LatencyMs)
	}

	_ = fmt.Sprintf("") // suppress unused import if needed
}
