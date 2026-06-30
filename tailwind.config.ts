import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm editorial canvas
        bone: "#F7F2E9",
        "bone-deep": "#EEE5D3",
        paper: "#FFFDF8",
        // Ink (warm near-black)
        ink: "#18130F",
        "ink-soft": "#5A5047",
        "ink-faint": "#8C8175",
        // Signature accents
        violet: "#5B3DF5",
        "violet-deep": "#3A23B8",
        "violet-soft": "#E7E1FF",
        coral: "#FF6A45",
        "coral-soft": "#FFE2D8",
        amber: "#F4A720",
        sage: "#2E9E78",
        "sage-soft": "#D6F0E5",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
      },
      boxShadow: {
        // Hard offset "sticker" shadow in warm ink
        sticker: "0.5rem 0.5rem 0 0 #18130F",
        "sticker-sm": "0.3rem 0.3rem 0 0 #18130F",
        "sticker-violet": "0.5rem 0.5rem 0 0 #5B3DF5",
        soft: "0 18px 50px -22px rgba(24,19,15,0.35)",
        "soft-lg": "0 35px 80px -30px rgba(24,19,15,0.45)",
      },
      keyframes: {
        "blob-drift": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(4%,-6%) scale(1.08)" },
          "66%": { transform: "translate(-4%,4%) scale(0.96)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "blob-drift": "blob-drift 18s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 2s infinite",
        "rise-in": "rise-in 0.6s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
