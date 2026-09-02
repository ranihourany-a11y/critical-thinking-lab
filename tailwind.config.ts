import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          navy: {
            DEFAULT: "#0B192C",
            50: "#F0F4F8",
            100: "#D9E2EC",
            200: "#BCCCDC",
            700: "#1E293B",
            800: "#0F172A",
            900: "#0B192C",
          },
          teal: {
            DEFAULT: "#0D9488",
            50: "#F0FDFA",
            100: "#CCFBF1",
            500: "#14B8A6",
            600: "#0D9488",
            700: "#0F766E",
            800: "#115E59",
            900: "#134E4A",
          },
          amber: {
            DEFAULT: "#D97706",
            50: "#FFFBEB",
            100: "#FEF3C7",
            500: "#F59E0B",
            600: "#D97706",
            700: "#B45309",
          },
          slate: {
            50: "#F8FAFC",
            100: "#F1F5F9",
            200: "#E2E8F0",
            300: "#CBD5E1",
            400: "#94A3B8",
            500: "#64748B",
            600: "#475569",
            700: "#334155",
            800: "#1E293B",
            900: "#0F172A",
          }
        }
      },
      fontFamily: {
        cairo: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      }
    },
  },
  plugins: [],
} satisfies Config;
