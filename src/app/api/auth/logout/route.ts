import { NextResponse, type NextRequest } from "next/server";
import { resolveOrigin } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const SESSION_COOKIES = ["gmail_access_token", "gmail_refresh_token", "syncme_user", "syncme_demo"] as const;

/** POST /api/auth/logout — clears every SyncMe cookie and returns to the landing page. */
export async function POST(req: NextRequest) {
  const origin = resolveOrigin(req);
  const res = NextResponse.redirect(`${origin}/`);
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
