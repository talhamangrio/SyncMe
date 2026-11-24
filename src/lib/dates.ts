// ─── SyncMe — date utilities: Budapest clock, expiration guard, chrono sort ─
// Pure Intl-based functions — identical output on the server and in the
// browser, so "today" is always the student's Europe/Budapest calendar day.

import type { SyncTask } from "@/lib/types";

export const SYNCME_TZ = "Europe/Budapest";

/** Today's calendar date in Europe/Budapest as `YYYY-MM-DD`. */
export function budapestTodayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SYNCME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Format a Date as a timezone-naive ISO-8601 datetime `YYYY-MM-DDTHH:mm:ss` in Europe/Budapest. */
export function toBudapestIso(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SYNCME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Normalize any dueDate coming from the AI engines, the .ics feed or the rule
 * engine into a `YYYY-MM-DDTHH:mm:ss` (Europe/Budapest wall-clock) string.
 * Timezone-NAIVE datetimes are treated as Budapest wall time exactly as the
 * extraction prompts request them; strings with an offset (Z, +01:00) are
 * converted. Returns the literal "unknown" when nothing plausible exists.
 */
export function normalizeDueDate(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return "unknown";

  // Already the canonical naive Budapest form (optionally with milliseconds).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+$/.test(trimmed)) return trimmed.slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;

  // Date-only → business-hours default.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T09:00:00`;

  // Reject obvious non-dates ("33", "ok", "soon") before they parse into
  // accidental years — a real date has a 4-digit year, a month name, or a
  // day/month separator.
  const looksDated =
    /\d{4}/.test(trimmed) ||
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(trimmed) ||
    /\d{1,2}[/\-.]\d{1,2}/.test(trimmed);
  if (!looksDated) return "unknown";

  // Timezone-aware or human-readable strings → parse, then re-express in Budapest.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2100) return "unknown";
  return toBudapestIso(parsed);
}

/** The `YYYY-MM-DD` day key of a dueDate (raw or normalized) — null when undated. */
export function dayKeyOf(dueDate: string): string | null {
  const normalized = normalizeDueDate(dueDate);
  if (normalized === "unknown") return null;
  return normalized.slice(0, 10);
}

/** Calendar-day arithmetic on a `YYYY-MM-DD` key (DST-safe via a UTC-noon anchor). */
export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Deterministic expiration guard — drops every task whose due day is strictly
 * earlier than today (Europe/Budapest). Items occurring today and everything
 * in the future survive; undated tasks survive too (they sink to the end of
 * the chronological sort).
 */
export function dropExpiredTasks<T extends { dueDate: string }>(tasks: T[], now: Date = new Date()): T[] {
  const today = budapestTodayKey(now);
  return tasks.filter((t) => {
    const day = dayKeyOf(t.dueDate);
    return day === null || day >= today;
  });
}

/**
 * Strict ascending chronological sort — `new Date(a.dueDate).getTime() -
 * new Date(b.dueDate).getTime()` — so the earliest upcoming date/time always
 * comes first. Undated tasks are pushed to the very end, ties keep input order.
 */
export function sortChronologically<T extends { dueDate: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const ta = a.dueDate === "unknown" ? Number.NaN : Date.parse(a.dueDate);
    const tb = b.dueDate === "unknown" ? Number.NaN : Date.parse(b.dueDate);
    const na = Number.isNaN(ta);
    const nb = Number.isNaN(tb);
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    return ta - tb;
  });
}

/** `HH:mm` time badge from a normalized dueDate — "—" for undated tasks. */
export function timeBadgeOf(dueDate: string): string {
  const normalized = normalizeDueDate(dueDate);
  return normalized === "unknown" ? "—" : normalized.slice(11, 16);
}
