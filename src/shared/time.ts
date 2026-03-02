import { ANCHOR_JST_DATE, JST_TIMEZONE } from "../domain/model.js";

export function toJstDateString(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(date);
}

export function ageHours(now: Date, publishedAt: string): number {
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) {
    return 999;
  }
  const diffMs = Math.max(0, now.getTime() - t);
  return diffMs / (1000 * 60 * 60);
}

export function shouldPostOnDate(jstDate: string): boolean {
  const anchor = Date.parse(`${ANCHOR_JST_DATE}T00:00:00+09:00`);
  const current = Date.parse(`${jstDate}T00:00:00+09:00`);
  const days = Math.floor((current - anchor) / (1000 * 60 * 60 * 24));
  return days % 2 === 0;
}
