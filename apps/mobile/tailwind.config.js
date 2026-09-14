/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // OLED-first palette
        bg: '#000000',
        surface: '#111111',
        border: '#1f1f1f',
        text: {
          DEFAULT: '#f5f5f5',
          muted: '#525252',
          dim: '#3a3a3a',
        },
      },
      fontFamily: {
        sans: ['System'],
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
