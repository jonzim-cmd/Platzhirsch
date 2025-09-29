import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './server/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0f12',
          soft: '#10161a',
        },
        fg: {
          DEFAULT: '#e6e9ef',
          muted: '#a3aab7',
        },
        primary: {
          DEFAULT: '#5eead4'
        }
      }
    }
  },
  plugins: []
} satisfies Config

