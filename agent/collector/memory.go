package collector

import (
	"github.com/shirou/gopsutil/v3/mem"
)

// MemoryMetrics holds memory usage data.
type MemoryMetrics struct {
	TotalBytes   uint64  `json:"total_bytes"`
	UsedBytes    uint64  `json:"used_bytes"`
	UsagePercent float64 `json:"usage_percent"`
}

// CollectMemory gathers virtual memory usage.
func CollectMemory() (MemoryMetrics, error) {
	v, err := mem.VirtualMemory()
	if err != nil {
		return MemoryMetrics{}, err
	}

	return MemoryMetrics{
		TotalBytes:   v.Total,
		UsedBytes:    v.Used,
		UsagePercent: round2(v.UsedPercent),
	}, nil
}
