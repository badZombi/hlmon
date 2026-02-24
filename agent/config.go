package main

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
)

// Config holds all agent configuration loaded from a TOML file.
type Config struct {
	ServerURL     string `toml:"server_url"`
	AuthToken     string `toml:"auth_token"`
	Interval      int    `toml:"interval_seconds"`
	PingTarget    string `toml:"ping_target"`
	PingTimeoutMs int    `toml:"ping_timeout_ms"`
	Hostname      string `toml:"hostname"`
}

// DefaultConfig returns sensible defaults.
func DefaultConfig() Config {
	hostname, _ := os.Hostname()
	return Config{
		ServerURL:     "http://localhost:3000",
		AuthToken:     "",
		Interval:      10,
		PingTarget:    "1.1.1.1",
		PingTimeoutMs: 3000,
		Hostname:      hostname,
	}
}

// LoadConfig reads a TOML config file, falling back to defaults for missing fields.
func LoadConfig(path string) (Config, error) {
	cfg := DefaultConfig()

	if path == "" {
		return cfg, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, fmt.Errorf("reading config: %w", err)
	}

	if err := toml.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parsing config: %w", err)
	}

	// Fill hostname if not set after parsing
	if cfg.Hostname == "" {
		cfg.Hostname, _ = os.Hostname()
	}

	return cfg, nil
}
