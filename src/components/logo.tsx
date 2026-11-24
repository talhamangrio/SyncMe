import Link from "next/link";
import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/** SyncMe brand mark — clicking it always returns to the homepage. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="SyncMe home"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg transition-opacity duration-300 ease-base hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
        className,
      )}
    >
      <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
        <Lightning weight="fill" className="h-4 w-4" />
      </span>
      <span className="title-3 tracking-tight text-black">
        Sync<span className="text-[#666666]">Me</span>
      </span>
    </Link>
  );
}
