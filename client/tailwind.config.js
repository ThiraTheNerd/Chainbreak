/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './src/components/ui/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background:  '#0D1117',
        surface:     '#161B22',
        'surface-2': '#1C2128',
        border:      '#30363D',
        'border-2':  '#484F58',
        'text-1':    '#E6EDF3',
        'text-2':    '#8B949E',
        'text-3':    '#484F58',
        accent:      '#388BFD',
        success:     '#2EA043',
        warning:     '#D29922',
        danger:      '#F85149',
        purple:      '#BC8CFF',
        // Layer colours
        'layer-web':       '#388BFD',
        'layer-container': '#2EA043',
        'layer-cloud':     '#D29922',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
