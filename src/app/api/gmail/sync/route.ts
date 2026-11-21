import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchUniversityEmails,
  GmailAuthError,
  refreshAccessToken,
  sessionCookieOptions,
} from "@/lib/gmail";
import { dedupeTasks, extractTasks } from "@/lib/zai";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/sync — fully stateless Gmail pipeline:
 *   1. read the OAuth access token from the httpOnly cookie,
 *   2. query Gmail for university email (last 30 days, max 12),
 *   3. send the list + current ISO date/time to Z.ai (glm-4.7-flash) for
 *      strict-JSON extraction,
 *   4. return { tasks, emails, aiStatus }.
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
    const { tasks, aiStatus } = await extractTasks(emails);
    return { emails, tasks: dedupeTasks(tasks), aiStatus };
  };

  try {
    const { emails, tasks, aiStatus } = await attempt(token);
    return NextResponse.json({ ok: true, tasks, emails, aiStatus });
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
    const { emails, tasks, aiStatus } = await attempt(token);
    const res = NextResponse.json({ ok: true, tasks, emails, aiStatus });
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
