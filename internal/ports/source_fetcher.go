package ports

import (
	"context"

	"github.com/HiroVodka/trendog/internal/domain"
)

type SourceFetcher interface {
	Name() string
	FetchItems(ctx context.Context, nowISO string) ([]domain.SourceItem, error)
}
