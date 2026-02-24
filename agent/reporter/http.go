package reporter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Report is the full JSON payload sent to the server.
type Report struct {
	Hostname      string      `json:"hostname"`
	OS            string      `json:"os"`
	Arch          string      `json:"arch"`
	Timestamp     string      `json:"timestamp"`
	CPU           interface{} `json:"cpu"`
	Memory        interface{} `json:"memory"`
	Disks         interface{} `json:"disks"`
	Ping          interface{} `json:"ping"`
	UptimeSeconds uint64      `json:"uptime_seconds"`
}

// HTTPReporter sends reports to the monitoring server.
type HTTPReporter struct {
	ServerURL  string
	AuthToken  string
	HTTPClient *http.Client
}

// NewHTTPReporter creates a reporter with sensible HTTP defaults.
func NewHTTPReporter(serverURL, authToken string) *HTTPReporter {
	return &HTTPReporter{
		ServerURL: serverURL,
		AuthToken: authToken,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Send posts a report to the server. Returns an error if the request fails.
func (r *HTTPReporter) Send(report Report) error {
	body, err := json.Marshal(report)
	if err != nil {
		return fmt.Errorf("marshaling report: %w", err)
	}

	url := r.ServerURL + "/api/report"
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if r.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+r.AuthToken)
	}

	resp, err := r.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending report: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	return nil
}
