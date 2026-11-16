import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono, Playfair_Display, Sora, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });
// Interface: Geist · display: Sora (tight, geometric) · timecodes and values: Geist Mono.
// Inter and Space Grotesk stay loaded only as caption-font choices in the free tools.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// Playfair is the serif the aesthetic recipes render with; the gallery previews them in it.
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Alter Effects — motion graphics without the timeline", template: "%s · Alter Effects" },
  description: "Editorial brand films, reels and captioned videos from your own footage. Pick a recipe, let any AI write the storyboard, approve, render.",
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "./" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0a0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${grotesk.variable} ${mono.variable} ${geist.variable} ${geistMono.variable} ${sora.variable} ${playfair.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} /></head>
      <body>{children}</body>
    </html>
  );
}
