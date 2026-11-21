"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleCheck,
  FlaskConical,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MailWarning,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { findConflicts } from "@/lib/conflicts";
import { DEMO_EMAILS, DEMO_TASKS } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import {
  CATEGORY_STYLES,
  PRIORITY_STYLES,
  TASK_CATEGORIES,
  type GmailSyncResponse,
  type MoodleSyncResponse,
  type RawEmail,
  type SyncMeUser,
  type SyncTask,
  type TaskCategory,
} from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;
const MOODLE_URL_KEY = "syncme_moodle_ics_url";
/** Browser-side persistence: synced tasks survive reloads and later syncs — nothing fades away. */
const GMAIL_TASKS_KEY = "syncme_gmail_tasks_v1";
const MOODLE_TASKS_KEY = "syncme_moodle_tasks_v1";
const EMAILS_KEY = "syncme_emails_v1";
const DONE_KEY = "syncme_done_v1";

/** Marks the user as handled — SyncMe skips these emails forever after. */
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

/**
 * Union merge: fresh tasks overwrite their previous version, tasks that were
 * extracted earlier are kept even if this sync missed them, and done tasks
 * never come back. Stale entries (due more than 14 days ago) are pruned.
 */
function mergeTasks(prev: SyncTask[], next: SyncTask[], done: Set<string>): SyncTask[] {
  const byId = new Map<string, SyncTask>();
  for (const t of prev) if (!done.has(t.id)) byId.set(t.id, t);
  for (const t of next) if (!done.has(t.id)) byId.set(t.id, t);
  const now = Date.now();
  return [...byId.values()]
    .filter((t) => {
      const due = Date.parse(t.dueDate);
      return Number.isNaN(due) || due > now - 14 * 86_400_000;
    })
    .slice(0, 80);
}

function mergeEmails(prev: RawEmail[], next: RawEmail[]): RawEmail[] {
  const byId = new Map<string, RawEmail>();
  for (const e of prev) byId.set(e.id, e);
  for (const e of next) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 50);
}

function formatDue(dueDate: string): string {
  if (dueDate === "unknown") return "No date detected";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "No date detected";
  return format(d, "EEE, d MMM · HH:mm");
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return chars.slice(0, 2) || "S";
}

function TaskCard({
  task,
  index,
  onDone,
}: {
  task: SyncTask;
  index: number;
  onDone: (task: SyncTask) => void;
}) {
  const cat = CATEGORY_STYLES[task.category];
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.04, 0.32) }}
      className="h-full"
    >
      <Card className="flex h-full flex-col border-border/80 bg-card transition-colors duration-300 ease-base hover:border-primary/40">
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                cat.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", cat.dot)} />
              {task.category}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                PRIORITY_STYLES[task.priority],
              )}
            >
              {task.priority}
            </span>
            <button
              type="button"
              onClick={() => onDone(task)}
              aria-label={`Mark "${task.title}" as done`}
              title="Mark as done — SyncMe will skip this email from now on"
              className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors duration-300 ease-base hover:border-emerald-400/40 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
            >
              <CircleCheck className="h-3.5 w-3.5" />
              Done
            </button>
          </div>
          <h3 className="text-sm font-semibold leading-snug text-foreground">{task.title}</h3>
          <p suppressHydrationWarning className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
            {formatDue(task.dueDate)}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{task.actionSummary}</p>
          <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground/70">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="w-0 flex-1 truncate">{task.sourceEmailSubject}</span>
          </p>
        </CardContent>
      </Card>
    </motion.article>
  );
}

export function DashboardClient({ user, isDemo }: { user: SyncMeUser; isDemo: boolean }) {
  const [gmailTasks, setGmailTasks] = useState<SyncTask[]>(isDemo ? DEMO_TASKS : []);
  const [moodleTasks, setMoodleTasks] = useState<SyncTask[]>([]);
  const [emails, setEmails] = useState<RawEmail[]>(isDemo ? DEMO_EMAILS : []);
  const [syncing, setSyncing] = useState(!isDemo);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [connected, setConnected] = useState(true);
  const [aiStatus, setAiStatus] = useState<"ai" | "heuristic" | null>(null);
  const [engine, setEngine] = useState<"gemini" | "zai" | "rule" | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [moodleConnected, setMoodleConnected] = useState(false);
  const [filter, setFilter] = useState<"All" | TaskCategory>("All");
  const [moodleOpen, setMoodleOpen] = useState(false);
  const [moodleUrl, setMoodleUrl] = useState("");
  const [moodleConnecting, setMoodleConnecting] = useState(false);

  /** Ref mirror of doneIds so the 30s polling merge never resurrects done tasks. */
  const doneRef = useRef<Set<string>>(new Set());

  // ── Restore the persisted session state before the first sync fires ───────
  useEffect(() => {
    if (isDemo) return;
    const savedTasks = loadJson<SyncTask[]>(GMAIL_TASKS_KEY, []);
    const savedMoodle = loadJson<SyncTask[]>(MOODLE_TASKS_KEY, []);
    const savedEmails = loadJson<RawEmail[]>(EMAILS_KEY, []);
    const savedDone = loadJson<string[]>(DONE_KEY, []);
    doneRef.current = new Set(savedDone);
    setDoneIds(new Set(savedDone));
    setGmailTasks((prev) => (prev.length === 0 ? savedTasks : prev));
    setMoodleTasks((prev) => (prev.length === 0 ? savedMoodle : prev));
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
            toast.error("Sync failed", { description: data.error ?? `HTTP ${res.status}` });
          }
          return;
        }
        // Merge instead of replace: previously synced tasks never fade away.
        setGmailTasks((prev) => mergeTasks(prev, data.tasks, doneRef.current));
        setEmails((prev) => mergeEmails(prev, data.emails));
        setAiStatus(data.aiStatus);
        setEngine(data.engine ?? null);
        setConnected(true);
        setLastSync(new Date());
        if (!silent) {
          toast.success(
            `${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"} extracted`,
            {
              description:
                data.aiStatus === "heuristic"
                  ? "AI was unavailable — used the rule-based extractor."
                  : `${data.engine === "gemini" ? "Gemini" : "GLM"} scanned ${data.emails.length} university email${data.emails.length === 1 ? "" : "s"} (last 30 days).`,
            },
          );
        }
      } catch (err) {
        if (!silent) toast.error("Sync failed", { description: String(err) });
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

  // ── Moodle .ics connect ────────────────────────────────────────────────────
  const connectMoodle = useCallback(
    async (url: string, silent = false) => {
      if (!/^https?:\/\/.+/i.test(url)) {
        if (!silent) toast.error("Invalid calendar URL", { description: "Paste a full http(s) .ics export URL." });
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
          if (!silent) toast.error("Moodle sync failed", { description: data.error ?? `HTTP ${res.status}` });
          return;
        }
        setMoodleTasks((prev) => mergeTasks(prev, data.tasks, doneRef.current));
        setMoodleConnected(true);
        window.localStorage.setItem(MOODLE_URL_KEY, url);
        if (!silent) {
          toast.success(`${data.tasks.length} Moodle event${data.tasks.length === 1 ? "" : "s"} imported`, {
            description: "Deadlines from your e-learning calendar now appear alongside Gmail tasks.",
          });
          setMoodleOpen(false);
        }
      } catch (err) {
        if (!silent) toast.error("Moodle sync failed", { description: String(err) });
      } finally {
        setMoodleConnecting(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isDemo) return;
    const saved = window.localStorage.getItem(MOODLE_URL_KEY);
    if (saved) {
      setMoodleUrl(saved);
      void connectMoodle(saved, true);
    }
  }, [isDemo, connectMoodle]);

  /** Mark as done: hidden now, skipped by every future sync, remembered forever. */
  const markTaskDone = useCallback((task: SyncTask) => {
    const next = new Set(doneRef.current);
    next.add(task.id);
    doneRef.current = next;
    setDoneIds(next);
    setGmailTasks((prev) => prev.filter((t) => t.id !== task.id));
    setMoodleTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.success("Marked as done", {
      description: `SyncMe will skip "${task.title}" from now on.`,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const allTasks = useMemo(() => {
    const merged = [...gmailTasks, ...moodleTasks];
    return [...merged].sort((a, b) => {
      const ta = Date.parse(a.dueDate);
      const tb = Date.parse(b.dueDate);
      const va = Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
      const vb = Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
      return va - vb;
    });
  }, [gmailTasks, moodleTasks]);

  const filteredTasks = useMemo(
    () => (filter === "All" ? allTasks : allTasks.filter((t) => t.category === filter)),
    [allTasks, filter],
  );

  const conflicts = useMemo(() => findConflicts(allTasks), [allTasks]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<"All" | TaskCategory, number>([["All", allTasks.length]]);
    for (const c of TASK_CATEGORIES) counts.set(c, allTasks.filter((t) => t.category === c).length);
    return counts;
  }, [allTasks]);

  const showSkeletons = syncing && allTasks.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            {isDemo && (
              <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/10 text-primary">
                <FlaskConical className="h-3 w-3" />
                Demo
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {user.picture ? <AvatarImage src={user.picture} alt={`${user.name}'s profile photo`} /> : null}
                <AvatarFallback className="bg-secondary text-xs font-semibold">
                  {initialsOf(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-xs font-semibold leading-tight text-foreground">{user.name}</p>
                <p className="truncate text-xs leading-tight text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void logout()} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-14 pt-6 sm:px-6">
        {/* ── Demo banner ──────────────────────────────────────────────────── */}
        {isDemo && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.07] px-4 py-3 text-sm">
            <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <strong className="font-semibold text-primary">Demo Sandbox</strong> — simulated Debrecen
              inbox. No Gmail account is connected;{" "}
              <a href="/api/auth/google" className="text-primary underline underline-offset-4">
                connect real Gmail
              </a>{" "}
              to run the live pipeline.
            </p>
          </div>
        )}

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void syncNow()}
            disabled={syncing || (!isDemo && !connected)}
            className="gap-2 font-semibold"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Gmail Now
          </Button>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span
              suppressHydrationWarning
              className={cn(
                "h-2 w-2 rounded-full",
                isDemo ? "bg-primary live-dot" : connected ? "bg-emerald-400 live-dot" : "bg-zinc-500",
              )}
            />
            {isDemo ? "Demo mode" : connected ? "Gmail connected" : "Gmail disconnected"}
            {lastSync && (
              <span suppressHydrationWarning className="text-muted-foreground/60">
                · synced {format(lastSync, "HH:mm:ss")}
              </span>
            )}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MailWarning className="h-3.5 w-3.5" />
                  Raw emails ({emails.length})
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full border-border bg-card sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Raw emails</SheetTitle>
                  <SheetDescription>
                    Last 30 days, academic, educational, immigration, health and professional mail only.
                    Emails you already answered are skipped. Fetched live, never stored on servers.
                  </SheetDescription>
                </SheetHeader>
                <div className="scrollbar-slim max-h-[calc(100vh-10rem)] space-y-3 overflow-y-auto px-4 pb-6">
                  {emails.length === 0 && (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No emails scanned yet — run a Gmail sync first.
                    </p>
                  )}
                  {emails.map((e) => (
                    <div key={e.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                      <p className="text-xs font-semibold leading-snug text-foreground">{e.subject}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{e.from}</p>
                      <p suppressHydrationWarning className="text-xs text-muted-foreground/70">
                        {formatDue(e.date)}
                      </p>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {e.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            <Dialog open={moodleOpen} onOpenChange={setMoodleOpen}>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMoodleOpen(true)}>
                {moodleConnected ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <CalendarPlus className="h-3.5 w-3.5" />
                )}
                {moodleConnected ? "Moodle connected" : "Connect Moodle .ics"}
              </Button>
              <DialogContent className="border-border bg-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Connect Moodle calendar</DialogTitle>
                  <DialogDescription>
                    On elearning.unideb.hu go to Calendar → Export → Private address (.ics) and paste the
                    URL here. It is stored only in this browser.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={moodleUrl}
                  onChange={(e) => setMoodleUrl(e.target.value)}
                  placeholder="https://elearning.unideb.hu/calendar/export.php?..."
                  className="border-input bg-background text-sm"
                  aria-label="Moodle .ics calendar URL"
                />
                <DialogFooter>
                  <Button
                    onClick={() => void connectMoodle(moodleUrl)}
                    disabled={moodleConnecting || !moodleUrl.trim()}
                    className="gap-2 font-semibold"
                  >
                    {moodleConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Connect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Conflict radar ───────────────────────────────────────────────── */}
        {conflicts.length > 0 && (
          <div className="mt-5 space-y-2" role="alert" aria-label="Deadline conflicts">
            {conflicts.map((c) => (
              <div
                key={c.dateKey}
                className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/[0.07] px-4 py-3"
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary live-dot" />
                <div className="text-sm leading-relaxed">
                  <span className="font-semibold text-primary">
                    {c.tasks.length} deadlines collide on {c.dateLabel}.
                  </span>{" "}
                  <span className="text-muted-foreground">{c.tasks.map((t) => t.title).join(" · ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Category filter chips ────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter tasks by category">
          {(["All", ...TASK_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              aria-pressed={filter === c}
              className={cn(
                "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-300 ease-base",
                filter === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c}
              <span className={cn("ml-1.5", filter === c ? "text-primary-foreground/70" : "text-muted-foreground/60")}>
                {categoryCounts.get(c) ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tasks + sidebar ──────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section aria-label="Extracted tasks">
            {showSkeletons ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-2xl bg-card" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card className="border-dashed border-border">
                <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">
                    {connected || isDemo ? "No deadlines detected yet" : "Gmail not connected"}
                  </p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {connected || isDemo
                      ? "Hit “Sync Gmail Now” — SyncMe scans your last 30 days of university email and pulls out exams, quizzes, appointments and immigration letters. Tasks stay on this dashboard between syncs."
                      : "Reconnect your Google account to start scanning your inbox for deadlines again. No consent screen needed."}
                  </p>
                  {!connected && !isDemo && (
                    <Button asChild className="mt-1 gap-2 font-semibold">
                      <a href="/api/auth/google">Reconnect Gmail</a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredTasks.map((t, i) => (
                  <TaskCard key={t.id} task={t} index={i} onDone={markTaskDone} />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4" aria-label="Sync status">
            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Sync status</CardTitle>
                <CardDescription className="text-xs">Auto-refreshes every 30 seconds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gmail</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium",
                      connected || isDemo ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {(connected || isDemo) && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {isDemo ? "Simulated" : connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                {!isDemo && (
                  <p className="truncate text-xs text-muted-foreground/70" title={user.email}>
                    {user.email}
                  </p>
                )}
                {!isDemo && !connected && (
                  <Button asChild size="sm" className="w-full gap-1.5 font-semibold">
                    <a href="/api/auth/google">Reconnect Gmail</a>
                  </Button>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Moodle</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium",
                      moodleConnected ? "text-emerald-300" : "text-muted-foreground",
                    )}
                  >
                    {moodleConnected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {moodleConnected ? `Connected · ${moodleTasks.length} events` : "Not connected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Extractor</span>
                  <span className="font-medium text-foreground">
                    {isDemo
                      ? "Demo data"
                      : engine === "gemini"
                        ? "Gemini"
                        : engine === "zai"
                          ? "GLM"
                          : engine === "rule"
                            ? "Rule engine"
                            : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last sync</span>
                  <span suppressHydrationWarning className="font-medium text-foreground">
                    {lastSync ? format(lastSync, "HH:mm:ss") : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Moodle feed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="break-all text-muted-foreground">
                  {moodleConnected
                    ? "Connected via your private .ics URL (stored in this browser only)."
                    : "Paste your elearning.unideb.hu private .ics export URL to pull quiz and assignment deadlines."}
                </p>
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setMoodleOpen(true)}>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {moodleConnected ? "Update feed URL" : "Connect .ics feed"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Read-only &amp; zero storage
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs leading-relaxed text-muted-foreground">
                SyncMe uses <code className="text-foreground">gmail.readonly</code> solely to extract student
                deadlines. Emails are fetched on demand and never stored or sold.{" "}
                <a href="/privacy" className="text-primary underline underline-offset-4">
                  Privacy Policy
                </a>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
