package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/HiroVodka/trendog/internal"
)

func main() {
	cfg := internal.RunConfig{
		Mode:            firstNonEmpty(os.Getenv("INPUT_MODE"), os.Getenv("MODE"), "normal"),
		DryRun:          parseBool(firstNonEmpty(os.Getenv("INPUT_DRYRUN"), os.Getenv("DRY_RUN"), "false")),
		MaxTopics:       parseInt(firstNonEmpty(os.Getenv("INPUT_MAXTOPICS"), os.Getenv("MAX_TOPICS"), "17"), 17),
		Debug:           parseBool(firstNonEmpty(os.Getenv("INPUT_DEBUG"), os.Getenv("DEBUG"), "false")),
		RunID:           firstNonEmpty(os.Getenv("GITHUB_RUN_ID"), fmt.Sprintf("run-%d", time.Now().Unix())),
		AudienceProfile: firstNonEmpty(os.Getenv("INPUT_AUDIENCEPROFILE"), os.Getenv("AUDIENCE_PROFILE")),
		GeminiAPIKey:    os.Getenv("GEMINI_API_KEY"),
		GeminiModel:     os.Getenv("GEMINI_MODEL"),
		SlackWebhookURL: os.Getenv("SLACK_WEBHOOK_URL"),
		StateFilePath:   firstNonEmpty(os.Getenv("STATE_FILE_PATH"), "state/state.json"),
	}
	if err := internal.Run(context.Background(), cfg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func parseBool(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func parseInt(v string, d int) int {
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return d
	}
	return n
}
