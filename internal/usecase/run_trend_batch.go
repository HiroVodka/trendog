package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/HiroVodka/trendog/internal/domain"
	"github.com/HiroVodka/trendog/internal/ports"
	"github.com/HiroVodka/trendog/internal/shared"
)

type RunOptions struct {
	Mode            string
	DryRun          bool
	MaxTopics       int
	Debug           bool
	RunID           string
	AudienceProfile string
	Now             time.Time
}

type Dependencies struct {
	Fetchers   []ports.SourceFetcher
	StateStore ports.StateStore
	AI         ports.AIProvider
	Notifier   ports.Notifier
	Logger     shared.Logger
}

func RunTrendBatch(ctx context.Context, deps Dependencies, opts RunOptions) error {
	now := opts.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	jstDate := shared.ToJSTDateString(now)
	shouldPost := opts.Mode == "force" || shared.ShouldPostOnDate(jstDate)

	state, err := deps.StateStore.Load(ctx)
	if err != nil {
		return err
	}
	logBase := map[string]interface{}{"run_id": opts.RunID, "mode": opts.Mode, "jst_date": jstDate, "schedule_match": shouldPost}
	deps.Logger.Info("run start", logBase)

	if opts.Mode == "normal" && !shouldPost {
		deps.Logger.Info("skip by alternate-day rule", logBase)
		return nil
	}
	if _, ok := state.PostedHashes[jstDate]; ok && opts.Mode == "normal" {
		deps.Logger.Info("skip by duplicate guard", logBase)
		return nil
	}

	sourceCounts := map[string]int{}
	allItems := make([]domain.SourceItem, 0, 256)
	for _, f := range deps.Fetchers {
		items, ferr := f.FetchItems(ctx, now.Format(time.RFC3339))
		if ferr != nil {
			sourceCounts[f.Name()] = 0
			deps.Logger.Error("source failed", map[string]interface{}{"source": f.Name(), "error": ferr.Error()})
			continue
		}
		sourceCounts[f.Name()] = len(items)
		allItems = append(allItems, items...)
	}

	scored := domain.ScoreItems(allItems, now)
	clusters := domain.ClusterByURL(scored)
	maxTopics := clampTopics(opts.MaxTopics)

	enriched, aiFallback := enrichWithFallback(ctx, deps, clusters, opts.AudienceProfile)
	importantIDs := map[string]bool{}
	for _, e := range enriched {
		if e.IsImportant {
			importantIDs[e.ClusterID] = true
		}
	}

	selected := make([]domain.Cluster, 0, maxTopics)
	for _, c := range clusters {
		if importantIDs[c.ID] {
			selected = append(selected, c)
			if len(selected) >= maxTopics {
				break
			}
		}
	}
	if len(selected) == 0 {
		if len(clusters) > maxTopics {
			selected = clusters[:maxTopics]
		} else {
			selected = clusters
		}
	}

	selectedSet := map[string]bool{}
	for _, c := range selected {
		selectedSet[c.ID] = true
	}
	outEnriched := make([]domain.EnrichedCluster, 0, len(selected))
	for _, e := range enriched {
		if selectedSet[e.ClusterID] {
			outEnriched = append(outEnriched, e)
		}
	}
	for _, c := range selected {
		found := false
		for _, e := range outEnriched {
			if e.ClusterID == c.ID {
				found = true
				break
			}
		}
		if !found {
			outEnriched = append(outEnriched, domain.EnrichedCluster{ClusterID: c.ID, IsImportant: true, ReasonToRead: "対象読者の実務に関連する可能性が高いため。"})
		}
	}

	md := domain.RenderMarkdown(jstDate, opts.AudienceProfile, selected, outEnriched)
	hash := shared.SHA256(md)
	if state.PostedHashes[jstDate] == hash && opts.Mode == "normal" {
		deps.Logger.Info("skip by same hash guard", map[string]interface{}{"run_id": opts.RunID, "hash": hash})
		return nil
	}

	if opts.DryRun {
		deps.Logger.Info("dryRun markdown", map[string]interface{}{"run_id": opts.RunID, "markdown": md})
	} else {
		res, nerr := deps.Notifier.Notify(ctx, md)
		if nerr != nil {
			return nerr
		}
		deps.Logger.Info("slack result", map[string]interface{}{"run_id": opts.RunID, "status": res.Status, "ok": res.OK})
		if !res.OK {
			return errors.New("slack webhook failed")
		}
	}

	if state.ItemsState == nil {
		state.ItemsState = map[string]domain.ItemState{}
	}
	for _, s := range scored {
		k := string(s.Source) + ":" + s.ID
		state.ItemsState[k] = domain.ItemState{Score: s.Score, Comments: s.Comments, LastSeen: now.Format(time.RFC3339)}
	}
	if state.PostedHashes == nil {
		state.PostedHashes = map[string]string{}
	}
	state.LastRunJSTDate = jstDate
	state.PostedHashes[jstDate] = hash
	if err := deps.StateStore.Save(ctx, state); err != nil {
		return err
	}

	deps.Logger.Info("run complete", map[string]interface{}{
		"run_id": opts.RunID, "mode": opts.Mode, "jst_date": jstDate,
		"fetched": sourceCounts, "clustered_count": len(clusters), "selected_count": len(selected),
		"important_count": len(importantIDs), "ai_fallback": aiFallback,
	})
	return nil
}

func enrichWithFallback(ctx context.Context, deps Dependencies, clusters []domain.Cluster, audience string) ([]domain.EnrichedCluster, bool) {
	enriched, err := deps.AI.Enrich(ctx, clusters, audience)
	if err != nil {
		deps.Logger.Error("ai enrich failed; fallback enabled", map[string]interface{}{"error": err.Error()})
		return nil, true
	}
	return enriched, false
}

func clampTopics(v int) int {
	if v <= 0 {
		return domain.DefaultMaxTopics
	}
	if v > domain.MaxTopicsLimit {
		return domain.MaxTopicsLimit
	}
	return v
}
