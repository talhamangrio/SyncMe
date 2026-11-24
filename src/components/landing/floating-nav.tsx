"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
  "inline-flex min-h-11 items-center rounded-lg px-3 button-sm text-[#666666] transition-colors duration-300 ease-base hover:bg-alt hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

const CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-3 button-sm text-white transition-colors duration-300 ease-base hover:bg-[#262626] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

/**
 * Floating compact navigation (skill B7): a bar sized to its content, 16px
 * off the top edge, translucent white with blur, rounded-2xl, shadow-sm.
 * Mobile: the toggle lines transform between hamburger and X and a full
 * height panel opens with staggered link entrances, 60ms apart, capped
 * at 400ms.
 */
export function FloatingNav({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex w-fit items-center gap-2 rounded-2xl border border-border bg-white/80 py-1.5 pl-3 pr-2 shadow-sm backdrop-blur-md">
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
          className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-300 ease-base hover:bg-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98] sm:hidden"
        >
          <span aria-hidden="true" className="relative flex h-5 w-5 items-center justify-center">
            <span
              className={cn(
                "absolute h-0.5 w-5 rounded-full bg-black transition-transform duration-500 ease-base",
                open ? "rotate-45" : "-translate-y-1",
              )}
            />
            <span
              className={cn(
                "absolute h-0.5 w-5 rounded-full bg-black transition-transform duration-500 ease-base",
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
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: BASE_CURVE }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-border py-4 title-1 text-black transition-colors duration-300 ease-base hover:text-[#666666] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: NAV_LINKS.length * 0.05, duration: 0.2, ease: BASE_CURVE }}
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
