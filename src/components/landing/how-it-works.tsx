"use client";

import { RiseLine, Reveal } from "@/components/landing/reveal";

interface Step {
  num: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    num: "01",
    title: "Connect",
    text: "Sign in with Google (read only) and paste your Moodle .ics feed. Under a minute.",
  },
  {
    num: "02",
    title: "Scan",
    text: "SyncMe scans your last 30 days and rechecks every 30 seconds while the dashboard is open.",
  },
  {
    num: "03",
    title: "Act",
    text: "Work a day-by-day list with conflict alerts. No typing, no missed email.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-label="How it works" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="heading-2 text-ink">
          <RiseLine mode="scroll">Three steps. Zero typing.</RiseLine>
        </h2>
        <div className="relative mt-12">
          <div aria-hidden="true" className="absolute left-0 right-0 top-5 hidden h-px bg-border sm:block" />
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.1}>
                <div>
                  <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white font-mono caption-1 text-ink-3">
                    {step.num}
                  </span>
                  <h3 className="title-1 mt-8 text-ink">{step.title}</h3>
                  <p className="body-3 mt-2 text-ink-3">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
