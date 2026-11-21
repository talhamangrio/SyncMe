import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchUniversityEmails, GmailAuthError } from "@/lib/gmail";
import { dedupeTasks, extractTasks } from "@/lib/zai";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/sync — reads the OAuth token from the httpOnly cookie,
 * queries Gmail for university email (last 30 days, max 12), sends the list
 * + current ISO date/time to Z.ai (glm-4.7-flash) for strict-JSON extraction,
 * and returns { tasks, emails }. Nothing is persisted: emails live only for
 * the duration of this request.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get("gmail_access_token")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Gmail not connected" }, { status: 401 });
  }

  try {
    const emails = await fetchUniversityEmails(token, 12);
    const { tasks, aiStatus } = await extractTasks(emails);
    return NextResponse.json({
      ok: true,
      tasks: dedupeTasks(tasks),
      emails,
      aiStatus,
    });
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json(
        { ok: false, error: "Gmail session expired — please sign in again" },
        { status: 401 },
      );
    }
    console.error("[SyncMe Gmail] sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gmail sync failed" },
      { status: 502 },
    );
  }
}
