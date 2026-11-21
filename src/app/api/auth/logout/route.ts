import { NextResponse, type NextRequest } from "next/server";
import { resolveOrigin } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — clears SyncMe cookies and returns to the landing page. */
export async function POST(req: NextRequest) {
  const origin = resolveOrigin(req);
  const res = NextResponse.redirect(`${origin}/`);
  for (const name of ["gmail_access_token", "syncme_user", "syncme_demo"]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
