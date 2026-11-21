import { NextResponse, type NextRequest } from "next/server";
import { buildGoogleAuthUrl, googleOAuthConfigured, resolveOrigin } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google — starts the Google OAuth 2.0 consent flow with
 * openid email profile + gmail.readonly, redirecting back to
 * ${origin}/api/auth/callback.
 */
export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
  }
  const redirectUri = `${origin}/api/auth/callback`;
  return NextResponse.redirect(buildGoogleAuthUrl(redirectUri));
}
