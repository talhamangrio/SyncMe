"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Base curve: weighted, decelerating motion used everywhere. */
export const BASE_CURVE = [0.22, 1, 0.36, 1] as const;

/**
 * Scroll reveal: the section rises 32px and fades in over 600 to 800ms on the
 * base curve, once only (IntersectionObserver under the hood). Under
 * prefers-reduced-motion, movement is replaced by a plain opacity change.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 32,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: reduce ? 0.3 : 0.75, ease: BASE_CURVE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Line reveal for headings: the line fades in and rises 14px on the base
 * curve. mode "load" plays on first render (hero); mode "scroll" plays once
 * when the line scrolls into view (section headings). Under
 * prefers-reduced-motion the line renders with a plain opacity change.
 *
 * Deliberately NOT an overflow-masked percentage transform: a masked
 * translateY("105%") reveal was leaving the headline permanently invisible
 * in some desktop browsers (composited clip never repainted). A pixel-based
 * rise always lands — the worst case is no animation, never missing text.
 */
export function RiseLine({
  children,
  className,
  delay = 0,
  mode = "load",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  mode?: "load" | "scroll";
}) {
  const reduce = useReducedMotion();
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 14 };
  const shown = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };
  const transition = { duration: reduce ? 0.3 : 0.6, ease: BASE_CURVE, delay };
  const motionProps =
    mode === "load"
      ? { initial: hidden, animate: shown, transition }
      : {
          initial: hidden,
          whileInView: shown,
          viewport: { once: true, margin: "0px 0px -10% 0px" },
          transition,
        };
  return (
    <span className="reveal-line">
      <motion.span className={cn("block", className)} {...motionProps}>
        {children}
      </motion.span>
    </span>
  );
}
