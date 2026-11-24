import { NextResponse, type NextRequest } from "next/server";
import { fetchIcsFeed } from "@/lib/ics";
import { dropExpiredTasks, sortChronologically, toBudapestIso } from "@/lib/dates";
import { collapseDuplicateTasks } from "@/lib/task-dedupe";
import type { MoodleSyncResponse, SyncTask, TaskPriority } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/moodle/sync — accepts { icsUrl: string }, fetches the Moodle .ics
 * feed server-side, parses VEVENT blocks (SUMMARY, DTSTART, DTEND, DESCRIPTION)
 * and returns normalized Moodle tasks in the SyncMe JSON schema. Every dueDate
 * is normalized to ISO-8601 `YYYY-MM-DDTHH:mm:ss` (Europe/Budapest), events
 * dated strictly before today are deterministically dropped, and the list is
 * sorted strictly ascending chronological (earliest upcoming first).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { icsUrl?: unknown };
    const icsUrl = typeof body.icsUrl === "string" ? body.icsUrl.trim() : "";
    if (!/^https?:\/\/.+/i.test(icsUrl)) {
      return NextResponse.json(
        { ok: false, error: "Please provide a valid http(s) .ics calendar URL" },
        { status: 400 },
      );
    }

    const events = await fetchIcsFeed(icsUrl);
    const now = new Date();

    const candidates: SyncTask[] = events
      .filter((e) => e.start !== null)
      .map((e, i) => {
        const start = e.start as Date;
        const hoursUntil = (start.getTime() - now.getTime()) / 3_600_000;
        const priority: TaskPriority =
          hoursUntil < 0 ? "Low" : hoursUntil <= 72 ? "High" : hoursUntil <= 24 * 7 ? "Medium" : "Low";
        return {
          id: `moodle-${e.uid}-${i}`,
          title: e.summary,
          category: "Moodle" as const,
          dueDate: toBudapestIso(start),
          priority,
          actionSummary: e.description
            ? e.description.slice(0, 200)
            : `Moodle calendar event: ${e.summary}`,
          sourceEmailSubject: "Moodle .ics calendar feed",
        };
      });

    // Deterministic expiration guard: drop every event whose day is strictly
    // earlier than today (Europe/Budapest), collapse duplicate events (some
    // Moodle feeds repeat the same VEVENT across export ranges), then sort
    // earliest-first.
    const tasks = sortChronologically(collapseDuplicateTasks(dropExpiredTasks(candidates, now))).slice(0, 25);

    return NextResponse.json({ ok: true, tasks } satisfies MoodleSyncResponse);
  } catch (err) {
    console.error("[SyncMe Moodle] sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Moodle sync failed" },
      { status: 502 },
    );
  }
}
