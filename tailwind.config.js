/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SafeCut design system
        bg: {
          base:    "#0a0a0f",
          surface: "#0f172a",
          card:    "#1e293b",
          hover:   "#334155",
        },
        accent: {
          cyan:    "#22d3ee",
          red:     "#ef4444",
          amber:   "#f59e0b",
          green:   "#4ade80",
          blue:    "#3b82f6",
        },
        text: {
          primary:   "#e2e8f0",
          secondary: "#94a3b8",
          muted:     "#475569",
        },
        safety: {
          ok:     "#4ade80",
          danger: "#ef4444",
          warn:   "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-red": "pulse-red 1.5s ease-in-out infinite",
        "glow-cyan": "glow-cyan 2s ease-in-out infinite",
        "slide-in":  "slide-in 0.4s ease-out",
        "fade-in":   "fade-in 0.6s ease-out",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.4)" },
          "50%":      { boxShadow: "0 0 0 8px rgba(239,68,68,0)" },
        },
        "glow-cyan": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(34,211,238,0.3)" },
          "50%":      { boxShadow: "0 0 24px rgba(34,211,238,0.6)" },
        },
        "slide-in": {
          from: { transform: "translateY(12px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
