// ─── SyncMe — FAQ content ────────────────────────────────────────────────────
// Shared by the FAQ accordion (landing) and the FAQPage JSON-LD (SEO/AEO).
// Sentence case, no hyphens, no em dashes, calm and specific.

export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQS: FaqEntry[] = [
  {
    q: "Does SyncMe store my emails?",
    a: "No. Emails are fetched on demand, processed in memory, and discarded. Nothing is written to a database and nothing sits on our servers.",
  },
  {
    q: "What exactly does SyncMe see in my Gmail?",
    a: "Read only access, focused on the last 30 days of academic, educational, immigration, health and professional mail. SyncMe can never send, delete, or change anything in your account.",
  },
  {
    q: "Which emails get ignored?",
    a: "Social notifications such as LinkedIn or Facebook, newsletters, promotions, general announcements with no personal deadline, and anything you have already answered or handled.",
  },
  {
    q: "Do I need to give SyncMe my Moodle password?",
    a: "Never. You paste your private .ics calendar export URL from elearning.unideb.hu once, and SyncMe remembers it for your account. Every device you sign in on connects automatically.",
  },
  {
    q: "What happens when two deadlines collide?",
    a: "SyncMe flags every day with more than one deadline in a yellow conflict group, so you can reschedule or prepare before the collision becomes a problem.",
  },
  {
    q: "Will I have to sign in every time?",
    a: "No. Your session is saved on your device. When a token expires, SyncMe reconnects with Google in the background without asking you to consent again.",
  },
  {
    q: "Can I try SyncMe without connecting Gmail?",
    a: "Yes. The demo sandbox shows the full dashboard with sample data.",
  },
  {
    q: "How do I disconnect?",
    a: "Log out at any time from the dashboard menu. Your Moodle link is saved only inside your own Google account in a hidden app folder, and it disappears when you revoke SyncMe's access from your Google Account permissions page.",
  },
];
