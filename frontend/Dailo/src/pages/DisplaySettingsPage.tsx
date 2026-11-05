import React, { useEffect, useState } from 'react';
import { WithdrawSection } from '../components/WithdrawSection';
import { ExportSection } from '../components/ExportSection';
import { PRESETS, ColorTheme, ThemeMode, resolveColors, rgbToHex, setColorTheme, setThemeMode, useTheme } from '../utils/theme';

const MODES: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light',  label: '라이트',    icon: '☀️' },
  { id: 'dark',   label: '다크',      icon: '🌙' },
  { id: 'system', label: '시스템 설정', icon: '💻' },
];

const Check = () => (
  <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

// 모드 미리보기 — 왼쪽 사이드바 + 본문 줄
const ModePreview = ({ mode }: { mode: ThemeMode }) => {
  const pane = (dark: boolean) => (
    <div className={`flex-1 flex ${dark ? 'bg-slate-900' : 'bg-slate-100'}`}>
      <div className={`w-1/4 ${dark ? 'bg-slate-800' : 'bg-white'}`} />
      <div className="flex-1 p-2 space-y-1.5">
        <div className={`h-1.5 w-3/4 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
        <div className={`h-1.5 w-1/2 rounded-full ${dark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <div className="h-1.5 w-1/3 rounded-full bg-primary-500" />
      </div>
    </div>
  );
  return (
    <div className="h-16 sm:h-20 rounded-lg overflow-hidden flex ring-1 ring-slate-200 dark:ring-slate-700">
      {mode === 'system' ? <>{pane(false)}{pane(true)}</> : pane(mode === 'dark')}
    </div>
  );
};

// 색 테마 미리보기 — 현재 모드 기준 사이드바색 + 강조색
const ThemePreview = ({ theme, isDark }: { theme: ColorTheme; isDark: boolean }) => {
  const { scale, sidebar } = resolveColors(theme);
  const accent = rgbToHex(isDark ? scale[400] : scale[600]);
  return (
    <div className="h-14 rounded-lg overflow-hidden flex ring-1 ring-slate-200 dark:ring-slate-700">
      <div className="w-1/3 p-1.5 space-y-1" style={{ background: rgbToHex(isDark ? sidebar.dark : sidebar.light) }}>
        <div className="h-1 w-3/4 rounded-full bg-slate-400/50" />
        <div className="h-1.5 w-full rounded-full" style={{ background: accent }} />
        <div className="h-1 w-2/3 rounded-full bg-slate-400/50" />
      </div>
      <div className="flex-1 p-1.5 space-y-1 bg-slate-50 dark:bg-dark-bg">
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: rgbToHex(scale[500]) }} />
        <div className="h-1 w-3/4 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="h-1 w-1/2 rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
};

export const DisplaySettingsPage = () => {
  const { mode, color, isDark } = useTheme();
  // 직접 고르기 기본값: 지금 테마의 색에서 출발
  const current = resolveColors(color);
  const [custom, setCustom] = useState({
    accent: color.id === 'custom' && color.accent ? color.accent : rgbToHex(current.scale[500]),
    sidebar: color.id === 'custom' && color.sidebar ? color.sidebar : rgbToHex(current.sidebar.dark),
  });

  // 색상 피커는 드래그 중 input 이벤트가 연속으로 옴 — 커스텀 선택 상태일 때만 즉시 반영
  useEffect(() => {
    if (color.id === 'custom' && (color.accent !== custom.accent || color.sidebar !== custom.sidebar)) {
      setColorTheme({ id: 'custom', ...custom });
    }
  }, [custom, color]);

  const card = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4 sm:p-6';
  const option = (selected: boolean) =>
    `text-left rounded-2xl p-2 sm:p-2.5 transition-colors min-w-0 ${
      selected
        ? 'ring-2 ring-primary-500 bg-primary-50/40 dark:bg-primary-900/10'
        : 'ring-1 ring-slate-200 dark:ring-dark-border hover:bg-slate-50 dark:hover:bg-slate-800/40'
    }`;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">이 기기에만 저장돼요</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">화면 설정</h1>
      </div>

      <section className={card}>
        <h2 className="font-semibold text-slate-800 dark:text-dark-text">화면 모드</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setThemeMode(m.id)} className={option(mode === m.id)} aria-pressed={mode === m.id}>
              <ModePreview mode={m.id} />
              <div className="flex items-center justify-between gap-1 mt-2 px-0.5 min-h-[24px]">
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  <span className="mr-1">{m.icon}</span>{m.label}
                </span>
                {mode === m.id && <Check />}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          시스템 설정을 고르면 휴대폰·PC에 정해 둔 다크 모드를 따라 자동으로 바뀝니다.
        </p>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-slate-800 dark:text-dark-text">색 테마</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setColorTheme({ id: p.id })} className={option(color.id === p.id)} aria-pressed={color.id === p.id}>
              <ThemePreview theme={{ id: p.id }} isDark={isDark} />
              <div className="flex items-center justify-between gap-1 mt-2 px-0.5 min-h-[24px]">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                {color.id === p.id && <Check />}
              </div>
            </button>
          ))}
        </div>

        {/* 직접 고르기 */}
        <div className={`mt-3 rounded-2xl p-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${
          color.id === 'custom' ? 'ring-2 ring-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'ring-1 ring-slate-200 dark:ring-dark-border'
        }`}>
          <button onClick={() => setColorTheme({ id: 'custom', ...custom })}
            className="flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-200">
            ✏️ 직접 고르기 {color.id === 'custom' && <Check />}
          </button>
          {(['sidebar', 'accent'] as const).map(key => (
            <label key={key} className="flex items-center gap-2 min-h-[44px] text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
              <input type="color" value={custom[key]}
                onChange={e => {
                  const v = e.target.value;
                  setCustom(c => ({ ...c, [key]: v }));
                  if (color.id !== 'custom') setColorTheme({ id: 'custom', ...custom, [key]: v });
                }}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
              {key === 'sidebar' ? '사이드바' : '강조색'}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          고른 색은 글자가 잘 읽히도록 밝기를 조금 옮겨 씁니다. 사이드바색은 다크 모드 기준이고, 라이트 모드에선 옅게 깔려요.
        </p>
      </section>

      <ExportSection className={card} />

      <WithdrawSection className={card} />
    </div>
  );
};
