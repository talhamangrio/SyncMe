import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";

/** Branded light 404 — wordmark, a way back, no dead ends. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
        <Logo />
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-alt text-ink-3"
        >
          <Compass className="h-5 w-5" />
        </span>
        <div className="max-w-md">
          <h1 className="heading-3 text-ink">This page took a detour.</h1>
          <p className="body-3 mt-4 text-ink-3">
            The page you are looking for does not exist or moved. Your deadlines, however, are exactly
            where you left them.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 button-md btn-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
