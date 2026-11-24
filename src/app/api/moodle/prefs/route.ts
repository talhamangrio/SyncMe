import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { GmailAuthError, refreshAccessToken, sessionCookieOptions } from "@/lib/gmail";
import { readAccountPrefs, writeAccountPrefs } from "@/lib/appdata";

export const dynamic = "force-dynamic";

const HTTPS_URL = /^https:\/\/\S+$/i;

/**
 * GET /api/moodle/prefs — reads the signed-in student's saved Moodle calendar
 * URL from their OWN Google Drive app-data folder (account-level: saved once
 * on any device, auto-connected on every device they sign in on).
 *
 * Responses never surface storage internals to the dashboard:
 *   { ok: true, icsUrl: string|null, synced: true }   — account storage worked
 *   { ok: true, icsUrl: null,         synced: false } — scope not granted yet
 *                                                       or Drive unavailable;
 *                                                       the client silently
 *                                                       falls back to its
 *                                                       per-browser copy.
 * 401 only when no Google session exists at all.
 */
export async function GET() {
  const jar = await cookies();
  let token = jar.get("gmail_access_token")?.value;
  const refreshToken = jar.get("gmail_refresh_token")?.value;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Google not connected" }, { status: 401 });
  }

  const attempt = async (accessToken: string) => readAccountPrefs(accessToken);

  try {
    let result = await attempt(token);
    if (result.status === "no-scope" && refreshToken) {
      // Token predates the drive.appdata scope — one silent refresh, one retry.
      token = await refreshAccessToken(refreshToken);
      result = await attempt(token);
      const res = NextResponse.json({ ok: true, icsUrl: result.prefs?.moodleIcsUrl ?? null, synced: result.status === "ok" });
      res.cookies.set("gmail_access_token", token, sessionCookieOptions(3500));
      return res;
    }
    return NextResponse.json({ ok: true, icsUrl: result.prefs?.moodleIcsUrl ?? null, synced: result.status === "ok" });
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ ok: true, icsUrl: null, synced: false });
    }
    console.error("[SyncMe AppData] prefs read failed:", err);
    return NextResponse.json({ ok: true, icsUrl: null, synced: false });
  }
}

/**
 * POST /api/moodle/prefs — saves (or updates) the Moodle calendar URL on the
 * student's Google account. Body: { icsUrl: string }. Best effort by design:
 * when account storage is unavailable the response reports synced:false and
 * the dashboard keeps the link in this browser as before.
 */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  let token = jar.get("gmail_access_token")?.value;
  const refreshToken = jar.get("gmail_refresh_token")?.value;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Google not connected" }, { status: 401 });
  }

  let icsUrl = "";
  try {
    const body = (await req.json()) as { icsUrl?: unknown };
    icsUrl = typeof body.icsUrl === "string" ? body.icsUrl.trim() : "";
  } catch {
    icsUrl = "";
  }
  if (!HTTPS_URL.test(icsUrl)) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid https:// .ics calendar URL" },
      { status: 400 },
    );
  }

  const attempt = async (accessToken: string) => writeAccountPrefs(accessToken, icsUrl);

  try {
    let result = await attempt(token);
    if (result.status === "no-scope" && refreshToken) {
      token = await refreshAccessToken(refreshToken);
      result = await attempt(token);
      const res = NextResponse.json({ ok: true, synced: result.status === "ok" });
      res.cookies.set("gmail_access_token", token, sessionCookieOptions(3500));
      return res;
    }
    return NextResponse.json({ ok: true, synced: result.status === "ok" });
  } catch (err) {
    if (err instanceof GmailAuthError) {
      return NextResponse.json({ ok: true, synced: false });
    }
    console.error("[SyncMe AppData] prefs write failed:", err);
    return NextResponse.json({ ok: true, synced: false });
  }
}
