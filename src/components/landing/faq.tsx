"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { FAQS } from "@/lib/faq-data";
import { cn } from "@/lib/utils";
import { BASE_CURVE, Reveal } from "@/components/landing/reveal";

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  const toggle = (i: number) => setOpen((cur) => (cur === i ? null : i));

  return (
    <section id="faq" aria-label="Frequently asked questions" className="scroll-mt-24 bg-alt px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <h2 className="heading-2 text-black">Questions students actually ask</h2>
        </Reveal>
        <div className="mt-12 space-y-4">
          {FAQS.map((faq, i) => (
            <Reveal key={faq.q} delay={i * 0.04}>
              <div className="rounded-2xl border border-border bg-white">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={open === i}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl p-6 text-left transition-colors duration-300 ease-base hover:bg-alt/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.99]"
                >
                  <span className="title-3 text-black">{faq.q}</span>
                  <CaretDown
                    aria-hidden="true"
                    className={cn(
                      "h-4 w-4 shrink-0 text-[#666666] transition-transform duration-500 ease-base",
                      open === i && "rotate-180"
                    )}
                  />
                </button>
                <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-trigger-${i}`} hidden={open !== i}>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={open === i ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                    transition={{ duration: 0.3, ease: BASE_CURVE }}
                    className="px-6 pb-6"
                  >
                    <p className="body-3 text-[#666666]">{faq.a}</p>
                  </motion.div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
