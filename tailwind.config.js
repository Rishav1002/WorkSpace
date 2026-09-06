/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        surfaceHover: 'var(--surface-hover)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        brand: 'var(--brand)',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.02)',
        float: '0 12px 30px -4px rgba(0,0,0,0.08), 0 4px 12px -2px rgba(0,0,0,0.04)',
        'float-dark': '0 16px 36px -4px rgba(0,0,0,0.55), 0 6px 16px -2px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};