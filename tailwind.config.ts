import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        navy: "var(--color-navy)",
        steel: "var(--color-steel)",
        cloud: "var(--color-cloud)",
        line: "var(--color-line)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        surface: "var(--color-surface)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Public Sans", "Inter", "ui-sans-serif", "system-ui"]
      },
      borderRadius: {
        app: "8px"
      },
      boxShadow: {
        panel: "0 1px 2px rgba(16, 24, 40, 0.06)"
      }
    }
  },
  plugins: []
} satisfies Config;
