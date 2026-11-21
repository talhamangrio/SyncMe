import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "What SyncMe does",
    paragraphs: [
      "SyncMe is a student assistant for University of Debrecen students. It connects to your Gmail inbox with read-only access and to your Moodle e-learning calendar, extracts academic deadlines (exams, quizzes, appointments, immigration letters), and displays them as organized, prioritized tasks.",
    ],
  },
  {
    title: "Google user data: read-only, nothing more",
    paragraphs: [
      "SyncMe requests only the gmail.readonly OAuth scope (plus your basic profile: name, email and profile photo). This scope allows SyncMe to READ email metadata and bodies solely to extract student deadlines. SyncMe can never send, delete, or modify your emails.",
      "Your OAuth access token is stored in a temporary, HTTP-only session cookie that expires after roughly one hour. It is never written to a database or shared with third parties.",
    ],
  },
  {
    title: "We do not sell or store your emails",
    paragraphs: [
      "SyncMe does not sell, rent, or share your email content with anyone. Emails are fetched on demand when you trigger a sync, processed transiently in memory to extract tasks, and discarded. No email content is persisted on external servers or databases.",
      "The raw-email drawer in the dashboard shows the emails scanned during your most recent sync, held only in your browser's memory while the page is open.",
    ],
  },
  {
    title: "AI processing",
    paragraphs: [
      "To turn emails into tasks, SyncMe sends the text of recently scanned emails to a large language model (GLM via Z.ai) for extraction. This processing is transient: it is used only to produce the task list shown to you and is not retained for training or any other purpose.",
    ],
  },
  {
    title: "Moodle calendar",
    paragraphs: [
      "For Moodle, SyncMe only fetches the .ics calendar export URL that you personally paste into the app. That URL is stored locally in your browser (localStorage) and is never sent anywhere except to your own Moodle server to download the calendar.",
    ],
  },
  {
    title: "Your controls",
    paragraphs: [
      "You can disconnect at any time: clicking Logout clears all SyncMe cookies, and you can revoke SyncMe's access to your Google account from your Google Account permissions page (myaccount.google.com/permissions). Clearing your browser storage removes the saved Moodle URL.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-12 sm:px-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
        </div>
        <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
          SyncMe · Effective 2025
        </p>

        <p className="mt-8 rounded-xl border border-primary/30 bg-primary/[0.07] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-foreground">In one sentence:</strong> SyncMe uses
          read-only Gmail access (<code className="text-primary">gmail.readonly</code>) solely to extract
          student deadlines, and does not sell or store your emails on external servers.
        </p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} aria-label={s.title}>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{s.title}</h2>
              <div className="mt-3 space-y-3">
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-xs leading-relaxed text-muted-foreground/70">
          Questions about this policy? Contact the SyncMe team. SyncMe is a student-built project and is
          not affiliated with the University of Debrecen.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
