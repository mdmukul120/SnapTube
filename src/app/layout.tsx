import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meta Tube — Universal Video Search, Share & Downloader',
  description:
    'যেকোনো ভিডিও লিংক শেয়ার করে অথবা সার্চ করে দ্রুত HD ভিডিও ও MP3 অডিও ডাউনলোড করুন। Ad-free universal media downloader & search app.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Meta Tube',
  },
};

export const viewport: Viewport = {
  themeColor: '#090B10',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
