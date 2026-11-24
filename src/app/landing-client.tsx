"use client";

import { FloatingNav } from "@/components/landing/floating-nav";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { TaglineReveal } from "@/components/tagline-reveal";
import { SiteFooter } from "@/components/site-footer";

const AUTH_ERROR_LABELS: Record<string, string> = {
  access_denied: "You declined the Google consent screen. SyncMe needs read only access to scan your inbox.",
  not_configured: "Google sign in is not configured on this deployment yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to continue.",
  missing_code: "Google did not return an authorization code. Please try signing in again.",
  token_exchange_failed: "Could not exchange the authorization code with Google. Please try signing in again.",
  oauth_failed: "Sign in with Google failed on our server. Check the deployment logs for the exact reason, then try again.",
};

export function LandingClient({
  authError,
  oauthError,
  oauthDetail,
  signedIn = false,
}: {
  authError?: string;
  oauthError?: string;
  oauthDetail?: string;
  signedIn?: boolean;
}) {
  const banner = authError
    ? (AUTH_ERROR_LABELS[authError] ?? "Sign in failed. Please try again.")
    : oauthError
      ? `${AUTH_ERROR_LABELS[oauthError] ?? "Sign in failed. Please try again."}${
          oauthDetail ? ` (${oauthDetail.slice(0, 140)})` : ""
        }`
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <FloatingNav signedIn={signedIn} />
      <main id="main" className="flex-1">
        <Hero signedIn={signedIn} authBanner={banner} />
        <TaglineReveal />
        <Benefits />
        <HowItWorks />
        {/*
          Social proof (skill A2): no invented testimonials.
          {{testimonial}} — real student quotes slot in here once collected.
          Until then the hero proof line carries the three trust signals.
        */}
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <SiteFooter />
    </div>
  );
}
