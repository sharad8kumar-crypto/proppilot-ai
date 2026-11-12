import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

// One font family for the whole app
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PropPilot AI | Real Estate Sales Automation",
  description:
    "AI-powered lead qualification, property matching, site-visit booking and follow-ups for Indian real estate teams.",
};

export const viewport: Viewport = {
  themeColor: "#E9E9EC",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}