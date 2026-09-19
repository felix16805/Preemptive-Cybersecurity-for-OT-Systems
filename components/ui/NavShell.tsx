"use client";

import { usePathname } from "next/navigation";
import CardNav from "@/components/ui/CardNav";
import { StaggeredMenu } from "@/components/ui/StaggeredMenu";
import { useTheme } from "@/components/ThemeProvider";
import { Moon, Sun } from "lucide-react";

// All the same links in both navs
const CARD_NAV_ITEMS = [
  {
    label: "Method",
    bgColor: "#1B2A56",
    textColor: "#F5F3EE",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Architecture", href: "/architecture" },
    ],
  },
  {
    label: "Explore",
    bgColor: "#16233F",
    textColor: "#F5F3EE",
    links: [
      { label: "Simulation", href: "/simulation" },
      { label: "Resources", href: "/resources" },
    ],
  },
  {
    label: "Connect",
    bgColor: "#111318",
    textColor: "#F5F3EE",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

// Full list for the staggered mobile menu
const MOBILE_MENU_ITEMS = [
  { label: "Home", link: "/" },
  { label: "How It Works", link: "/how-it-works" },
  { label: "Architecture", link: "/architecture" },
  { label: "Simulation", link: "/simulation" },
  { label: "Resources", link: "/resources" },
  { label: "About", link: "/about" },
  { label: "Contact", link: "/contact" },
  { label: "Defender Sign In", link: "/console" },
];

export default function NavShell() {
  const { isLightMode, toggleTheme } = useTheme();

  const ThemeToggleBtn = (
    <button 
      onClick={toggleTheme} 
      className="p-2 rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10"
      aria-label="Toggle theme"
      style={{ color: isLightMode ? "#111318" : "#F5F3EE" }}
    >
      {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );

  return (
    <>
      {/* ── Desktop: floating CardNav ── */}
      <div className="hidden md:block">
        <CardNav
          logoText="SafeCut"
          items={CARD_NAV_ITEMS.map(item => ({
            ...item,
            // Invert submenu background based on theme if desired.
            bgColor: isLightMode ? "#F5F3EE" : item.bgColor,
            textColor: isLightMode ? "#111318" : item.textColor,
          }))}
          baseColor={isLightMode ? "#F5F3EE" : "#111318"}
          menuColor={isLightMode ? "#111318" : "#F5F3EE"}
          buttonBgColor="#C8862B"
          buttonTextColor="#111318"
          ease="power3.out"
          themeToggle={ThemeToggleBtn}
        />
      </div>

      {/* ── Mobile: full-screen StaggeredMenu + Floating Toggle ── */}
      <div className="md:hidden">
        {/* Floating Theme Toggle for mobile, separate from StaggeredMenu for easy access */}
        <div className="fixed top-6 left-6 z-50">
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full backdrop-blur-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
            aria-label="Toggle theme"
            style={{ color: isLightMode ? "#111318" : "#F5F3EE" }}
          >
            {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <StaggeredMenu
          items={MOBILE_MENU_ITEMS}
          position="right"
          isFixed={true}
          menuButtonColor={isLightMode ? "#111318" : "#F5F3EE"}
          openMenuButtonColor={isLightMode ? "#111318" : "#F5F3EE"}
          accentColor="#C8862B"
          displaySocials={false}
          displayItemNumbering={true}
          changeMenuColorOnOpen={true}
          closeOnClickAway={true}
        />
      </div>
    </>
  );
}
