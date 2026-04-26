import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodLens — South Asia Flood Atlas · PHI Lab, Oxford",
  description: "FloodLens: interactive atlas of flood-affected population, children, health facilities, and schools across Pakistan, India, Bangladesh, Nepal, Bhutan, and Sri Lanka.",
  icons: { icon: '/floodlens-logo.png', apple: '/floodlens-logo.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body
        className="antialiased"
        style={{
          height: '100%',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
