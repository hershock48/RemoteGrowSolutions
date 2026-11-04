import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";

/**
 * Two faces, the same two the MI Gas site uses: Archivo for anything that has
 * to sound like a facility, Inter for what you read. Both self-hosted at build
 * time through next/font, so nothing is fetched from a font CDN at runtime.
 */
const display = Archivo({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} - ${SITE.tagline}`, template: `%s - ${SITE.short}` },
  description:
    "Subscription cultivation management for commercial grows: three check-ins a week, one call a week, a weekly report, a living crop calendar and exception-based review of every flower room.",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.tagline,
    url: SITE.url,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
