"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.18 7.07C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.86-3c-1.08.72-2.45 1.16-3.42 1.16-2.86 0-5.29-1.93-6.16-4.53l-3.66 2.84C3.99 20.53 7.7 23 12 23z"
      />
    </svg>
  );
}

const FEATURES = [
  {
    num: "01",
    icon: Mail,
    title: "Gmail, decoded",
    desc: "SyncMe watches your inbox with read-only Google access and spots Neptun, clinic, immigration and professor emails the moment they land.",
  },
  {
    num: "02",
    icon: CalendarDays,
    title: "Moodle .ics sync",
    desc: "Paste your private elearning.unideb.hu calendar feed once — every quiz and assignment deadline flows in automatically.",
  },
  {
    num: "03",
    icon: BrainCircuit,
    title: "AI extraction",
    desc: "GLM turns messy email threads into clean tasks: due date, priority and a one-line action summary you can actually follow.",
  },
  {
    num: "04",
    icon: TriangleAlert,
    title: "Conflict radar",
    desc: "When two deadlines collide on the same day, SyncMe flags it with a yellow alert before it burns you.",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Connect",
    desc: "Sign in with Google (read-only) and paste your Moodle .ics feed. Takes under a minute.",
  },
  {
    num: "2",
    title: "Sync",
    desc: "SyncMe scans the last 30 days and re-checks every 30 seconds while your dashboard is open.",
  },
  {
    num: "3",
    title: "Act",
    desc: "Open your dashboard: sorted tasks, priorities and conflict alerts — no typing, no missed email.",
  },
];

const AUTH_ERROR_LABELS: Record<string, string> = {
  access_denied: "You declined the Google consent screen. SyncMe needs read-only access to scan your inbox.",
  not_configured: "Google OAuth is not configured on this deployment yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  missing_code: "Google did not return an authorization code. Please try signing in again.",
  token_exchange_failed: "Could not exchange the authorization code with Google. Please try again.",
};

export function LandingClient({ authError }: { authError?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/privacy">Privacy</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href="/api/auth/google">
                <GoogleIcon />
                Sign in
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <GraduationCap className="h-3.5 w-3.5" />
            Built for University of Debrecen students
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            Your student admin,
            <br />
            <span className="text-primary">on autopilot.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            SyncMe reads your Gmail and Moodle calendar, extracts every exam, quiz, appointment and
            deadline, and tells you exactly what to do next — sorted, prioritized and conflict-checked.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 min-w-[230px] gap-2.5 text-sm font-semibold shadow-[0_8px_30px_rgba(255,201,60,0.22)]"
            >
              <a href="/api/auth/google">
                <GoogleIcon className="h-5 w-5" />
                Sign in with Google
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 min-w-[210px] gap-2.5 border-border bg-transparent text-sm font-semibold text-foreground hover:bg-secondary hover:text-foreground"
            >
              <a href="/api/demo/enter">
                <FlaskConical className="h-4 w-4 text-primary" />
                Try Demo Sandbox
              </a>
            </Button>
          </div>

          {authError && (
            <p
              role="alert"
              className="mx-auto mt-6 max-w-md rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-xs leading-relaxed text-rose-300"
            >
              {AUTH_ERROR_LABELS[authError] ?? "Sign-in failed. Please try again."}
            </p>
          )}

          <p className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-primary/70" /> Read-only Gmail access
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-primary/70" /> No emails stored on servers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-primary/70" /> Works with @unideb.hu accounts
            </span>
          </p>
        </motion.section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section aria-label="Features" className="border-t border-border/60 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">From inbox chaos to a plan.</h2>
              <span className="hidden text-xs uppercase tracking-[0.22em] text-muted-foreground/70 sm:block">
                What SyncMe does
              </span>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <motion.article
                  key={f.num}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <f.icon className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground/50">{f.num}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section
          aria-label="How it works"
          className="border-t border-border/60 px-4 py-16 sm:px-6"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three steps. Zero typing.</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="relative border-l border-border/70 pl-5"
                >
                  <span className="absolute -left-[9px] top-1 h-[17px] w-[17px] rounded-full border-2 border-primary bg-background" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Step {s.num}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
