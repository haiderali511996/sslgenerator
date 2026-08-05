import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        unc: {
          50: "#fff4e9",
          100: "#ffe2c2",
          200: "#fdc98d",
          300: "#fbb26a",
          400: "#f89a4c",
          500: "#F5821F",
          600: "#dd6f10",
          700: "#b3590d",
          800: "#8a440a",
          900: "#5c2d07",
        },
      },
    },
  },
  plugins: [],
};

export default config;
