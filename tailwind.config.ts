import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        page: "var(--page)",
        ember: "var(--ember)",
        gold: "var(--gold)",
        muted: "var(--muted)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        button: "var(--radius-button)",
        chip: "var(--radius-chip)",
      },
      spacing: {
        card: "var(--card-padding)",
        section: "var(--section-gap)",
        inline: "var(--inline-gap)",
      },
      fontFamily: {
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
