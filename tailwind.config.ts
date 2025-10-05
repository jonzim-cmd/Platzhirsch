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
          DEFAULT: '#0c0d0f',
          soft: '#1f1f23',
        },
        fg: {
          DEFAULT: '#e6e9ef',
          muted: '#a3aab7',
        },
        primary: {
          DEFAULT: '#10a37f'
        }
      }
    }
  },
  plugins: []
} satisfies Config
