package notifier

import (
	"context"
	"fmt"

	"github.com/HiroVodka/trendog/internal/ports"
)

type StdoutNotifier struct{}

func (StdoutNotifier) Notify(_ context.Context, markdown string) (ports.NotifyResult, error) {
	fmt.Println(markdown)
	return ports.NotifyResult{OK: true, Status: 200, Body: "ok"}, nil
}
