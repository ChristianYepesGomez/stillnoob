/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        void: {
          deep: '#0a0612',
          mid: '#12091f',
          surface: '#1a0f2e',
          glow: '#7b2ff2',
          bright: '#9d5cff',
          accent: '#c084fc',
          text: '#e8e0f0',
          muted: '#5c4f73',
          secondary: '#9a8bb5',
        },
        sunwell: {
          gold: '#f6c843',
          amber: '#ff9f1c',
        },
        fel: {
          green: '#00ff88',
        },
        blood: {
          red: '#ff3b5c',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out both',
        shimmer: 'shimmer 4s ease-in-out infinite',
        'void-drift': 'voidDrift 20s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        voidDrift: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '100%': { transform: 'translate(-5%, 3%) rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
};
