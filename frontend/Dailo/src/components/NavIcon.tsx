// 사이드바·하단 탭 아이콘 — 이모지 대신 선 아이콘 (currentColor라 활성·테마 색을 그대로 따라감)
const PATHS = {
  dashboard: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-3H4zm10-13h6V4h-6z',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zm0 3h18M7 15h4',
  repeat: 'M17 2l3 3-3 3M20 5H8a4 4 0 00-4 4v1m3 12l-3-3 3-3M4 19h12a4 4 0 004-4v-1',
  report: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  sliders: 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M15 4v4M9 10v4M17 16v4',
  pie: 'M21 12a9 9 0 11-9-9v9zm-6-8.5A9 9 0 0120.5 9H15z',
  wallet: 'M20 7V5a1 1 0 00-1-1H5a2 2 0 00-2 2v12a2 2 0 002 2h14a1 1 0 001-1v-3m0-8H6a2 2 0 01-2-2m16 2v8h-4a2 2 0 010-4h4',
  coins: 'M4 7c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2zm0 0v5c0 1.1 3.6 2 8 2s8-.9 8-2V7M4 12v5c0 1.1 3.6 2 8 2s8-.9 8-2v-5',
  trend: 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  book: 'M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2zm0 15a2 2 0 002 2h13v-4M8 7h7',
  calendar: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zm0 4h16M8 3v4m8-4v4M8 15h2m4 0h2',
  checklist: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  habit: 'M12 21a9 9 0 110-18 9 9 0 010 18zm-4-9l3 3 5-6',
} as const;

export type NavIconName = keyof typeof PATHS;

export const NavIcon = ({ name, className = 'w-[18px] h-[18px]' }: { name: NavIconName; className?: string }) => (
  <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={PATHS[name]} />
  </svg>
);
