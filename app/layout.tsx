import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeCut — Preemptive Cybersecurity for OT Systems",
  description:
    "SafeCut isolates industrial network intrusions using safety-constrained minimum cuts, mathematically guaranteeing every safety-instrumented function loop stays intact. A real-time cybersecurity dashboard for operational technology environments.",
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
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-bg-base text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
