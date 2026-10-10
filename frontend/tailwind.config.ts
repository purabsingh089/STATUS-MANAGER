import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#020617",
        surface: "#0F172A",
        panel: "#111827",
        muted: "#94A3B8",
        line: "#1E293B",
        accent: "#22C55E",
        warn: "#F59E0B",
        danger: "#EF4444",
        info: "#38BDF8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 0 0 1px rgba(148,163,184,0.08), 0 24px 60px rgba(0,0,0,0.35)",
        glow: "0 0 0 1px rgba(34,197,94,0.35), 0 0 28px rgba(34,197,94,0.22)",
        "glow-sm": "0 0 12px rgba(34,197,94,0.45)",
        raised: "inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.42)",
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
    },
  },
  plugins: [],
};

export default config;
