import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SyncMe — Your Student Chief of Staff",
  description:
    "SyncMe reads your Gmail and Moodle calendar, extracts every exam, quiz, appointment and deadline, and tells you exactly what to do next. Built for University of Debrecen students.",
  keywords: ["SyncMe", "University of Debrecen", "Neptun", "Moodle", "Gmail", "AI task extraction", "student deadlines"],
  openGraph: {
    title: "SyncMe — Your Student Chief of Staff",
    description:
      "Every exam, quiz, clinic appointment and residence permit deadline from your Gmail and Moodle, extracted, sorted and conflict-checked.",
    type: "website",
    siteName: "SyncMe",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SyncMe — Your student admin, on autopilot." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SyncMe — Your Student Chief of Staff",
    description:
      "Every exam, quiz, clinic appointment and residence permit deadline from your Gmail and Moodle, extracted, sorted and conflict-checked.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {children}
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
