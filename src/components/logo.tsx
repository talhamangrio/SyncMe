import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** SyncMe brand mark — clicking it always returns to the homepage. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="SyncMe home"
      className={cn(
        "inline-flex items-center gap-2 rounded-md transition-opacity duration-300 ease-base hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[0_4px_12px_-3px_rgba(37,120,191,0.55)]"
      >
        <Zap className="h-4 w-4" fill="currentColor" />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        Sync<span className="text-primary">Me</span>
      </span>
    </Link>
  );
}
