import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
          <Compass className="h-6 w-6 text-primary" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Error 404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">This page took a detour.</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            The page you are looking for does not exist or moved. Your deadlines, however, are exactly
            where you left them.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 min-w-[200px] gap-2 text-sm font-semibold">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </main>
    </div>
  );
}
