import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f4",
          100: "#eeeeea",
          200: "#d9d9d1",
          300: "#b8b8ab",
          400: "#8f8f7f",
          500: "#6b6b5c",
          600: "#4a4a3e",
          700: "#33332a",
          800: "#22221c",
          900: "#161611",
          950: "#0d0d0a",
        },
        brand: {
          50: "#eef7f6",
          100: "#d3ebe8",
          200: "#a7d7d1",
          300: "#78bfb6",
          400: "#4b9f94",
          500: "#2f8078",
          600: "#236862",
          700: "#1c534f",
          800: "#173f3d",
          900: "#123030",
          DEFAULT: "#2f8078",
          dark: "#1c534f",
        },
        accent: {
          DEFAULT: "#d97a3f",
          light: "#f0b384",
          dark: "#b3602c",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(22 22 17 / 0.04), 0 4px 16px -4px rgb(22 22 17 / 0.08)",
        card: "0 1px 3px 0 rgb(22 22 17 / 0.06), 0 8px 24px -8px rgb(22 22 17 / 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
