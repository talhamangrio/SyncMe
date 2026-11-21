import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import type { SyncMeUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const jar = await cookies();
  const isDemo = jar.get("syncme_demo")?.value === "1";
  const rawUser = jar.get("syncme_user")?.value;

  if (!isDemo && !rawUser) redirect("/");

  // Saved session, dead tokens: silently reconnect via Google prompt=none —
  // no consent screen, no clicks. The syncme_reauth marker cookie (set by the
  // auth route, cleared by the callback) prevents a redirect loop when the
  // Google session is truly gone; the dashboard then shows a reconnect button.
  if (!isDemo && rawUser && !jar.get("gmail_access_token") && jar.get("syncme_reauth")?.value !== "1") {
    redirect("/api/auth/google?mode=silent");
  }

  let user: SyncMeUser = { name: "Demo Student", email: "demo.student@unideb.hu", picture: "" };
  if (rawUser) {
    try {
      const parsed = JSON.parse(decodeURIComponent(rawUser)) as Partial<SyncMeUser>;
      user = {
        name: parsed.name?.trim() || "Student",
        email: parsed.email?.trim() || "",
        picture: parsed.picture?.trim() || "",
      };
    } catch {
      user = { name: "Student", email: "", picture: "" };
    }
  }

  return <DashboardClient user={user} isDemo={isDemo} />;
}
