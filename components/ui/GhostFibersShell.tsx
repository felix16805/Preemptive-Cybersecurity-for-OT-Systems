"use client";

import { usePathname } from "next/navigation";
import GhostFibers from "@/components/ui/GhostFibers";

export default function GhostFibersShell() {
  const pathname = usePathname();
  // Console is Ink (dark) background — use dark fiber config
  const isDarkPage = pathname?.startsWith("/console");

  if (isDarkPage) {
    return (
      <GhostFibers
        lineColor="#1B2A56"
        glowColor="#C8862B"
        lightMode={false}
        speed={0.08}
        scale={3}
        layers={2}
        brightness={1}
        glowIntensity={0.6}
        grain={0.02}
        vignette={0.5}
        dpr={1}
      />
    );
  }

  // Light pages — marketing, simulation, architecture, etc.
  return (
    <GhostFibers
      lineColor="#111318"
      glowColor="#C8862B"
      lightMode={true}
      speed={0.08}
      scale={3}
      layers={2}
      brightness={1}
      glowIntensity={0.6}
      grain={0.02}
      vignette={0.5}
      dpr={1}
    />
  );
}
