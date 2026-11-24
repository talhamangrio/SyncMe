// ─── SyncMe — duplicate-task collapse ───────────────────────────────────────
// One real-world deadline must render as ONE row, no matter how many copies
// the pipeline produced. Twins are born when the extractor emits both a dated
// copy (from the subject line) and an undated copy (from the body) of the same
// email, when the AI re-words a title between syncs, and when the same event
// reaches the student twice (Moodle .ics event + its announcement email).
//
// Collapse rules, safest first:
//   1. Same source email (normalized subject) + similar title  → same task.
//      (The generic "Moodle .ics calendar feed" label never counts as a
//      subject — every Moodle event shares it.)
//   2. Identical normalized title + identical day              → same task.
//   3. Same id                                                 → same task.
//
// Survivor preference: a DATED copy always beats an undated twin; on the same
// day the Moodle calendar copy wins (its time comes from the feed, not a
// guess); two different date readings trust the earlier one; undated ties keep
// the richer action summary, then input order (stable).

import { dayKeyOf, normalizeDueDate } from "@/lib/dates";
import type { SyncTask } from "@/lib/types";

/** Aggressive normalization: lowercase, strip diacritics, strip punctuation. */
export function normalizeTitleKey(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSetOf(key: string): Set<string> {
  return new Set(key.split(" ").filter(Boolean));
}

/**
 * Fuzzy title equality: exact normalized match, one title's words fully inside
 * the other (min two shared words so "Quiz 1" never swallows "Quiz 2"), or a
 * high token overlap. Catches "Cardiology appointment" vs
 * "Cardiology appointment Hajnalka Szabó" — the same task, re-worded.
 */
export function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitleKey(a);
  const nb = normalizeTitleKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = tokenSetOf(na);
  const tb = tokenSetOf(nb);
  if (ta.size === 0 || tb.size === 0) return false;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let shared = 0;
  let contained = true;
  for (const word of small) {
    if (large.has(word)) shared += 1;
    else contained = false;
  }
  if (contained && shared >= 2) return true;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 && shared / union >= 0.6;
}

/** Every Moodle event carries this pseudo-subject — it is not a real email. */
const GENERIC_FEED_SUBJECTS = new Set(["moodle ics calendar feed"]);

/**
 * Do two tasks describe the same real-world deadline? Used both by the
 * collapse pass below and by "mark done" so completing one copy completes
 * every twin.
 */
export function areDuplicateTasks(a: SyncTask, b: SyncTask): boolean {
  if (a.id === b.id) return true;
  const na = normalizeTitleKey(a.title);
  const nb = normalizeTitleKey(b.title);
  if (!na || !nb) return false;

  // 1. Same underlying email with a re-worded title — the extractor's twin.
  const subjA = normalizeTitleKey(a.sourceEmailSubject);
  const subjB = normalizeTitleKey(b.sourceEmailSubject);
  if (subjA && subjA === subjB && !GENERIC_FEED_SUBJECTS.has(subjA) && titlesSimilar(a.title, b.title)) {
    return true;
  }

  // 2. Different feeds, same day, same title — the same deadline seen twice.
  const dayA = dayKeyOf(a.dueDate);
  const dayB = dayKeyOf(b.dueDate);
  if (dayA !== null && dayA === dayB && na === nb) return true;

  return false;
}

/** Which copy of a duplicate survives. */
function betterCopy(a: SyncTask, b: SyncTask): SyncTask {
  const na = normalizeDueDate(a.dueDate);
  const nb = normalizeDueDate(b.dueDate);
  const aDated = na !== "unknown";
  const bDated = nb !== "unknown";

  // A dated copy always heals an undated twin.
  if (aDated !== bDated) return aDated ? a : b;

  if (aDated && bDated) {
    // Same day, different source: the Moodle .ics time comes from the calendar
    // itself — trust the feed over an AI time guess.
    if (na.slice(0, 10) === nb.slice(0, 10) && (a.source === "Moodle") !== (b.source === "Moodle")) {
      return a.source === "Moodle" ? a : b;
    }
    // Two different readings of the same deadline — trust the earlier one.
    if (na !== nb) return na < nb ? a : b;
  }

  // Undated ties: keep the richer action summary, then input order (stable).
  return a.actionSummary.length >= b.actionSummary.length ? a : b;
}

/**
 * Collapse duplicate rows while preserving input order of the survivors.
 * Runs on the server after extraction and in the browser over stored tasks,
 * so duplicates that already reached a device heal on the next sync too.
 */
export function collapseDuplicateTasks<T extends SyncTask>(tasks: T[]): T[] {
  const survivors: T[] = [];
  for (const task of tasks) {
    const index = survivors.findIndex((s) => areDuplicateTasks(s, task));
    if (index === -1) {
      survivors.push(task);
      continue;
    }
    const best = betterCopy(survivors[index], task);
    if (best !== survivors[index]) survivors[index] = best;
  }
  return survivors;
}
