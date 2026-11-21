// ─── Google Gemini extraction engine (PRIMARY AI classifier) ────────────────
// gemini-2.5-flash via generativelanguage.googleapis.com with
// generationConfig.responseMimeType = "application/json" (guaranteed strict
// JSON, no markdown fences) and temperature 0.1 for deterministic extraction.
//
// Contract: returns SyncTask[] on success — an EMPTY array is a legitimate
// success meaning "no email is actionable" — or null when GEMINI_API_KEY is
// missing, still the paste-me placeholder, or the call/parse fails. Callers
// then silently fall back to the Z.ai GLM pipeline (src/lib/zai.ts), which has
// its own SDK + rule-engine fallbacks. This module never throws.

import type { RawEmail, SyncTask } from "@/lib/types";
import { sanitizeTask } from "@/lib/types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_TIMEOUT_MS = 30_000;
/** Placeholder written into .env.example / .env.local before the real key exists. */
const KEY_PLACEHOLDER = "PASTE_YOUR_GEMINI_KEY_HERE";

function buildPrompt(emails: RawEmail[], nowIso: string): string {
  const payload = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    from: e.from,
    date: e.date,
    body: e.snippet.slice(0, 1200),
  }));

  return `You are SyncMe, an AI extraction engine for a university student's inbox at the University of Debrecen (Hungary).
Current date & time: ${nowIso} (Europe/Budapest timezone).

You receive a JSON list of recent emails: Neptun university messages, Moodle/elearning notices, clinic (Klinikák) medical appointments, immigration / Enter Hungary / residence permit letters, and professor emails.

IGNORE completely — never create tasks for them:
- Promotional emails, marketing offers, newsletters and spam.
- Social media notifications: LinkedIn, Facebook, Instagram, X/Twitter, TikTok, Reddit, Pinterest, YouTube and any other social network.
- GitHub / GitLab / repository notifications and other automated developer-platform alerts.
- Job-board digests, alumni fundraisers, survey invitations, webinar invites.
- General university announcements, campus events, talks or news with NO personal action required and NO personal deadline.
- Emails the student has ALREADY ANSWERED (their reply was sent) or where the requested action is already completed: confirmation receipts, acknowledgment emails, "we received your submission" notices.
- Any email whose deadlines or events are entirely in the PAST (earlier than the current ISO timestamp above).

EXTRACT ONLY actionable student items in these scopes:
- ACADEMIC: student deadlines, exams and exam registrations, grades, certificates, Neptun administrative tasks, subject registration, payments.
- EDUCATIONAL: Moodle / elearning.unideb.hu quizzes, assignments, homework.
- IMMIGRATION: residence permit deadlines, Enter Hungary, aliens policing, document upload appointments.
- HEALTH: Klinikák / clinic / doctor medical appointments and medical deadlines.
- PROFESSIONAL: professor, thesis supervisor or university administration correspondence containing a personal action or deadline (consultation, thesis submission, office appointments).

Output schema — every actionable email produces exactly ONE task object:
{"tasks": [{"id": string, "title": string, "category": "Neptun"|"Moodle"|"Medical"|"Immigration", "dueDate": string, "priority": "High"|"Medium"|"Low", "actionSummary": string, "sourceEmailSubject": string}]}

Field rules:
- "id": short unique slug derived from the source email id.
- "title": concise imperative summary, max 120 characters.
- "category": exactly one of "Neptun" (exams, grades, registration, professor/admin mail), "Moodle" (e-learning, quizzes, assignments), "Medical" (clinic, doctor, appointments), "Immigration" (residence permit, Enter Hungary, aliens policing).
- "dueDate": resolve the most relevant FUTURE date mentioned into ISO-8601 (Europe/Budapest). If no future date is stated, use the literal string "unknown".
- "priority": "High" for exams, immigration matters or deadlines within 72 hours; "Medium" for quizzes and appointments; "Low" for everything else.
- "actionSummary": one short sentence telling the student exactly what to do.
- "sourceEmailSubject": the exact subject line of the email the task came from.
- If NO email is actionable, respond exactly {"tasks": []}.

Respond with ONLY the JSON object — no markdown fences, no commentary.

Email list (JSON):
${JSON.stringify(payload)}`;
}

/**
 * Primary extraction via Google Gemini (gemini-2.5-flash).
 * Returns null (never throws) when the key is absent/placeholder or anything
 * fails — the caller falls back to the Z.ai pipeline silently.
 */
export async function extractTasksGemini(
  emails: RawEmail[],
  now: Date = new Date(),
): Promise<SyncTask[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  // Not configured yet (or still the paste-me placeholder) — no doomed request.
  if (!apiKey || apiKey === KEY_PLACEHOLDER) return null;

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(emails, now.toISOString()) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[SyncMe Gemini] gemini-2.5-flash → HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as { tasks?: unknown };
    if (!parsed || !Array.isArray(parsed.tasks)) {
      console.error("[SyncMe Gemini] response missing tasks array");
      return null;
    }
    return parsed.tasks
      .map((t, i) => sanitizeTask(t, `gemini-${i}`))
      .filter((t): t is SyncTask => t !== null);
  } catch (err) {
    console.error(
      "[SyncMe Gemini] gemini-2.5-flash failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
