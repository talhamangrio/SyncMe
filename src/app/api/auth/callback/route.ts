import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleOAuthConfigured,
  resolveOrigin,
  sessionCookieOptions,
} from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/callback — exchanges the authorization code with Google and
 * keeps the entire session statelessly in HTTP-only cookies (Vercel serverless
 * functions have a read-only filesystem — nothing here touches a database,
 * filesystem or any persistent store):
 *
 *   gmail_access_token   — short-lived OAuth access token (~58 min)
 *   gmail_refresh_token  — long-lived refresh token (30 days, silent renew)
 *   syncme_user          — profile { name, email, picture } (server-read only)
 *
 * The whole handler — including origin resolution — is wrapped in try/catch,
 * so this route can never throw an unhandled 500: every failure redirects
 * cleanly to `/?error=oauth_failed&detail=...` and the exact Google error body
 * is logged for the serverless function logs.
 */
export async function GET(req: NextRequest) {
  let origin: string;
  try {
    origin = resolveOrigin(req);
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed&detail=origin", req.url));
  }

  const failTo = (detail: string) =>
    NextResponse.redirect(`${origin}/?error=oauth_failed&detail=${encodeURIComponent(detail)}`);

  try {
    const oauthError = req.nextUrl.searchParams.get("error");
    if (oauthError) {
      // Student declined consent or Google rejected the request.
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(oauthError)}`);
    }

    const code = req.nextUrl.searchParams.get("code");
    if (!code) return failTo("missing_code");
    if (!googleOAuthConfigured()) return failTo("not_configured");

    // Byte-identical redirect_uri computation with /api/auth/google.
    const redirectUri = `${origin}/api/auth/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleProfile(tokens.access_token);

    const res = NextResponse.redirect(`${origin}/dashboard`);
    res.cookies.set("gmail_access_token", tokens.access_token, sessionCookieOptions(3500));
    if (tokens.refresh_token) {
      res.cookies.set("gmail_refresh_token", tokens.refresh_token, sessionCookieOptions(30 * 24 * 3600));
    }
    res.cookies.set(
      "syncme_user",
      encodeURIComponent(JSON.stringify(profile)),
      sessionCookieOptions(30 * 24 * 3600),
    );
    return res;
  } catch (err) {
    // Log the exact failure (token exchange already logs Google's body) and
    // redirect cleanly — never an unhandled FUNCTION_INVOCATION_FAILED.
    console.error("[SyncMe OAuth] callback failed:", err);
    return failTo(err instanceof Error ? err.message.slice(0, 180) : "token_exchange_failed");
  }
}
