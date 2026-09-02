/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cloud: {
          bg: '#f8fafc',
          card: '#ffffff',
          primary: '#0284c7', // Muted sky blue
          secondary: '#8b5cf6', // Soft lavender
          accent: '#0d9488', // Calm teal
          slate: '#1e293b', // Dark slate text
          border: '#e2e8f0', // Subtle blue-gray border
        },
      },
    },
  },
  plugins: [],
};
