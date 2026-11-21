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

/**
 * Prefer NEXT_PUBLIC_APP_URL when set, else derive the request origin
 * dynamically (x-forwarded-proto/host) so both http://localhost:3000 and
 * https://syncme.vercel.app work seamlessly.
 */
export function resolveOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
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
  if (!res.ok) throw new Error(`Google token exchange failed: HTTP ${res.status}`);
  return (await res.json()) as GoogleTokenResponse;
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
