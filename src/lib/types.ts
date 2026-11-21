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
  /** "ai" = GLM extraction, "heuristic" = deterministic fallback engine. */
  aiStatus: "ai" | "heuristic";
  error?: string;
}

export interface MoodleSyncResponse {
  ok: boolean;
  tasks: SyncTask[];
  error?: string;
}

export const TASK_CATEGORIES: TaskCategory[] = ["Neptun", "Moodle", "Medical", "Immigration"];

export const CATEGORY_STYLES: Record<TaskCategory, { badge: string; dot: string }> = {
  Neptun: { badge: "border-amber-400/40 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  Moodle: { badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-400" },
  Medical: { badge: "border-rose-400/40 bg-rose-400/10 text-rose-300", dot: "bg-rose-400" },
  Immigration: { badge: "border-orange-400/40 bg-orange-400/10 text-orange-300", dot: "bg-orange-400" },
};

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  High: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  Medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Low: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
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
