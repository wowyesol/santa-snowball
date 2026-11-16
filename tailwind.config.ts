import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          '"HakgyoansimDunggeunmisoTTF-B"',
          "'ONE-Mobile-POP'",
          '"Gowun Dodum"',
          "sans-serif",
        ],
        sans: [
          '"Gowun Dodum"',
          "'ONE-Mobile-POP'",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
