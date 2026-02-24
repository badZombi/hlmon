package collector

import "math"

// round2 rounds a float to 2 decimal places.
func round2(f float64) float64 {
	return math.Round(f*100) / 100
}
