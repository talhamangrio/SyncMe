// ─── SyncMe — deterministic date reader for email subjects & titles ─────────
// The AI engines occasionally leave a task undated even when the appointment
// or deadline day is stated right in the email subject ("Appointment on
// 26 November 2025", "2025. november 26.", "26/11", "Nov 26 at 10:00"). This
// module rescues those cases with a pure regex pass over the text — no AI, no
// network — supporting the formats a University of Debrecen student actually
// receives: English and Hungarian month names, ISO and European numeric dates,
// and plain today/tomorrow words.
//
// Safety contract: only dates on or AFTER today (Europe/Budapest) are ever
// returned. A subject mentioning only past dates yields null, so an undated
// task can never be demoted into the "expired" bucket by a wrong guess.

import { budapestTodayKey } from "@/lib/dates";

interface RawCandidate {
  /** Explicit year (undefined = resolve relative to today). */
  y?: number;
  m: number;
  d: number;
  hh?: number;
  mm?: number;
}

/** English + Hungarian month tokens → month number. Longest forms listed first. */
const MONTHS: Record<string, number> = {
  january: 1, január: 1, januar: 1, jan: 1,
  february: 2, február: 2, februar: 2, feb: 2,
  march: 3, március: 3, marcius: 3, márc: 3, mar: 3,
  april: 4, április: 4, aprilis: 4, ápr: 4, apr: 4,
  may: 5, május: 5, majus: 5, máj: 5, maj: 5,
  june: 6, június: 6, junius: 6, jún: 6, jun: 6,
  july: 7, július: 7, julius: 7, júl: 7, jul: 7,
  august: 8, augusztus: 8, aug: 8,
  september: 9, szeptember: 9, sept: 9, szept: 9, sep: 9,
  october: 10, október: 10, oktober: 10, oct: 10, okt: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

/** Month-name alternation used inside the patterns (\b-guarded, longest first). */
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const MONTH_RE = new RegExp(`(?:${MONTH_ALT})`, "i");

function monthNumberOf(token: string): number | null {
  return MONTHS[token.toLowerCase()] ?? null;
}

/** Plausibility of a day/month pair (leap years are not the enemy here). */
function validDayMonth(m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (m === 2 && d > 29) return false;
  if ((m === 4 || m === 6 || m === 9 || m === 11) && d > 30) return false;
  return true;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

const dayKey = (y: number, m: number, d: number): string => `${y}-${pad2(m)}-${pad2(d)}`;

/**
 * Find a clock time in the text shortly after a date match — "at 14:30",
 * "10:00", Hungarian "14.30". Colon form first (unambiguous), dotted form
 * second. Returns null unless both hour (0-23) and minute (0-59) are valid.
 */
function scanTime(text: string, from: number, window = 40): { hh: number; mm: number } | null {
  const tail = text.slice(from, from + window);
  const colon = tail.match(/(?<!\d)(\d{1,2})\s*:\s*(\d{2})(?!\d)/);
  const dotted = colon ? null : tail.match(/(?<!\d)(\d{1,2})\.(\d{2})(?!\d)/);
  const match = colon ?? dotted;
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 23 || mm > 59) return null;
  return { hh, mm };
}

interface Found {
  candidates: RawCandidate[];
  /** Text with every consumed match blanked out (same length, spaces). */
  rest: string;
}

/** Run one pattern over the text, collect its date candidates and blank the spans. */
function collect(
  text: string,
  pattern: RegExp,
  build: (m: RegExpMatchArray) => RawCandidate | null,
): Found {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  const candidates: RawCandidate[] = [];
  const spans: [number, number][] = [];
  for (const m of text.matchAll(re)) {
    const candidate = build(m);
    if (candidate) candidates.push(candidate);
    const start = m.index ?? 0;
    spans.push([start, start + m[0].length]);
  }
  let rest = text;
  for (const [start, end] of spans) {
    rest = rest.slice(0, start) + " ".repeat(end - start) + rest.slice(end);
  }
  return { candidates, rest };
}

/** Attach a nearby clock time (40 chars after the match) to a raw candidate. */
function withNearbyTime(text: string, from: number, c: RawCandidate): RawCandidate {
  const t = scanTime(text, from);
  return t ? { ...c, hh: t.hh, mm: t.mm } : c;
}

// ── Patterns, applied in order (each match is blanked before the next) ──────

/** P1 — ISO / year-first numeric: 2025-11-26, 2025.11.26, 2025-11-26 14:30. */
const P1 = /(?<!\d)(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?(?!\d)/;

/** P2 — Hungarian year-first with month name: 2025. november 26., 2025 nov 26. */
const P2 = new RegExp(
  `(?<!\\d)(\\d{4})\\s*\\.?\\s*\\b(${MONTH_ALT})\\b\\.?\\s*(\\d{1,2})(?![\\d:])`,
  "i",
);

/** P3 — day-first month name: 26 November, 26. november, 26 nov 2025, 3rd of March. */
const P3 = new RegExp(
  `\\b(\\d{1,2})\\s*\\.?(?:\\s*(?:st|nd|rd|th))?(?:\\s*of\\b)?\\s*(?:[-––]\\s*)?\\b(${MONTH_ALT})\\b\\.?(?:\\s*,?\\s*(\\d{4})\\b)?`,
  "i",
);

/** P4 — month-name first: Nov 26, November 26, 2025 / november 26-án. */
const P4 = new RegExp(
  `\\b(${MONTH_ALT})\\b\\.?\\s*(\\d{1,2})(?:\\s*(?:st|nd|rd|th))?(?!\\s*\\d)(?:\\s*[,;]?\\s*(\\d{4})(?!\\s*:|\\d)\\b)?`,
  "i",
);

/** P5 — European numeric day/month(/year): 26/11, 26.11.2025, 26-11-25, 11/26. */
const P5 = /(?<!\d)(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{2,4})(?!\s*:|\d))?(?!\d)/;

/** P6 — relative words: today / tomorrow / holnap. */
const P6 = /\b(today|tomorrow|holnap)\b/i;

/**
 * Scan free text (email subject, task title) for a calendar date and resolve
 * it to the earliest FUTURE day mentioned, as a Budapest wall-clock
 * `YYYY-MM-DDTHH:mm:ss` string (09:00 default when only the day is stated).
 * Returns null when nothing plausible and current/future exists — never a
 * past date, so callers cannot accidentally expire an undated task.
 */
export function inferFutureDateFromText(text: string, now: Date = new Date()): string | null {
  if (!text) return null;
  const todayKey = budapestTodayKey(now);
  const candidates: RawCandidate[] = [];

  // P1: ISO / year-first numeric — blanked so P5 cannot re-match fragments.
  const p1 = collect(text, P1, (m) => {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!validDayMonth(mo, d)) return null;
    const c: RawCandidate = { y, m: mo, d };
    if (m[4] !== undefined) {
      const hh = Number(m[4]);
      const mm = Number(m[5]);
      if (hh <= 23 && mm <= 59) Object.assign(c, { hh, mm });
    }
    return c;
  });
  candidates.push(...p1.candidates);

  // P2: 2025. november 26. (Hungarian year-first with month name).
  const p2 = collect(p1.rest, P2, (m) => {
    const mo = monthNumberOf(m[2]);
    const d = Number(m[3]);
    if (mo === null || !validDayMonth(mo, d)) return null;
    return withNearbyTime(p1.rest, (m.index ?? 0) + m[0].length, { y: Number(m[1]), m: mo, d });
  });
  candidates.push(...p2.candidates);

  // P3: 26 November / 26. november / 26 nov 2025.
  const p3 = collect(p2.rest, P3, (m) => {
    const mo = monthNumberOf(m[2]);
    const d = Number(m[1]);
    if (mo === null || !validDayMonth(mo, d)) return null;
    const c: RawCandidate = { m: mo, d };
    if (m[3] !== undefined) c.y = Number(m[3]);
    return withNearbyTime(p2.rest, (m.index ?? 0) + m[0].length, c);
  });
  candidates.push(...p3.candidates);

  // P4: Nov 26 / november 26-án / November 26, 2025.
  const p4 = collect(p3.rest, P4, (m) => {
    const mo = monthNumberOf(m[1]);
    const d = Number(m[2]);
    if (mo === null || !validDayMonth(mo, d)) return null;
    const c: RawCandidate = { m: mo, d };
    if (m[3] !== undefined) c.y = Number(m[3]);
    return withNearbyTime(p3.rest, (m.index ?? 0) + m[0].length, c);
  });
  candidates.push(...p4.candidates);

  // P5: 26/11 / 26.11.2025 — ambiguous day/month order resolved by validation.
  const p5 = collect(p4.rest, P5, (m) => {
    let d = Number(m[1]);
    let mo = Number(m[2]);
    if (!validDayMonth(mo, d) && validDayMonth(d, mo)) [d, mo] = [mo, d];
    if (!validDayMonth(mo, d)) return null;
    const c: RawCandidate = { m: mo, d };
    if (m[3] !== undefined) {
      const y = Number(m[3]);
      c.y = y >= 2000 ? y : 2000 + y;
    }
    return withNearbyTime(p4.rest, (m.index ?? 0) + m[0].length, c);
  });
  candidates.push(...p5.candidates);

  // P6: today / tomorrow / holnap.
  const p6 = collect(p5.rest, P6, (m) => {
    const word = m[1].toLowerCase();
    if (word === "today") return withNearbyTime(p5.rest, (m.index ?? 0) + m[0].length, { m: 0, d: 0 });
    return withNearbyTime(p5.rest, (m.index ?? 0) + m[0].length, { m: 0, d: 1 });
  });
  candidates.push(...p6.candidates);

  return resolveEarliest(candidates, todayKey);
}

/** Resolve every candidate to a concrete date and return the earliest future one. */
function resolveEarliest(candidates: RawCandidate[], todayKey: string): string | null {
  const stamps: string[] = [];
  for (const c of candidates) {
    const stamp = resolveCandidate(c, todayKey);
    if (stamp) stamps.push(stamp);
  }
  if (stamps.length === 0) return null;
  stamps.sort();
  return stamps[0];
}

/** Resolve one raw candidate into a canonical naive Budapest datetime stamp. */
function resolveCandidate(c: RawCandidate, todayKey: string): string | null {
  if (c.m === 0 && c.d === 0) return stampOfDay(todayKey, c); // today
  if (c.m === 0 && c.d === 1) {
    const next = new Date(`${todayKey}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return stampOfDay(next.toISOString().slice(0, 10), c); // tomorrow / holnap
  }
  if (!validDayMonth(c.m, c.d)) return null;

  if (c.y !== undefined) {
    if (c.y < 2000 || c.y > 2100) return null;
    const key = dayKey(c.y, c.m, c.d);
    if (key < todayKey) return null; // explicit past date — ignore
    return stampOfDay(key, c);
  }

  // No year: try this year first; wrap to next year only when it lands within
  // ~120 days so a stale past mention ("the 20 November appointment") is not
  // projected a whole year into the future.
  const y0 = Number(todayKey.slice(0, 4));
  const key0 = dayKey(y0, c.m, c.d);
  if (key0 >= todayKey) return stampOfDay(key0, c);
  const key1 = dayKey(y0 + 1, c.m, c.d);
  const daysAhead = Math.round(
    (Date.parse(`${key1}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / 86_400_000,
  );
  if (daysAhead <= 120) return stampOfDay(key1, c);
  return null;
}

function stampOfDay(key: string, c: RawCandidate): string {
  const hh = c.hh !== undefined && c.hh <= 23 ? c.hh : 9;
  const mm = c.mm !== undefined && c.mm <= 59 ? c.mm : 0;
  return `${key}T${pad2(hh)}:${pad2(mm)}:00`;
}
