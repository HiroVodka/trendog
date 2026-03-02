package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/HiroVodka/trendog/internal/ports"
)

type SlackWebhookNotifier struct {
	WebhookURL string
	Client     *http.Client
}

func (n SlackWebhookNotifier) Notify(ctx context.Context, markdown string) (ports.NotifyResult, error) {
	if n.WebhookURL == "" {
		return ports.NotifyResult{}, errors.New("SLACK_WEBHOOK_URL is missing")
	}
	client := n.Client
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	body, _ := json.Marshal(map[string]string{"text": markdown})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, n.WebhookURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return ports.NotifyResult{}, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return ports.NotifyResult{OK: res.StatusCode >= 200 && res.StatusCode < 300, Status: res.StatusCode, Body: string(b)}, nil
}
