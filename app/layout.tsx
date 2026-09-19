import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import NavShell from "@/components/ui/NavShell";
import AuroraShell from "@/components/ui/AuroraShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import CustomScrollbar from "@/components/ui/CustomScrollbar";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

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
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --font-general-sans: 'General Sans', system-ui, sans-serif;
          }
        `}</style>
      </head>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased min-h-screen font-sans`}>
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
