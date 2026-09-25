/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#0b0e14',
          surface: '#12161f',
          border: '#1f2530',
          accent: '#5b8cff',
        },
      },
    },
  },
  plugins: [],
};
