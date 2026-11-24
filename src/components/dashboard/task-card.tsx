"use client";

import { format } from "date-fns";
import {
  BookOpen,
  CaretRight,
  Check,
  Clock,
  GraduationCap,
  IdentificationCard,
  Minus,
  Stethoscope,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { normalizeDueDate } from "@/lib/dates";
import {
  CATEGORY_UI,
  PRIORITY_UI,
  SOURCE_CHIP,
  URGENCY_PILL,
  type SyncTask,
  type TaskCategory,
  type TaskPriority,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Phosphor icon per category — natural metaphors instead of tech jargon. */
export const CATEGORY_ICONS: Record<TaskCategory, Icon> = {
  Neptun: GraduationCap,
  Moodle: BookOpen,
  Medical: Stethoscope,
  Immigration: IdentificationCard,
};

const PRIORITY_ICONS: Record<TaskPriority, Icon> = {
  High: WarningCircle,
  Medium: Clock,
  Low: Minus,
};

/** Due date and time in Geist Mono, e.g. "Tue 24 Nov, 09:40". */
export function formatTaskDue(dueDate: string): string {
  const normalized = normalizeDueDate(dueDate);
  if (normalized === "unknown") return "No date detected";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "No date detected";
  return format(parsed, "EEE d MMM, HH:mm");
}

export interface TaskCardProps {
  task: SyncTask;
  /** Opens the source drawer. Omitted for static previews. */
  onOpen?: (task: SyncTask) => void;
  /** Marks the task done. Omitted for static previews. */
  onToggleDone?: (task: SyncTask) => void;
  /** Visual-only completed state (used by interactive previews). */
  done?: boolean;
  /** Show the urgency pill ("Due in 6 hours" / "Overdue"). */
  showUrgency?: boolean;
  /** Inner radius inside a conflict group: outer 16 minus the 8px gap. */
  compactRadius?: boolean;
}

/**
 * The real task card (light theme): 24px circular checkbox with a 44px touch
 * target, a 40px category icon circle, title, action summary, a mono due
 * date, source and category chips, and a priority pill with a caret that
 * nudges right on hover. The whole card is clickable and opens the drawer.
 */
export function TaskCard({ task, onOpen, onToggleDone, done = false, showUrgency = false, compactRadius = false }: TaskCardProps) {
  const cat = CATEGORY_UI[task.category];
  const CatIcon = CATEGORY_ICONS[task.category];
  const prio = PRIORITY_UI[task.priority];
  const PrioIcon = PRIORITY_ICONS[task.priority];

  const normalized = normalizeDueDate(task.dueDate);
  const dueMs = normalized === "unknown" ? Number.NaN : Date.parse(normalized);
  const dueInMs = dueMs - Date.now();
  const overdue = !Number.isNaN(dueInMs) && dueInMs <= 0;
  const urgent = !Number.isNaN(dueInMs) && dueInMs > 0 && dueInMs < 24 * 3_600_000;
  const hoursLeft = Math.max(1, Math.round(dueInMs / 3_600_000));

  const interactive = Boolean(onOpen);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onOpen ? () => onOpen(task) : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(task);
              }
            }
          : undefined
      }
      aria-label={interactive ? `Open source for ${task.title}` : undefined}
      className={cn(
        "card-hover group relative flex w-full items-start gap-3 border border-border bg-white p-4 text-left",
        compactRadius ? "rounded-lg" : "rounded-2xl",
        interactive && "cursor-pointer",
        "hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
      )}
    >
      {/* Circular checkbox — 24px visual inside a 44px touch target */}
      {onToggleDone ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task);
          }}
          aria-label={`Mark "${task.title}" as done`}
          className="group/check -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-300 ease-base",
              done
                ? "border-black bg-black"
                : "border-border-strong bg-white group-hover/check:border-black group-hover/check:bg-black",
            )}
          >
            <Check
              weight="bold"
              className={cn(
                "h-3.5 w-3.5 text-white transition-opacity duration-300 ease-base",
                done ? "opacity-100" : "opacity-0 group-hover/check:opacity-100",
              )}
            />
          </span>
        </button>
      ) : null}

      {/* 40px category icon circle in the category tint */}
      <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", cat.circle)}>
        <CatIcon className={cn("h-5 w-5", cat.icon)} />
      </span>

      {/* Title, action summary, meta row */}
      <div className="min-w-0 flex-1">
        <h3 className="title-2 truncate text-black">{task.title}</h3>
        <p className="body-6 mt-0.5 line-clamp-2 text-[#666666]">{task.actionSummary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="caption-1 font-mono text-[#666666]">{formatTaskDue(task.dueDate)}</span>
          {task.source ? (
            <span className={cn("caption-4 rounded-full px-2 py-1", SOURCE_CHIP)}>{task.source}</span>
          ) : null}
          <span className={cn("caption-4 rounded-full px-2 py-1", cat.chip)}>{task.category}</span>
        </div>
      </div>

      {/* Priority pill, urgency pill, caret */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {showUrgency && (overdue || urgent) ? (
          <span
            suppressHydrationWarning
            className={cn("caption-3 inline-flex items-center gap-1 rounded-full px-2 py-1", URGENCY_PILL)}
          >
            <WarningCircle className="h-3 w-3" aria-hidden="true" />
            {overdue ? "Overdue" : `Due in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`}
          </span>
        ) : null}
        <span className={cn("caption-3 inline-flex items-center gap-1 rounded-full px-2 py-1", prio.pill)}>
          <PrioIcon className="h-3 w-3" aria-hidden="true" />
          {prio.label}
        </span>
        <CaretRight
          aria-hidden="true"
          className="h-4 w-4 text-[#666666] transition-transform duration-500 ease-base group-hover:translate-x-1"
        />
      </div>
    </div>
  );
}

/**
 * Conflict group: two or more deadlines sharing a day, wrapped in one amber
 * container. White task cards inside use rounded-lg (16 minus the 8px gap).
 */
export function ConflictGroup({
  dateLabel,
  count,
  children,
}: {
  dateLabel: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={`Schedule conflict: ${count} deadlines on ${dateLabel}`}
      className="rounded-2xl border border-status-warn-border bg-status-warn-bg p-2"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-2 pt-1">
        <WarningCircle className="h-4 w-4 shrink-0 text-status-warn" aria-hidden="true" />
        <span className="caption-3 text-status-warn">Schedule conflict</span>
        <span className="caption-1 text-[#666666]">
          {count} deadline{count === 1 ? "" : "s"} on {dateLabel}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
