"use client";

import type { ReactNode } from "react";
import { BookOpen, EnvelopeSimple, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MaskedLine, Reveal } from "@/components/landing/reveal";

interface Benefit {
  title: string;
  detail: string;
  icon: Icon;
  tintBg: string;
  tintText: string;
  fragment: ReactNode;
}

export function Benefits() {
  const BENEFITS: Benefit[] = [
    {
      title: "Catch every message that matters",
      detail: "Read only Google access surfaces Neptun, clinic, immigration and professor mail the moment it lands.",
      icon: EnvelopeSimple,
      tintBg: "bg-cat-neptun-bg",
      tintText: "text-cat-neptun",
      fragment: (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
          <span className="caption-3 rounded-full bg-cat-neptun-bg px-2 py-1 text-cat-neptun">Neptun</span>
          <span className="caption-4 truncate text-ink-3">Registration window closes</span>
          <span className="caption-4 ml-auto shrink-0 font-mono text-ink">Fri 18 Dec</span>
        </div>
      ),
    },
    {
      title: "Paste your Moodle link once",
      detail: "Add your private elearning.unideb.hu calendar feed one time and every quiz and assignment deadline flows in.",
      icon: BookOpen,
      tintBg: "bg-cat-moodle-bg",
      tintText: "text-cat-moodle",
      fragment: (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
          <span className="caption-3 rounded-full bg-cat-moodle-bg px-2 py-1 text-cat-moodle">Moodle</span>
          <span className="caption-4 truncate text-ink-3">Quiz 3 closes</span>
          <span className="caption-4 ml-auto shrink-0 font-mono text-ink">Fri 19 Dec, 23:59</span>
        </div>
      ),
    },
    {
      title: "Read less, act faster",
      detail: "Messy email threads become clean tasks with a due date, a priority, and a one line next step.",
      icon: Sparkle,
      tintBg: "bg-cat-medical-bg",
      tintText: "text-cat-medical",
      fragment: (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
          <span className="caption-3 inline-flex items-center gap-1 rounded-full bg-status-high-bg px-2 py-1 text-status-high">
            <WarningCircle className="h-3 w-3" aria-hidden="true" />
            High
          </span>
          <span className="caption-4 truncate text-ink-3">Upload scanned documents</span>
          <span className="caption-4 ml-auto shrink-0 font-mono text-ink">Mon 14 Dec, 17:00</span>
        </div>
      ),
    },
    {
      title: "See collisions before they happen",
      detail: "When two deadlines share a day, SyncMe flags the clash so you can reschedule early.",
      icon: WarningCircle,
      tintBg: "bg-status-warn-bg",
      tintText: "text-status-warn",
      fragment: (
        <div className="flex items-center gap-2 rounded-lg border border-status-warn-border bg-status-warn-bg px-3 py-2">
          <WarningCircle className="h-4 w-4 shrink-0 text-status-warn" aria-hidden="true" />
          <span className="caption-3 text-status-warn">Schedule conflict</span>
          <span className="caption-1 ml-auto shrink-0 text-ink-3">2 deadlines on Tue 9 Dec</span>
        </div>
      ),
    },
  ];

  return (
    <section aria-label="Benefits" className="bg-alt px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="heading-2 text-ink">
          <MaskedLine mode="scroll">From inbox chaos to a plan</MaskedLine>
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((benefit, i) => (
            <Reveal key={benefit.title} delay={i * 0.08} className="h-full">
              <article className="card-hover flex h-full flex-col rounded-2xl border border-border bg-white p-6">
                <span
                  aria-hidden="true"
                  className={cn("flex h-10 w-10 items-center justify-center rounded-full", benefit.tintBg)}
                >
                  <benefit.icon className={cn("h-5 w-5", benefit.tintText)} />
                </span>
                <h3 className="title-2 mt-4 text-ink">{benefit.title}</h3>
                <p className="body-6 mt-2 text-ink-3">{benefit.detail}</p>
                <div className="mt-auto pt-6">{benefit.fragment}</div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
