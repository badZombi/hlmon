package collector

import (
	"github.com/shirou/gopsutil/v3/cpu"
	"time"
)

// CPUMetrics holds CPU usage data.
type CPUMetrics struct {
	UsagePercent float64 `json:"usage_percent"`
	Cores        int     `json:"cores"`
}

// CollectCPU gathers CPU usage over a 1-second sample window.
func CollectCPU() (CPUMetrics, error) {
	percentages, err := cpu.Percent(1*time.Second, false)
	if err != nil {
		return CPUMetrics{}, err
	}

	cores, err := cpu.Counts(true)
	if err != nil {
		cores = 0
	}

	usage := 0.0
	if len(percentages) > 0 {
		usage = percentages[0]
	}

	return CPUMetrics{
		UsagePercent: round2(usage),
		Cores:        cores,
	}, nil
}
