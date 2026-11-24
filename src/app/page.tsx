import { cookies } from "next/headers";
import { LandingClient } from "./landing-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const detail = typeof params.detail === "string" ? params.detail : undefined;

  // A returning student with a saved SyncMe session goes straight in —
  // Google consent is never asked again (silent prompt=none reconnect).
  const jar = await cookies();
  const signedIn = Boolean(jar.get("syncme_user")?.value);

  return <LandingClient authError={authError} oauthError={error} oauthDetail={detail} signedIn={signedIn} />;
}
