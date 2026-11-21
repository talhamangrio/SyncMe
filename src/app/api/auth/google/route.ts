import { NextResponse, type NextRequest } from "next/server";
import { buildGoogleAuthUrl, googleOAuthConfigured, resolveOrigin } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google — starts the Google OAuth 2.0 consent flow with
 * openid email profile + gmail.readonly (access_type=offline so a refresh
 * token is issued), redirecting back to ${origin}/api/auth/callback.
 *
 * The whole handler is wrapped in try/catch: this route can never surface an
 * unhandled 500 to Vercel — every failure is a clean redirect back to the
 * landing page with an error parameter.
 */
export async function GET(req: NextRequest) {
  let origin: string;
  try {
    origin = resolveOrigin(req);
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed&detail=origin", req.url));
  }

  try {
    if (!googleOAuthConfigured()) {
      return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
    }
    // Byte-identical redirect_uri computation with /api/auth/callback — both
    // routes call resolveOrigin() and append the same path.
    const redirectUri = `${origin}/api/auth/callback`;
    return NextResponse.redirect(buildGoogleAuthUrl(redirectUri));
  } catch (err) {
    console.error("[SyncMe OAuth] authorize redirect failed:", err);
    const detail = err instanceof Error ? err.message.slice(0, 120) : "authorize_failed";
    return NextResponse.redirect(`${origin}/?error=oauth_failed&detail=${encodeURIComponent(detail)}`);
  }
}
