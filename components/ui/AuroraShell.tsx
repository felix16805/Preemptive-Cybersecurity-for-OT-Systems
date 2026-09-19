"use client";

import { useTheme } from "@/components/ThemeProvider";
import Aurora from "./Aurora";

export default function AuroraShell() {
  const { isLightMode } = useTheme();

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none transition-colors duration-700 bg-background">
      <Aurora
        colorStops={
          isLightMode
            ? ["#E0E5FF", "#C8862B", "#5227FF"]
            : ["#1B2A56", "#B497CF", "#5227FF"]
        }
        speed={0.3}
        amplitude={0.5}
        blend={0.5}
      />
      {/* Overlay gradient to ensure content readability */}
      <div 
        className={`absolute inset-0 transition-colors duration-700 ${
          isLightMode 
            ? 'bg-gradient-to-br from-[#F5F3EE]/80 via-[#F5F3EE]/50 to-transparent' 
            : 'bg-gradient-to-br from-[#111318]/90 via-[#111318]/70 to-transparent'
        }`} 
      />
    </div>
  );
}
