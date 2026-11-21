// ─── Demo Sandbox — simulated University of Debrecen inbox ──────────────────
// Dates are computed dynamically so the demo always looks alive on stage.
// Client-safe: no server-only imports.

import type { RawEmail, SyncTask } from "@/lib/types";

function inDaysAt(days: number, h: number, m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
}

function human(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const quizDeadline = inDaysAt(1, 23, 59);
const docsDeadline = inDaysAt(1, 12, 0);
const examRegClose = inDaysAt(2, 23, 59);
const thesisReplyBy = inDaysAt(2, 16, 0);
const clinicAppt = inDaysAt(3, 9, 15);
const examDate = inDaysAt(5, 10, 0);
const permitAppt = inDaysAt(6, 8, 30);

export const DEMO_EMAILS: RawEmail[] = [
  {
    id: "demo-neptun-exam",
    subject: "[Neptun] Exam registration closes soon - MBVB13003 Practical Biochemistry",
    from: "no-reply@neptun.unideb.hu",
    date: new Date(Date.now() - 3_600_000).toISOString(),
    snippet: `Dear Student,

Your exam registration window for the following course closes soon in the Neptun system:

Course: MBVB13003 Practical Biochemistry
Exam date: ${human(examDate)}
Location: ÉÉ building, Room ÉÉ-111

Registration closes: ${human(examRegClose)}. You may register or deregister until the deadline. Please arrive 15 minutes early with your student card.

University of Debrecen - Neptun Education System`,
  },
  {
    id: "demo-moodle-quiz",
    subject: `Moodle: Quiz 3 (Genetika) closes ${human(quizDeadline)}`,
    from: "moodlebot@elearning.unideb.hu",
    date: new Date(Date.now() - 7_200_000).toISOString(),
    snippet: `A new quiz has been added to the course "MBVVEB01E - Genetika".

Quiz 3 covers lectures 5-7 (Mendelian inheritance, linkage, population genetics).
Closes: ${human(quizDeadline)}
Time limit: 30 minutes. Attempts allowed: 1. Worth 10% of the course total.

You can access the quiz on the e-learning portal: elearning.unideb.hu
Do not wait until the last minute - the server is busy on deadline evenings.`,
  },
  {
    id: "demo-immigration-docs",
    subject: `Enter Hungary: Upload residence permit documents before ${human(docsDeadline)}`,
    from: "no-reply@oif.gov.hu",
    date: new Date(Date.now() - 10_800_000).toISOString(),
    snippet: `Dear Third-Country National Student,

Your residence permit appointment has been scheduled at the National Directorate-General for Aliens Policing, Debrecen Regional Directorate.

Appointment: ${human(permitAppt)}
Address: 1 Sándor Brigád utca, Debrecen 4025

ACTION REQUIRED: Upload scanned copies of your passport, TAJ card and accommodation certificate to the Enter Hungary portal before ${human(docsDeadline)}. Missing documents may result in cancellation of your appointment.`,
  },
  {
    id: "demo-clinic",
    subject: "Appointment confirmation - Cardiology follow-up at the Klinika",
    from: "kardio@klinika.med.unideb.hu",
    date: new Date(Date.now() - 86_400_000).toISOString(),
    snippet: `Dear Patient,

This is a confirmation of your cardiology follow-up appointment.

Date & time: ${human(clinicAppt)}
Location: Kenézy Gyula Campus, Cardiology Outpatient Clinic, Door 3

Please bring your TAJ card and the referral letter from your GP. If you cannot attend, cancel at least 24 hours in advance.`,
  },
  {
    id: "demo-professor",
    subject: "Re: Thesis topic approval - please confirm by replying",
    from: "kovacs.peter@inf.unideb.hu",
    date: new Date(Date.now() - 129_600_000).toISOString(),
    snippet: `Dear Student,

Thank you for your patience. I have reviewed your proposal and I am happy to supervise the thesis topic "AI-assisted timetabling for university students" as proposed.

Please confirm by replying to this email by ${human(thesisReplyBy)} so I can register the topic officially.

Kind regards,
Prof. Dr. Péter Kovács
Faculty of Informatics, University of Debrecen`,
  },
  {
    id: "demo-newsletter",
    subject: "DEENK Library Newsletter - Autumn events, discounts and more",
    from: "newsletter@lib.unideb.hu",
    date: new Date(Date.now() - 172_800_000).toISOString(),
    snippet: `Dear Reader,

Welcome to the autumn issue of the University and National Library Newsletter!

In this issue:
- 20% discount on all printing services this month
- Autumn book fair: 300+ titles in the main hall
- Workshop: Introduction to academic databases

You can unsubscribe at any time.`,
  },
];

export const DEMO_TASKS: SyncTask[] = [
  {
    id: "demo-task-quiz",
    title: "Quiz 3 - Genetika closes",
    category: "Moodle",
    dueDate: quizDeadline.toISOString(),
    priority: "High",
    actionSummary: "Finish Quiz 3 on elearning.unideb.hu before it closes - 30 min limit, 1 attempt.",
    sourceEmailSubject: `Moodle: Quiz 3 (Genetika) closes ${human(quizDeadline)}`,
  },
  {
    id: "demo-task-docs",
    title: "Upload residence permit documents",
    category: "Immigration",
    dueDate: docsDeadline.toISOString(),
    priority: "High",
    actionSummary: "Scan and upload passport, TAJ card and accommodation certificate to the Enter Hungary portal.",
    sourceEmailSubject: `Enter Hungary: Upload residence permit documents before ${human(docsDeadline)}`,
  },
  {
    id: "demo-task-examreg",
    title: "Exam registration closes - MBVB13003",
    category: "Neptun",
    dueDate: examRegClose.toISOString(),
    priority: "High",
    actionSummary: "Register (or deregister) for the Practical Biochemistry exam in Neptun before midnight.",
    sourceEmailSubject: "[Neptun] Exam registration closes soon - MBVB13003 Practical Biochemistry",
  },
  {
    id: "demo-task-thesis",
    title: "Confirm thesis topic to Prof. Kovács",
    category: "Neptun",
    dueDate: thesisReplyBy.toISOString(),
    priority: "Medium",
    actionSummary: "Reply to Prof. Kovács's email approving the proposed thesis topic.",
    sourceEmailSubject: "Re: Thesis topic approval - please confirm by replying",
  },
  {
    id: "demo-task-clinic",
    title: "Cardiology follow-up appointment",
    category: "Medical",
    dueDate: clinicAppt.toISOString(),
    priority: "Medium",
    actionSummary: "Attend the follow-up at Kenézy Campus Door 3; bring your TAJ card and referral letter.",
    sourceEmailSubject: "Appointment confirmation - Cardiology follow-up at the Klinika",
  },
  {
    id: "demo-task-exam",
    title: "Exam: Practical Biochemistry (ÉÉ-111)",
    category: "Neptun",
    dueDate: examDate.toISOString(),
    priority: "Medium",
    actionSummary: "Sit the MBVB13003 written exam; arrive 15 minutes early with your student card.",
    sourceEmailSubject: "[Neptun] Exam registration closes soon - MBVB13003 Practical Biochemistry",
  },
  {
    id: "demo-task-permit",
    title: "Residence permit appointment",
    category: "Immigration",
    dueDate: permitAppt.toISOString(),
    priority: "Medium",
    actionSummary: "Attend the aliens-policing appointment in Debrecen with all original documents.",
    sourceEmailSubject: `Enter Hungary: Upload residence permit documents before ${human(docsDeadline)}`,
  },
];
