# SyncMe — Your Student Chief of Staff

**SyncMe** reads your Gmail and Moodle calendar, extracts every exam, quiz, appointment and deadline, and tells you exactly what to do next — grouped by priority, conflict-checked, with worthless mail (spam, newsletters, personal chat) silently ignored. Built for University of Debrecen students.

![Stack](https://img.shields.io/badge/Next.js%2016-App%20Router-black) ![AI](https://img.shields.io/badge/Google_Gemini-primary_extractor-8E75B2) ![Fallback](https://img.shields.io/badge/fallback-Z.ai_GLM-FFC93C) ![Auth](https://img.shields.io/badge/Google_OAuth-gmail.readonly-4285F4)

## How it works

```
Gmail (Neptun / Klinika / Immigration / Professors) ──►  GET /api/gmail/sync ──┐
Moodle elearning.unideb.hu (.ics private feed)      ──►  POST /api/moodle/sync ─┼─► Gemini AI ─► Dashboard
Demo Sandbox (one click, zero credentials)          ──►  GET  /api/demo/enter ──┘   (fallback: Z.ai GLM)
```

- **Read-only Gmail access** (`gmail.readonly`) — the last 30 days of university email are scanned, never stored.
- **Google Gemini extraction** (primary) — emails + current Europe/Budapest date/time in, strict JSON tasks out (`{ title, category: Neptun|Moodle|Medical|Immigration, dueDate, priority, actionSummary, sourceEmailSubject }`).
- **Worthless-mail gate** — the AI prompt hard-ignores promotional mail, social notifications, general announcements, already-answered mail, and personal chat between students ("33", "ok", "I sent a file to my friend") — so only actionable institutional mail becomes a task.
- **Silent fallback chain** — Gemini → Z.ai `glm-4.5-flash` → bundled Z.ai SDK → deterministic rule engine, so sync never hard-fails.
- **Priority-grouped list** — the dashboard groups tasks into High / Medium / Low sections instead of a flat card grid.
- **Conflict radar** — days holding 2+ deadlines raise yellow collision alerts.
- **Demo Sandbox** — a simulated Debrecen inbox with dynamically generated dates, so demos work on any day without credentials.
- **Zero storage** — no database: tokens live in a short-lived httpOnly cookie (~1h), emails are processed transiently in memory and discarded.

## How to run it

### Prerequisites

- [Bun](https://bun.sh) 1.1+ (recommended) or Node.js 20.9+
- A Google account with Gmail (a `@unideb.hu` university inbox gives the best results)
- Two free API keys: **Google Gemini** (primary) and **Z.ai** (fallback — optional)

### 1. Install & configure

```bash
bun install
cp .env.example .env.local   # then paste your real keys
```

### 2. Environment variables (`.env.local`)

| Variable | Required | Where to get it |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | [Google AI Studio](https://aistudio.google.com/apikey) → *Get API key* (free tier works) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Only for real Gmail | Google Cloud Console → OAuth client ID (Web application) |
| `ZAI_API_KEY` | Optional | [z.ai](https://z.ai) → API Keys (used only if Gemini fails) |
| `NEXT_PUBLIC_APP_URL` | Optional | Leave as `http://localhost:3000` locally — the origin is auto-detected in production |
| `GEMINI_MODEL` / `ZAI_MODEL` | Optional | Model overrides (`gemini-3.8-flash` / `glm-4.5-flash` by default) |

> SyncMe works **without any keys** in Demo Sandbox mode — API keys are only needed for real Gmail sync and live AI extraction.

### 3. Start the dev server

```bash
bun run dev    # http://localhost:3000
```

Open `http://localhost:3000` and either:

- click **Try Demo Sandbox** (zero credentials, simulated inbox), or
- click **Sign in with Google** to connect your real Gmail.

### 4. Quality checks (optional, for contributors)

```bash
bun run lint           # ESLint (eslint-config-next)
bunx tsc --noEmit      # type check
```

### Google Cloud Console setup ($0, Testing mode — only for real Gmail)

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → External → add your Gmail as a **Test user**.
4. **Credentials → Create Credentials → OAuth client ID** → Web application → Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `https://<your-deployment>/api/auth/callback`

## Connecting real data

1. **Gmail** — click *Sign in with Google* on the landing page and grant read-only access.
2. **Moodle** — on `elearning.unideb.hu`: Calendar → Export → **Private address (.ics)** → paste it into *Connect Moodle .ics* on the dashboard (stored only in your browser).
3. **Demo** — no credentials needed: click *Try Demo Sandbox*.

## API surface

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/google` | GET | Start Google OAuth (openid email profile + gmail.readonly) |
| `/api/auth/callback` | GET | Exchange code → httpOnly cookie (`gmail_access_token`, maxAge 3500) + profile session cookie → `/dashboard` |
| `/api/auth/logout` | POST | Clear SyncMe cookies, return to `/` |
| `/api/gmail/sync` | GET | Gmail (last 30d, max 12) → Gemini strict-JSON extraction → Z.ai fallback → rule engine → deduped tasks |
| `/api/moodle/sync` | POST | `{ icsUrl }` → server-side fetch + VEVENT parse → normalized tasks |
| `/api/demo/enter` | GET | Set demo cookie → `/dashboard` (simulated inbox) |

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the environment variables above in **Settings → Environment Variables** (set `NEXT_PUBLIC_APP_URL=https://syncme-rust.vercel.app`).
3. Add `https://syncme-rust.vercel.app/api/auth/callback` to the Authorized redirect URIs in Google Cloud Console.
4. Deploy — every push to `main` auto-deploys.

## Tools, APIs & AI assistants used

### AI engines inside SyncMe

| Engine | Role |
| --- | --- |
| **Google Gemini** (`gemini-2.5-flash` class, strict JSON mode, temp 0.1) | Primary classifier — reads email subjects/snippets and returns prioritized tasks as JSON; also enforces the worthless-mail ignore rules |
| **Z.ai GLM** (`glm-4.5-flash`) | Silent fallback extractor when Gemini is unavailable |
| **z-ai-web-dev-sdk** | Third-line extraction via the bundled Z.ai SDK |
| **Deterministic rule engine** | Keyword/date-parser fallback — guarantees sync still works with zero AI keys |

### External APIs

| API | Scope |
| --- | --- |
| **Gmail API** (Google OAuth 2.0, `gmail.readonly`) | Read-only scan of the last 30 days of university email (max 12 per sync) |
| **Google Gemini API** (`generativelanguage.googleapis.com`) | Task extraction |
| **Z.ai API** (`api.z.ai`) | Fallback extraction |
| **Moodle .ics private calendar feed** (`elearning.unideb.hu`) | Server-side VEVENT parsing of Moodle deadlines |

### Development stack & tooling

| Tool | Purpose |
| --- | --- |
| **Next.js 16** (App Router) + **TypeScript 5** | Framework & language |
| **Bun** | Package manager, runtime & dev server |
| **Tailwind CSS 4** + **shadcn/ui** (New York, Radix primitives) | Styling & component library |
| **Framer Motion** | Entry/hover animations |
| **lucide-react** | Icons |
| **sonner** | Toast notifications |
| **date-fns** | Deadline math & formatting |
| **ESLint** (`eslint-config-next`) | Code quality |
| **Vercel** | Hosting with auto-deploy on every push to `main` |

### AI assistant used to build this project

- **Z.ai Code** — the GLM-powered agentic coding assistant used to scaffold the repo, implement the Gmail/Moodle pipelines, design the UI, wire the Gemini/Z.ai extraction chain, debug and browser-verify every release. All code in this repository was written and iterated in pair-programming sessions with Z.ai Code.

## Security notes

- `.env.local` is git-ignored; `.env.example` documents the required keys.
- Rotate your Google Client Secret, Gemini key and Z.ai API key after any public exposure (screenshots, chats).
- Revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) or via the dashboard Logout button.

> Student-built for the University of Debrecen community. Not affiliated with the University of Debrecen.
