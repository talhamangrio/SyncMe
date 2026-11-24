"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  ArrowLeft,
  CheckCircle,
  Flask,
  List,
  ShieldCheck,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
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
import { CATEGORY_ICONS, ConflictGroup, DoneTaskRow, TaskCard, formatTaskDue } from "@/components/dashboard/task-card";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { BASE_CURVE } from "@/components/landing/reveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEMO_DONE, DEMO_DONE_TASKS, DEMO_EMAILS, DEMO_TASKS } from "@/lib/demo-data";
import { addDaysKey, budapestTodayKey, dayKeyOf, sortChronologically } from "@/lib/dates";
import type { GmailSyncResponse, MoodleSyncResponse, RawEmail, SyncMeUser, SyncTask, TaskCategory } from "@/lib/types";
import { CATEGORY_UI, TASK_CATEGORIES } from "@/lib/types";
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
/** Full completed task snapshots so the Done view can list and restore them. */
const DONE_TASKS_KEY = "syncme_done_tasks_v1";

/** Which list the main task area shows: the day-by-day schedule or completed tasks. */
type DashboardView = "upcoming" | "done";

/** A completed task snapshot plus the feed it came from (needed to restore it). */
interface DoneEntry {
  task: SyncTask;
  origin: "gmail" | "moodle";
}

/** One summary tile in the top grid; clickable tiles switch the list view. */
interface SummaryTile {
  label: string;
  value: number;
  icon: Icon | null;
  iconClass: string;
  onClick: (() => void) | null;
  selected: boolean;
  /** Small hint rendered under the value, e.g. "View done →". */
  hint: string | null;
}

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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 button-md btn-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50";
const BUTTON_SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 button-md text-ink btn-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50";

/** Skeleton shaped exactly like a real compact task row, slow opacity pulse. */
function TaskRowSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
      <span className="skeleton-soft h-5 w-5 shrink-0 rounded-full bg-alt" />
      <span className="skeleton-soft h-7 w-7 shrink-0 rounded-lg bg-alt" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="skeleton-soft block h-4 w-3/5 rounded bg-alt" />
        <span className="skeleton-soft block h-3 w-full rounded bg-alt" />
        <span className="skeleton-soft block h-3 w-28 rounded bg-alt sm:hidden" />
      </div>
      <span className="skeleton-soft hidden h-3 w-24 shrink-0 rounded bg-alt sm:block" />
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
      <TaskCard task={task} onOpen={onOpen} onToggleDone={onToggleDone} done={completing} showUrgency />
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
  const [doneTasks, setDoneTasks] = useState<Record<string, DoneEntry>>({});
  const [view, setView] = useState<DashboardView>("upcoming");
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
      setDoneTasks(
        Object.fromEntries(
          DEMO_DONE_TASKS.map(
            (t): [string, DoneEntry] => [t.id, { task: t, origin: t.source === "Moodle" ? "moodle" : "gmail" }],
          ),
        ),
      );
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
    const savedDoneTasks = loadJson<Record<string, DoneEntry>>(DONE_TASKS_KEY, {});
    // Keep only the last 30 days of completed snapshots — the Done list never piles up.
    const monthCutoff = Date.now() - 30 * 86_400_000;
    const liveDoneTasks: Record<string, DoneEntry> = {};
    for (const [id, entry] of Object.entries(savedDoneTasks)) {
      const at = mergedDoneAt[id];
      if (!at || Date.parse(at) > monthCutoff) liveDoneTasks[id] = entry;
    }
    setDoneTasks(liveDoneTasks);
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
  useEffect(() => {
    if (!isDemo) saveJson(DONE_TASKS_KEY, doneTasks);
  }, [doneTasks, isDemo]);

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
      setDoneTasks((prev) => ({ ...prev, [task.id]: { task, origin } }));
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

  /**
   * Restore a completed task: uncheck it from the Done view, drop it from the
   * done bookkeeping and slide it straight back into its chronological day
   * group on the feed it came from.
   */
  const restoreTask = useCallback((task: SyncTask, origin: "gmail" | "moodle") => {
    const nextDone = new Set(doneRef.current);
    nextDone.delete(task.id);
    doneRef.current = nextDone;
    setDoneIds(nextDone);
    setDoneAt((prev) => {
      const copy = { ...prev };
      delete copy[task.id];
      return copy;
    });
    setDoneTasks((prev) => {
      const copy = { ...prev };
      delete copy[task.id];
      return copy;
    });
    const restore = (prev: SyncTask[]) => sortChronologically([task, ...prev.filter((t) => t.id !== task.id)]);
    if (origin === "moodle") setMoodleTasks(restore);
    else setGmailTasks(restore);
    toast.success("Task restored to schedule");
  }, []);

  const undoDone = useCallback(() => {
    const entry = lastDoneRef.current;
    if (!entry) return;
    lastDoneRef.current = null;
    restoreTask(entry.task, entry.origin);
  }, [restoreTask]);

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
   * Strict day-by-day groups in ascending calendar order — no vague multi-day
   * buckets. Every date with tasks gets its own header: TODAY · Tue 24 Nov,
   * TOMORROW · Wed 25 Nov, then exact THU 26 NOV style headers. Past days
   * surface as OVERDUE · <date>; undated tasks sink into a trailing group.
   */
  const dateGroups = useMemo(() => {
    const tomorrowKey = addDaysKey(todayKey, 1);
    const byDay = new Map<string, SyncTask[]>();
    const undated: SyncTask[] = [];
    for (const t of filteredTasks) {
      const day = dayKeyOf(t.dueDate);
      if (day === null) {
        undated.push(t);
        continue;
      }
      const bucket = byDay.get(day);
      if (bucket) bucket.push(t);
      else byDay.set(day, [t]);
    }
    const groups: { key: string; day: string | null; label: string; items: SyncTask[] }[] = [];
    for (const day of [...byDay.keys()].sort((a, b) => a.localeCompare(b))) {
      const noon = new Date(`${day}T12:00:00`);
      let label: string;
      if (day < todayKey) label = `OVERDUE · ${format(noon, "EEE d MMM")}`;
      else if (day === todayKey) label = `TODAY · ${format(noon, "EEE d MMM")}`;
      else if (day === tomorrowKey) label = `TOMORROW · ${format(noon, "EEE d MMM")}`;
      else label = format(noon, "EEE d MMM").toUpperCase();
      groups.push({ key: day, day, label, items: sortChronologically(byDay.get(day) ?? []) });
    }
    if (undated.length > 0) {
      groups.push({ key: "undated", day: null, label: "NO DUE DATE", items: sortChronologically(undated) });
    }
    return groups;
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

  /** Completed task snapshots, most recently done first — powers the Done view. */
  const doneEntries = useMemo(() => {
    return Object.values(doneTasks)
      .map((entry) => ({ ...entry, at: doneAt[entry.task.id] ?? "" }))
      .sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  }, [doneTasks, doneAt]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([["All", allTasks.length]]);
    for (const c of TASK_CATEGORIES) counts.set(c, allTasks.filter((t) => t.category === c).length);
    return counts;
  }, [allTasks]);

  const showSkeletons = syncing && allTasks.length === 0 && view === "upcoming";
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const weekTotal = dueTodayCount + next7Count;

  /** Summary tiles — "Due today"/"Next 7 days" return to the schedule, "Done" opens the completed view. */
  const summaryTiles: SummaryTile[] = [
    {
      label: "Due today",
      value: dueTodayCount,
      icon: null,
      iconClass: "",
      onClick: () => setView("upcoming"),
      selected: false,
      hint: null,
    },
    {
      label: "Next 7 days",
      value: next7Count,
      icon: null,
      iconClass: "",
      onClick: () => setView("upcoming"),
      selected: false,
      hint: null,
    },
    {
      label: "Conflicts",
      value: conflictMap.size,
      icon: WarningCircle,
      iconClass: "text-status-warn",
      onClick: null,
      selected: false,
      hint: null,
    },
    {
      label: "Done this week",
      value: doneThisWeek,
      icon: CheckCircle,
      iconClass: "text-cat-medical",
      onClick: () => setView(view === "done" ? "upcoming" : "done"),
      selected: view === "done",
      hint: view === "done" ? "Viewing" : "View done →",
    },
  ];

  const FILTERS = useMemo(() => ["All", ...TASK_CATEGORIES] as const, []);

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

  /** Renders one day group's rows, wrapping same-day clusters in a conflict container. */
  const renderGroupItems = (group: { day: string | null; items: SyncTask[] }): React.ReactNode => {
    const { day, items } = group;
    const rows = items.map((t, j) => (
      <TaskRow
        key={t.id}
        task={t}
        index={j}
        completing={completingIds.has(t.id)}
        onOpen={setDrawerTask}
        onToggleDone={startComplete}
      />
    ));
    // Two or more deadlines sharing the day → wrap them in the amber conflict container.
    if (day !== null && items.length >= 2 && conflictMap.has(day)) {
      const label = format(new Date(`${day}T12:00:00`), "EEEE d MMM");
      return (
        <ConflictGroup key={day} dateLabel={label} count={items.length}>
          {rows}
        </ConflictGroup>
      );
    }
    return rows;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Floating dashboard navigation ──────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
        <div className="glass-nav mx-auto flex w-fit items-center gap-2 rounded-2xl border border-border py-1.5 pl-3 pr-2 shadow-sm">
          <Logo />
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <span className="caption-3 hidden rounded-full bg-brand px-2.5 py-1 text-white sm:inline-flex">Dashboard</span>
          <span
            suppressHydrationWarning
            className="caption-4 hidden min-[480px]:inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-ink-3"
          >
            <ArrowsClockwise className="h-3.5 w-3.5" aria-hidden="true" />
            {syncLabel}
          </span>
          {isDemo && (
            <span className="caption-4 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-ink-3">
              <Flask className="h-3.5 w-3.5" aria-hidden="true" />
              Demo
            </span>
          )}
          <button
            type="button"
            onClick={() => setEmailsOpen(true)}
            aria-label="Open raw emails"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 transition-colors duration-300 ease-base hover:bg-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98]"
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Avatar className="h-9 w-9 border border-border">
                  {user.picture ? <AvatarImage src={user.picture} alt={`${user.name}'s profile photo`} /> : null}
                  <AvatarFallback className="caption-3 bg-alt text-ink">{initialsOf(user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-border">
              <DropdownMenuLabel className="py-2">
                <span className="caption-3 block truncate text-ink">{user.name}</span>
                <span className="caption-4 block truncate text-ink-3">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()} className="caption-1 gap-2">
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
            <Flask className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            <p className="body-6 text-ink-3">
              <span className="font-semibold text-ink">Demo sandbox.</span> Simulated Debrecen inbox. No Gmail
              account is connected;{" "}
              <a
                href="/api/auth/google"
                className="font-medium text-brand underline underline-offset-4 transition-colors duration-300 ease-base hover:text-brand-deep"
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
          <h1 suppressHydrationWarning className="heading-5 text-ink">
            {greetingOf(new Date())}, {firstName}
          </h1>
          <p suppressHydrationWarning className="body-3 mt-1 text-ink-3">
            You have {weekTotal} task{weekTotal === 1 ? "" : "s"} due this week and {conflictMap.size} conflict
            {conflictMap.size === 1 ? "" : "s"}.
          </p>
        </header>

        {/* ── Summary tiles ────────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {summaryTiles.map((tile) => {
            const interactive = tile.onClick !== null;
            return (
              <div
                key={tile.label}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={tile.onClick ?? undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          tile.onClick?.();
                        }
                      }
                    : undefined
                }
                aria-pressed={interactive ? tile.selected : undefined}
                className={cn(
                  "rounded-2xl border bg-white p-4 text-left transition-[border-color,box-shadow] duration-200 ease-base",
                  tile.selected
                    ? "border-brand ring-2 ring-brand/20"
                    : interactive
                      ? "cursor-pointer border-border hover:border-brand hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      : "border-border",
                )}
              >
                <p className="caption-1 inline-flex items-center gap-1.5 text-ink-3">
                  {tile.icon && <tile.icon className={cn("h-4 w-4", tile.iconClass)} aria-hidden="true" />}
                  {tile.label}
                </p>
                <p suppressHydrationWarning className="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  {tile.value}
                </p>
                {tile.hint ? <p className="mt-1 text-xs font-medium leading-4 text-brand">{tile.hint}</p> : null}
              </div>
            );
          })}
        </div>

        {/* ── Main column + right rail ─────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {view === "upcoming" ? (
              <>
            {/* ── Segmented pill filter bar ─────────────────────────────────── */}
            <div
              role="group"
              aria-label="Filter tasks by category"
              className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-slim sm:mx-0 sm:px-0 sm:pb-0"
            >
              <div className="inline-flex max-w-full items-center gap-1 rounded-xl border border-border bg-alt p-1">
                {FILTERS.map((c) => {
                  const selected = filter === c;
                  const CatIcon = c === "All" ? null : CATEGORY_ICONS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFilter(c)}
                      aria-pressed={selected}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-200 ease-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        selected ? "bg-white text-ink shadow-xs ring-1 ring-line" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {CatIcon && <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                      {c}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-xs leading-4",
                          selected ? "bg-alt text-ink-3" : "bg-[#E2E8F0] text-ink-2",
                        )}
                      >
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
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <TaskRowSkeleton key={i} />
                  ))}
                </div>
              ) : dateGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-4 py-12 text-center">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-alt text-ink-3"
                  >
                    <CheckCircle className="h-6 w-6" />
                  </span>
                  <h2 className="title-1 text-ink">Nothing due this week</h2>
                  <p className="body-3 max-w-sm text-ink-3">
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
                      <div className="sticky top-[72px] z-20 -mx-4 mb-2 flex items-center justify-between gap-2 border-b border-border bg-page/85 px-4 pb-1.5 backdrop-blur-sm sm:-mx-6 sm:px-6">
                        <h3 className="text-xs font-semibold tracking-wider text-ink-3">{group.label}</h3>
                        <span className="rounded-full bg-alt px-2 py-0.5 text-xs leading-4 text-ink-3">
                          {group.items.length}
                        </span>
                      </div>
                      <ul className="space-y-2">{renderGroupItems(group)}</ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
              </>
            ) : (
              /* ── Completed tasks view (opened from the "Done this week" tile) ── */
              <section aria-label="Completed tasks" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4">
                  <h2 className="title-2 text-ink">
                    Completed tasks <span className="font-mono text-ink-3">({doneEntries.length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setView("upcoming")}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 button-md text-ink btn-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to upcoming
                  </button>
                </div>
                {doneEntries.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-4 py-12 text-center">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-alt text-ink-3"
                    >
                      <CheckCircle className="h-6 w-6" />
                    </span>
                    <h3 className="title-1 text-ink">No completed tasks yet</h3>
                    <p className="body-3 max-w-sm text-ink-3">
                      Check off a task and it will appear here — uncheck it any time to put it back on your schedule.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {doneEntries.map((entry, i) => (
                      <motion.li
                        key={entry.task.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{
                          duration: 0.4,
                          ease: BASE_CURVE,
                          delay: Math.min(i * 0.04, 0.25),
                        }}
                        className="list-none"
                      >
                        <DoneTaskRow
                          task={entry.task}
                          doneAtLabel={entry.at ? `Done ${format(Date.parse(entry.at), "EEE d MMM")}` : null}
                          onRestore={(task) => restoreTask(task, entry.origin)}
                          onOpen={setDrawerTask}
                        />
                      </motion.li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          {/* ── Right rail ─────────────────────────────────────────────────── */}
          <aside aria-label="Sync status and Moodle calendar" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {/* Moodle calendar card */}
            <div className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="title-2 text-ink">Moodle calendar</h2>
                <span
                  className={cn(
                    "caption-1 inline-flex items-center gap-1.5",
                    moodleConnected ? "text-cat-medical" : "text-ink-3",
                  )}
                >
                  {moodleConnected && <CheckCircle className="h-4 w-4" aria-hidden="true" />}
                  {moodleConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="body-6 mt-2 text-ink-3">
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
                  className="caption-1 rounded-lg border-border bg-alt px-3 py-2 text-ink placeholder:text-ink-3"
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
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="title-2 text-ink">Conflict radar</h2>
              {nextConflict ? (
                <div className="mt-3 rounded-xl border border-status-warn-border bg-status-warn-bg p-4">
                  <p className="caption-3 inline-flex items-center gap-2 text-status-warn">
                    <WarningCircle className="h-4 w-4" aria-hidden="true" />
                    Schedule conflict
                  </p>
                  <p className="caption-1 mt-1 text-ink-3">
                    {nextConflict[1].length} deadlines on {format(new Date(`${nextConflict[0]}T12:00:00`), "EEEE d MMM")}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {nextConflict[1].map((t) => (
                      <li key={t.id} className="caption-4 truncate text-ink-2">
                        {t.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="body-6 mt-2 text-ink-3">No conflicts in your schedule right now.</p>
              )}
            </div>

            {/* Sync status card */}
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="title-2 text-ink">Sync status</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-ink-3">Gmail</dt>
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
                  <dt className="caption-1 text-ink-3">Moodle</dt>
                  <dd className="caption-1 text-ink">{moodleConnected ? `${moodleTasks.length} events` : "Not connected"}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-ink-3">Extractor</dt>
                  <dd className="caption-1 text-ink">
                    {isDemo ? "Demo data" : engine === "gemini" ? "Gemini" : engine === "zai" ? "GLM" : engine === "rule" ? "Rule engine" : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="caption-1 text-ink-3">Last sync</dt>
                  <dd suppressHydrationWarning className="caption-1 font-mono text-ink">
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
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="title-2 inline-flex items-center gap-2 text-ink">
                <ShieldCheck className="h-4 w-4 text-cat-medical" aria-hidden="true" />
                Read only, zero storage
              </h2>
              <p className="body-6 mt-2 text-ink-3">
                SyncMe uses gmail.readonly solely to extract student deadlines. Emails are fetched on demand and
                never stored or sold.{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-4 transition-colors duration-300 ease-base hover:text-ink"
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
                <SheetTitle className="heading-5 text-ink">{drawerTask.title}</SheetTitle>
                <SheetDescription className="caption-1 mt-1 text-ink-3">
                  {drawerEmail ? `${drawerEmail.from} · ${formatTaskDue(drawerEmail.date)}` : drawerTask.sourceEmailSubject}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 rounded-xl bg-alt p-4">
                <p className="caption-4 text-ink-3">Due date</p>
                <p className="caption-1 mt-0.5 font-mono text-ink">{formatTaskDue(drawerTask.dueDate)}</p>
                <p className="caption-4 mt-3 text-ink-3">Category</p>
                <p className="mt-0.5">
                  <span
                    className={cn(
                      "caption-3 inline-flex items-center rounded-full px-2 py-1",
                      CATEGORY_UI[drawerTask.category].chip,
                    )}
                  >
                    {drawerTask.category}
                  </span>
                </p>
                <p className="caption-4 mt-3 text-ink-3">Action summary</p>
                <p className="body-6 mt-0.5 text-ink">{drawerTask.actionSummary}</p>
              </div>
              <div className="mt-4 rounded-xl bg-alt p-4">
                <p className="caption-4 text-ink-3">Source email</p>
                <pre className="scrollbar-slim caption-1 mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-ink-2">
                  {drawerEmail ? drawerEmail.snippet : drawerTask.sourceEmailSubject}
                </pre>
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                {doneIds.has(drawerTask.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const entry = doneTasks[drawerTask.id];
                      setDrawerTask(null);
                      restoreTask(drawerTask, entry?.origin ?? (drawerTask.source === "Moodle" ? "moodle" : "gmail"));
                    }}
                    className={cn(BUTTON_PRIMARY, "flex-1")}
                  >
                    Restore to schedule
                  </button>
                ) : (
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
                )}
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
            <SheetTitle className="heading-5 text-ink">Raw emails</SheetTitle>
            <SheetDescription className="caption-1 mt-1 text-ink-3">
              Last 30 days, academic, educational, immigration, health and professional mail only. Fetched live,
              never stored on servers.
            </SheetDescription>
          </SheetHeader>
          <div className="scrollbar-slim mt-6 space-y-3 overflow-y-auto pb-6">
            {emails.length === 0 && (
              <p className="caption-1 py-8 text-center text-ink-3">No emails scanned yet — run a Gmail sync first.</p>
            )}
            {emails.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-white p-3">
                <p className="body-6 font-medium text-ink">{e.subject}</p>
                <p className="caption-4 mt-1 truncate text-ink-3">{e.from}</p>
                <p suppressHydrationWarning className="caption-4 font-mono text-ink-3">
                  {formatTaskDue(e.date)}
                </p>
                <p className="caption-5 mt-2 line-clamp-3 text-ink-3">{e.snippet}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <SiteFooter />
    </div>
  );
}
