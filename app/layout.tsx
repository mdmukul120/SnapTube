import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader, TabBar } from "@/components/site-nav";
import { SiteFooter } from "@/components/footer";
import { site } from "@/lib/config";
import { stats } from "@/lib/catalog";

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: `${site.name} is a rebuilt, fully redesigned streaming catalogue: ${stats.titles.toLocaleString(
    "en-US",
  )} movies, series, anime and games across ${stats.collections} collections, with a documented auth-key / auth-token API.`,
  keywords: ["CTGMovies", "movies", "series", "anime", "games", "streaming catalogue", "Cinemax", "Bangla subtitles"],
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    description: "Your Own World of Entertainment. Rebuilt from the archive, redesigned from scratch.",
    type: "website",
    siteName: site.name,
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.tagline },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <TabBar />
      </body>
    </html>
  );
}
