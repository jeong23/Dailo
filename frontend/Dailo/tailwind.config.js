/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 색 테마(utils/theme.ts)가 <html>에 --primary-* 변수로 넣음 — 기본값은 index.css (tailwind blue)
        primary: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(s => [s, `rgb(var(--primary-${s}) / <alpha-value>)`])
        ),
        sidebar: 'rgb(var(--sidebar-bg) / <alpha-value>)',
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          text: '#e2e8f0',
          muted: '#94a3b8',
        }
      },
      // 운동 상세 시트용 — 바텀시트 슬라이드업 / 배경 페이드 / 요소 순차 등장
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'pop': { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'sheet-up': 'sheet-up 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'rise-in': 'rise-in 0.4s cubic-bezier(0.32, 0.72, 0, 1) both',
        'pop': 'pop 0.28s ease-out',
        'slide-in': 'slide-in 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
