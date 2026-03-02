package internal

import (
	"context"
	"os"
	"strings"

	"github.com/HiroVodka/trendog/internal/adapters/ai"
	"github.com/HiroVodka/trendog/internal/adapters/notifier"
	"github.com/HiroVodka/trendog/internal/adapters/sources"
	"github.com/HiroVodka/trendog/internal/adapters/state"
	"github.com/HiroVodka/trendog/internal/ports"
	"github.com/HiroVodka/trendog/internal/shared"
	"github.com/HiroVodka/trendog/internal/usecase"
)

type RunConfig struct {
	Mode            string
	DryRun          bool
	MaxTopics       int
	Debug           bool
	RunID           string
	AudienceProfile string
	GeminiAPIKey    string
	GeminiModel     string
	SlackWebhookURL string
	StateFilePath   string
}

func Run(ctx context.Context, cfg RunConfig) error {
	geminiKey := firstNonEmpty(cfg.GeminiAPIKey, os.Getenv("GEMINI_API_KEY"))
	slackURL := firstNonEmpty(cfg.SlackWebhookURL, os.Getenv("SLACK_WEBHOOK_URL"))
	statePath := firstNonEmpty(cfg.StateFilePath, os.Getenv("STATE_FILE_PATH"))
	if statePath == "" {
		statePath = "state/state.json"
	}
	audience := firstNonEmpty(cfg.AudienceProfile, os.Getenv("AUDIENCE_PROFILE"))
	if audience == "" {
		audience = "バックエンドエンジニア、SREエンジニア"
	}
	model := firstNonEmpty(cfg.GeminiModel, os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-2.5-flash"
	}
	fetchers := []ports.SourceFetcher{
		sources.NewHatenaFetcher(nil),
		sources.NewHNFetcher(nil),
		sources.NewZennFetcher(nil),
	}

	deps := usecase.Dependencies{
		Fetchers:   fetchers,
		StateStore: state.FileStateStore{Path: statePath},
		AI:         ai.GeminiProvider{APIKey: geminiKey, Model: model},
		Notifier:   notifier.SlackWebhookNotifier{WebhookURL: slackURL},
		Logger:     shared.JSONLogger{},
	}
	return usecase.RunTrendBatch(ctx, deps, usecase.RunOptions{
		Mode:            defaultString(cfg.Mode, "normal"),
		DryRun:          cfg.DryRun,
		MaxTopics:       cfg.MaxTopics,
		Debug:           cfg.Debug,
		RunID:           cfg.RunID,
		AudienceProfile: audience,
	})
}

func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func defaultString(v, d string) string {
	if strings.TrimSpace(v) == "" {
		return d
	}
	return v
}
