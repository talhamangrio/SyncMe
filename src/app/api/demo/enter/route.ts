import { NextResponse, type NextRequest } from "next/server";
import { resolveOrigin } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/demo/enter — "Try Demo Sandbox": sets a demo-flag cookie and
 * redirects to /dashboard. No Google account or Gmail access is required.
 */
export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const res = NextResponse.redirect(`${origin}/dashboard`);
  res.cookies.set("syncme_demo", "1", { path: "/", sameSite: "lax" });
  return res;
}
