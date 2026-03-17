import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PakEnv Risk Portal — Environmental Early Warning System",
  description: "Pakistan Environmental Risk Monitoring Portal — Flood Risk, Smog Risk, and Early Warning System for all districts and provinces.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body className={`${inter.variable} antialiased`} style={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
