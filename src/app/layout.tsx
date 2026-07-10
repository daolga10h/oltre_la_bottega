import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Oltre la Bottega",
  description: "Dashboard operativa per la tua bottega",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Oltre la Bottega",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b2716",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
