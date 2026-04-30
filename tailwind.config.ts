import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "var(--accent, #635bff)",
          600: "var(--accent-600, #5851e6)",
          50:  "var(--accent-50, #f3f2ff)",
          100: "var(--accent-100, #e7e5ff)",
        },
        ink: {
          DEFAULT: "#0a2540",
          soft:    "#425466",
        },
        muted: {
          DEFAULT: "#697386",
          2:       "#8792a2",
        },
        line: {
          DEFAULT: "#e6ebf1",
          strong:  "#d1d9e0",
        },
        bg: {
          DEFAULT: "#ffffff",
          soft:    "#f6f9fc",
          deep:    "#f0f4f8",
        },
        green: { 50: "#ecfdf5", 600: "#047857" },
        amber: { 50: "#fffbeb", 600: "#b45309" },
        slate: { 50: "#f1f5f9", 600: "#475569" },
        red:   { 50: "#fef2f2", 600: "#b91c1c" },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', '"Helvetica Neue"', "Arial", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.022em",
        tighter: "-0.035em",
      },
      boxShadow: {
        card: "0 0 0 1px rgba(60, 66, 87, 0.06), 0 1px 1px rgba(0, 0, 0, 0.04)",
        "card-hover": "0 0 0 1px rgba(60, 66, 87, 0.08), 0 2px 5px rgba(60,66,87,0.08)",
        login: "0 0 0 1px rgba(60,66,87,0.04), 0 8px 24px rgba(60,66,87,0.08), 0 1px 2px rgba(0,0,0,0.05)",
        drawer: "-8px 0 32px rgba(10, 37, 64, 0.12)",
        focus: "0 0 0 3px var(--accent-100, #e7e5ff)",
      },
      borderRadius: {
        DEFAULT: "6px",
        card: "10px",
        pill: "9999px",
      },
      keyframes: {
        slideIn: { from: { transform: "translateX(20px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        pulse2:  { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: "0.4", transform: "scale(0.85)" } },
      },
      animation: {
        "slide-in": "slideIn 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in":  "fadeIn 180ms ease",
        "pulse2":   "pulse2 1.6s ease infinite",
      },
    },
  },
} satisfies Config;
