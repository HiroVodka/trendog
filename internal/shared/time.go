package shared

import (
	"time"
)

var jst = time.FixedZone("JST", 9*60*60)

func ToJSTDateString(t time.Time) string {
	return t.In(jst).Format("2006-01-02")
}

func AgeHours(now time.Time, publishedAt string) float64 {
	pt, err := time.Parse(time.RFC3339, publishedAt)
	if err != nil {
		return 999
	}
	d := now.Sub(pt)
	if d < 0 {
		return 0
	}
	return d.Hours()
}

func ShouldPostOnDate(jstDate string) bool {
	anchor, _ := time.ParseInLocation("2006-01-02", "2026-03-02", jst)
	current, err := time.ParseInLocation("2006-01-02", jstDate, jst)
	if err != nil {
		return false
	}
	days := int(current.Sub(anchor).Hours() / 24)
	return days%2 == 0
}
