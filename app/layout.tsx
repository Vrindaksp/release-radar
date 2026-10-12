import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// The chunky, slightly quirky face for headlines, big numbers and the logo; everything else stays Inter.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Release Radar — weekly open-source release digest",
  description: "AI-triaged GitHub release digest: security fixes and breaking changes first, noise filtered out.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-vibe="calm" className={`${inter.variable} ${jetbrainsMono.variable} ${bricolage.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
