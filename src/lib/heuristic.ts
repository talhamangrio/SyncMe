// ─── SyncMe — deterministic rule engine (last-resort extractor) ─────────────
// Runs ONLY when Google Gemini is unavailable (missing key, HTTP error,
// timeout, unparseable response). No external AI API is involved: this is a
// bundled, deterministic classifier so the sync can never hard-fail.
//
// Titles come from the email SUBJECT itself, which is exactly what makes
// dedupe work across engines: a Gemini task for the same email carries the
// same sourceEmailSubject, so the twin collapse in task-dedupe.ts merges the
// two into one row.

import type { RawEmail, SyncTask, TaskCategory, TaskPriority } from "@/lib/types";
import { inferFutureDateFromText } from "@/lib/subject-date";

const CATEGORY_RULES: { pattern: RegExp; category: TaskCategory; priority: TaskPriority }[] = [
  { pattern: /immigration|enter hungary|residence permit|aliens polic|idegenrend/i, category: "Immigration", priority: "High" },
  { pattern: /klinika|clinic|medical|doctor|cardiolog|appointment/i, category: "Medical", priority: "Medium" },
  { pattern: /moodle|elearning|quiz|assignment|homework/i, category: "Moodle", priority: "Medium" },
  { pattern: /neptun|exam|vizsga|registration|deadline/i, category: "Neptun", priority: "High" },
];

const NOISE = /newsletter|unsubscribe|promotion|discount|webinar|survey|digest|roundup|book fair/i;

function guessDueDate(text: string, emailDate: string, now: Date): string {
  const iso = text.match(/(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (iso) {
    const d = new Date(`${iso[1]}T${iso[2] ?? "09"}:${iso[3] ?? "00"}:00`);
    if (!Number.isNaN(d.getTime()) && d.getTime() > now.getTime() - 86400_000) return d.toISOString();
  }
  // Natural-language pass over the same text (subject first, then body):
  // "26 November", "2025. november 26.", "26/11", "Nov 26 at 10:00" — strictly
  // future-only, so a stale past mention can never expire the task.
  const natural = inferFutureDateFromText(text, now);
  if (natural) return natural;
  const email = new Date(emailDate);
  if (!Number.isNaN(email.getTime()) && email.getTime() > now.getTime() - 86400_000) return email.toISOString();
  return "unknown";
}

function cleanTitle(subject: string): string {
  return subject
    .replace(/\[.*?\]/g, "")
    .replace(/^(fw|fwd|re):\s*/i, "")
    .trim()
    .slice(0, 140) || subject.slice(0, 140);
}

export function heuristicExtractTasks(emails: RawEmail[], now: Date = new Date()): SyncTask[] {
  const tasks: SyncTask[] = [];
  for (const email of emails) {
    const haystack = `${email.subject}\n${email.snippet}`;
    if (NOISE.test(haystack) && !/exam|appointment|deadline|immigration|residence permit/i.test(haystack)) continue;
    const rule = CATEGORY_RULES.find((r) => r.pattern.test(haystack)) ?? null;
    tasks.push({
      id: `heuristic-${email.id}`,
      title: cleanTitle(email.subject),
      category: rule?.category ?? "Neptun",
      // Subject first, then body — the date is often stated in the title.
      dueDate: guessDueDate(`${email.subject}\n${email.snippet}`, email.date, now),
      priority: rule?.priority ?? "Medium",
      actionSummary: `Review "${email.subject}" and take the required action.`,
      sourceEmailSubject: email.subject,
    });
  }
  return tasks;
}
