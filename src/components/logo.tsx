import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="h-4 w-4" fill="currentColor" />
      </span>
      <span className="text-base font-bold tracking-tight text-foreground">
        Sync<span className="text-primary">Me</span>
      </span>
    </span>
  );
}
