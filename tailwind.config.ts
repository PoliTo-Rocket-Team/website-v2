import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
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
      colors: {
        // PRT design tokens (Pencil variables, board 00)
        ground: "#0B0B0C",
        panel: "#141416",
        "surface-2": "#1C1C1F",
        hairline: "#232326",
        "border-strong": "#34343A",
        "prt-text": "#F2F2F0",
        "text-2": "#C9C9CE",
        "prt-muted": "#8A8A8F",
        dim: "#5E5E64",
        accent: {
          DEFAULT: "#FF5100",
          hover: "#FF6A26",
          pressed: "#E04700",
          soft: "#FF510024",
          "on-accent": "#0B0B0C",
        },
        "white-5": "#FFFFFF0D",
        "white-10": "#FFFFFF1A",
        success: { DEFAULT: "#2E9B4F", soft: "#2E9B4F26" },
        warning: { DEFAULT: "#F5A623", soft: "#F5A62326" },
        danger: { DEFAULT: "#CE2B4B", soft: "#CE2B4B26" },
        // Existing shadcn/ui colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        // NOTE: PRT brand `accent` (orange) below replaces shadcn's gray accent.
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Space Theme Colors
        // Background Colors
        'space': {
          black: '#121212',         // Main background
          surface: '#1A1A1A',       // Surface/Cards
        },

        // Primary UI Colors
        'rocket': {
          DEFAULT: '#FF4B00',       // Primary orange
          hover: '#E04400',         // Darker orange for hover states
          light: '#FF8350',         // Light tint for subtle accents
        },

        // Accent/Secondary Colors
        'mission': {
          'gray-1': '#C4C4C4',     // Accent gray 1 (matches logo white tone)
          'gray-2': '#8A8A8A',     // Accent gray 2 (for text)
          'gray-3': '#3A3A3A',     // Accent gray 3 (dividers, strokes)
        },

        // Text Colors
        'cosmos': {
          white: '#EDEDED',         // Text on dark
          secondary: '#A8A8A8',     // Secondary text
          disabled: '#6A6A6A',      // Disabled text
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Archivo", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        twinkle: "twinkle 4s ease-in-out infinite",
        "shoot": "shoot 1.4s ease-in forwards",
        "shooting-star": "shooting-star 20s linear infinite",
        marquee: "marquee 40s linear infinite",
        "rocket-hover": "rocket-hover 6s ease-in-out infinite",
        "word-up": "word-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slogan-down": "slogan-down 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "hero-fade": "hero-fade 0.9s ease-out both",
        // Heavy drive-in: Starship pace — slow, deliberate, long deceleration
        "rocket-drive-in": "rocket-drive-in 7s linear both",
        // Lift-off: starts slow, accelerates away
        "rocket-liftoff": "rocket-liftoff 1.8s cubic-bezier(0.55, 0, 0.9, 0.35) forwards",
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
        twinkle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        "word-up": {
          "0%": { transform: "translateY(0.7em)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slogan-down": {
          "0%": { transform: "translateY(-0.45em)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "hero-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Angled arrival: climbs in from lower-left over the type at ~22°,
        // leveling out as it decelerates. Deceleration is baked into the stop
        // spacing, so the animation runs linear.
        "rocket-drive-in": {
          "0%": { transform: "translate(-68vw, 24vh) rotate(-22deg)" },
          "20%": { transform: "translate(-42vw, 15.5vh) rotate(-17deg)" },
          "40%": { transform: "translate(-24vw, 9.5vh) rotate(-12.5deg)" },
          "60%": { transform: "translate(-11.5vw, 4.8vh) rotate(-8.5deg)" },
          "80%": { transform: "translate(-3.6vw, 1.6vh) rotate(-5.5deg)" },
          "92%": { transform: "translate(-0.9vw, 0.4vh) rotate(-2.5deg)" },
          "100%": { transform: "translate(0, 0) rotate(0deg)" },
        },
        "rocket-liftoff": {
          "0%": { transform: "translate(0, 0) rotate(0deg)" },
          "100%": { transform: "translate(28vw, -130vh) rotate(-16deg)" },
        },
        shoot: {
          "0%": { transform: "translate(0, 0) rotate(-18deg)", opacity: "0" },
          "8%": { opacity: "1" },
          "60%": { opacity: "1" },
          "100%": {
            transform: "translate(-420px, 136px) rotate(-18deg)",
            opacity: "0",
          },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "rocket-hover": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "rocket-fly-in": {
          "0%": { transform: "translateX(-55vw)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "shooting-star": {
          "0%": { transform: "translate(0, 0) rotate(-18deg)", opacity: "0" },
          "1%": { opacity: "1" },
          "7%": { transform: "translate(-420px, 136px) rotate(-18deg)", opacity: "0" },
          "100%": { transform: "translate(0, 0) rotate(-18deg)", opacity: "0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
