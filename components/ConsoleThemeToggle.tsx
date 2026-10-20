"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ConsoleThemeToggle() {
  const { isLightMode, toggleTheme } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <Link href="/" className="text-xs font-mono hover:text-foreground">Home</Link>
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-full hover:bg-white/10"
        aria-label="Toggle theme"
      >
        {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </div>
  );
}
