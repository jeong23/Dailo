import React, { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { resolveColors, rgbToHex, useTheme } from '../utils/theme';

// 순자산 추이 — 정산월별 스냅샷(GET /assets/snapshots). 자산 현황을 열 때마다 이번 달 값이 덮어써져 마지막 기록 = 그 달 말 값
export interface Snapshot {
  settleMonth: string; // YYYY-MM
  cash: number;
  invest: number;
  savings: number;
  manual: number;
  total: number;
  capturedAt: string;
}

const KINDS: { key: keyof Pick<Snapshot, 'cash' | 'invest' | 'savings' | 'manual'>; label: string }[] = [
  { key: 'cash', label: '현금' },
  { key: 'invest', label: '투자' },
  { key: 'savings', label: '적금·청약' },
  { key: 'manual', label: '직접 입력' },
];

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
// 축 눈금: 1억 이상은 억, 그 아래는 만
const axisWon = (n: number) => Math.abs(n) >= 1e8 ? `${(n / 1e8).toFixed(n % 1e8 === 0 ? 0 : 1)}억` : `${Math.round(n / 1e4).toLocaleString()}만`;
const monthLabel = (ym: string) => `${Number(ym.slice(5))}월`;
const fullMonth = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;

const Delta = ({ value, className = '' }: { value: number; className?: string }) => {
  if (value === 0) return <span className={`text-slate-400 ${className}`}>변동 없음</span>;
  // 한국 관례: 늘면 빨강(rose), 줄면 파랑 — 투자 페이지와 같은 색
  const up = value > 0;
  return (
    <span className={`tabular-nums font-medium ${up ? 'text-rose-500' : 'text-blue-500'} ${className}`}>
      {up ? '▲' : '▼'} {won(Math.abs(value))}
    </span>
  );
};

const TrendTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const s: Snapshot & { prev?: number } = payload[0].payload;
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-2.5 text-xs min-w-[180px]">
      <p className="font-semibold text-slate-800 dark:text-slate-100">{fullMonth(s.settleMonth)}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{won(s.total)}</p>
      {s.prev != null && <p className="mt-0.5"><Delta value={s.total - s.prev} /> <span className="text-slate-400">전월 대비</span></p>}
      <ul className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-0.5">
        {KINDS.filter(k => s[k.key] > 0).map(k => (
          <li key={k.key} className="flex justify-between gap-3 text-slate-500 dark:text-slate-400">
            <span>{k.label}</span><span className="tabular-nums text-slate-700 dark:text-slate-200">{won(s[k.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const NetWorthTrend = ({ snapshots, className }: { snapshots: Snapshot[]; className: string }) => {
  const { color, isDark } = useTheme();
  const scale = resolveColors(color).scale;
  const line = rgbToHex(isDark ? scale[400] : scale[500]);
  const grid = isDark ? '#334155' : '#e2e8f0';
  const tick = isDark ? '#94a3b8' : '#64748b';

  const data = snapshots.map((s, i) => ({ ...s, prev: i > 0 ? snapshots[i - 1].total : undefined, prevSnap: i > 0 ? snapshots[i - 1] : undefined }));
  const last = data[data.length - 1];
  const first = data[0];
  // 펼친 달 — 표에서 누르거나 그래프 점을 누르면 칸별 증감
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const recentBase = [...data].reverse().slice(0, 6);
  // 그래프에서 6개월보다 오래된 달을 누르면 표에 그 달도 붙여서 보여줌
  const older = openMonth && !recentBase.some(s => s.settleMonth === openMonth) ? data.find(s => s.settleMonth === openMonth) : undefined;
  const recent = older ? [...recentBase, older] : recentBase;
  const toggle = (m: string) => setOpenMonth(cur => (cur === m ? null : m));

  return (
    <section className={className} aria-labelledby="net-worth-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="net-worth-title" className="text-sm font-semibold text-slate-900 dark:text-dark-text">순자산 추이</h2>
          <p className="text-xs text-slate-400 mt-0.5">달마다 이 화면을 연 마지막 시점 금액이에요</p>
        </div>
        {last?.prev != null && (
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-400">전월 대비</p>
            <Delta value={last.total - last.prev} className="text-sm" />
          </div>
        )}
      </div>

      {data.length < 2 ? (
        <p className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-5 text-sm text-slate-500 dark:text-slate-400 text-center">
          {data.length === 0 ? '아직 기록이 없어요.' : `${fullMonth(data[0].settleMonth)}부터 기록을 시작했어요.`}
          <br />다음 달에도 자산 현황을 열면 추이 그래프가 그려져요.
        </p>
      ) : (
        <>
          <div className="mt-4 h-52 sm:h-60 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                onClick={(st: any) => { if (st?.activeLabel) setOpenMonth(st.activeLabel); }} className="cursor-pointer">
                <defs>
                  <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={line} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 3" />
                <XAxis dataKey="settleMonth" tickFormatter={monthLabel} tick={{ fill: tick, fontSize: 11 }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={axisWon} tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false}
                  width={52} domain={['auto', 'auto']} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: tick, strokeWidth: 1, strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="total" stroke={line} strokeWidth={2} fill="url(#netWorthFill)"
                  dot={data.length <= 12 ? { r: 4, fill: line, stroke: isDark ? '#1e293b' : '#fff', strokeWidth: 2 } : false}
                  activeDot={{ r: 5, fill: line, stroke: isDark ? '#1e293b' : '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} name="순자산" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {first && last && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {fullMonth(first.settleMonth)} 이후 <Delta value={last.total - first.total} />
            </p>
          )}
        </>
      )}

      {/* 표 보기 — 그래프 없이도 읽히게 (최근 6개월). 달을 누르면 칸별 증감 */}
      {data.length > 0 && (
        <ul className="mt-4 pt-3 border-t border-slate-100 dark:border-dark-border/60 divide-y divide-slate-50 dark:divide-dark-border/40">
          {recent.map(s => {
            const open = openMonth === s.settleMonth;
            return (
              <li key={s.settleMonth}>
                <button
                  onClick={() => toggle(s.settleMonth)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 min-h-[44px] py-2 text-sm min-w-0 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30 rounded-lg -mx-1 px-1 transition-colors"
                >
                  <span className="w-20 shrink-0 text-slate-500 dark:text-slate-400">{fullMonth(s.settleMonth).slice(2)}</span>
                  <span className="flex-1 min-w-0 truncate tabular-nums font-semibold text-slate-800 dark:text-dark-text">{won(s.total)}</span>
                  <span className="shrink-0 text-xs">{s.prev != null ? <Delta value={s.total - s.prev} /> : <span className="text-slate-400">첫 기록</span>}</span>
                  <span className={`shrink-0 text-slate-300 dark:text-slate-600 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>›</span>
                </button>
                {open && <KindBreakdown cur={s} prev={s.prevSnap} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};


// 직전 기록 대비 칸(현금·투자·적금·직접 입력)별 증감 — 어디서 늘고 줄었는지
const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

const KindBreakdown = ({ cur, prev }: { cur: Snapshot; prev?: Snapshot }) => {
  const rows = KINDS
    .map(k => ({ ...k, now: cur[k.key], diff: prev ? cur[k.key] - prev[k.key] : null }))
    .filter(r => r.now !== 0 || (r.diff ?? 0) !== 0);
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.diff ?? 0)));
  const gap = prev && nextMonth(prev.settleMonth) !== cur.settleMonth;
  return (
    <div className="mb-2 ml-1 rounded-xl bg-slate-50 dark:bg-slate-800/40 px-3 py-3">
      {prev ? (
        <p className="text-[11px] text-slate-400 mb-2">
          {gap ? `${fullMonth(prev.settleMonth)} 기록과 비교 (사이 달은 기록 없음)` : '전월 대비 칸별 증감'}
        </p>
      ) : (
        <p className="text-[11px] text-slate-400 mb-2">첫 기록이라 칸별 금액만 보여요</p>
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">자산 칸이 비어 있어요.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-300 min-w-0 truncate">
                  {r.label} <span className="text-slate-400 tabular-nums">{won(r.now)}</span>
                </span>
                {r.diff != null && <Delta value={r.diff} className="shrink-0" />}
              </div>
              {r.diff != null && r.diff !== 0 && (
                <div className="mt-1 h-1 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.diff > 0 ? 'bg-rose-400' : 'bg-blue-400'}`}
                    style={{ width: `${(Math.abs(r.diff) / maxAbs) * 100}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
