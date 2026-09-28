import type { Config } from "tailwindcss";

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
      },
      backdropBlur: {
        'glass': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-lg': '0 20px 48px 0 rgba(31, 38, 135, 0.2)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'float-1': 'float1 6s ease-in-out infinite',
        'float-2': 'float2 8s ease-in-out infinite',
        'float-3': 'float3 7s ease-in-out infinite',
        // Notification center / prompt (iOS-like springy ease; used behind motion-safe:)
        'sheet-in': 'sheetIn 0.45s cubic-bezier(0.32, 0.72, 0, 1) both',
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
  plugins: [],
};
export default config;
