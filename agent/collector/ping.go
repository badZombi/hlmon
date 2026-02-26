package collector

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"time"

	probing "github.com/prometheus-community/pro-bing"
)

// PingMetrics holds the result of a ping check.
type PingMetrics struct {
	Target    string  `json:"target"`
	LatencyMs float64 `json:"latency_ms"`
	Success   bool    `json:"success"`
}

// CollectPing sends ICMP echo requests and returns average latency.
// It tries the native pro-bing library first, then falls back to the system ping utility.
func CollectPing(target string, timeoutMs int) PingMetrics {
	result := PingMetrics{Target: target, Success: false}

	// 1. Try native Go probing (requires sysctl net.ipv4.ping_group_range or root)
	pinger, err := probing.NewPinger(target)
	if err == nil {
		pinger.Count = 3
		pinger.Timeout = time.Duration(timeoutMs) * time.Millisecond
		pinger.SetPrivileged(false) // Use unprivileged ICMP (UDP) natively

		if err = pinger.Run(); err == nil {
			stats := pinger.Statistics()
			if stats.PacketsRecv > 0 {
				result.Success = true
				result.LatencyMs = round2(float64(stats.AvgRtt.Microseconds()) / 1000.0)
				return result
			}
		}
	}

	// 2. Native ping failed, fallback to system ping utility which usually has setuid/cap_net_raw
	cmd := exec.Command("ping", "-c", "3", "-W", fmt.Sprintf("%d", timeoutMs/1000), target)
	out, err := cmd.Output()
	if err != nil {
		// Ping command failed or host unreachable
		return result
	}

	// Parse typical ping output for average latency
	// e.g "rtt min/avg/max/mdev = 1.123/2.345/3.456/1.232 ms"
	output := string(out)

	// regex to grab the average: captures the second number in the slash-separated group
	re := regexp.MustCompile(`(?:rtt|round-trip) min/avg/max/(?:mdev|stddev) = [0-9.]+/([0-9.]+)/[0-9.]+/[0-9.]+ ms`)
	matches := re.FindStringSubmatch(output)

	if len(matches) == 2 {
		avg, err := strconv.ParseFloat(matches[1], 64)
		if err == nil {
			result.Success = true
			result.LatencyMs = round2(avg)
		}
	}

	return result
}
