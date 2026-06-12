import type { Metadata } from "next";
import { Kalam, Architects_Daughter } from "next/font/google";
import "./globals.css";
import { SentryInit } from "./_sentry-init";

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

const architectsDaughter = Architects_Daughter({
  variable: "--font-sketch",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const SITE_URL = "https://postitup.varshithvhegde.in";
const OG_IMAGE = `${SITE_URL}/og.png`;
const TITLE    = "PostItUp — Collaborative Sticky Note Boards";
const DESC     = "Create real-time sticky note boards for retros, feedback, and brainstorming. Paper aesthetic, anonymous posting, embeddable anywhere. Free forever.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESC,
  keywords: ["sticky notes", "collaborative board", "retro board", "real-time", "PostItUp", "embeddable", "open source"],
  authors: [{ name: "Varshith V Hegde", url: "https://varshithvhegde.in" }],
  creator: "Varshith V Hegde",

  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },

  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESC,
    siteName: "PostItUp",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "PostItUp — Collaborative Sticky Note Boards",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    creator: "@VarshithVhegde1",
    images: [OG_IMAGE],
  },

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${kalam.variable} ${architectsDaughter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SentryInit />
        {children}
      </body>
    </html>
  );
}
