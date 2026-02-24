package collector

import (
	"time"

	probing "github.com/prometheus-community/pro-bing"
)

// PingMetrics holds the result of a ping check.
type PingMetrics struct {
	Target    string  `json:"target"`
	LatencyMs float64 `json:"latency_ms"`
	Success   bool    `json:"success"`
}

// CollectPing sends 3 ICMP echo requests and returns average latency.
func CollectPing(target string, timeoutMs int) PingMetrics {
	result := PingMetrics{Target: target, Success: false}

	pinger, err := probing.NewPinger(target)
	if err != nil {
		return result
	}

	pinger.Count = 3
	pinger.Timeout = time.Duration(timeoutMs) * time.Millisecond
	pinger.SetPrivileged(false) // Use unprivileged ICMP (UDP) on most systems

	err = pinger.Run()
	if err != nil {
		return result
	}

	stats := pinger.Statistics()
	if stats.PacketsRecv > 0 {
		result.Success = true
		result.LatencyMs = round2(float64(stats.AvgRtt.Microseconds()) / 1000.0)
	}

	return result
}
