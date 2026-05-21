import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Couleurs ACS
        acs: {
          rouge: {
            DEFAULT: '#D32027',
            clair: '#E84855',
            fonce: '#A01820',
          },
          magenta: {
            DEFAULT: '#B52B8E',
            clair: '#D63DAB',
            fonce: '#8C1F6E',
          },
          bleu: {
            DEFAULT: '#0066B3',
            clair: '#1E88E5',
            fonce: '#004D87',
          },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
