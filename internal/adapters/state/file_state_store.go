package state

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/HiroVodka/trendog/internal/domain"
)

type FileStateStore struct{ Path string }

func (s FileStateStore) Load(_ context.Context) (domain.AppState, error) {
	b, err := os.ReadFile(s.Path)
	if err != nil {
		return domain.AppState{ItemsState: map[string]domain.ItemState{}, PostedHashes: map[string]string{}}, nil
	}
	var st domain.AppState
	if err := json.Unmarshal(b, &st); err != nil {
		return domain.AppState{ItemsState: map[string]domain.ItemState{}, PostedHashes: map[string]string{}}, nil
	}
	if st.ItemsState == nil {
		st.ItemsState = map[string]domain.ItemState{}
	}
	if st.PostedHashes == nil {
		st.PostedHashes = map[string]string{}
	}
	return st, nil
}

func (s FileStateStore) Save(_ context.Context, st domain.AppState) error {
	if st.ItemsState == nil {
		st.ItemsState = map[string]domain.ItemState{}
	}
	if st.PostedHashes == nil {
		st.PostedHashes = map[string]string{}
	}
	if err := os.MkdirAll(filepath.Dir(s.Path), 0o755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(st, "", "  ")
	return os.WriteFile(s.Path, b, 0o644)
}
