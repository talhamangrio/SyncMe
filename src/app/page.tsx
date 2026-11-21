import { LandingClient } from "./landing-client";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : undefined;
  return <LandingClient authError={authError} />;
}
