"use client";

import { format } from "date-fns";
import {
  BookOpen,
  CaretRight,
  Check,
  GraduationCap,
  IdentificationCard,
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
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Phosphor icon per category — natural metaphors instead of tech jargon. */
export const CATEGORY_ICONS: Record<TaskCategory, Icon> = {
  Neptun: GraduationCap,
  Moodle: BookOpen,
  Medical: Stethoscope,
  Immigration: IdentificationCard,
};

/** Due date and time in Geist Mono, e.g. "Wed 26 Nov, 10:00". */
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
}

/**
 * The compact task row: a clean white surface with a hairline border, a 20px
 * circular checkbox (44px touch target), a 28px category icon badge, one
 * title line with category and source pills, a one line action summary, and
 * an aligned metadata column (mono due date, priority badge, caret). Clicking
 * the row opens the source drawer. No colored background washes — the only
 * tint lives on the small pills.
 */
export function TaskCard({ task, onOpen, onToggleDone, done = false, showUrgency = false }: TaskCardProps) {
  const cat = CATEGORY_UI[task.category];
  const CatIcon = CATEGORY_ICONS[task.category];
  const prio = PRIORITY_UI[task.priority];

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
        "group/row relative flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-base",
        "hover:border-line-strong hover:bg-page",
        interactive && "cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      )}
    >
      {/* Circular checkbox — 20px visual inside a 44px touch target */}
      {onToggleDone ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task);
          }}
          aria-label={`Mark "${task.title}" as done`}
          className="group/check -m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.95]"
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200 ease-base",
              done
                ? "border-brand bg-brand"
                : "border-line-strong bg-white group-hover/check:border-brand",
            )}
          >
            <Check
              weight="bold"
              className={cn(
                "h-3 w-3 text-white transition-opacity duration-200 ease-base",
                done ? "opacity-100" : "opacity-0 group-hover/check:opacity-60",
              )}
            />
          </span>
        </button>
      ) : null}

      {/* 28px category icon badge in the slate inset */}
      <span
        aria-hidden="true"
        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-alt", cat.icon)}
      >
        <CatIcon className="h-4 w-4" />
      </span>

      {/* Title line + one line summary (the mono date rides the summary line on mobile) */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-medium leading-5 text-ink">{task.title}</h3>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs leading-4", cat.chip)}>
            {task.category}
          </span>
          {task.source ? (
            <span
              className={cn(
                "hidden shrink-0 rounded-full px-2 py-0.5 text-xs leading-4 sm:inline",
                SOURCE_CHIP,
              )}
            >
              {task.source}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs leading-4 text-ink-3">{task.actionSummary}</p>
          <span
            suppressHydrationWarning
            className={cn(
              "shrink-0 whitespace-nowrap font-mono text-xs font-medium leading-4 sm:hidden",
              overdue ? "text-status-high" : "text-mono-ink",
            )}
          >
            {formatTaskDue(task.dueDate)}
          </span>
        </div>
      </div>

      {/* Compact priority chip on small screens */}
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs leading-4 sm:hidden",
          prio.pill,
        )}
      >
        {prio.label}
      </span>

      {/* Aligned metadata column: urgency, mono date, priority, caret (desktop) */}
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {showUrgency && (overdue || urgent) ? (
          <span
            suppressHydrationWarning
            className={cn(
              "caption-3 hidden items-center gap-1 rounded-full px-2 py-1 sm:inline-flex",
              URGENCY_PILL,
            )}
          >
            <WarningCircle className="h-3 w-3" aria-hidden="true" />
            {overdue ? "Overdue" : `Due in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`}
          </span>
        ) : null}
        <span
          suppressHydrationWarning
          className={cn(
            "whitespace-nowrap font-mono text-xs font-medium leading-4",
            overdue ? "text-status-high" : "text-mono-ink",
          )}
        >
          {formatTaskDue(task.dueDate)}
        </span>
        <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs leading-4", prio.pill)}>
          {prio.label}
        </span>
        <CaretRight
          aria-hidden="true"
          className="hidden h-4 w-4 shrink-0 text-ink-4 transition-transform duration-200 ease-base group-hover/row:translate-x-0.5 sm:block"
        />
      </div>
    </div>
  );
}

/**
 * Conflict group: two or more deadlines sharing a day, wrapped in one slim
 * amber container. The rows inside stay crisp white — the tint never bleeds
 * into the task surfaces.
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
      aria-label={`Schedule conflict: ${count} deadlines overlap on ${dateLabel}`}
      className="space-y-1.5 rounded-2xl border border-status-warn-border/50 bg-status-warn-bg/40 p-2"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pt-1">
        <WarningCircle className="h-4 w-4 shrink-0 text-status-warn" aria-hidden="true" />
        <span className="text-xs font-semibold leading-4 text-status-warn">Schedule conflict</span>
        <span className="text-xs leading-4 text-ink-3">
          {count} deadline{count === 1 ? "" : "s"} overlap on this day
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
