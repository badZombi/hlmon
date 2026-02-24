package collector

import (
	"github.com/shirou/gopsutil/v3/disk"
)

// DiskMetrics holds usage data for a single mount point.
type DiskMetrics struct {
	Mount        string  `json:"mount"`
	TotalBytes   uint64  `json:"total_bytes"`
	UsedBytes    uint64  `json:"used_bytes"`
	UsagePercent float64 `json:"usage_percent"`
}

// CollectDisks gathers disk usage for all real partitions.
func CollectDisks() ([]DiskMetrics, error) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}

	var metrics []DiskMetrics
	seen := make(map[string]bool)

	for _, p := range partitions {
		// Skip duplicates and special filesystems
		if seen[p.Mountpoint] {
			continue
		}
		seen[p.Mountpoint] = true

		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}

		// Skip tiny or virtual filesystems
		if usage.Total < 100*1024*1024 { // < 100 MB
			continue
		}

		metrics = append(metrics, DiskMetrics{
			Mount:        p.Mountpoint,
			TotalBytes:   usage.Total,
			UsedBytes:    usage.Used,
			UsagePercent: round2(usage.UsedPercent),
		})
	}

	return metrics, nil
}
