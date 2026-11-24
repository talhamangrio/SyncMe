import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchUniversityEmails,
  GmailAuthError,
  refreshAccessToken,
  sessionCookieOptions,
} from "@/lib/gmail";
import { dedupeTasks, extractTasks } from "@/lib/zai";
import { extractTasksGemini } from "@/lib/gemini";
import { dropExpiredTasks, normalizeDueDate, sortChronologically } from "@/lib/dates";
import { inferFutureDateFromText } from "@/lib/subject-date";
import { collapseDuplicateTasks } from "@/lib/task-dedupe";
import type { RawEmail, SyncTask } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Gemini (gemini-3.8-flash) is the PRIMARY classifier/extractor. When
 * GEMINI_API_KEY is missing or the call fails, extractTasksGemini returns
 * null and we silently fall back to the existing Z.ai GLM pipeline
 * (glm-4.5-flash → bundled SDK → deterministic rule engine).
 */
async function extractWithFallback(
  emails: RawEmail[],
): Promise<{ tasks: SyncTask[]; aiStatus: "ai" | "heuristic"; engine: "gemini" | "zai" | "rule" }> {
  const geminiTasks = await extractTasksGemini(emails).catch(() => null);
  if (geminiTasks) return { tasks: geminiTasks, aiStatus: "ai", engine: "gemini" };
  const { tasks, aiStatus } = await extractTasks(emails);
  return { tasks, aiStatus, engine: aiStatus === "ai" ? "zai" : "rule" };
}

/**
 * Subject-line rescue: the AI engines sometimes leave a task undated even
 * when the appointment/deadline day is stated right in the email SUBJECT
 * ("Appointment on 26 November 2025", "2025. november 26.", "26/11"). For
 * every undated task, scan the source subject + task title (+ the raw email
 * subject) with the deterministic date reader and fill in the earliest
 * future date found. Past-only mentions yield null, so an undated task is
 * never demoted into the expired bucket by a wrong guess.
 */
function rescueUndatedTasks(tasks: SyncTask[], emails: RawEmail[]): SyncTask[] {
  return tasks.map((t) => {
    if (t.dueDate !== "unknown") return t;
    const email = emails.find((e) => e.subject === t.sourceEmailSubject);
    const text = `${t.sourceEmailSubject}\n${t.title}${email ? `\n${email.subject}` : ""}`;
    const inferred = inferFutureDateFromText(text);
    return inferred ? { ...t, dueDate: inferred } : t;
  });
}

/**
 * GET /api/gmail/sync — fully stateless Gmail pipeline:
 *   1. read the OAuth access token from the httpOnly cookie,
 *   2. query Gmail for university email (last 30 days, max 12),
 *   3. extract strict-JSON tasks with Google Gemini (primary), silently
 *      falling back to Z.ai when Gemini is unavailable,
 *   4. deterministic post-processing on the server: normalize every dueDate
 *      into ISO-8601 `YYYY-MM-DDTHH:mm:ss` (Europe/Budapest), DROP any task
 *      dated strictly before today, dedupe and COLLAPSE duplicate twins (the
 *      extractor may emit both a dated subject-reading copy and an undated
 *      body copy of the same email), then sort strictly ascending
 *      chronological (`getTime() - getTime()` — earliest upcoming first),
 *   5. return { tasks, emails, aiStatus }.
 *
 * Nothing is persisted: emails live only for the duration of this request.
 * When the access token has expired but a refresh-token cookie is present,
 * the token is silently renewed (cookie updated on the response) and the
 * fetch is retried once — no re-consent needed until the refresh token dies.
 */
export async function GET() {
  const jar = await cookies();
  let token = jar.get("gmail_access_token")?.value;
  const refreshToken = jar.get("gmail_refresh_token")?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Gmail not connected" },
      { status: 401 },
    );
  }

  const attempt = async (accessToken: string) => {
    const emails = await fetchUniversityEmails(accessToken, 12);
    const { tasks, aiStatus, engine } = await extractWithFallback(emails);
    // Deterministic expiration guard + normalization + subject rescue + twin
    // collapse + strict chronological order — nothing dated before today
    // (Europe/Budapest) ever leaves here, undated tasks whose subject carries
    // a date are healed, and the same email can never yield two rows. Expired
    // tasks are dropped BEFORE the collapse so an expired wrong twin can never
    // swallow its correct future sibling.
    const dated: SyncTask[] = tasks.map((t) => ({ ...t, dueDate: normalizeDueDate(t.dueDate) }));
    const rescued = rescueUndatedTasks(dated, emails);
    const cleaned = sortChronologically(collapseDuplicateTasks(dropExpiredTasks(dedupeTasks(rescued))));
    return { emails, tasks: cleaned, aiStatus, engine };
  };

  try {
    const { emails, tasks, aiStatus, engine } = await attempt(token);
    return NextResponse.json({ ok: true, tasks, emails, aiStatus, engine });
  } catch (err) {
    if (!(err instanceof GmailAuthError)) {
      console.error("[SyncMe Gmail] sync failed:", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Gmail sync failed" },
        { status: 502 },
      );
    }
  }

  // Access token expired — try one silent refresh, then retry the sync.
  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, error: "Gmail session expired — please sign in again" },
      { status: 401 },
    );
  }

  try {
    token = await refreshAccessToken(refreshToken);
    const { emails, tasks, aiStatus, engine } = await attempt(token);
    const res = NextResponse.json({ ok: true, tasks, emails, aiStatus, engine });
    res.cookies.set("gmail_access_token", token, sessionCookieOptions(3500));
    return res;
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json(
        { ok: false, error: "Gmail session expired — please sign in again" },
        { status: 401 },
      );
    }
    console.error("[SyncMe Gmail] sync failed after refresh:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gmail sync failed" },
      { status: 502 },
    );
  }
}
