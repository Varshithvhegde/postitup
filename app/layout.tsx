import type { Metadata } from "next";
import { Kalam, Architects_Daughter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "PostItUp — Collaborative Sticky Note Boards",
  description: "Create interactive sticky note boards for your team, community, or project. Free, real-time, embeddable.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${kalam.variable} ${architectsDaughter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
