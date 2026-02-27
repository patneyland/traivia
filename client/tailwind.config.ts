import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fredoka", "system-ui", "sans-serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
      },
      colors: {
        primary: "hsl(262 83% 68%)",
        secondary: "hsl(326 100% 74%)",
        background: "hsl(260 50% 98%)",
        foreground: "hsl(260 50% 10%)",
        accent: "hsl(42 100% 50%)",
        destructive: "hsl(348 100% 61%)",
        muted: "hsl(260 20% 90%)",
        gameRed: "hsl(348 100% 61%)",
        gameBlue: "hsl(211 100% 50%)",
        gameYellow: "hsl(42 100% 50%)",
        gameGreen: "hsl(141 71% 48%)",
      },
      boxShadow: {
        button: "6px 6px 0px hsl(260 50% 10% / 0.2)",
        buttonPressed: "2px 2px 0px hsl(260 50% 10% / 0.2)",
      },
      borderRadius: {
        pill: "2.5rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
