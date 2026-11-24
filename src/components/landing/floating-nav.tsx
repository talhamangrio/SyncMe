"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";
import { GoogleMark } from "@/components/landing/google-mark";
import { BASE_CURVE } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
];

const LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-lg px-3 button-sm text-ink-2 transition-colors duration-300 ease-base hover:bg-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const CTA_CLASS =
  "btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 button-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * Floating compact navigation: a bar sized to its content, 16px off the top
 * edge, translucent white glass with blur, rounded-2xl, shadow-sm. Mobile:
 * the toggle lines transform between hamburger and X and a full height panel
 * opens with staggered link entrances, 60ms apart.
 */
export function FloatingNav({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div className="glass-nav mx-auto flex w-fit items-center gap-2 rounded-2xl border border-border py-1.5 pl-3 pr-2 shadow-sm">
        <Logo />
        <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
        <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </nav>
        {signedIn ? (
          <Link href="/dashboard" className={cn(CTA_CLASS, "hidden sm:inline-flex")}>
            Open dashboard
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <a href="/api/auth/google" className={cn(CTA_CLASS, "hidden sm:inline-flex")}>
            <GoogleMark className="h-4 w-4" />
            Sign in
          </a>
        )}

        {/* Menu toggle: two lines transform between hamburger and X */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-300 ease-base hover:bg-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98] sm:hidden"
        >
          <span aria-hidden="true" className="relative flex h-5 w-5 items-center justify-center">
            <span
              className={cn(
                "absolute h-0.5 w-5 rounded-full bg-ink transition-transform duration-500 ease-base",
                open ? "rotate-45" : "-translate-y-1",
              )}
            />
            <span
              className={cn(
                "absolute h-0.5 w-5 rounded-full bg-ink transition-transform duration-500 ease-base",
                open ? "-rotate-45" : "translate-y-1",
              )}
            />
          </span>
        </button>
      </div>

      {/* Mobile menu: full height panel, high opacity surface, strong blur */}
      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: BASE_CURVE }}
            className="fixed inset-0 z-[-1] bg-white/95 backdrop-blur-xl sm:hidden"
          >
            <nav aria-label="Mobile navigation" className="flex min-h-full flex-col px-6 pb-16 pt-28">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.2, ease: BASE_CURVE }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-border py-4 title-1 text-ink transition-colors duration-300 ease-base hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ delay: NAV_LINKS.length * 0.06, duration: 0.2, ease: BASE_CURVE }}
                className="mt-8"
              >
                {signedIn ? (
                  <Link href="/dashboard" onClick={() => setOpen(false)} className={cn(CTA_CLASS, "w-full")}>
                    Open dashboard
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <a href="/api/auth/google" onClick={() => setOpen(false)} className={cn(CTA_CLASS, "w-full")}>
                    <GoogleMark className="h-4 w-4" />
                    Sign in with Google
                  </a>
                )}
              </motion.div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
