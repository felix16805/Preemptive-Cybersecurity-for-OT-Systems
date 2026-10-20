import type { Metadata } from "next";
import "./globals.css";
import NavShell from "@/components/ui/NavShell";
import AuroraShell from "@/components/ui/AuroraShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import CustomScrollbar from "@/components/ui/CustomScrollbar";

export const metadata: Metadata = {
  title: "SafeCut — Preemptive Cybersecurity for OT Systems",
  description:
    "SafeCut isolates industrial network intrusions using safety-constrained minimum cuts, mathematically guaranteeing every safety-instrumented function loop stays intact.",
  keywords: [
    "OT cybersecurity", "ICS security", "SCADA", "SafeCut", "min-cut", "network isolation",
    "industrial control systems", "operational technology", "safety-instrumented systems",
  ],
  openGraph: {
    title: "SafeCut — Preemptive Cybersecurity for OT Systems",
    description: "Safety-constrained network isolation for industrial control systems.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Fonts are loaded at runtime (never at build time) so the app builds
            and runs even with no internet. If the venue WiFi is down, the
            system-font fallbacks below keep the UI fully legible. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --font-plex-sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            --font-plex-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
            --font-general-sans: 'General Sans', var(--font-plex-sans);
          }
        `}</style>
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen font-sans">
        <ThemeProvider>
          {/* Custom Animated Scrollbar */}
          <CustomScrollbar />
          {/* Global ambient background texture — sits behind all content */}
          <AuroraShell />
          {/* Single navigation instance — persists across every route */}
          <NavShell />
          {/* Page content */}
          <div className="relative z-10">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
