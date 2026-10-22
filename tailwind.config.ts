import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F4EF",
        surface: "#FFFFFF",
        sunken: "#EFEEE8",
        ink: "#171916",
        muted: "#5F625B", // darkened from #73766F so small text passes AA on #F5F4EF
        accent: { DEFAULT: "#245C45", hover: "#194936" },
        positive: "#287653",
        warning: "#B7791F",
        critical: "#B54747",
        line: "#DCDDD5",
        grid: "#E8E7E0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { control: "6px", panel: "10px" },
      spacing: { safeb: "env(safe-area-inset-bottom)" },
      transitionDuration: { DEFAULT: "160ms" },
    },
  },
  plugins: [],
};
export default config;
