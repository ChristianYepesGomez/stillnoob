/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          deepblue: '#0a0e27',
          spaceblue: '#1a1d3a',
          purple: '#4a1a8f',
          'bright-purple': '#8b5cf6',
          glow: '#a78bfa',
          silver: '#e0e7ff',
          accent: '#6d28d9',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
