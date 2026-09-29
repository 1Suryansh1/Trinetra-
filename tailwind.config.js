/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07090C',
          900: '#0A0E13',
          850: '#0D1218',
          800: '#10161D',
          750: '#141B23',
          700: '#18212B',
          600: '#1F2A35',
          500: '#2A3744',
          400: '#3A4958',
        },
        fg: {
          DEFAULT: '#D6DDE4',
          hi: '#EEF2F5',
          muted: '#8C99A7',
          dim: '#5D6A78',
        },
        amber: { DEFAULT: '#D6A24A', dim: '#3A2F1C', line: '#6B5328' },
        teal: { DEFAULT: '#3EB2A8', dim: '#15302E', line: '#23605A' },
        rej: { DEFAULT: '#C2625C', dim: '#361C1B', line: '#6A3230' },
        ok: { DEFAULT: '#57B37E', dim: '#16301F', line: '#2A6040' },
        sar: { DEFAULT: '#8FA3C7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10.5px', '14px'],
        xs: ['11.5px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
      },
      letterSpacing: { label: '0.14em' },
    },
  },
  plugins: [],
}
