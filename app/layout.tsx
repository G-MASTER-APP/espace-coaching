import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "G-MASTER — Espace Coaching",
    template: "%s · G-MASTER",
  },
  description:
    "Espace de suivi coaching G-MASTER : planning, programme, diète, bilans et accompagnement.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "G-MASTER",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f1ea",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable} data-scroll-behavior="smooth">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
