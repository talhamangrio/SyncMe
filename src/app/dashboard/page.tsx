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
