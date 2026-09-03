import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2422",
        paper: "#F4F5F2",
        primary: { DEFAULT: "#0E5A53", dark: "#0A423D", light: "#E3EFED" },
        saffron: { DEFAULT: "#B96A00", light: "#FBF1E2" },
        credit: "#1B7A3D",
        debit: "#B3372E",
      },
      fontFamily: { sans: ["var(--font-plex)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
