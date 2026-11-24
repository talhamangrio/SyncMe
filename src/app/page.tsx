import { cookies } from "next/headers";
import { FAQS } from "@/lib/faq-data";
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

  // FAQPage JSON-LD for answer engines (AEO): plain question and answer form.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <LandingClient authError={authError} oauthError={error} oauthDetail={detail} signedIn={signedIn} />
    </>
  );
}
