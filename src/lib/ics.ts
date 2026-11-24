// ─── Minimal RFC 5545 (.ics) parser tuned for Moodle calendar exports ───────

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  start: Date | null;
  end: Date | null;
}

function unfold(text: string): string[] {
  // Join continuation lines (CRLF followed by space/tab) then split records.
  const folded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  return folded.split(/\r\n|\n|\r/);
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsDate(raw: string, isDateOnly: boolean): Date | null {
  if (!raw) return null;
  const value = raw.trim();
  // DATE-TIME: 20250118T100000Z or 20250118T100000 (floating / TZID)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "0", mm = "0", ss = "0", z] = m;
  if (z === "Z") {
    return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  }
  if (isDateOnly || !m[4]) {
    // All-day or date-only events: anchor at 08:00 local so they land on the board
    return new Date(+y, +mo - 1, +d, 8, 0, 0);
  }
  // Floating time: treat as local wall-clock time (Europe/Budapest campus assumption)
  return new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
}

function pickProp(lines: string[], name: string): { value: string; params: Record<string, string> } | null {
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const head = line.slice(0, idx);
    const propName = head.split(";")[0].toUpperCase();
    if (propName !== name.toUpperCase()) continue;
    const params: Record<string, string> = {};
    head.split(";").slice(1).forEach((p) => {
      const [k, v] = p.split("=");
      if (k && v) params[k.toUpperCase()] = v;
    });
    return { value: line.slice(idx + 1), params };
  }
  return null;
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:VEVENT")) {
      current = [];
      continue;
    }
    if (upper.startsWith("END:VEVENT")) {
      if (current) {
        const ev = buildEvent(current);
        if (ev) events.push(ev);
      }
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  return events;
}

function buildEvent(lines: string[]): IcsEvent | null {
  const uidProp = pickProp(lines, "UID");
  const summaryProp = pickProp(lines, "SUMMARY");
  const descProp = pickProp(lines, "DESCRIPTION");
  const dtStartProp = pickProp(lines, "DTSTART");
  const dtEndProp = pickProp(lines, "DTEND");
  const uid = uidProp?.value ?? `ics-${summaryProp?.value ?? Math.random().toString(36).slice(2)}`;
  const summary = unescapeText(summaryProp?.value ?? "");
  if (!summary && !dtStartProp) return null;
  const isDateOnly = (dtStartProp?.params["VALUE"] ?? "").toUpperCase() === "DATE";
  return {
    uid,
    summary: summary || "Moodle event",
    description: unescapeText(descProp?.value ?? ""),
    start: dtStartProp ? parseIcsDate(dtStartProp.value, isDateOnly) : null,
    end: dtEndProp ? parseIcsDate(dtEndProp.value, false) : null,
  };
}

/** Fetch + parse a remote .ics calendar feed (Moodle export URL). */
export async function fetchIcsFeed(url: string, timeoutMs = 12000): Promise<IcsEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`ICS feed returned HTTP ${res.status}`);
    const text = await res.text();
    if (!text.toUpperCase().includes("BEGIN:VCALENDAR")) {
      throw new Error("Response is not a valid iCalendar feed (missing VCALENDAR header)");
    }
    return parseIcs(text);
  } finally {
    clearTimeout(timer);
  }
}
