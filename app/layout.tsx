import type { Metadata } from "next";
import { DM_Sans, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coffee Shop",
  description:
    "Fresh coffee, warm bakes, and easy ordering for Phnom Penh customers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${dmSans.variable} ${fraunces.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_10%_-20%,rgba(13,148,136,0.12),transparent),radial-gradient(ellipse_60%_40%_at_90%_100%,rgba(14,165,233,0.08),transparent),radial-gradient(ellipse_40%_30%_at_50%_50%,rgba(232,163,24,0.04),transparent),linear-gradient(to_bottom,rgba(248,250,249,0.97),rgba(241,245,243,1))]">
          {children}
        </div>
      </body>
    </html>
  );
}
