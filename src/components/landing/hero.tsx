"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap, Lock, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ConflictGroup, TaskCard } from "@/components/dashboard/task-card";
import { GoogleMark } from "@/components/landing/google-mark";
import { BASE_CURVE } from "@/components/landing/reveal";
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

const PROOF_ITEMS = [
  { icon: Lock, label: "Read only Gmail access" },
  { icon: ShieldCheck, label: "No emails stored on servers" },
  { icon: GraduationCap, label: "Works with @unideb.hu accounts" },
];

const PRIMARY_CTA =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 button-md text-white transition-colors duration-300 ease-base hover:bg-[#262626] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

const QUIET_LINK =
  "caption-1 text-[#666666] underline-offset-4 transition-colors duration-300 ease-base hover:text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

/** A card in the preview settles in 60ms after the previous one, once. */
function PreviewCard({ task, index, doneIds, onToggle }: { task: SyncTask; index: number; doneIds: Set<string>; onToggle: (id: string) => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: BASE_CURVE, delay: 0.3 + index * 0.06 }}
    >
      <TaskCard
        task={task}
        done={doneIds.has(task.id)}
        onToggleDone={(t) => onToggle(t.id)}
      />
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

  const [conflictA, conflictB, quiz, clinic] = HERO_TASKS;

  return (
    <section className="px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: BASE_CURVE }}
        className="mx-auto max-w-[680px] text-center"
      >
        <p className="caption-1 inline-flex items-center gap-2 text-[#666666]">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          Built for University of Debrecen students
        </p>
        <h1 className="heading-1 mt-4 bg-gradient-to-r from-black to-[#666666] bg-clip-text text-transparent">
          Your student admin,
          <br />
          on autopilot.
        </h1>
        <p className="title-1 mt-4 text-[#666666]">
          SyncMe reads your Gmail and Moodle calendar, finds every exam, quiz, appointment and deadline,
          and tells you what to do next. Sorted by priority and checked for conflicts.
        </p>

        {/* One primary action above the fold; the demo sandbox is a quiet link */}
        <div className="mt-8 flex flex-col items-center gap-3">
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
            Or explore the demo sandbox
          </a>
        </div>

        {authBanner ? (
          <p role="alert" className="mt-6 rounded-lg border border-status-high bg-status-high-bg px-4 py-3 body-6 text-status-high">
            {authBanner}
          </p>
        ) : null}

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {PROOF_ITEMS.map((item) => (
            <span key={item.label} className="caption-1 inline-flex items-center gap-1.5 text-[#666666]">
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </p>
      </motion.div>

      {/* Framed dashboard preview: real task cards, marked as demo data */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: BASE_CURVE, delay: 0.2 }}
        className="mx-auto mt-16 max-w-4xl rounded-2xl border border-border bg-alt p-2"
        aria-label="Demo dashboard preview"
      >
        <div className="rounded-lg border border-border bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between px-1 pb-3">
            <p className="title-3 text-black">Today</p>
            <span className="caption-4 rounded-full bg-inset px-2 py-1 text-[#666666]">Demo data</span>
          </div>
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: BASE_CURVE, delay: 0.3 }}
            >
              <ConflictGroup dateLabel={format(new Date("2026-12-09T17:00:00"), "EEEE d MMM")} count={2}>
                <TaskCard task={conflictA} compactRadius done={doneIds.has(conflictA.id)} onToggleDone={(t) => toggle(t.id)} />
                <TaskCard task={conflictB} compactRadius done={doneIds.has(conflictB.id)} onToggleDone={(t) => toggle(t.id)} />
              </ConflictGroup>
            </motion.div>
            <PreviewCard task={quiz} index={0} doneIds={doneIds} onToggle={toggle} />
            <PreviewCard task={clinic} index={1} doneIds={doneIds} onToggle={toggle} />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
