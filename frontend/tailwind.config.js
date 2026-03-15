/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563eb', hover: '#1d4ed8', light: '#eff6ff' },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        sidebar: '#0f172a',
      },
    },
  },
  plugins: [],
};
