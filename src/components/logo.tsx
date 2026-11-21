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
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="h-4 w-4" fill="currentColor" />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        Sync<span className="text-primary">Me</span>
      </span>
    </Link>
  );
}
