import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        unc: {
          50: "#eefdf6",
          100: "#d5f9e6",
          500: "#0fa968",
          600: "#0b8a54",
          900: "#053b25",
        },
      },
    },
  },
  plugins: [],
};

export default config;
