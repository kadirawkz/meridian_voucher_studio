import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        navy: "#12345a",
        steel: "#4f6078",
        cloud: "#f6f8fb",
        line: "#d8dee8",
        success: "#0f7b55",
        warning: "#a35f00"
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
