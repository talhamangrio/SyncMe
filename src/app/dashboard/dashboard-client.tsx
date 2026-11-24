"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  CheckCircle,
  Flask,
  List,
  ShieldCheck,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConflictGroup, TaskCard, formatTaskDue } from "@/components/dashboard/task-card";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { BASE_CURVE } from "@/components/landing/reveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEMO_DONE, DEMO_EMAILS, DEMO_TASKS } from "@/lib/demo-data";
import { addDaysKey, budapestTodayKey, dayKeyOf, normalizeDueDate, sortChronologically } from "@/lib/dates";
import type { GmailSyncResponse, MoodleSyncResponse, RawEmail, SyncMeUser, SyncTask, TaskCategory } from "@/lib/types";
import { TASK_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 30_000;
const MOODLE_URL_KEY = "syncme_moodle_ics_url";
/** Browser-side persistence: synced tasks survive reloads and later syncs — nothing fades away. */
const GMAIL_TASKS_KEY = "syncme_gmail_tasks_v1";
const MOODLE_TASKS_KEY = "syncme_moodle_tasks_v1";
const EMAILS_KEY = "syncme_emails_v1";
const DONE_KEY = "syncme_done_v1";
/** When each task was marked done (powers the "Done this week" tile). */
const DONE_AT_KEY = "syncme_done_at_v1";

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full — persistence is best effort, sync still works.
  }
}

function tagSource(tasks: SyncTask[], source: "Gmail" | "Moodle"): SyncTask[] {
  return tasks.map((t) => ({ ...t, source }));
}

/**
 * Union merge: fresh tasks overwrite their previous version, tasks that were
 * extracted earlier are kept even if this sync missed them, and done tasks
 * never come back. Entries older than two days are pruned — the Overdue
 * group still gets a chance to warn, the past never piles up.
 */
function mergeTasks(prev: SyncTask[], next: SyncTask[], done: Set<string>): SyncTask[] {
  const byId = new Map<string, SyncTask>();
  for (const t of prev) if (!done.has(t.id)) byId.set(t.id, t);
  for (const t of next) if (!done.has(t.id)) byId.set(t.id, t);
  const floorKey = addDaysKey(budapestTodayKey(), -2);
  return [...byId.values()]
    .filter((t) => {
      const day = dayKeyOf(t.dueDate);
      return day === null || day >= floorKey;
    })
    .slice(0, 80);
}

function mergeEmails(prev: RawEmail[], next: RawEmail[]): RawEmail[] {
  const byId = new Map<string, RawEmail>();
  for (const e of prev) byId.set(e.id, e);
  for (const e of next) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 50);
}

/** Sort key: normalized Budapest ISO parsed as ms; undated tasks sink to the end. */
function dueMsOf(task: SyncTask): number {
  const normalized = normalizeDueDate(task.dueDate);
  return normalized === "unknown" ? Number.POSITIVE_INFINITY : Date.parse(normalized);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return chars.slice(0, 2) || "S";
}

function greetingOf(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Strict https check for the Moodle .ics feed URL (client side validation). */
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Button classes reused across the dashboard. */
const BUTTON_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 button-md text-white transition-colors duration-300 ease-base hover:bg-[#262626] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:pointer-events-none disabled:opacity-50";
const BUTTON_SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 button-md text-black transition-colors duration-300 ease-base hover:bg-alt active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:pointer-events-none disabled:opacity-50";

/** Skeleton shaped exactly like the real task card, slow opacity pulse. */
function TaskCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4">
      <span className="skeleton-soft mt-1 h-6 w-6 shrink-0 rounded-full bg-inset" />
      <span className="skeleton-soft h-10 w-10 shrink-0 rounded-full bg-inset" />
      <div className="min-w-0 flex-1 space-y-2">
        <span className="skeleton-soft block h-4 w-1/3 rounded bg-inset" />
        <span className="skeleton-soft block h-3 w-2/3 rounded bg-inset" />
        <span className="skeleton-soft block h-3 w-1/2 rounded bg-inset" />
      </div>
      <span className="skeleton-soft h-5 w-16 shrink-0 rounded-full bg-inset" />
    </div>
  );
}

/** One task row in the date groups: entrance, completing fade, layout close-up. */
function TaskRow({
  task,
  index,
  completing,
  onOpen,
  onToggleDone,
}: {
  task: SyncTask;
  index: number;
  completing: boolean;
  onOpen: (task: SyncTask) => void;
  onToggleDone: (task: SyncTask) => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={completing ? { opacity: 0, x: 8 } : { opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: completing ? 0.3 : 0.4,
        ease: BASE_CURVE,
        delay: completing ? 0 : Math.min(index * 0.04, 0.25),
      }}
      className="list-none"
    >
      <TaskCard
        task={task}
        onOpen={onOpen}
        onToggleDone={onToggleDone}
        done={completing}
        showUrgency
      />
    </motion.li>
  );
}

export function DashboardClient({ user, isDemo }: { user: SyncMeUser; isDemo: boolean }) {
  const [gmailTasks, setGmailTasks] = useState<SyncTask[]>(isDemo ? DEMO_TASKS : []);
  const [moodleTasks, setMoodleTasks] = useState<SyncTask[]>([]);
  const [emails, setEmails] = useState<RawEmail[]>(isDemo ? DEMO_EMAILS : []);
  const [syncing, setSyncing] = useState(!isDemo);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [connected, setConnected] = useState(true);
  const [engine, setEngine] = useState<"gemini" | "zai" | "rule" | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [doneAt, setDoneAt] = useState<Record<string, string>>({});
  const [moodleConnected, setMoodleConnected] = useState(false);
  const [filter, setFilter] = useState<"All" | TaskCategory>("All");
  const [moodleUrl, setMoodleUrl] = useState("");
  const [moodleConnecting, setMoodleConnecting] = useState(false);
  const [moodleError, setMoodleError] = useState<string | null>(null);
  const [moodleSuccess, setMoodleSuccess] = useState<string | null>(null);
  const [drawerTask, setDrawerTask] = useState<SyncTask | null>(null);
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [todayKey, setTodayKey] = useState<string>(() => budapestTodayKey());
  const [, setTick] = useState(0);
  const isMobile = useIsMobile();

  /** Ref mirrors so the 30s polling merge never resurrects done tasks. */
  const doneRef = useRef<Set<string>>(new Set());
  const completingRef = useRef<Set<string>>(new Set());
  const lastDoneRef = useRef<{ task: SyncTask; origin: "gmail" | "moodle" } | null>(null);
  const moodleInputRef = useRef<HTMLInputElement>(null);

  // ── Keep the Budapest "today" key fresh (handles midnight rollover) ────────
  useEffect(() => {
    const update = () => setTodayKey(budapestTodayKey());
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Ticks the "Synced X seconds ago" chip ──────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  // ── Restore the persisted session state before the first sync fires ───────
  useEffect(() => {
    if (isDemo) {
      setDoneAt(Object.fromEntries(DEMO_DONE.map((d) => [d.id, d.at])));
      return;
    }
    const savedTasks = loadJson<SyncTask[]>(GMAIL_TASKS_KEY, []);
    const savedMoodle = loadJson<SyncTask[]>(MOODLE_TASKS_KEY, []);
    const savedEmails = loadJson<RawEmail[]>(EMAILS_KEY, []);
    const legacyDone = loadJson<string[]>(DONE_KEY, []);
    const savedDoneAt = loadJson<Record<string, string>>(DONE_AT_KEY, {});
    const mergedDoneAt: Record<string, string> = { ...savedDoneAt };
    for (const id of legacyDone) if (!mergedDoneAt[id]) mergedDoneAt[id] = new Date().toISOString();
    const ids = new Set<string>([...legacyDone, ...Object.keys(savedDoneAt)]);
    doneRef.current = ids;
    setDoneIds(ids);
    setDoneAt(mergedDoneAt);
    setGmailTasks((prev) => (prev.length === 0 ? tagSource(savedTasks, "Gmail") : prev));
    setMoodleTasks((prev) => (prev.length === 0 ? tagSource(savedMoodle, "Moodle") : prev));
    setEmails((prev) => (prev.length === 0 ? savedEmails : prev));
    if (savedMoodle.length > 0) setMoodleConnected(true);
  }, [isDemo]);

  // ── Persist on every change (best effort, browser only — zero servers) ────
  useEffect(() => {
    if (!isDemo) saveJson(GMAIL_TASKS_KEY, gmailTasks);
  }, [gmailTasks, isDemo]);
  useEffect(() => {
    if (!isDemo) saveJson(MOODLE_TASKS_KEY, moodleTasks);
  }, [moodleTasks, isDemo]);
  useEffect(() => {
    if (!isDemo) saveJson(EMAILS_KEY, emails);
  }, [emails, isDemo]);
  useEffect(() => {
    if (!isDemo) saveJson(DONE_KEY, [...doneIds]);
  }, [doneIds, isDemo]);
  useEffect(() => {
    if (!isDemo) saveJson(DONE_AT_KEY, doneAt);
  }, [doneAt, isDemo]);

  // ── Gmail sync (also runs on load and polls every 30s) ────────────────────
  const syncNow = useCallback(
    async (silent = false) => {
      if (isDemo) {
        if (!silent) {
          toast.info("Demo sandbox", {
            description: "Simulated sync — connect real Gmail from the landing page to run the live pipeline.",
          });
        }
        setLastSync(new Date());
        return;
      }
      setSyncing(true);
      try {
        const res = await fetch("/api/gmail/sync", { cache: "no-store" });
        const data = (await res.json()) as GmailSyncResponse;
        if (res.status === 401 || !data.ok) {
          if (res.status === 401) {
            setConnected(false);
            if (!silent) {
              toast.error("Gmail not connected", {
                description: "Your session expired or is missing. Reconnect below — no consent screen needed.",
              });
            }
          } else if (!silent) {
            toast.error("Gmail sync failed. Reconnect Google to continue.", {
              description: data.error ?? `HTTP ${res.status}`,
            });
          }
          return;
        }
        // Merge instead of replace: previously synced tasks never fade away.
        setGmailTasks((prev) => mergeTasks(prev, tagSource(data.tasks, "Gmail"), doneRef.current));
        setEmails((prev) => mergeEmails(prev, data.emails));
        setEngine(data.engine ?? null);
        setConnected(true);
        setLastSync(new Date());
        if (!silent) {
          toast.success(`${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"} extracted`, {
            description:
              data.engine === "rule"
                ? "The AI was unavailable, so the rule based extractor ran instead."
                : `${data.engine === "gemini" ? "Gemini" : "GLM"} scanned ${data.emails.length} university email${
                    data.emails.length === 1 ? "" : "s"
                  } from the last 30 days.`,
          });
        }
      } catch (err) {
        if (!silent) toast.error("Gmail sync failed. Reconnect Google to continue.", { description: String(err) });
      } finally {
        setSyncing(false);
      }
    },
    [isDemo],
  );

  useEffect(() => {
    if (isDemo) return;
    void syncNow(true);
    const timer = setInterval(() => void syncNow(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isDemo, syncNow]);

  // ── Moodle .ics connect (inline rail card, client side validation) ────────
  const connectMoodle = useCallback(async (url: string, silent = false) => {
    if (!isValidHttpsUrl(url)) {
      if (!silent) {
        setMoodleSuccess(null);
        setMoodleError("That link is not a valid calendar feed. Copy the private .ics link from elearning.unideb.hu.");
      }
      return;
    }
    setMoodleConnecting(true);
    try {
      const res = await fetch("/api/moodle/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: url }),
      });
      const data = (await res.json()) as MoodleSyncResponse;
      if (!res.ok || !data.ok) {
        if (!silent) {
          setMoodleSuccess(null);
          setMoodleError(data.error ?? "Moodle sync failed. Check the link and try again.");
        }
        return;
      }
      setMoodleTasks((prev) => mergeTasks(prev, tagSource(data.tasks, "Moodle"), doneRef.current));
      setMoodleConnected(true);
      window.localStorage.setItem(MOODLE_URL_KEY, url);
      if (!silent) {
        setMoodleError(null);
        setMoodleSuccess("Calendar saved. Next sync in 30 seconds.");
      }
    } catch (err) {
      if (!silent) {
        setMoodleSuccess(null);
        setMoodleError(`Moodle sync failed. ${String(err)}`);
      }
    } finally {
      setMoodleConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (isDemo) return;
    const saved = window.localStorage.getItem(MOODLE_URL_KEY);
    if (saved) {
      setMoodleUrl(saved);
      void connectMoodle(saved, true);
    }
  }, [isDemo, connectMoodle]);

  // ── Mark done: fade out, then remove; undo brings it straight back ────────
  const markTaskDone = useCallback(
    (task: SyncTask) => {
      const origin = moodleTasks.some((t) => t.id === task.id) ? "moodle" : "gmail";
      lastDoneRef.current = { task, origin };
      const nextDone = new Set(doneRef.current);
      nextDone.add(task.id);
      doneRef.current = nextDone;
      setDoneIds(nextDone);
      setDoneAt((prev) => ({ ...prev, [task.id]: new Date().toISOString() }));
      setGmailTasks((prev) => prev.filter((t) => t.id !== task.id));
      setMoodleTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (drawerTask?.id === task.id) setDrawerTask(null);
      toast.success("Task marked done", {
        description: `SyncMe will skip "${task.title}" from now on.`,
        action: { label: "Undo", onClick: () => undoDone() },
      });
    },
    [moodleTasks, drawerTask],
  );

  const undoDone = useCallback(() => {
    const entry = lastDoneRef.current;
    if (!entry) return;
    const { task, origin } = entry;
    lastDoneRef.current = null;
    const nextDone = new Set(doneRef.current);
    nextDone.delete(task.id);
    doneRef.current = nextDone;
    setDoneIds(nextDone);
    setDoneAt((prev) => {
      const copy = { ...prev };
      delete copy[task.id];
      return copy;
    });
    const restore = (prev: SyncTask[]) => sortChronologically([task, ...prev.filter((t) => t.id !== task.id)]);
    if (origin === "moodle") setMoodleTasks(restore);
    else setGmailTasks(restore);
    toast.success("Task restored", { description: `"${task.title}" is back on your dashboard.` });
  }, []);

  const startComplete = useCallback(
    (task: SyncTask) => {
      if (completingRef.current.has(task.id)) return;
      completingRef.current.add(task.id);
      setCompletingIds(new Set(completingRef.current));
      window.setTimeout(() => {
        completingRef.current.delete(task.id);
        setCompletingIds(new Set(completingRef.current));
        markTaskDone(task);
      }, 320);
    },
    [markTaskDone],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const allTasks = useMemo(
    () => sortChronologically([...gmailTasks, ...moodleTasks]),
    [gmailTasks, moodleTasks],
  );

  const filteredTasks = useMemo(
    () => (filter === "All" ? allTasks : allTasks.filter((t) => t.category === filter)),
    [allTasks, filter],
  );

  /**
   * Date groups: Overdue (past due and not done), Today, Tomorrow, This week
   * (within 7 days), Later (beyond 7 days, undated tasks sink here). Each
   * group is strictly ascending by date and time.
   */
  const dateGroups = useMemo(() => {
    const tomorrowKey = addDaysKey(todayKey, 1);
    const weekEndKey = addDaysKey(todayKey, 7);
    const overdue: SyncTask[] = [];
    const today: SyncTask[] = [];
    const tomorrow: SyncTask[] = [];
    const week: SyncTask[] = [];
    const later: SyncTask[] = [];
    const undated: SyncTask[] = [];
    for (const t of filteredTasks) {
      const normalized = normalizeDueDate(t.dueDate);
      if (normalized === "unknown") {
        undated.push(t);
        continue;
      }
      const day = normalized.slice(0, 10);
      const ms = Date.parse(normalized);
      if (day < todayKey || (day === todayKey && ms <= Date.now())) overdue.push(t);
      else if (day === todayKey) today.push(t);
      else if (day === tomorrowKey) tomorrow.push(t);
      else if (day <= weekEndKey) week.push(t);
      else later.push(t);
    }
    const byTime = (a: SyncTask, b: SyncTask) => dueMsOf(a) - dueMsOf(b);
    const groups: { key: string; label: string; items: SyncTask[] }[] = [
      { key: "overdue", label: "Overdue", items: [...overdue].sort(byTime) },
      { key: "today", label: "Today", items: [...today].sort(byTime) },
      { key: "tomorrow", label: "Tomorrow", items: [...tomorrow].sort(byTime) },
      { key: "week", label: "This week", items: [...week].sort(byTime) },
      { key: "later", label: "Later", items: [...later].sort(byTime).concat(undated) },
    ];
    return groups.filter((g) => g.items.length > 0);
  }, [filteredTasks, todayKey]);

  /** Days holding two or more deadlines — rendered as amber conflict groups. */
  const conflictMap = useMemo(() => {
    const byDay = new Map<string, SyncTask[]>();
    for (const t of allTasks) {
      const day = dayKeyOf(t.dueDate);
      if (!day) continue;
      const bucket = byDay.get(day);
      if (bucket) bucket.push(t);
      else byDay.set(day, [t]);
    }
    const map = new Map<string, SyncTask[]>();
    for (const [day, items] of byDay) if (items.length >= 2) map.set(day, items);
    return map;
  }, [allTasks]);

  const nextConflict = useMemo(() => {
    const entries = [...conflictMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    return entries[0] ?? null;
  }, [conflictMap]);

  const dueTodayCount = useMemo(
    () => allTasks.filter((t) => dayKeyOf(t.dueDate) === todayKey).length,
    [allTasks, todayKey],
  );
  const next7Count = useMemo(() => {
    const weekEndKey = addDaysKey(todayKey, 7);
    return allTasks.filter((t) => {
      const day = dayKeyOf(t.dueDate);
      return day !== null && day > todayKey && day <= weekEndKey;
    }).length;
  }, [allTasks, todayKey]);
  const doneThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return Object.values(doneAt).filter((at) => Date.parse(at) > cutoff).length;
  }, [doneAt]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([["All", allTasks.length]]);
    for (const c of TASK_CATEGORIES) counts.set(c, allTasks.filter((t) => t.category === c).length);
    return counts;
  }, [allTasks]);

  const showSkeletons = syncing && allTasks.length === 0;
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const weekTotal = dueTodayCount + next7Count;

  // ── Segmented filter: measured sliding indicator (transform based) ────────
  const FILTERS = useMemo(() => ["All", ...TASK_CATEGORIES] as const, []);
  const activeIndex = FILTERS.indexOf(filter);
  const segRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const el = segRefs.current[activeIndex];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, filter]);

  const syncLabel = useMemo(() => {
    if (!lastSync) return isDemo ? "Demo mode" : connected ? "Ready" : "Not connected";
    const s = Math.max(0, Math.floor((Date.now() - lastSync.getTime()) / 1000));
    if (s < 60) return `Synced ${s} second${s === 1 ? "" : "s"} ago`;
    const m = Math.floor(s / 60);
    return `Synced ${m} minute${m === 1 ? "" : "s"} ago`;
  }, [lastSync, isDemo, connected]);

  const drawerEmail = drawerTask
    ? (emails.find((e) => e.subject === drawerTask.sourceEmailSubject) ?? null)
    : null;

  const focusMoodleInput = () => {
    moodleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    moodleInputRef.current?.focus();
  };

  /** Renders a group's cards, wrapping consecutive same day pairs in a conflict container. */
  const renderGroupItems = (items: SyncTask[]): React.ReactNode[] => {
    const runs: { day: string | null; items: SyncTask[] }[] = [];
    for (const t of items) {
      const day = dayKeyOf(t.dueDate);
      const last = runs[runs.length - 1];
      if (last && last.day === day) last.items.push(t);
      else runs.push({ day, items: [t] });
    }
    let cursor = 0;
    return runs.map((run, runIndex) => {
      const start = cursor;
      cursor += run.items.length;
      const conflicted = run.day !== null && run.items.length >= 2 && conflictMap.has(run.day);
      if (conflicted && run.day) {
        const label = format(new Date(`${run.day}T12:00:00`), "EEEE d MMM");
        return (
          <ConflictGroup key={run.day} dateLabel={label} count={run.items.length}>
            {run.items.map((t, j) => (
              <TaskRow
                key={t.id}
                task={t}
                index={start + j}
                completing={completingIds.has(t.id)}
                onOpen={setDrawerTask}
                onToggleDone={startComplete}
              />
            ))}
          </ConflictGroup>
        );
      }
      return run.items.map((t, j) => (
        <TaskRow
          key={t.id}
          task={t}
          index={start + j}
          completing={completingIds.has(t.id)}
          onOpen={setDrawerTask}
          onToggleDone={startComplete}
        />
      ));
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Floating dashboard navigation ──────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-2xl border border-border bg-white/80 py-1.5 pl-3 pr-2 shadow-sm backdrop-blur-md">
          <Logo />
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <span className="caption-3 hidden rounded-full bg-black px-2.5 py-1 text-white sm:inline-flex">Dashboard</span>
          <span
            suppressHydrationWarning
            className="caption-4 hidden min-[480px]:inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[#666666]"
          >
            <ArrowsClockwise className="h-3.5 w-3.5" aria-hidden="true" />
            {syncLabel}
          </span>
          {isDemo && (
            <span className="caption-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[#666666]">
              <Flask className="h-3.5 w-3.5" aria-hidden="true" />
              Demo
            </span>
          )}
          <button
            type="button"
            onClick={() => setEmailsOpen(true)}
            aria-label="Open raw emails"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#666666] transition-colors duration-300 ease-base hover:bg-alt hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <Avatar className="h-9 w-9 border border-border">
                  {user.picture ? <AvatarImage src={user.picture} alt={`${user.name}'s profile photo`} /> : null}
                  <AvatarFallback className="bg-inset caption-3 text-black">{initialsOf(user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg border-border">
              <DropdownMenuLabel className="py-2">
                <span className="caption-3 block truncate text-black">{user.name}</span>
                <span className="caption-4 block truncate text-[#666666]">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()} className="gap-2 caption-1">
                <SignOut className="h-4 w-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        {/* ── Demo banner ──────────────────────────────────────────────────── */}
        {isDemo && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-alt px-4 py-3">
            <Flask className="h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" />
            <p className="body-6 text-[#666666]">
              <span className="font-semibold text-black">Demo sandbox.</span> Simulated Debrecen inbox. No Gmail
              account is connected;{" "}
              <a
                href="/api/auth/google"
                className="underline underline-offset-4 transition-colors duration-300 ease-base hover:text-black"
              >
                connect real Gmail
              </a>{" "}
              to run the live pipeline.
            </p>
          </div>
        )}

        {/* ── Inline error: Gmail disconnected ─────────────────────────────── */}
        {!connected && !isDemo && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-status-high bg-status-high-bg p-6"
          >
            <div>
              <p className="caption-3 inline-flex items-center gap-2 text-status-high">
                <WarningCircle className="h-4 w-4" aria-hidden="true" />
                Gmail sync failed.
              </p>
              <p className="body-6 mt-1 text-status-high">Reconnect Google to continue.</p>
            </div>
            <a href="/api/auth/google" className={BUTTON_SECONDARY}>
              Reconnect Google
            </a>
          </div>
        )}

        {/* ── Greeting ─────────────────────────────────────────────────────── */}
        <header>
          <h1 suppressHydrationWarning className="heading-5 text-black">
            {greetingOf(new Date())}, {firstName}
          </h1>
          <p suppressHydrationWarning className="body-3 mt-1 text-[#666666]">
            You have {weekTotal} task{weekTotal === 1 ? "" : "s"} due this week and {conflictMap.size} conflict
            {conflictMap.size === 1 ? "" : "s"}.
          </p>
        </header>

        {/* ── Summary tiles ────────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Due today", value: dueTodayCount, icon: null, iconClass: "" },
            { label: "Next 7 days", value: next7Count, icon: null, iconClass: "" },
            { label: "Conflicts", value: conflictMap.size, icon: WarningCircle, iconClass: "text-status-warn" },
            { label: "Done this week", value: doneThisWeek, icon: CheckCircle, iconClass: "text-cat-medical" },
          ].map((tile) => (
            <div key={tile.label} className="rounded-2xl border border-border bg-white p-4">
              <p className="caption-1 inline-flex items-center gap-1.5 text-[#666666]">
                {tile.icon && <tile.icon className={cn("h-4 w-4", tile.iconClass)} aria-hidden="true" />}
                {tile.label}
              </p>
              <p suppressHydrationWarning className="heading-4 mt-2 text-black">
                {tile.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Main column + right rail ─────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* ── Segmented filter ─────────────────────────────────────────── */}
            <div role="group" aria-label="Filter tasks by category" className="-mx-4 overflow-x-auto px-4 scrollbar-slim sm:mx-0 sm:px-0">
              <div className="relative flex w-max gap-1 rounded-lg bg-inset p-1 sm:w-full">
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 top-1 left-0 rounded-md border border-border bg-white transition-transform duration-500 ease-base"
                  style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
                />
                {FILTERS.map((c, i) => {
                  const selected = filter === c;
                  return (
                    <button
                      key={c}
                      ref={(el) => {
                        segRefs.current[i] = el;
                      }}
                      type="button"
                      onClick={() => setFilter(c)}
                      aria-pressed={selected}
                      className={cn(
                        "relative z-10 flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3 button-sm transition-colors duration-300 ease-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:flex-1 sm:justify-center",
                        selected ? "text-black" : "text-[#666666] hover:text-black",
                      )}
                    >
                      {c}
                      <span className={cn("caption-4", selected ? "text-[#666666]" : "text-[#999999]")}>
                        {categoryCounts.get(c) ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Date groups ──────────────────────────────────────────────── */}
            <section aria-label="Tasks by date">
              {showSkeletons ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <TaskCardSkeleton key={i} />
                  ))}
                </div>
              ) : dateGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-4 py-12 text-center">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-alt text-[#666666]"
                  >
                    <CheckCircle className="h-6 w-6" />
                  </span>
                  <h2 className="heading-5 text-black">Nothing due this week</h2>
                  <p className="body-3 max-w-sm text-[#666666]">
                    New deadlines appear here as soon as they land in your inbox or Moodle.
                  </p>
                  {!moodleConnected && (
                    <button type="button" onClick={focusMoodleInput} className={cn(BUTTON_SECONDARY, "mt-2")}>
                      Add your Moodle calendar
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {dateGroups.map((group) => (
                    <div key={group.key}>
                      <div className="sticky top-20 z-20 -mx-4 flex items-center gap-2 bg-white/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
                        <h3 className="title-4 text-black">{group.label}</h3>
                        <span className="caption-4 rounded-full bg-inset px-2 py-0.5 text-[#666666]">
                          {group.items.length}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2">{renderGroupItems(group.items)}</ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Right rail ─────────────────────────────────────────────────── */}
          <aside aria-label="Sync status and Moodle calendar" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {/* Moodle calendar card */}
            <div className="rounded-2xl border border-border bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="title-2 text-black">Moodle calendar</h2>
                <span
                  className={cn(
                    "caption-1 inline-flex items-center gap-1.5",
                    moodleConnected ? "text-cat-medical" : "text-[#666666]",
                  )}
                >
                  {moodleConnected && <CheckCircle className="h-4 w-4" aria-hidden="true" />}
                  {moodleConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="body-6 mt-2 text-[#666666]">
                Paste your private elearning.unideb.hu calendar feed once. It stays in your own browser.
              </p>
              <div className="mt-4 space-y-2">
                <Input
                  ref={moodleInputRef}
                  id="moodle-ics-input"
                  value={moodleUrl}
                  onChange={(e) => {
                    setMoodleUrl(e.target.value);
                    setMoodleError(null);
                    setMoodleSuccess(null);
                  }}
                  placeholder="https://elearning.unideb.hu/calendar/export.php?..."
                  aria-label="Moodle .ics calendar URL"
                  className="rounded-lg border-border bg-inset px-3 py-2 caption-1 text-black placeholder:text-[#666666] focus-visible:ring-black"
                />
                {moodleError && (
                  <p role="alert" className="caption-1 text-status-high">
                    {moodleError}
                  </p>
                )}
                {moodleSuccess && <p className="caption-1 text-cat-medical">{moodleSuccess}</p>}
                <button
                  type="button"
                  onClick={() => void connectMoodle(moodleUrl)}
                  disabled={moodleConnecting || !moodleUrl.trim()}
                  className={cn(BUTTON_PRIMARY, "w-full")}
                >
                  <ArrowsClockwise className={cn("h-4 w-4", moodleConnecting && "animate-spin")} aria-hidden="true" />
                  Save feed
                </button>
              </div>
            </div>

            {/* Conflict summary card */}
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="title-2 text-black">Conflict radar</h2>
              {nextConflict ? (
                <div className="mt-3 rounded-lg border border-status-warn-border bg-status-warn-bg p-4">
                  <p className="caption-3 inline-flex items-center gap-2 text-status-warn">
                    <WarningCircle className="h-4 w-4" aria-hidden="true" />
                    Schedule conflict
                  </p>
                  <p className="caption-1 mt-1 text-[#666666]">
                    {nextConflict[1].length} deadlines on {format(new Date(`${nextConflict[0]}T12:00:00`), "EEEE d MMM")}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {nextConflict[1].map((t) => (
                      <li key={t.id} className="caption-4 truncate text-[#666666]">
                        {t.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="body-6 mt-2 text-[#666666]">No conflicts in your schedule right now.</p>
              )}
            </div>

            {/* Sync status card */}
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="title-2 text-black">Sync status</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-[#666666]">Gmail</dt>
                  <dd
                    className={cn(
                      "caption-1 inline-flex items-center gap-1.5",
                      connected || isDemo ? "text-cat-medical" : "text-status-high",
                    )}
                  >
                    {(connected || isDemo) && <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                    {isDemo ? "Simulated" : connected ? "Connected" : "Disconnected"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-[#666666]">Moodle</dt>
                  <dd className="caption-1 text-black">{moodleConnected ? `${moodleTasks.length} events` : "Not connected"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-[#666666]">Extractor</dt>
                  <dd className="caption-1 text-black">
                    {isDemo ? "Demo data" : engine === "gemini" ? "Gemini" : engine === "zai" ? "GLM" : engine === "rule" ? "Rule engine" : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-[#666666]">Last sync</dt>
                  <dd suppressHydrationWarning className="caption-1 font-mono text-black">
                    {lastSync ? format(lastSync, "HH:mm:ss") : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  disabled={syncing || (!isDemo && !connected)}
                  className={cn(BUTTON_PRIMARY, "w-full")}
                >
                  <ArrowsClockwise className={cn("h-4 w-4", syncing && "animate-spin")} aria-hidden="true" />
                  Sync now
                </button>
                {!isDemo && !connected && (
                  <a href="/api/auth/google" className={cn(BUTTON_SECONDARY, "w-full")}>
                    Reconnect Google
                  </a>
                )}
              </div>
            </div>

            {/* Privacy note */}
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="title-2 inline-flex items-center gap-2 text-black">
                <ShieldCheck className="h-4 w-4 text-cat-medical" aria-hidden="true" />
                Read only, zero storage
              </h2>
              <p className="body-6 mt-2 text-[#666666]">
                SyncMe uses gmail.readonly solely to extract student deadlines. Emails are fetched on demand and
                never stored or sold.{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-4 transition-colors duration-300 ease-base hover:text-black"
                >
                  Privacy policy
                </a>
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* ── Source drawer (per task) ─────────────────────────────────────────── */}
      <Sheet open={drawerTask !== null} onOpenChange={(open) => !open && setDrawerTask(null)}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "w-full gap-0 overflow-y-auto border-border bg-white p-6 shadow-sm scrollbar-slim sm:max-w-[480px]",
            isMobile && "max-h-[85dvh] rounded-t-2xl",
          )}
        >
          {drawerTask && (
            <>
              <SheetHeader className="p-0 text-left">
                <SheetTitle className="heading-5 text-black">{drawerTask.title}</SheetTitle>
                <SheetDescription className="caption-1 mt-1 text-[#666666]">
                  {drawerEmail ? `${drawerEmail.from} · ${formatTaskDue(drawerEmail.date)}` : drawerTask.sourceEmailSubject}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 rounded-lg bg-inset p-4">
                <p className="caption-4 text-[#666666]">Due date</p>
                <p className="caption-1 mt-0.5 font-mono text-black">{formatTaskDue(drawerTask.dueDate)}</p>
                <p className="caption-4 mt-3 text-[#666666]">Priority</p>
                <p className="mt-0.5">
                  <span className={cn("caption-3 inline-flex items-center gap-1 rounded-full px-2 py-1", drawerTask.priority === "High" ? "bg-status-high-bg text-status-high" : drawerTask.priority === "Medium" ? "bg-status-warn-bg text-status-warn" : "bg-status-low-bg text-status-low")}>
                    {drawerTask.priority}
                  </span>
                </p>
                <p className="caption-4 mt-3 text-[#666666]">Action summary</p>
                <p className="body-6 mt-0.5 text-black">{drawerTask.actionSummary}</p>
              </div>
              <div className="mt-4 rounded-lg bg-alt p-4">
                <p className="caption-4 text-[#666666]">Source email</p>
                <pre className="scrollbar-slim caption-1 mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[#666666]">
                  {drawerEmail ? drawerEmail.snippet : drawerTask.sourceEmailSubject}
                </pre>
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    const task = drawerTask;
                    setDrawerTask(null);
                    startComplete(task);
                  }}
                  className={cn(BUTTON_PRIMARY, "flex-1")}
                >
                  Mark done
                </button>
                <button type="button" onClick={() => setDrawerTask(null)} className={cn(BUTTON_SECONDARY, "flex-1")}>
                  Close
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Raw emails drawer ───────────────────────────────────────────────── */}
      <Sheet open={emailsOpen} onOpenChange={setEmailsOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "w-full gap-0 overflow-y-auto border-border bg-white p-6 shadow-sm scrollbar-slim sm:max-w-[480px]",
            isMobile && "max-h-[85dvh] rounded-t-2xl",
          )}
        >
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="heading-5 text-black">Raw emails</SheetTitle>
            <SheetDescription className="caption-1 mt-1 text-[#666666]">
              Last 30 days, academic, educational, immigration, health and professional mail only. Fetched live,
              never stored on servers.
            </SheetDescription>
          </SheetHeader>
          <div className="scrollbar-slim mt-6 space-y-3 overflow-y-auto pb-6">
            {emails.length === 0 && (
              <p className="caption-1 py-8 text-center text-[#666666]">
                No emails scanned yet — run a Gmail sync first.
              </p>
            )}
            {emails.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-white p-3">
                <p className="body-6 font-medium text-black">{e.subject}</p>
                <p className="caption-4 mt-1 truncate text-[#666666]">{e.from}</p>
                <p suppressHydrationWarning className="caption-4 font-mono text-[#666666]">
                  {formatTaskDue(e.date)}
                </p>
                <p className="caption-5 mt-2 line-clamp-3 text-[#666666]">{e.snippet}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <SiteFooter />
    </div>
  );
}
