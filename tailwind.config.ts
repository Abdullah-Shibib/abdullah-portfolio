import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0b0a07',
        panel: 'rgba(13, 22, 20, 0.55)',
        neon: '#4ea89a',
        neonDim: '#2a5248',
        violet: '#5f7a4a',
        ember: '#ff5c87',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 24px rgba(78, 168, 154, 0.35), inset 0 0 12px rgba(78, 168, 154, 0.08)',
        violet: '0 0 24px rgba(95, 122, 74, 0.35)',
      },
      backdropBlur: { hud: '14px' },
    },
  },
  plugins: [],
};
export default config;
