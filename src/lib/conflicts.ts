// ─── SyncMe — Deadline conflict radar ───────────────────────────────────────

import { format } from "date-fns";
import type { SyncTask } from "@/lib/types";

export interface ConflictGroup {
  dateKey: string;
  dateLabel: string;
  tasks: SyncTask[];
}

/** Groups tasks by calendar day and returns every day holding 2+ deadlines. */
export function findConflicts(tasks: SyncTask[]): ConflictGroup[] {
  const groups = new Map<string, SyncTask[]>();
  for (const t of tasks) {
    if (t.dueDate === "unknown") continue;
    const d = new Date(t.dueDate);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(t);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .filter(([, bucket]) => bucket.length >= 2)
    .map(([dateKey, bucket]) => ({
      dateKey,
      dateLabel: format(new Date(bucket[0].dueDate), "EEE, d MMM yyyy"),
      tasks: [...bucket].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate)),
    }));
}
