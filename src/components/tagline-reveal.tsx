"use client";

import { useEffect, useRef } from "react";

const WORDS =
  "One quiet scan turns a chaotic student inbox into one sorted plan, and nothing at Debrecen slips past you again.".split(
    " ",
  );

/**
 * Mandatory tagline reveal (design skill B11): a large type moment, separate
 * from the hero. Words rest at ~30% opacity of the base text color and
 * activate to full color one at a time as they cross a trigger line, on the
 * base curve. Driven by IntersectionObserver per word; the base curve and
 * reduced-motion behavior live in the .word-reveal CSS (globals.css).
 */
export function TaglineReveal() {
  const containerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const words = container.querySelectorAll<HTMLElement>("[data-word]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-active", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      // Trigger line at 75% viewport height: words activate in reading order.
      { rootMargin: "0px 0px -25% 0px", threshold: 0.1 },
    );
    for (const w of words) observer.observe(w);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-label="SyncMe promise" className="px-4 py-16 sm:px-6 sm:py-24">
      <p ref={containerRef} className="heading-2 mx-auto max-w-[680px] text-black">
        {WORDS.map((word, i) => (
          <span key={`${word}-${i}`} data-word className="word-reveal">
            {word}
            {i < WORDS.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </section>
  );
}
