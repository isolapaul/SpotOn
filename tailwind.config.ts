import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        brand: { 50: '#ECFBF3', 100: '#D1F5E2', 200: '#A3EAC6', 300: '#69D9A5', 400: '#3CCB8C', 500: '#16A064', 600: '#12814F', 700: '#0D6A40', 800: '#0A5534', 900: '#083F27' },
        surface: { 0: '#0E1013', 1: '#16181C', 2: '#1E2126', 3: '#2A2D33', 4: '#363A41' },
        label: { DEFAULT: '#F4F5F7', secondary: 'rgb(235 238 245 / 0.68)', tertiary: 'rgb(235 238 245 / 0.45)' },
        separator: 'rgb(255 255 255 / 0.09)',
        warn: { 500: '#F5B301', 600: '#B98300', ink: '#3B2A00' },
        gold: '#F7C948',
        danger: { 400: '#FF6B61', 500: '#FF453A' },
        locate: '#0A84FF',
        ink: { DEFAULT: '#111418', secondary: '#5A6069' },
      },
      backdropBlur: {
        'glass': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-lg': '0 20px 48px 0 rgba(31, 38, 135, 0.2)',
        float: '0 1px 2px rgb(0 0 0 / .08), 0 6px 20px rgb(0 0 0 / .14)',
        card: 'inset 0 1px 0 rgb(255 255 255 / .04), 0 8px 24px rgb(0 0 0 / .25)',
        sheet: 'inset 0 1px 0 rgb(255 255 255 / .06), 0 12px 40px rgb(0 0 0 / .35)',
      },
      // Design tokens (design 1B; SPEC §2 with the senior UI review). Additive: existing classes keep
      // their look until the later phases move screens onto these names.
      // Separate radius names (review M2): redefining rounded-lg/xl would reshape every screen at once.
      borderRadius: { r1: '8px', r2: '14px', r3: '20px', r4: '28px', r5: '40px' },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'ios-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: { 250: '250ms', 350: '350ms', 450: '450ms' },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'float-1': 'float1 6s ease-in-out infinite',
        'float-2': 'float2 8s ease-in-out infinite',
        'float-3': 'float3 7s ease-in-out infinite',
        // Notification center / prompt (iOS-like springy ease; used behind motion-safe:)
        'sheet-in': 'sheetIn 0.45s cubic-bezier(0.32, 0.72, 0, 1) both',
        'hint-bob': 'hintBob 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        // Place card (design 1E): in on the iOS curve, out faster on the exit curve
        'card-in': 'cardIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) both',
        // Level identity: a new spot pings the avatar ring
        'ring-ping': 'ringPing 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
        // Level-up celebration
        'level-pop': 'levelPop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'rise-in': 'riseIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'rays-spin': 'raysSpin 14s linear infinite',
        'card-out': 'cardOut 0.28s cubic-bezier(0.4, 0, 1, 1) both',
        'sheet-out': 'sheetOut 0.18s ease-in both',
        'backdrop-in': 'fadeIn 0.25s ease-out both',
        'backdrop-out': 'fadeOut 0.18s ease-in both',
        'item-in': 'itemIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'badge-pop': 'badgePop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'bell-ring': 'bellRing 0.9s ease-in-out both',
        'prompt-in': 'promptIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) both',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        levelPop: {
          '0%': { opacity: '0', transform: 'scale(0.2) rotate(-25deg)' },
          '60%': { opacity: '1', transform: 'scale(1.12) rotate(4deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        raysSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        ringPing: {
          '0%': { opacity: '0.9', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.45)' },
        },
        cardIn: {
          '0%': { transform: 'translateY(calc(100% + 16px))' },
          '100%': { transform: 'translateY(0)' },
        },
        cardOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(calc(100% + 16px))', opacity: '0.6' },
        },
        hintBob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        sheetIn: {
          '0%': { opacity: '0', transform: 'translateY(-12px) scale(0.94)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sheetOut: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-8px) scale(0.96)' },
        },
        itemIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        badgePop: {
          '0%': { transform: 'scale(0.3)' },
          '100%': { transform: 'scale(1)' },
        },
        bellRing: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '15%': { transform: 'rotate(14deg)' },
          '30%': { transform: 'rotate(-12deg)' },
          '45%': { transform: 'rotate(8deg)' },
          '60%': { transform: 'rotate(-5deg)' },
          '75%': { transform: 'rotate(2deg)' },
        },
        promptIn: {
          '0%': { opacity: '0', transform: 'translateY(-24px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        float1: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)', opacity: '0.3' },
          '25%': { transform: 'translateY(-20px) rotate(5deg)', opacity: '0.6' },
          '50%': { transform: 'translateY(-10px) rotate(0deg)', opacity: '0.4' },
          '75%': { transform: 'translateY(-30px) rotate(-5deg)', opacity: '0.7' },
        },
        float2: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)', opacity: '0.4' },
          '33%': { transform: 'translateY(-25px) rotate(10deg)', opacity: '0.5' },
          '66%': { transform: 'translateY(-15px) rotate(-10deg)', opacity: '0.6' },
        },
        float3: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)', opacity: '0.5' },
          '50%': { transform: 'translateY(-35px) rotate(15deg)', opacity: '0.8' },
        },
      },
    },
  },
  plugins: [
    // Chrome over the dark and satellite map styles (design 1B): `chrome-dark:text-brand-400`.
    plugin(({ addVariant }) => {
      addVariant('chrome-dark', ['html[data-map-theme="dark"] &', 'html[data-map-theme="satellite"] &']);
    }),
  ],
};
export default config;
