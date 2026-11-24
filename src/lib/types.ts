// ─── SyncMe — Shared Types ──────────────────────────────────────────────────

export type TaskCategory = "Neptun" | "Moodle" | "Medical" | "Immigration";
export type TaskPriority = "High" | "Medium" | "Low";

/** Which feed produced a task. Tagged when tasks are synced or seeded. */
export type TaskSource = "Gmail" | "Moodle";

/** Structured task extracted from an email or calendar feed. */
export interface SyncTask {
  id: string;
  title: string;
  category: TaskCategory;
  /** ISO-8601 datetime, or the literal string "unknown" when no date is detectable. */
  dueDate: string;
  priority: TaskPriority;
  actionSummary: string;
  sourceEmailSubject: string;
  /** Optional origin chip shown on the task card; inferred per sync source. */
  source?: TaskSource;
}

/** Raw email metadata shown in the "Raw Emails" drawer (never persisted). */
export interface RawEmail {
  id: string;
  subject: string;
  from: string;
  date: string; // ISO-8601
  snippet: string;
}

export interface SyncMeUser {
  name: string;
  email: string;
  picture: string;
}

export interface GmailSyncResponse {
  ok: boolean;
  tasks: SyncTask[];
  emails: RawEmail[];
  /** "ai" = Gemini (primary) or Z.ai GLM extraction, "heuristic" = deterministic fallback engine. */
  aiStatus: "ai" | "heuristic";
  /** Which extraction engine produced the tasks (server-reported). */
  engine?: "gemini" | "zai" | "rule";
  error?: string;
}

export interface MoodleSyncResponse {
  ok: boolean;
  tasks: SyncTask[];
  error?: string;
}

export const TASK_CATEGORIES: TaskCategory[] = ["Neptun", "Moodle", "Medical", "Immigration"];

/** Light category styling: tinted chip text on a flat tinted background. */
export const CATEGORY_UI: Record<TaskCategory, { chip: string; icon: string; circle: string }> = {
  Neptun: { chip: "bg-cat-neptun-bg text-cat-neptun", icon: "text-cat-neptun", circle: "bg-cat-neptun-bg" },
  Moodle: { chip: "bg-cat-moodle-bg text-cat-moodle", icon: "text-cat-moodle", circle: "bg-cat-moodle-bg" },
  Medical: { chip: "bg-cat-medical-bg text-cat-medical", icon: "text-cat-medical", circle: "bg-cat-medical-bg" },
  Immigration: {
    chip: "bg-cat-immigration-bg text-cat-immigration",
    icon: "text-cat-immigration",
    circle: "bg-cat-immigration-bg",
  },
};

/** Status tint pills: always paired with an icon and a text label (never color alone). */
export const PRIORITY_UI: Record<TaskPriority, { pill: string; label: string }> = {
  High: { pill: "bg-status-high-bg text-status-high", label: "High" },
  Medium: { pill: "bg-status-warn-bg text-status-warn", label: "Medium" },
  Low: { pill: "bg-status-low-bg text-status-low", label: "Low" },
};

/** Urgency pill (due within 24 hours, or overdue): the high priority tint. */
export const URGENCY_PILL = "bg-status-high-bg text-status-high";

/** Neutral source chip ("Gmail" or "Moodle"): inset surface, secondary text. */
export const SOURCE_CHIP = "bg-inset text-ink-3";

/** Normalize/validate one raw task object coming from the AI or heuristics. */
export function sanitizeTask(raw: unknown, fallbackId: string): SyncTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 160) : "";
  if (!title) return null;

  const category = TASK_CATEGORIES.includes(r.category as TaskCategory) ? (r.category as TaskCategory) : "Neptun";
  const priorities: TaskPriority[] = ["High", "Medium", "Low"];
  const priority = priorities.includes(r.priority as TaskPriority) ? (r.priority as TaskPriority) : "Medium";

  // Keep the AI's raw dueDate string (validated as parseable) — the route-level
  // normalizer converts timezone-naive datetimes into Budapest wall-clock ISO
  // exactly as the extraction prompt requests them.
  let dueDate = "unknown";
  if (typeof r.dueDate === "string" && r.dueDate.trim() && r.dueDate.trim().toLowerCase() !== "unknown") {
    const d = new Date(r.dueDate.trim());
    if (!Number.isNaN(d.getTime())) dueDate = r.dueDate.trim();
  }

  return {
    id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : fallbackId,
    title,
    category,
    dueDate,
    priority,
    actionSummary:
      typeof r.actionSummary === "string" && r.actionSummary.trim()
        ? r.actionSummary.trim().slice(0, 220)
        : "Review this email and take the required action.",
    sourceEmailSubject:
      typeof r.sourceEmailSubject === "string" && r.sourceEmailSubject.trim()
        ? r.sourceEmailSubject.trim().slice(0, 200)
        : title,
  };
}
