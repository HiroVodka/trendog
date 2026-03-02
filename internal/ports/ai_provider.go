package ports

import (
	"context"

	"github.com/HiroVodka/trendog/internal/domain"
)

type AIProvider interface {
	Enrich(ctx context.Context, clusters []domain.Cluster, audienceProfile string) ([]domain.EnrichedCluster, error)
}
