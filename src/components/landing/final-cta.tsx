"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GoogleMark } from "@/components/landing/google-mark";
import { Reveal } from "@/components/landing/reveal";

const PRIMARY =
  "btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 button-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const QUIET =
  "caption-1 text-ink-3 underline-offset-4 transition-colors duration-300 ease-base hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function FinalCta({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section aria-label="Get started" className="bg-white px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="mx-auto max-w-[680px] text-center">
        <h2 className="heading-2 text-ink">
          Your next deadline is <span className="text-gradient-brand">already in your inbox.</span>
        </h2>
        <p className="body-3 mt-4 text-ink-3">Connect once and never dig through university mail again.</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          {signedIn ? (
            <Link href="/dashboard" className={PRIMARY}>
              Open my dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <a href="/api/auth/google" className={PRIMARY}>
              <GoogleMark className="h-5 w-5" />
              Sign in with Google
            </a>
          )}
          <a href="/api/demo/enter" className={QUIET}>
            Try the live demo sandbox
          </a>
        </div>
        <p className="caption-1 mt-8 text-ink-3">Read only access. No emails stored on servers. Log out anytime.</p>
      </Reveal>
    </section>
  );
}
