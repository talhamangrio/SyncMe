// ─── SyncMe — Shared Types ──────────────────────────────────────────────────

export type TaskCategory = "Neptun" | "Moodle" | "Medical" | "Immigration";
export type TaskPriority = "High" | "Medium" | "Low";

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

/** Light-theme category styling: a soft tinted chip behind the category icon. */
export const CATEGORY_STYLES: Record<TaskCategory, { chip: string; dot: string }> = {
  Neptun: { chip: "bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100", dot: "bg-sky-500" },
  Moodle: { chip: "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100", dot: "bg-emerald-500" },
  Medical: { chip: "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100", dot: "bg-rose-500" },
  Immigration: { chip: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100", dot: "bg-amber-500" },
};

/** Light-theme priority styling: quiet colored text + matching dot. */
export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  High: "text-rose-600",
  Medium: "text-amber-600",
  Low: "text-emerald-600",
};

export const PRIORITY_DOTS: Record<TaskPriority, string> = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

/** Normalize/validate one raw task object coming from the AI or heuristics. */
export function sanitizeTask(raw: unknown, fallbackId: string): SyncTask | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 160) : "";
  if (!title) return null;

  const category = TASK_CATEGORIES.includes(r.category as TaskCategory) ? (r.category as TaskCategory) : "Neptun";
  const priorities: TaskPriority[] = ["High", "Medium", "Low"];
  const priority = priorities.includes(r.priority as TaskPriority) ? (r.priority as TaskPriority) : "Medium";

  let dueDate = "unknown";
  if (typeof r.dueDate === "string" && r.dueDate.trim() && r.dueDate.trim().toLowerCase() !== "unknown") {
    const d = new Date(r.dueDate);
    if (!Number.isNaN(d.getTime())) dueDate = d.toISOString();
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
