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
        // muted text: the default slate-500 is only 3.8:1 on the dark panels; this one is about 5.7:1
        slate: { 500: "#8391a7" },
      },
    },
  },
  plugins: [],
} satisfies Config;
