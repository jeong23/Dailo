import { useEffect, useState } from 'react';

// 화면 모드(라이트/다크/시스템) + 색 테마(강조색·사이드바색) — localStorage 저장, <html>에 CSS 변수로 적용.
// tailwind의 primary-* / sidebar 색은 이 변수를 읽는다 (tailwind.config.js).
// 'darkMode' 키는 옛 토글 값 — themeMode가 없을 때만 읽어서 이어받는다.

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorTheme {
  id: string;           // 프리셋 id 또는 'custom'
  accent?: string;      // custom일 때 강조색 hex
  sidebar?: string;     // custom일 때 사이드바색 hex
}

type Rgb = [number, number, number];
type Scale = Record<(typeof STEPS)[number], Rgb>;

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

// 기본 '파랑'은 tailwind blue 그대로 — 테마 기능 전과 화면이 똑같아야 함
const BLUE: Scale = {
  50: [239, 246, 255], 100: [219, 234, 254], 200: [191, 219, 254], 300: [147, 197, 253], 400: [96, 165, 250],
  500: [59, 130, 246], 600: [37, 99, 235], 700: [29, 78, 216], 800: [30, 64, 175], 900: [30, 58, 138],
};

export const PRESETS: { id: string; name: string; accent: string }[] = [
  { id: 'blue',   name: '파랑', accent: '#3b82f6' },
  { id: 'indigo', name: '남색', accent: '#6366f1' },
  { id: 'grape',  name: '포도', accent: '#8b5cf6' },
  { id: 'pink',   name: '벚꽃', accent: '#ec4899' },
  { id: 'sunset', name: '노을', accent: '#f97316' },
  { id: 'forest', name: '숲',   accent: '#10b981' },
  { id: 'teal',   name: '청록', accent: '#14b8a6' },
  { id: 'ink',    name: '먹',   accent: '#64748b' },
];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const DARK_CARD: Rgb = [30, 41, 59];   // dark.card #1e293b — 다크 모드 기본 사이드바
const PAGE_BG = { light: '#f8fafc', dark: '#0f172a' };

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = ([r, g, b]: Rgb) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;

// 상대 휘도 (WCAG)
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// 너무 밝으면 검정 쪽으로 조금씩 옮김 — 흰 글자 버튼(bg-primary-600)·밝은 글자 사이드바가 읽히도록
const darkenTo = (c: Rgb, max: number): Rgb => {
  let out = c;
  for (let t = 0.05; luminance(out) > max && t <= 1; t += 0.05) out = mix(c, BLACK, t);
  return out;
};

const buildScale = (accentHex: string): Scale => {
  const base = darkenTo(hexToRgb(accentHex), 0.3);
  return {
    50: mix(WHITE, base, 0.07), 100: mix(WHITE, base, 0.15), 200: mix(WHITE, base, 0.28),
    300: mix(WHITE, base, 0.45), 400: mix(WHITE, base, 0.7), 500: base,
    600: mix(base, BLACK, 0.14), 700: mix(base, BLACK, 0.28), 800: mix(base, BLACK, 0.42), 900: mix(base, BLACK, 0.55),
  };
};

/** 테마의 강조색 스케일 + 모드별 사이드바색 */
export const resolveColors = (theme: ColorTheme) => {
  const preset = PRESETS.find(p => p.id === theme.id);
  const accent = theme.id === 'custom' ? theme.accent || PRESETS[0].accent : (preset ?? PRESETS[0]).accent;
  const scale = theme.id === 'blue' || (!preset && theme.id !== 'custom') ? BLUE : buildScale(accent);
  if (scale === BLUE) return { scale, sidebar: { light: WHITE, dark: DARK_CARD } };

  if (theme.id === 'custom' && theme.sidebar) {
    const picked = hexToRgb(theme.sidebar);
    return { scale, sidebar: { light: mix(WHITE, picked, 0.08), dark: darkenTo(picked, 0.05) } };
  }
  return { scale, sidebar: { light: mix(WHITE, scale[500], 0.05), dark: mix(DARK_CARD, scale[600], 0.22) } };
};

const readMode = (): ThemeMode => {
  try {
    const m = localStorage.getItem('themeMode');
    if (m === 'light' || m === 'dark' || m === 'system') return m;
    const legacy = localStorage.getItem('darkMode');
    return legacy === 'false' ? 'light' : 'dark';   // 기본값: 다크
  } catch { return 'dark'; }
};

const readColor = (): ColorTheme => {
  try {
    const raw = localStorage.getItem('colorTheme');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.id === 'string') return parsed;
  } catch { /* 깨진 값은 기본으로 */ }
  return { id: 'blue' };
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
const isDarkFor = (mode: ThemeMode) => (mode === 'system' ? systemDark() : mode === 'dark');

const EVENT = 'dailo-theme';

export const applyTheme = () => {
  const mode = readMode();
  const dark = isDarkFor(mode);
  const { scale, sidebar } = resolveColors(readColor());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  STEPS.forEach(s => root.style.setProperty(`--primary-${s}`, scale[s].join(' ')));
  root.style.setProperty('--sidebar-bg', (dark ? sidebar.dark : sidebar.light).join(' '));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? PAGE_BG.dark : PAGE_BG.light);
  window.dispatchEvent(new Event(EVENT));
};

export const setThemeMode = (mode: ThemeMode) => {
  localStorage.setItem('themeMode', mode);
  localStorage.setItem('darkMode', String(isDarkFor(mode)));
  applyTheme();
};

export const setColorTheme = (theme: ColorTheme) => {
  localStorage.setItem('colorTheme', JSON.stringify(theme));
  applyTheme();
};

/** 앱 시작 시 한 번 — 렌더 전에 적용해 깜빡임 방지, 시스템 모드면 OS 변경 추적 */
export const initTheme = () => {
  applyTheme();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (readMode() === 'system') applyTheme();
  });
};

export const useTheme = () => {
  const read = () => ({ mode: readMode(), color: readColor(), isDark: document.documentElement.classList.contains('dark') });
  const [state, setState] = useState(read);
  useEffect(() => {
    const on = () => setState(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return state;
};
