"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Skill B7 base curve: weighted, decelerating motion everywhere. */
export const BASE_CURVE = [0.22, 1, 0.36, 1] as const;

/**
 * Scroll reveal (skill B7): the section rises 32px and fades in over 600 to
 * 800ms on the base curve, once only. Triggered by Framer Motion's
 * whileInView (IntersectionObserver under the hood) — never a scroll
 * listener. Under prefers-reduced-motion, movement is replaced by a plain
 * opacity change.
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
