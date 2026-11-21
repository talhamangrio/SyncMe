# SyncMe — Your Student Chief of Staff

**SyncMe** reads your Gmail and Moodle calendar, extracts every exam, quiz, appointment and deadline, and tells you exactly what to do next — sorted, prioritized and conflict-checked. Built for University of Debrecen students.

![Stack](https://img.shields.io/badge/Next.js%2016-App%20Router-black) ![AI](https://img.shields.io/badge/Z.ai-glm--4.7--flash-FFC93C) ![Auth](https://img.shields.io/badge/Google_OAuth-gmail.readonly-4285F4)

## How it works

```
Gmail (Neptun / Klinika / Immigration / Professors) ──►  GET /api/gmail/sync ──┐
Moodle elearning.unideb.hu (.ics private feed)      ──►  POST /api/moodle/sync ─┼─► Z.ai GLM ─► Dashboard
Demo Sandbox (one click, zero credentials)          ──►  GET  /api/demo/enter ──┘
```

- **Read-only Gmail access** (`gmail.readonly`) — the last 30 days of university email are scanned, never stored.
- **Z.ai GLM extraction** (`glm-4.7-flash`) — emails + current ISO date/time in, strict JSON tasks out (`{ title, category: Neptun|Moodle|Medical|Immigration, dueDate, priority, actionSummary, sourceEmailSubject }`).
- **Conflict radar** — days holding 2+ deadlines raise yellow collision alerts.
- **Demo Sandbox** — a simulated Debrecen inbox with dynamically generated dates, so demos work on any day without credentials.
- **Zero storage** — no database: tokens live in a short-lived httpOnly cookie (~1h), emails are processed transiently in memory and discarded.

## Quick start

```bash
bun install
cp .env.example .env.local   # then paste your real keys
bun run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

| Variable | Where to get it |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client ID (Web application) |
| `ZAI_API_KEY` | [z.ai](https://z.ai) → API Keys |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, `https://syncme.vercel.app` in production |

### Google Cloud Console setup ($0, Testing mode)

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
| `/api/gmail/sync` | GET | Gmail (last 30d, max 12) → Z.ai `glm-4.7-flash` strict-JSON extraction |
| `/api/moodle/sync` | POST | `{ icsUrl }` → server-side fetch + VEVENT parse → normalized tasks |
| `/api/demo/enter` | GET | Set demo cookie → `/dashboard` (simulated inbox) |

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the same four environment variables in **Settings → Environment Variables** (set `NEXT_PUBLIC_APP_URL=https://syncme.vercel.app`).
3. Add `https://syncme.vercel.app/api/auth/callback` to the Authorized redirect URIs in Google Cloud Console.
4. Deploy.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Z.ai GLM · Framer Motion · sonner · date-fns

## Security notes

- `.env.local` is git-ignored; `.env.example` documents the required keys.
- Rotate your Google Client Secret and Z.ai API key after any public exposure (screenshots, chats).
- Revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) or via the dashboard Logout button.

> Student-built for the University of Debrecen community. Not affiliated with the University of Debrecen.
