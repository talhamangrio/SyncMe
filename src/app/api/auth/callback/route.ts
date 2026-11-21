import { NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode, fetchGoogleProfile, googleOAuthConfigured, resolveOrigin } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/callback — exchanges the authorization code with Google,
 * stores gmail_access_token in a short-lived httpOnly cookie (maxAge 3500)
 * plus the student's profile in a session cookie, then redirects to /dashboard.
 */
export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const failTo = (reason: string) =>
    NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(reason)}`);

  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) return failTo(oauthError);

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return failTo("missing_code");
  if (!googleOAuthConfigured()) return failTo("not_configured");

  try {
    // The redirect URI must be byte-identical to the one used in /api/auth/google.
    const redirectUri = `${origin}/api/auth/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleProfile(tokens.access_token);

    const res = NextResponse.redirect(`${origin}/dashboard`);
    const secure = origin.startsWith("https://");
    res.cookies.set("gmail_access_token", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 3500,
    });
    res.cookies.set("syncme_user", encodeURIComponent(JSON.stringify(profile)), {
      httpOnly: false,
      sameSite: "lax",
      secure,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[SyncMe OAuth] callback failed:", err);
    return failTo("token_exchange_failed");
  }
}
