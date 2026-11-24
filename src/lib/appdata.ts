// ─── SyncMe — per-account preferences in the student's own Google Drive ─────
// SyncMe has no database (Vercel serverless, read-only filesystem), yet the
// Moodle calendar link must follow the student's ACCOUNT — saved once on the
// phone, it auto-connects on the laptop too. The storage that achieves this
// with zero new infrastructure is the drive.appdata space: a hidden,
// per-Google-account folder only this app can read or write. It never appears
// in the student's Drive UI, counts against their own quota, and disappears
// entirely when they revoke SyncMe's access.
//
// One small JSON file holds everything:
//   { "moodleIcsUrl": string | null, "updatedAt": ISO timestamp }
//
// Every call degrades gracefully: `no-scope` (consent not yet granted on the
// current session) and `unavailable` (Drive API error) both resolve to
// "no server-side preference" and the dashboard falls back to per-browser
// storage — nothing in the auth or sync flow can break because of this.

import { GmailAuthError } from "@/lib/gmail";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const PREFS_FILE_NAME = "syncme-prefs.json";
const REQUEST_TIMEOUT_MS = 12_000;

export type AppDataStatus = "ok" | "no-scope" | "unavailable";

export interface AccountPrefs {
  moodleIcsUrl: string | null;
  updatedAt: string;
}

interface DriveFileList {
  files?: { id: string; name?: string }[];
}

interface DriveErrorBody {
  error?: {
    errors?: { reason?: string }[];
    message?: string;
    status?: string;
  };
}

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  // 401 (expired token) and auth-shaped 403 mean the ROUTE should refresh and
  // retry — signal it exactly like the Gmail helpers do.
  if (res.status === 401) throw new GmailAuthError();
  if (res.status === 403) {
    let reason = "";
    try {
      const body = (await res.json()) as DriveErrorBody;
      reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? "";
    } catch {
      reason = "";
    }
    if (reason === "authError" || reason === "insufficientPermissions" || reason === "forbidden") {
      throw new GmailAuthError();
    }
  }
  return res;
}

/**
 * Classify a non-auth Drive failure. A 403 with `insufficientPermissions`
 * means the session was granted BEFORE the drive.appdata scope existed —
 * the student simply needs one fresh sign-in. `accessNotConfigured` means the
 * Drive API is not enabled for the OAuth project yet; log the exact enable
 * URL so the fix is a single click from the function logs.
 */
function classifyFailure(status: number, context: string): AppDataStatus {
  if (status === 403) {
    const hint =
      "Enable it at https://console.cloud.google.com/apis/library/drive.googleapis.com (one click), then sign in again.";
    console.error(`[SyncMe AppData] ${context} → HTTP 403 (Drive API unavailable or scope missing). ${hint}`);
    return "unavailable";
  }
  if (status === 401) return "no-scope";
  console.error(`[SyncMe AppData] ${context} → HTTP ${status} — treating as unavailable`);
  return "unavailable";
}

/** Find the prefs file id in the appDataFolder space (null when absent). */
async function findPrefsFileId(token: string): Promise<string | null> {
  const url = `${DRIVE_BASE}/files?spaces=appDataFolder&q=${encodeURIComponent(
    `name='${PREFS_FILE_NAME}'`,
  )}&fields=files(id,name)&pageSize=5`;
  const res = await driveFetch(token, url);
  if (!res.ok) {
    const err = new Error(`Drive list failed: HTTP ${res.status}`);
    (err as Error & { httpStatus?: number; appDataStatus?: AppDataStatus }).httpStatus = res.status;
    throw err;
  }
  const list = (await res.json()) as DriveFileList;
  return list.files?.[0]?.id ?? null;
}

function parsePrefs(raw: string): AccountPrefs | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AccountPrefs>;
    const url = typeof parsed.moodleIcsUrl === "string" && parsed.moodleIcsUrl.trim() ? parsed.moodleIcsUrl.trim() : null;
    const at = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString();
    return { moodleIcsUrl: url, updatedAt: at };
  } catch {
    return null;
  }
}

/**
 * Read the account prefs. Never throws for expected conditions:
 *   - no file yet          → { status: "ok", prefs: null }
 *   - scope not granted    → { status: "no-scope", prefs: null }
 *   - Drive API down/error → { status: "unavailable", prefs: null }
 * Throws GmailAuthError only when the token itself must be refreshed first.
 */
export async function readAccountPrefs(token: string): Promise<{ status: AppDataStatus; prefs: AccountPrefs | null }> {
  let fileId: string | null = null;
  try {
    fileId = await findPrefsFileId(token);
  } catch (err) {
    if (err instanceof GmailAuthError) throw err;
    const status = err as Error & { httpStatus?: number };
    if (status.httpStatus) return { status: classifyFailure(status.httpStatus === 403 ? 403 : 500, "prefs list"), prefs: null };
    return { status: "unavailable", prefs: null };
  }
  if (!fileId) return { status: "ok", prefs: null };

  const res = await driveFetch(token, `${DRIVE_BASE}/files/${fileId}?alt=media`).catch((err) => {
    if (err instanceof GmailAuthError) throw err;
    return null;
  });
  if (!res) return { status: "unavailable", prefs: null };
  if (!res.ok) return { status: classifyFailure(res.status === 403 ? 403 : res.status, "prefs read"), prefs: null };
  const prefs = parsePrefs(await res.text());
  if (!prefs) return { status: "ok", prefs: null };
  return { status: "ok", prefs };
}

/**
 * Write (create or update) the account prefs with the given Moodle URL.
 * Same graceful-degradation contract as readAccountPrefs.
 */
export async function writeAccountPrefs(
  token: string,
  moodleIcsUrl: string,
): Promise<{ status: AppDataStatus; prefs: AccountPrefs | null }> {
  const prefs: AccountPrefs = { moodleIcsUrl, updatedAt: new Date().toISOString() };
  const payload = JSON.stringify(prefs);

  let fileId: string | null = null;
  try {
    fileId = await findPrefsFileId(token);
  } catch (err) {
    if (err instanceof GmailAuthError) throw err;
    const status = err as Error & { httpStatus?: number };
    if (status.httpStatus) return { status: classifyFailure(status.httpStatus === 403 ? 403 : 500, "prefs list"), prefs: null };
    return { status: "unavailable", prefs: null };
  }

  if (fileId) {
    // PATCH with uploadType=media updates only the content — metadata (name,
    // appDataFolder parent) is already correct on the existing file.
    const res = await driveFetch(token, `${DRIVE_BASE}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch((err) => {
      if (err instanceof GmailAuthError) throw err;
      return null;
    });
    if (!res) return { status: "unavailable", prefs };
    if (!res.ok) return { status: classifyFailure(res.status === 403 ? 403 : res.status, "prefs update"), prefs: null };
    return { status: "ok", prefs };
  }

  // Create: multipart/related — part 1 metadata (name + appDataFolder parent),
  // part 2 the JSON content.
  const boundary = "syncme_prefs";
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify({ name: PREFS_FILE_NAME, parents: ["appDataFolder"] }),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    payload,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const res = await driveFetch(token, `${DRIVE_BASE}/files?uploadType=multipart`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  }).catch((err) => {
    if (err instanceof GmailAuthError) throw err;
    return null;
  });
  if (!res) return { status: "unavailable", prefs };
  if (!res.ok) return { status: classifyFailure(res.status === 403 ? 403 : res.status, "prefs create"), prefs: null };
  return { status: "ok", prefs };
}
