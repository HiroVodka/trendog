package shared

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func FetchJSONWithRetry(ctx context.Context, client *http.Client, url string, reqInit func(*http.Request) error, out interface{}) error {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		if reqInit != nil {
			if err := reqInit(req); err != nil {
				return err
			}
		}
		res, err := client.Do(req)
		if err != nil {
			lastErr = err
		} else {
			body, _ := io.ReadAll(res.Body)
			_ = res.Body.Close()
			if res.StatusCode >= 200 && res.StatusCode < 300 {
				if err := json.Unmarshal(body, out); err != nil {
					return err
				}
				return nil
			}
			lastErr = fmt.Errorf("HTTP %d: %s", res.StatusCode, truncate(string(body), 300))
			if res.StatusCode < 500 && res.StatusCode != 429 {
				return lastErr
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(500*(1<<attempt)) * time.Millisecond):
		}
	}
	return lastErr
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
