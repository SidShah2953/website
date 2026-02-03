const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Open Sans", ...defaultTheme.fontFamily.sans],
        mono: ["SF Mono", "Monaco", "Inconsolata", "Fira Code", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          light: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.06)',
        },
        finance: {
          green: '#00d084',
          red: '#ff4757',
          blue: '#3b82f6',
          'deep-blue': '#2563eb',
          cyan: '#0ea5e9',
          purple: '#a855f7',
          gold: '#fbbf24',
        },
        dark: {
          bg: '#000000',
          card: '#0a0a0a',
          elevated: '#111111',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 40% 20%, hsla(240, 95%, 25%, 0.4) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(200, 95%, 35%, 0.3) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(280, 95%, 35%, 0.3) 0px, transparent 50%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-lg': '0 15px 50px 0 rgba(0, 0, 0, 0.5)',
        'inner-glass': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          'from': { opacity: '0.4' },
          'to': { opacity: '0.8' },
        }
      }
    },
  },
  plugins: [],
};
