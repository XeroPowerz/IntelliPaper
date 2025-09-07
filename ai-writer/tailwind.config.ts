import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f1115',
        panel: '#131621',
        panel2: '#0f1320',
        text: '#e6e8ee',
        muted: '#9aa3b2',
        accent: '#6aa3ff',
        accent2: '#4bd7a3',
        danger: '#ff6b6b',
        border: '#20263a'
      }
    },
  },
  plugins: [],
} satisfies Config

