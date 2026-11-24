"use client";

import { format } from "date-fns";
import {
  BookOpen,
  CaretRight,
  Check,
  CheckCircle,
  EnvelopeSimple,
  GraduationCap,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { normalizeDueDate } from "@/lib/dates";
import {
  CATEGORY_UI,
  SOURCE_CHIP,
  URGENCY_PILL,
  displayCategoryLabel,
  type SyncTask,
  type TaskCategory,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** Phosphor icon per display bucket — Neptun, Moodle, and the shared Gmail envelope. */
export const CATEGORY_ICONS: Record<TaskCategory, Icon> = {
  Neptun: GraduationCap,
  Moodle: BookOpen,
  Medical: EnvelopeSimple,
  Immigration: EnvelopeSimple,
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
 * circular checkbox (44px touch target) and a 28px category icon badge on the
 * left, a full readable two line title plus a two line action summary and an
 * inline category chip in the flexible center, and a metadata column (mono due
 * date, urgency pill, caret) on the right. Below 640px the date/time and the
 * urgency pill stack cleanly under the action line instead of squeezing the
 * text. No priority badges — rows stay calm; the only tint lives on the small
 * pills.
 */
export function TaskCard({ task, onOpen, onToggleDone, done = false, showUrgency = false }: TaskCardProps) {
  const cat = CATEGORY_UI[task.category];
  const CatIcon = CATEGORY_ICONS[task.category];
  const catLabel = displayCategoryLabel(task.category);

  const normalized = normalizeDueDate(task.dueDate);
  const dueMs = normalized === "unknown" ? Number.NaN : Date.parse(normalized);
  const dueInMs = dueMs - Date.now();
  const overdue = !Number.isNaN(dueInMs) && dueInMs <= 0;
  const urgent = !Number.isNaN(dueInMs) && dueInMs > 0 && dueInMs < 24 * 3_600_000;
  const hoursLeft = Math.max(1, Math.round(dueInMs / 3_600_000));

  const interactive = Boolean(onOpen);

  /** Geist Mono due date & time — red tint once the moment has passed. */
  const dueChip = (
    <span
      suppressHydrationWarning
      className={cn(
        "shrink-0 whitespace-nowrap font-mono text-xs font-medium leading-4",
        overdue ? "text-status-high" : "text-mono-ink",
      )}
    >
      {formatTaskDue(task.dueDate)}
    </span>
  );

  /** Urgent countdown pill — only when due within 24 hours (or overdue). */
  const urgencyChip = showUrgency && (overdue || urgent) ? (
    <span
      suppressHydrationWarning
      className={cn(
        "caption-3 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1",
        URGENCY_PILL,
      )}
    >
      <WarningCircle className="h-3 w-3" aria-hidden="true" />
      {overdue ? "Overdue" : `Due in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`}
    </span>
  ) : null;

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

      {/* Full readable title (up to two lines) + action summary + inline category chip */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-ink">{task.title}</h3>
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-xs leading-4", cat.chip)}>{catLabel}</span>
            {task.source && task.source !== catLabel ? (
              <span
                className={cn(
                  "hidden shrink-0 rounded-full px-2 py-0.5 text-xs leading-4 sm:inline",
                  SOURCE_CHIP,
                )}
              >
                {task.source}
              </span>
            ) : null}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-2">{task.actionSummary}</p>

        {/* Mobile: the exact date/time and urgency stack cleanly under the action line */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
          {dueChip}
          {urgencyChip}
        </div>
      </div>

      {/* Desktop metadata column: urgency, mono date, caret */}
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {urgencyChip}
        {dueChip}
        <CaretRight
          aria-hidden="true"
          className="hidden h-4 w-4 shrink-0 text-ink-4 transition-transform duration-200 ease-base group-hover/row:translate-x-0.5 sm:block"
        />
      </div>
    </div>
  );
}

export interface DoneTaskRowProps {
  task: SyncTask;
  /** Formatted completion label, e.g. "Done Tue 18 Nov". */
  doneAtLabel?: string | null;
  /** Restores the task back into its chronological day group. */
  onRestore?: (task: SyncTask) => void;
  /** Opens the source drawer. */
  onOpen?: (task: SyncTask) => void;
}

/**
 * A completed task row: a filled blue CheckCircle (44px touch target) that
 * unchecks on click, a 28px category icon badge, a muted two line title and
 * the one line action summary, and the mono "Done <date>" label on desktop.
 * Clicking the circle removes the task from the Done list and restores it
 * into the upcoming schedule.
 */
export function DoneTaskRow({ task, doneAtLabel, onRestore, onOpen }: DoneTaskRowProps) {
  const cat = CATEGORY_UI[task.category];
  const CatIcon = CATEGORY_ICONS[task.category];
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
      {/* Filled check circle — click to uncheck and restore (44px touch target) */}
      {onRestore ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRestore(task);
          }}
          aria-label={`Restore "${task.title}" to schedule`}
          className="group/uncheck -m-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.95]"
        >
          <CheckCircle
            weight="fill"
            aria-hidden="true"
            className="h-5 w-5 text-brand transition-colors duration-200 ease-base group-hover/uncheck:text-ink-4"
          />
        </button>
      ) : (
        <span aria-hidden="true" className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center">
          <CheckCircle weight="fill" className="h-5 w-5 text-brand" />
        </span>
      )}

      {/* 28px category icon badge in the slate inset */}
      <span
        aria-hidden="true"
        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-alt", cat.icon)}
      >
        <CatIcon className="h-4 w-4" />
      </span>

      {/* Muted title (up to two lines) + one line action summary */}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 min-w-0 text-sm font-medium leading-snug text-ink-3">{task.title}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-ink-4">{task.actionSummary}</p>
      </div>

      {/* Mono "Done <date>" label on desktop */}
      {doneAtLabel ? (
        <span
          suppressHydrationWarning
          className="hidden shrink-0 whitespace-nowrap font-mono text-xs font-medium leading-4 text-ink-3 sm:block"
        >
          {doneAtLabel}
        </span>
      ) : null}

      <CaretRight
        aria-hidden="true"
        className="hidden h-4 w-4 shrink-0 text-ink-4 transition-transform duration-200 ease-base group-hover/row:translate-x-0.5 sm:block"
      />
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
