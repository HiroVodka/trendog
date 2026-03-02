package ports

import "context"

type NotifyResult struct {
	OK     bool
	Status int
	Body   string
}

type Notifier interface {
	Notify(ctx context.Context, markdown string) (NotifyResult, error)
}
