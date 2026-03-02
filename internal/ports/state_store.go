package ports

import (
	"context"

	"github.com/HiroVodka/trendog/internal/domain"
)

type StateStore interface {
	Load(ctx context.Context) (domain.AppState, error)
	Save(ctx context.Context, state domain.AppState) error
}
