import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Playfair_Display,
} from "next/font/google";

import { AppProviders } from "@/components/providers/AppProviders";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://gathervia.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "GatherVia — Create, invite and welcome",
    template: "%s | GatherVia",
  },

  description:
    "Create digital invitations, manage guest lists and welcome guests smoothly with GatherVia.",

  applicationName: "GatherVia",

  keywords: [
    "digital invitations",
    "event guest management",
    "QR event check-in",
    "online invitation maker",
    "event invitation templates",
    "guest list management",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    url: "/",
    siteName: "GatherVia",
    title: "GatherVia — Create, invite and welcome",
    description:
      "Beautiful invitations, organised guest lists and smooth event check-in in one place.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "GatherVia digital invitation and guest management platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "GatherVia — Create, invite and welcome",
    description:
      "Beautiful invitations, organised guest lists and smooth event check-in in one place.",
    images: ["/og-image.jpg"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,

  themeColor: [
    {
      media: "(prefers-color-scheme: dark)",
      color: "#0f1912",
    },
    {
      media: "(prefers-color-scheme: light)",
      color: "#effaf6",
    },
  ],

  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={[
        geistSans.variable,
        geistMono.variable,
        playfairDisplay.variable,
        "h-full antialiased",
      ].join(" ")}
    >
      <body className="scrollbar-custom min-h-full bg-background font-sans text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
