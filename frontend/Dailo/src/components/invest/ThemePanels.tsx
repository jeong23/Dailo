import React from 'react';
import { Link } from 'react-router-dom';
import { TRAction, TRResult } from '../../utils/themeRebalance';
import { THEME_COLORS } from '../../utils/themeDefaults';

// 투자 현황 — 테마 모드 화면 조각 (InvestDashboardPage에서 테마가 있을 때 사용)
//  ThemeTodo: 이번 달 할 일 (계좌별 매수·매도 → 체결 완료)
//  ThemeBreakdown: 테마별 현재 비중 vs 목표 + 소속 종목

export interface ThemeInfo { id: number; name: string; targetPct: number; cash: boolean }
export interface ThemeHolding {
  holdingId: number; accountId: number; ticker: string; themeId: number | null;
  evalAmt: number | null; purchaseAmt: number | null; profitPct: number | null;
  shares: number | null; currentPrice: number | null;
}
export interface ThemeAccount { id: number; name: string; contribution: number; budget: number; tradeCount: number }
export interface Blocker { accountId: number; kind: 'duplicate' | 'price'; text: string }

const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const fmt = (n: number) => Math.round(n).toLocaleString();
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const profitColor = (v: number) => (v > 0 ? 'text-rose-500' : v < 0 ? 'text-blue-500' : 'text-slate-400');
const shortAcc = (name: string) => name.replace(/^[\d-]+\s*/, '').replace(/\t/g, ' ').slice(0, 14);

const SIDE: Record<TRAction['side'], { label: string; chip: string; text: string; sign: string }> = {
  SELL:      { label: '매도',     chip: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', text: 'text-blue-500', sign: '−' },
  USE_CASH:  { label: '현금 사용', chip: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', text: 'text-blue-500', sign: '−' },
  BUY:       { label: '매수',     chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400', text: 'text-rose-500', sign: '+' },
  KEEP_CASH: { label: '현금 유지', chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', text: 'text-emerald-600', sign: '+' },
};
const ORDER: Record<TRAction['side'], number> = { SELL: 0, USE_CASH: 1, BUY: 2, KEEP_CASH: 3 };

export const themeColor = (themes: ThemeInfo[], id: number | null) => {
  const i = themes.findIndex(t => t.id === id);
  return i < 0 ? '#cbd5e1' : THEME_COLORS[i % THEME_COLORS.length];
};

export const ThemeTodo = ({
  themes, holdings, accounts, plan, blockers, threshold, monthlyBudget, withContribution, onToggleContribution, onTrade, children,
}: {
  themes: ThemeInfo[]; holdings: ThemeHolding[]; accounts: ThemeAccount[]; plan: TRResult | null; blockers: Blocker[];
  threshold: number; monthlyBudget: number; withContribution: boolean; onToggleContribution: () => void;
  onTrade: (holdingId: number, side: 'BUY' | 'SELL', shares: number | null) => void;
  children?: React.ReactNode; // 이번 달 체결 내역
}) => {
  const byId = (id: number | null) => holdings.find(h => h.holdingId === id);
  const themeName = (id: number) => themes.find(t => t.id === id)?.name ?? '';
  const actions = plan?.actions ?? [];
  const sellTotal = actions.filter(a => a.side === 'SELL' || a.side === 'USE_CASH').reduce((s, a) => s + a.amount, 0);
  const buyTotal = actions.filter(a => a.side === 'BUY').reduce((s, a) => s + a.amount, 0);
  const tradeActions = actions.filter(a => a.side === 'BUY' || a.side === 'SELL');

  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 dark:text-dark-text">이번 달 할 일</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {blockers.length > 0 ? '먼저 정리할 게 있어요'
              : tradeActions.length > 0 ? `테마 비중 ±${threshold}%p 기준 · 매도 ${actions.filter(a => a.side === 'SELL').length}건 · 매수 ${actions.filter(a => a.side === 'BUY').length}건`
              : '테마 비중이 목표 안이에요'}
          </p>
        </div>
        {monthlyBudget > 0 && (
          <button onClick={onToggleContribution} aria-pressed={withContribution}
            className={`shrink-0 h-11 sm:h-9 px-3.5 rounded-full text-xs font-medium transition-colors ${
              withContribution ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
            {withContribution ? '✓ ' : ''}이번 달 납입금 {fmt(monthlyBudget)}원 포함
          </button>
        )}
      </div>

      {blockers.length > 0 && (
        <div className="mt-3 space-y-2">
          {blockers.map((b, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 px-3 py-2">
              <p className="text-xs text-amber-700 dark:text-amber-400 min-w-0">{b.text}</p>
              <Link to="/invest/settings" className="shrink-0 h-11 sm:h-9 px-3 inline-flex items-center rounded-full bg-amber-500 text-white text-xs font-medium">
                {b.kind === 'duplicate' ? '설정에서 합치기' : '설정 열기'}
              </Link>
            </div>
          ))}
        </div>
      )}

      {plan && (sellTotal > 0 || buyTotal > 0) && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-xl bg-blue-50/70 dark:bg-blue-900/10 px-3 py-2.5 min-w-0">
            <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80">팔 금액</p>
            <p className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400 truncate">{fmt(sellTotal)}원</p>
          </div>
          <div className="rounded-xl bg-rose-50/70 dark:bg-rose-900/10 px-3 py-2.5 min-w-0">
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">살 금액</p>
            <p className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400 truncate">{fmt(buyTotal)}원</p>
          </div>
        </div>
      )}

      {plan && (
        <div className="mt-4 space-y-3">
          {accounts.map(acc => {
            const list = actions.filter(a => a.accountId === acc.id).sort((x, y) => ORDER[x.side] - ORDER[y.side] || y.amount - x.amount);
            const left = plan.leftover[acc.id] ?? 0;
            if (list.length === 0 && acc.budget === 0) return null;
            return (
              <div key={acc.id} className="rounded-xl ring-1 ring-slate-100 dark:ring-dark-border/60 p-3">
                <div className="flex items-baseline justify-between gap-3 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate min-w-0">{acc.name}</p>
                  {acc.budget > 0 && <p className="text-[11px] text-slate-400 tabular-nums shrink-0">쓸 돈 {fmt(acc.budget)}원</p>}
                </div>
                {list.length === 0 ? (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">✓ 이 계좌는 할 일이 없어요</p>
                ) : (
                  <ul className="mt-1 divide-y divide-slate-50 dark:divide-dark-border/50">
                    {list.map((a, i) => {
                      const h = byId(a.holdingId);
                      const st = SIDE[a.side];
                      const tradable = (a.side === 'BUY' || a.side === 'SELL') && h;
                      return (
                        <li key={i} className="flex items-center gap-3 py-2.5 min-w-0">
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${st.chip}`}>{st.label}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 break-all">
                              {h ? h.ticker : `${themeName(a.themeId)}(현금)`}
                            </p>
                            <p className="text-[11px] tabular-nums flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: themeColor(themes, a.themeId) }} />
                              <span className="text-slate-500 dark:text-slate-400 truncate">{themeName(a.themeId)}</span>
                              {h?.profitPct != null && <span className={`shrink-0 ${profitColor(h.profitPct)}`}>· 수익률 {fmtPct(h.profitPct)}</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold tabular-nums ${st.text}`}>{a.shares ? `${a.shares}주` : `${st.sign}${fmt(a.amount)}원`}</p>
                            {a.shares ? <p className="text-[11px] text-slate-400 tabular-nums">{fmt(a.amount)}원</p> : null}
                          </div>
                          {tradable && (
                            <button onClick={() => onTrade(h!.holdingId, a.side as 'BUY' | 'SELL', a.shares)}
                              className="shrink-0 h-11 sm:h-9 px-3 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700">
                              체결 완료
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {left > 0 && (
                  <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                    남는 돈 {fmt(left)}원 — {list.some(x => x.side === 'BUY') ? '1주 가격보다 적게 남은 돈' : '이 계좌에서 살 수 있는 테마가 이미 목표를 채웠어요'} · 예수금으로 두고 다음 달에 써요
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {children}
      <p className="text-[11px] text-slate-400 mt-3">
        돈은 계좌 안에서만 움직여요. 살 수 있는 테마가 적은 계좌부터, 전체 기준으로 가장 모자란 테마의 종목을 1주씩 골랐어요. 증권 앱에서 실행 후 '체결 완료'를 누르면 보유 수량·평균단가가 바뀌고 다시 계산돼요.
      </p>
    </section>
  );
};

export const ThemeBreakdown = ({
  themes, holdings, accountName, plan, threshold,
}: {
  themes: ThemeInfo[]; holdings: ThemeHolding[]; accountName: (id: number) => string; plan: TRResult | null; threshold: number;
}) => {
  const total = holdings.filter(h => h.themeId !== null && themes.some(t => t.id === h.themeId)).reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  const unassigned = holdings.filter(h => h.themeId === null || !themes.some(t => t.id === h.themeId));
  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-bold text-slate-900 dark:text-dark-text">테마 비중</p>
        <p className="text-xs text-slate-400 tabular-nums">투자 {fmt(total)}원</p>
      </div>

      {/* 현재 비중 막대 (목표 대비) */}
      <div className="mt-3 h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        {themes.map(t => {
          const v = holdings.filter(h => h.themeId === t.id).reduce((s, h) => s + (h.evalAmt ?? 0), 0);
          return total > 0 && v > 0 ? <div key={t.id} style={{ width: `${(v / total) * 100}%`, background: themeColor(themes, t.id) }} /> : null;
        })}
      </div>

      <ul className="mt-4 space-y-3">
        {themes.map(t => {
          const members = holdings.filter(h => h.themeId === t.id).sort((a, b) => (b.evalAmt ?? 0) - (a.evalAmt ?? 0));
          const value = members.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
          const cur = total > 0 ? (value / total) * 100 : 0;
          const diff = cur - t.targetPct;
          const pl = members.filter(h => h.evalAmt != null && h.purchaseAmt != null);
          const plEval = pl.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
          const plCost = pl.reduce((s, h) => s + (h.purchaseAmt ?? 0), 0);
          const profitPct = plCost > 0 ? ((plEval - plCost) / plCost) * 100 : null;
          const after = plan?.themes.find(x => x.id === t.id)?.afterPct;
          const status = Math.abs(diff) <= threshold
            ? { label: '목표 안', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' }
            : diff > 0
              ? { label: `${diff.toFixed(1)}%p 초과`, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' }
              : { label: `${(-diff).toFixed(1)}%p 부족`, cls: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' };
          return (
            <li key={t.id} className="rounded-xl bg-slate-50/70 dark:bg-slate-800/20 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: themeColor(themes, t.id) }} />
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text truncate min-w-0 flex-1">
                  {t.name}{t.cash && <span className="ml-1 text-[11px] font-normal text-slate-400">현금성</span>}
                </p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text">
                    {cur.toFixed(1)}%<span className="text-xs font-medium text-slate-400 ml-1.5">목표 {t.targetPct}%</span>
                  </p>
                  {after !== undefined && Math.abs(after - cur) >= 0.1 && (
                    <p className="text-[11px] text-slate-400 tabular-nums">할 일 실행 후 {after.toFixed(1)}%</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{fmt(value)}원</p>
                  {profitPct !== null && <p className={`text-xs font-semibold tabular-nums ${profitColor(profitPct)}`}>{fmtPct(profitPct)}</p>}
                </div>
              </div>
              {/* 목표선 표시 진행바 */}
              <div className="relative mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(cur, 100)}%`, background: themeColor(themes, t.id) }} />
                <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-500 dark:bg-slate-300" style={{ left: `${Math.min(t.targetPct, 100)}%` }} />
              </div>
              {members.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {members.map(h => (
                    <li key={h.holdingId} className="flex items-center gap-2 text-xs min-w-0">
                      <span className="truncate flex-1 min-w-0 text-slate-600 dark:text-slate-300">{h.ticker}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">{shortAcc(accountName(h.accountId))}</span>
                      <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400 w-20 text-right">{h.evalAmt != null ? `${fmt(h.evalAmt)}원` : '—'}</span>
                      <span className={`shrink-0 tabular-nums w-14 text-right ${h.profitPct != null ? profitColor(h.profitPct) : 'text-slate-300'}`}>
                        {h.profitPct != null ? fmtPct(h.profitPct) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-400">이 테마에 배정된 종목이 없어요</p>
              )}
            </li>
          );
        })}
      </ul>
      {unassigned.length > 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          테마가 없는 종목 {unassigned.length}개는 비중 계산에서 빠져요: {unassigned.map(h => h.ticker).join(', ')} — <Link to="/invest/settings" className="underline">설정</Link>
        </p>
      )}
    </section>
  );
};
