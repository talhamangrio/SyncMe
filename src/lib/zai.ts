// ─── Z.ai GLM extraction engine (OpenAI-compatible API) ─────────────────────
// Sends the fetched email list + current ISO date/time to Z.ai and parses the
// strict-JSON response into SyncMe tasks. Falls back to the bundled Z.ai SDK
// and finally to a deterministic rule engine — the pipeline never hard-fails.

import type { RawEmail, SyncTask, TaskCategory, TaskPriority } from "@/lib/types";
import { sanitizeTask } from "@/lib/types";

const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";
// glm-4.5-flash is the free tier workhorse (verified live: strict JSON with
// thinking disabled). glm-4.7-flash / glm-4.6 / glm-4.5-air require a paid
// resource package — they are fallbacks that only engage if balance exists.
const PRIMARY_MODEL = process.env.ZAI_MODEL || "glm-4.5-flash";
const FALLBACK_MODELS = ["glm-4.7-flash", "glm-4.6"];
const AI_TIMEOUT_MS = 30_000;

function buildSystemPrompt(nowIso: string): string {
  return `You are SyncMe, an extraction engine for a university student's inbox at the University of Debrecen (Hungary).
You receive a list of recent emails: Neptun university messages, Moodle/elearning notices, clinic/medical appointments, immigration (Enter Hungary) letters, and professor emails.
Current date & time: ${nowIso} (Europe/Budapest).

Rules:
- IGNORE newsletters, promotions, spam, and emails whose events or deadlines are entirely in the PAST (before the current date/time).
- For every actionable email produce exactly ONE task object.
- "category" must be exactly one of: "Neptun" (exams, grades, registration, professor/admin mail), "Moodle" (e-learning, quizzes, assignments), "Medical" (clinic, doctor, appointments), "Immigration" (residence permit, Enter Hungary, aliens policing).
- "dueDate": resolve the most relevant future date mentioned into ISO-8601 (Europe/Budapest). If no future date is stated, use the literal string "unknown".
- "priority": "High" for exams, immigration matters or deadlines within 72 hours; "Medium" for quizzes and appointments; "Low" for everything else.
- "actionSummary": one short sentence telling the student exactly what to do.
- "sourceEmailSubject": copy the exact subject line of the email the task came from.

Respond with ONLY valid JSON — no markdown fences, no commentary — in this exact schema:
{"tasks": [{"id": string, "title": string, "category": "Neptun"|"Moodle"|"Medical"|"Immigration", "dueDate": string, "priority": "High"|"Medium"|"Low", "actionSummary": string, "sourceEmailSubject": string}]}
If no email is actionable, respond {"tasks": []}.`;
}

function buildUserPrompt(emails: RawEmail[], nowIso: string): string {
  const payload = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    from: e.from,
    date: e.date,
    body: e.snippet.slice(0, 1200),
  }));
  return `Current ISO date/time: ${nowIso}\n\nEmail list (JSON):\n${JSON.stringify(payload)}`;
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw;
}

function parseTasks(content: string): SyncTask[] | null {
  try {
    const parsed = JSON.parse(stripFences(content)) as { tasks?: unknown };
    if (!parsed || !Array.isArray(parsed.tasks)) return null;
    return parsed.tasks
      .map((t, i) => sanitizeTask(t, `ai-${i}`))
      .filter((t): t is SyncTask => t !== null);
  } catch {
    return null;
  }
}

async function callModel(model: string, emails: RawEmail[], nowIso: string): Promise<SyncTask[]> {
  const res = await fetch(ZAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ZAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 4000,
      // Disable chain-of-thought for fast, deterministic structured extraction.
      thinking: { type: "disabled" },
      messages: [
        { role: "system", content: buildSystemPrompt(nowIso) },
        { role: "user", content: buildUserPrompt(emails, nowIso) },
      ],
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Z.ai ${model} → HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const tasks = parseTasks(content);
  if (!tasks) throw new Error(`Z.ai ${model} → unparseable JSON`);
  return tasks;
}

/** Middle fallback: the bundled Z.ai SDK (used inside the Z.ai sandbox runtime). */
async function callSdkFallback(emails: RawEmail[], nowIso: string): Promise<SyncTask[]> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();
  const completion = (await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: buildSystemPrompt(nowIso) },
      { role: "user", content: buildUserPrompt(emails, nowIso) },
    ],
  })) as { choices?: { message?: { content?: string } }[] };
  const content = completion.choices?.[0]?.message?.content ?? "";
  const tasks = parseTasks(content);
  if (!tasks) throw new Error("SDK fallback → unparseable JSON");
  return tasks;
}

// ─── Deterministic rule engine (bulletproof last resort) ────────────────────

const CATEGORY_RULES: { pattern: RegExp; category: TaskCategory; priority: TaskPriority }[] = [
  { pattern: /immigration|enter hungary|residence permit|aliens polic|idegenrend/i, category: "Immigration", priority: "High" },
  { pattern: /klinika|clinic|medical|doctor|cardiolog|appointment/i, category: "Medical", priority: "Medium" },
  { pattern: /moodle|elearning|quiz|assignment|homework/i, category: "Moodle", priority: "Medium" },
  { pattern: /neptun|exam|vizsga|registration|deadline/i, category: "Neptun", priority: "High" },
];

const NOISE = /newsletter|unsubscribe|promotion|discount|webinar|survey|digest|roundup|book fair/i;

function guessDueDate(text: string, emailDate: string, now: Date): string {
  const iso = text.match(/(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (iso) {
    const d = new Date(`${iso[1]}T${iso[2] ?? "09"}:${iso[3] ?? "00"}:00`);
    if (!Number.isNaN(d.getTime()) && d.getTime() > now.getTime() - 86400_000) return d.toISOString();
  }
  const email = new Date(emailDate);
  if (!Number.isNaN(email.getTime()) && email.getTime() > now.getTime() - 86400_000) return email.toISOString();
  return "unknown";
}

function cleanTitle(subject: string): string {
  return subject
    .replace(/\[.*?\]/g, "")
    .replace(/^(fw|fwd|re):\s*/i, "")
    .trim()
    .slice(0, 140) || subject.slice(0, 140);
}

export function heuristicExtractTasks(emails: RawEmail[], now: Date = new Date()): SyncTask[] {
  const tasks: SyncTask[] = [];
  for (const email of emails) {
    const haystack = `${email.subject}\n${email.snippet}`;
    if (NOISE.test(haystack) && !/exam|appointment|deadline|immigration|residence permit/i.test(haystack)) continue;
    const rule = CATEGORY_RULES.find((r) => r.pattern.test(haystack)) ?? null;
    tasks.push({
      id: `heuristic-${email.id}`,
      title: cleanTitle(email.subject),
      category: rule?.category ?? "Neptun",
      dueDate: guessDueDate(email.snippet, email.date, now),
      priority: rule?.priority ?? "Medium",
      actionSummary: `Review "${email.subject}" and take the required action.`,
      sourceEmailSubject: email.subject,
    });
  }
  return tasks;
}

// ─── Public pipeline ────────────────────────────────────────────────────────

export async function extractTasks(
  emails: RawEmail[],
  now: Date = new Date(),
): Promise<{ tasks: SyncTask[]; aiStatus: "ai" | "heuristic" }> {
  if (emails.length === 0) return { tasks: [], aiStatus: "ai" };

  const nowIso = now.toISOString();
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS];

  for (const model of models) {
    if (!process.env.ZAI_API_KEY) break;
    try {
      const tasks = await callModel(model, emails, nowIso);
      return { tasks, aiStatus: "ai" };
    } catch (err) {
      console.error(`[SyncMe] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  try {
    const tasks = await callSdkFallback(emails, nowIso);
    return { tasks, aiStatus: "ai" };
  } catch (err) {
    console.error("[SyncMe] SDK fallback failed:", err instanceof Error ? err.message : err);
  }

  return { tasks: heuristicExtractTasks(emails, now), aiStatus: "heuristic" };
}

/** Remove duplicate tasks (same title + dueDate + category). */
export function dedupeTasks(tasks: SyncTask[]): SyncTask[] {
  const seen = new Set<string>();
  const out: SyncTask[] = [];
  for (const t of tasks) {
    const key = `${t.title.toLowerCase().trim()}|${t.dueDate}|${t.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
