package shared

import (
	"encoding/json"
	"fmt"
	"time"
)

type Logger interface {
	Info(msg string, extra map[string]interface{})
	Warn(msg string, extra map[string]interface{})
	Error(msg string, extra map[string]interface{})
}

type JSONLogger struct{}

func (l JSONLogger) Info(msg string, extra map[string]interface{})  { emit("info", msg, extra) }
func (l JSONLogger) Warn(msg string, extra map[string]interface{})  { emit("warn", msg, extra) }
func (l JSONLogger) Error(msg string, extra map[string]interface{}) { emit("error", msg, extra) }

func emit(level, message string, extra map[string]interface{}) {
	if extra == nil {
		extra = map[string]interface{}{}
	}
	extra["level"] = level
	extra["message"] = message
	extra["timestamp"] = time.Now().UTC().Format(time.RFC3339)
	b, _ := json.Marshal(extra)
	fmt.Println(string(b))
}
