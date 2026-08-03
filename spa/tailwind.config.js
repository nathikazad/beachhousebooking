import { Config } from "tailwindcss"

const config = {
  darkMode: "selector",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        // Table content can safely expand before the full desktop layout.
        "table-wide-up": { min: "1200px" },
        //Desktop breackpoints
        "desktop-up": { min: "1367px" },
        "desktop-down": { max: "1920px" },
        "desktop-only": { min: "1367px", max: "1920px" },
        //Laptop breackpoints
        "laptop-up": { min: "1024px" },
        "laptop-down": { max: "1366px" },
        "laptop-only": { min: "1024px", max: "1366px" },
        //Tablet breackpoints
        "tablet-up": { min: "768px" },
        "tablet-down": { max: "1023px" },
        "tablet-only": { min: "768px", max: "1023px" },
        //Mobile breackpoints
        "mobile-up": { min: "480px" },
        "mobile-down": { max: "768px" },
        "mobile-only": { max: "768px", min: "480px" },
        "xs-only": { max: "479px" },
      },
      colors: {
        placeHolderText: "#617A8A",
        inputBoxbg: "#F0F2F5",
        selectedButton: "#129CED",
        primaryShade: "#E3F5FF",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        link: "#757575",
        blueShade: "#F7FAFA",
        typo_dark: { 300: "#141414", 200: "#121417", 100: "#676A6C" },
        typo_light: {
          100: "#F0F2F5",
          200: "#637887",
          300: "#617A8A",
          400: "#3D4D5C",
        },
        error: "#ED3912",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("daisyui")],
  daisyui: {
    themes: [],
  },
};

export default config
