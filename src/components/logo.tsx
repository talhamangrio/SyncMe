import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * SyncMe emblem: a rounded squircle filled with the cobalt-to-sky brand
 * gradient, holding a crisp white geometric sync monogram. Rendered inline
 * so it inherits size from the parent via className.
 */
export function SyncMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id="syncme-mark-gradient" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="0.55" stopColor="#0284C7" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#syncme-mark-gradient)" />
      <g stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" fill="none">
        <path d="M32 17 A15 15 0 0 1 47 32" />
        <path d="M32 47 A15 15 0 0 1 17 32" />
      </g>
      <path fill="#FFFFFF" d="M41.5 29.5 H52.5 L47 38 Z" />
      <path fill="#FFFFFF" d="M11.5 34.5 H22.5 L17 26 Z" />
    </svg>
  );
}

/** SyncMe brand lockup: luminous emblem plus the Sync / Me wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="SyncMe home"
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg transition-opacity duration-300 ease-base hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className,
      )}
    >
      <span aria-hidden="true" className="logo-halo flex h-7 w-7 shrink-0 items-center justify-center">
        <SyncMark className="h-7 w-7" />
      </span>
      <span className="title-3 font-semibold tracking-tight text-ink">
        Sync<span className="text-brand">Me</span>
      </span>
    </Link>
  );
}
