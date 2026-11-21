// ─── Google OAuth 2.0 + Gmail REST helpers (cookie-based, zero storage) ─────
// SyncMe never persists Gmail data: tokens live in a short-lived httpOnly
// cookie and emails are fetched on demand, processed transiently, discarded.

import type { NextRequest } from "next/server";
import type { RawEmail } from "@/lib/types";

export const GMAIL_SCOPES = "openid email profile https://www.googleapis.com/auth/gmail.readonly";

export const GMAIL_SEARCH_QUERY =
  "newer_than:30d (neptun OR unideb OR exam OR quiz OR appointment OR klinika OR immigration OR deadline)";

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i;

/**
 * Single source of truth for the OAuth origin — used identically by
 * /api/auth/google, /api/auth/callback, /api/auth/logout and /api/demo/enter
 * so the Google redirect_uri is always byte-identical across the flow.
 *
 * Precedence:
 *   1. x-forwarded-host / x-forwarded-proto — on Vercel this is EXACTLY the
 *      domain the student is browsing (syncme-rust.vercel.app, custom domains,
 *      git-branch deployment URLs). The OAuth loop therefore always stays on
 *      the domain the visitor came from.
 *   2. req.nextUrl.origin — local dev and direct access.
 *   3. NEXT_PUBLIC_APP_URL — last resort, ONLY when the request origin looks
 *      local (sandbox behind a proxy that hides the real host). Never let a
 *      configured URL override a real deployed host: a stale NEXT_PUBLIC_APP_URL
 *      once bounced every OAuth callback to a broken domain (HTTP 500) even
 *      though the browsed domain was perfectly healthy.
 */
export function resolveOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  const requestOrigin = req.nextUrl.origin.replace(/\/+$/, "");
  if (!LOCAL_ORIGIN.test(requestOrigin)) return requestOrigin;

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && !LOCAL_ORIGIN.test(configured)) return configured;
  return requestOrigin;
}

/** Cookie options shared by every auth route (Vercel: NODE_ENV=production). */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function buildGoogleAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface GoogleProfile {
  name: string;
  email: string;
  picture: string;
}

export class GmailAuthError extends Error {
  constructor(message = "Gmail token expired or insufficient scope") {
    super(message);
    this.name = "GmailAuthError";
  }
}

/** Exchange the OAuth authorization code for access/refresh tokens. */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    // Log the exact Google response body — redirect_uri_mismatch / invalid_grant
    // are diagnosed from this line in the serverless function logs.
    const body = await res.text().catch(() => "");
    console.error("[SyncMe OAuth] token exchange failed:", res.status, body || "(empty body)");
    throw new Error(
      `Google token exchange failed: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
    );
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Silent refresh: exchange a long-lived refresh token for a fresh access
 * token. Keeps the session alive without forcing the student through the
 * consent screen every ~55 minutes. Fully stateless — everything travels in
 * cookies, nothing touches a filesystem or database (Vercel-safe).
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[SyncMe OAuth] token refresh failed:", res.status, body || "(empty body)");
    throw new GmailAuthError();
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new GmailAuthError();
  return data.access_token;
}

/** Fetch the signed-in student's Google profile (name, email, picture). */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google userinfo failed: HTTP ${res.status}`);
  const data = (await res.json()) as { name?: string; email?: string; picture?: string };
  return {
    name: data.name ?? data.email ?? "Student",
    email: data.email ?? "",
    picture: data.picture ?? "",
  };
}

// ── Gmail REST API ──────────────────────────────────────────────────────────

interface GmailMessageRef {
  id: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
}

interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailPayloadPart[];
  };
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** Extract the plain-text body: base64url text/plain → stripped text/html → snippet. */
function extractPlainText(msg: GmailMessage): string {
  const payload = msg.payload;
  if (!payload) return msg.snippet ?? "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  const parts = payload.parts ?? [];
  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html?.body?.data) {
    return decodeBase64Url(html.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return msg.snippet ?? "";
}

async function gmailFetch(token: string, url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new GmailAuthError();
  return res;
}

/**
 * Search the student's inbox for university-related email (last 30 days) and
 * fetch full message details: Subject, From, Date and decoded plain-text body.
 */
export async function fetchUniversityEmails(token: string, maxResults = 12): Promise<RawEmail[]> {
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
    GMAIL_SEARCH_QUERY,
  )}&maxResults=${maxResults}`;
  const listRes = await gmailFetch(token, listUrl);
  if (!listRes.ok) throw new Error(`Gmail search failed: HTTP ${listRes.status}`);
  const list = (await listRes.json()) as { messages?: GmailMessageRef[] };

  const emails: RawEmail[] = [];
  for (const ref of list.messages ?? []) {
    try {
      const res = await gmailFetch(
        token,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
      );
      if (!res.ok) continue;
      const msg = (await res.json()) as GmailMessage;
      const headers = msg.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
      const dateHeader = header("date");
      const parsedDate = dateHeader ? new Date(dateHeader) : new Date();
      emails.push({
        id: msg.id,
        subject: header("subject") || "(no subject)",
        from: header("from") || "unknown",
        date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
        snippet: (extractPlainText(msg) || msg.snippet || "").slice(0, 2000),
      });
    } catch {
      // Skip individual message failures — never fail the whole sync for one email.
    }
  }
  return emails;
}
