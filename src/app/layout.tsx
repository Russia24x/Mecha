import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MECHA: LAST PROTOCOL",
  description: "A 2D action game built with Phaser 4.2 and Matter.js. Fight through the Abandoned Factory and defeat Guardian AX-09.",
  keywords: ["Phaser", "Matter.js", "2D Game", "Action", "MECHA"],
  authors: [{ name: "MECHA Studio" }],
  openGraph: {
    title: "MECHA: LAST PROTOCOL",
    description: "A 2D action game built with Phaser 4.2 and Matter.js.",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MECHA: LAST PROTOCOL",
    description: "A 2D action game built with Phaser 4.2 and Matter.js.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
