import Link from "next/link";
import { Logo } from "@/components/logo";

/** Full width footer on the alternate surface, separated by a full width rule. */
export function SiteFooter() {
  const linkClass =
    "caption-4 text-ink-3 underline-offset-4 transition-colors duration-300 ease-base hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm";
  return (
    <footer className="mt-auto w-full border-t border-border bg-alt pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Logo />
          <span className="caption-4 text-ink-3">Built for University of Debrecen students</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span className="caption-4 text-ink-3">© 2026 SyncMe</span>
          <Link href="/privacy" className={linkClass}>
            Privacy policy
          </Link>
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
