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
  metadataBase: new URL("https://syncme-rust.vercel.app"),
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
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png" }],
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        {/* Soft sky-to-cobalt ambient depth behind the top of every page. */}
        <div aria-hidden="true" className="ambient-glow" />
        {children}
        {/* Calm system messages: white surface, slate ink, no exclamation marks. */}
        <Toaster
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!rounded-xl !border !border-[#E2E8F0] !bg-white !text-[#0F172A] !shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]",
              title: "!text-sm !font-semibold !text-[#0F172A]",
              description: "!text-sm !text-[#475569]",
              actionButton: "!rounded-lg !bg-[#2563EB] !text-white !font-semibold",
              cancelButton: "!rounded-lg !bg-[#F1F5F9] !text-[#0F172A]",
              closeButton: "!bg-white !text-[#475569] !border-[#E2E8F0]",
            },
          }}
        />
      </body>
    </html>
  );
}
