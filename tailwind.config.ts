import type { Config } from 'tailwindcss';

/**
 * Muted military command-center palette.
 * `teal` is deliberately overridden with a desaturated moss/olive ramp so every
 * legacy `teal-*` utility in the screens reskins in one move — no neon, no blue.
 */
const moss = {
  50: '#f2f2e8',
  100: '#e6e5d3',
  200: '#d0d2b6',
  300: '#b0ba90',
  400: '#8d9c6a',
  500: '#718152',
  600: '#5a6842',
  700: '#475237',
  800: '#373f2c',
  900: '#262c20',
  950: '#151a12',
};

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0c0c09',
        panel: 'rgba(20, 23, 18, 0.55)',
        neon: '#8d9c6a',
        neonDim: '#47523a',
        violet: '#5f7a4a',
        ember: '#a8443a',
        teal: moss,
        emerald: {
          200: '#d4d8b8',
          300: '#bcc49a',
          400: '#9aa876',
          500: '#7a8a58',
          950: '#171c11',
        },
        gunmetal: '#2b2f2b',
        charcoal: '#181a16',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 24px rgba(141, 156, 106, 0.3), inset 0 0 12px rgba(141, 156, 106, 0.07)',
        violet: '0 0 24px rgba(95, 122, 74, 0.35)',
      },
      backdropBlur: { hud: '14px' },
    },
  },
  plugins: [],
};
export default config;
