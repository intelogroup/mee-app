import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mee — Your AI Companion",
  description:
    "Mee is a personal AI companion that learns who you are and grows with you. Sign up to get your private Telegram bot.",
  keywords: ["AI companion", "Telegram bot", "personal AI", "Mee"],
  openGraph: {
    title: "Mee — Your AI Companion",
    description: "A personal AI that learns who you are.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
