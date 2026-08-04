import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodLens — South Asia Flood Atlas · PHI Lab, Oxford",
  description: "FloodLens: interactive atlas of flood-affected population, children, health facilities, and schools across Pakistan, India, Bangladesh, Nepal, Bhutan, and Sri Lanka.",
  icons: { icon: '/floodlens-logo.png', apple: '/floodlens-logo.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // data-theme is set on the server so the first paint is already light.
  // ThemeProvider rewrites the attribute on toggle; without it the CSS
  // `:root` default renders dark for a frame before hydration catches up.
  return (
    <html lang="en" data-theme="light" style={{ height: '100%' }}>
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
