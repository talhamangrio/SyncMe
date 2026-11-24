import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms — SyncMe",
  description: "The short, readable terms of using SyncMe as a University of Debrecen student.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms of use</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          SyncMe is a free tool built for University of Debrecen students. These terms are intentionally
          short and readable — the full data details live in the{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground">What SyncMe does</h2>
            <p className="mt-2 text-muted-foreground">
              SyncMe reads your Gmail (read-only) and the Moodle calendar feed you provide, extracts
              academic, educational, immigration, health and professional deadlines, and displays them as
              a sorted, conflict-checked list. It never sends, deletes, or modifies anything in your
              accounts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Your responsibility</h2>
            <p className="mt-2 text-muted-foreground">
              SyncMe is a helper, not an official university channel. Always verify critical deadlines
              (exams, residence permits, tuition payments) in Neptun, Moodle, or the official
              announcement before acting on them. SyncMe can miss things, and automated extraction can
              misread dates.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Your data</h2>
            <p className="mt-2 text-muted-foreground">
              Emails are fetched on demand and never stored on our servers. Your session lives in cookies
              on your device, and your Moodle feed URL stays in your own browser. Logging out removes
              every SyncMe cookie immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Availability</h2>
            <p className="mt-2 text-muted-foreground">
              The service is offered as is, with no uptime guarantee. If the AI extractor is unavailable,
              SyncMe falls back to simpler extraction methods so the dashboard keeps working.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Ending use</h2>
            <p className="mt-2 text-muted-foreground">
              Stop using SyncMe anytime by logging out and revoking the app in your Google account
              security settings. Nothing of yours remains on our side.
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-300 ease-base hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
