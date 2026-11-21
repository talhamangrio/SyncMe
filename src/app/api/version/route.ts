import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/version — tiny deployment marker.
 *
 * Returns the git commit SHA Vercel baked into this deployment, so a push to
 * GitHub can be verified end-to-end: if this endpoint starts reporting the
 * new SHA without anyone clicking "Redeploy", auto-deploy (Git integration)
 * is proven working. Also handy in production to confirm which commit is live.
 */
export async function GET() {
  return NextResponse.json(
    {
      service: "syncme",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      region: process.env.VERCEL_REGION ?? null,
      deployedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
