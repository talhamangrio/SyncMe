"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, GraduationCap, Lock, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import { ConflictGroup, TaskCard } from "@/components/dashboard/task-card";
import { GoogleMark } from "@/components/landing/google-mark";
import { BASE_CURVE, RiseLine } from "@/components/landing/reveal";
import type { SyncTask } from "@/lib/types";

const HERO_TASKS: SyncTask[] = [
  {
    id: "hero-conflict-1",
    title: "Exam registration closes",
    category: "Neptun",
    dueDate: "2026-12-09T23:59:00",
    priority: "High",
    actionSummary: "Register for the Practical Biochemistry exam in Neptun before midnight.",
    sourceEmailSubject: "[Neptun] Exam registration closes soon",
    source: "Gmail",
  },
  {
    id: "hero-conflict-2",
    title: "Upload residence permit documents",
    category: "Immigration",
    dueDate: "2026-12-09T17:00:00",
    priority: "High",
    actionSummary: "Scan and upload your passport, TAJ card and accommodation certificate to the Enter Hungary portal.",
    sourceEmailSubject: "Enter Hungary: Upload residence permit documents",
    source: "Gmail",
  },
  {
    id: "hero-quiz",
    title: "Quiz 3 closes",
    category: "Moodle",
    dueDate: "2026-12-10T21:30:00",
    priority: "Medium",
    actionSummary: "Finish Quiz 3 on elearning.unideb.hu before it closes. One attempt, 30 minute limit.",
    sourceEmailSubject: "Moodle: Quiz 3 closes soon",
    source: "Moodle",
  },
  {
    id: "hero-clinic",
    title: "Cardiology follow up",
    category: "Medical",
    dueDate: "2026-12-12T09:15:00",
    priority: "Medium",
    actionSummary: "Attend the follow up at the Kenézy Campus. Bring your TAJ card and referral letter.",
    sourceEmailSubject: "Appointment confirmation: Cardiology follow up",
    source: "Gmail",
  },
];

const TRUST_ITEMS = [
  { icon: Lock, label: "Read only Gmail" },
  { icon: ShieldCheck, label: "Zero email storage" },
];

const PRIMARY_CTA =
  "btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 button-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const QUIET_LINK =
  "caption-1 text-ink-3 underline-offset-4 transition-colors duration-300 ease-base hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** A row in the preview settles in 60ms after the previous one, once. */
function PreviewRow({ index, children }: { index: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: BASE_CURVE, delay: 0.85 + index * 0.06 }}
    >
      {children}
    </motion.div>
  );
}

export function Hero({ signedIn = false, authBanner }: { signedIn?: boolean; authBanner?: string | null }) {
  // Interactive preview: the checkbox is real, cards stay in place.
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reduce = useReducedMotion();
  const [conflictA, conflictB, quiz, clinic] = HERO_TASKS;

  return (
    <section className="px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36">
      <div className="mx-auto max-w-[720px] text-center">
        {/* Eyebrow pill */}
        <motion.p
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: BASE_CURVE }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 caption-4 text-ink-2"
        >
          <GraduationCap className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          For University of Debrecen students
        </motion.p>

        <h1 className="mt-5 font-semibold tracking-tight text-ink text-[36px] leading-[1.12] sm:text-[48px] sm:leading-[1.08] md:text-[60px] md:leading-[1.06]">
          <RiseLine mode="load" delay={0.05}>Your student admin,</RiseLine>
          <RiseLine mode="load" delay={0.15}>
            <span className="text-gradient-brand">on autopilot.</span>
          </RiseLine>
        </h1>

        <p className="mt-5 text-base leading-6 text-ink-2 sm:text-lg sm:leading-7">
          <RiseLine mode="load" delay={0.25}>
            SyncMe scans Gmail and Moodle to turn buried exams, clinic visits, and deadlines into one
            conflict-checked plan.
          </RiseLine>
        </p>

        {/* One primary action above the fold; the demo sandbox is a quiet link */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: BASE_CURVE, delay: 0.5 }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          {signedIn ? (
            <Link href="/dashboard" className={PRIMARY_CTA}>
              Open my dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <a href="/api/auth/google" className={PRIMARY_CTA}>
              <GoogleMark className="h-5 w-5" />
              Sign in with Google
            </a>
          )}
          <a href="/api/demo/enter" className={QUIET_LINK}>
            Try the live demo sandbox
          </a>
        </motion.div>

        {authBanner ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-status-high bg-status-high-bg px-4 py-3 body-6 text-status-high"
          >
            {authBanner}
          </p>
        ) : null}

        {/* Trust line */}
        <motion.p
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: BASE_CURVE, delay: 0.56 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        >
          {TRUST_ITEMS.map((item) => (
            <span key={item.label} className="caption-1 inline-flex items-center gap-1.5 text-ink-3">
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </motion.p>
      </div>

      {/* Framed dashboard preview: real task cards, marked as demo data */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: BASE_CURVE, delay: 0.62 }}
        className="mx-auto mt-14 w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_48px_-24px_rgba(37,99,235,0.25)]"
        role="region"
        aria-label="Demo dashboard preview"
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-alt/60 px-4 py-3">
          <span aria-hidden="true" className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          </span>
          <span className="mx-auto rounded-md border border-border bg-white px-3 py-1 caption-4 text-ink-3">
            SyncMe dashboard
          </span>
        </div>

        {/* Preview body */}
        <div className="p-3 sm:p-5">
          <div className="flex items-center justify-between px-1 pb-3">
            <p className="title-4 text-ink">Today</p>
            <span className="caption-4 rounded-full bg-alt px-2 py-1 text-ink-3">Demo data</span>
          </div>
          <div className="space-y-2">
            <PreviewRow index={0}>
              <ConflictGroup dateLabel={format(new Date(conflictA.dueDate), "EEEE d MMM")} count={2}>
                <TaskCard task={conflictA} done={doneIds.has(conflictA.id)} onToggleDone={(t) => toggle(t.id)} />
                <TaskCard task={conflictB} done={doneIds.has(conflictB.id)} onToggleDone={(t) => toggle(t.id)} />
              </ConflictGroup>
            </PreviewRow>
            <PreviewRow index={1}>
              <TaskCard task={quiz} done={doneIds.has(quiz.id)} onToggleDone={(t) => toggle(t.id)} />
            </PreviewRow>
            <PreviewRow index={2}>
              <TaskCard task={clinic} done={doneIds.has(clinic.id)} onToggleDone={(t) => toggle(t.id)} />
            </PreviewRow>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
