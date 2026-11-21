import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span aria-hidden="true" className="text-border">|</span>
          <span>© {new Date().getFullYear()} SyncMe</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Built for University of Debrecen students</span>
          <Link
            href="/privacy"
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
