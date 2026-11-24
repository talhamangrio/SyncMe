"use client";

import { Reveal } from "@/components/landing/reveal";

interface Step {
  num: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    num: "01",
    title: "Connect",
    text: "Sign in with Google (read only) and paste your Moodle .ics feed. It takes under a minute.",
  },
  {
    num: "02",
    title: "Sync",
    text: "SyncMe scans the last 30 days and checks again every 30 seconds while your dashboard is open.",
  },
  {
    num: "03",
    title: "Act",
    text: "Open your dashboard for sorted tasks, priorities, and conflict alerts. No typing, no missed email.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-label="How it works" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="heading-2 text-black">Three steps. Zero typing.</h2>
        </Reveal>
        <div className="relative mt-12">
          <div aria-hidden="true" className="absolute left-0 right-0 top-5 hidden h-px bg-border sm:block" />
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.1}>
                <div>
                  <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white font-mono caption-1 text-[#666666]">
                    {step.num}
                  </span>
                  <h3 className="title-1 mt-8 text-black">{step.title}</h3>
                  <p className="body-3 mt-2 text-[#666666]">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
