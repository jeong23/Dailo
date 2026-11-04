import React from 'react';
import { Link } from 'react-router-dom';
import { TRAction, TRResult } from '../../utils/themeRebalance';
import { THEME_COLORS } from '../../utils/themeDefaults';

// 투자 현황 — 테마 모드 화면 조각 (InvestDashboardPage에서 테마가 있을 때 사용)
//  ThemeTodo: 이번 달 할 일 (계좌별 매수·매도 → 체결 완료)
//  ThemeBreakdown: 테마별 현재 비중 vs 목표 + 소속 종목
//  위성 테마(satellite)는 목표 대신 '최대 N%' — 상한 아래면 할 일 없음, 넘으면 안내 (납입금으로 사지 않음)

export interface ThemeInfo { id: number; name: string; targetPct: number; cash: boolean; satellite?: boolean }

// 위성 테마 중 상한 + threshold를 넘은 것 — {theme, 현재 %}
const overCapSatellites = (themes: ThemeInfo[], holdings: ThemeHolding[], threshold: number) => {
  const inTheme = holdings.filter(h => h.themeId !== null && themes.some(t => t.id === h.themeId));
  const total = inTheme.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  if (total <= 0) return [];
  return themes.filter(t => t.satellite).map(t => ({
    theme: t, pct: (inTheme.filter(h => h.themeId === t.id).reduce((s, h) => s + (h.evalAmt ?? 0), 0) / total) * 100,
  })).filter(x => x.pct - x.theme.targetPct > threshold);
};
export interface ThemeHolding {
  holdingId: number; accountId: number; ticker: string; themeId: number | null;
  evalAmt: number | null; purchaseAmt: number | null; profitPct: number | null;
  shares: number | null; currentPrice: number | null;
}
export interface ThemeAccount { id: number; name: string; type?: string; contribution: number; budget: number; tradeCount: number }
export interface Blocker { accountId: number; kind: 'duplicate' | 'price'; text: string }

// 받침 있으면 '이', 없으면 '가' (한글 아닌 끝 글자는 '이')
const josaIGa = (word: string) => {
  const c = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 === 0 ? '가' : '이';
};
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

// 일반 계좌 매도 세금 (참고용): 국내 상장 해외·채권·원자재 ETF 매매차익은 배당소득세 15.4%, 국내 주식형 ETF는 비과세.
// ISA·연금저축·IRP는 계좌 안에서 사고팔 땐 세금 없음 (ISA는 만기, 연금은 꺼낼 때 과세)
const GAIN_TAX = 0.154;
const taxFreeAccount = (type?: string) => type === 'ISA' || type === 'PENSION' || type === 'IRP';

// 매매 비용 설정 줄 — 수수료 %, 가격 변동 여유 % (서버 저장)
const TradeCosts = ({ feeRate, priceBuffer, onSave }: { feeRate: number; priceBuffer: number; onSave: (v: { feeRate: number; priceBuffer: number }) => void }) => {
  const [open, setOpen] = React.useState(false);
  const [fee, setFee] = React.useState(String(feeRate));
  const [buf, setBuf] = React.useState(String(priceBuffer));
  React.useEffect(() => { setFee(String(feeRate)); setBuf(String(priceBuffer)); }, [feeRate, priceBuffer]);
  const feeN = parseFloat(fee), bufN = parseFloat(buf);
  const valid = feeN >= 0 && feeN <= 1 && bufN >= 0 && bufN <= 5;
  if (!open) {
    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
        <span>수수료 {feeRate}% · 가격 여유 {priceBuffer}% 반영</span>
        <button onClick={() => setOpen(true)} className="min-h-[32px] px-2 text-primary-500 font-medium">바꾸기</button>
      </div>
    );
  }
  const field = 'h-11 sm:h-9 w-20 rounded-lg bg-slate-50 dark:bg-dark-bg px-2 text-right text-sm tabular-nums text-slate-800 dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-400';
  return (
    <div className="mt-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/20 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0">증권사 수수료</label>
        <input inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} className={field} aria-label="수수료 %" />
        <span className="text-xs text-slate-400">%</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0">가격 변동 여유</label>
        <input inputMode="decimal" value={buf} onChange={e => setBuf(e.target.value)} className={field} aria-label="가격 여유 %" />
        <span className="text-xs text-slate-400">%</span>
      </div>
      <p className="text-[11px] text-slate-400">수수료는 증권 앱의 계좌 수수료(ISA 중개형은 보통 0.015% 안팎)를 넣으세요. 가격 여유는 주문하는 사이 값이 올라도 돈이 모자라지 않게 남겨둘 몫이에요 (0~5%).</p>
      <div className="flex gap-2">
        <button disabled={!valid} onClick={() => { onSave({ feeRate: feeN, priceBuffer: bufN }); setOpen(false); }}
          className="h-11 sm:h-9 px-4 rounded-full bg-primary-600 text-white text-xs font-semibold disabled:opacity-40">저장</button>
        <button onClick={() => setOpen(false)} className="h-11 sm:h-9 px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500">취소</button>
      </div>
    </div>
  );
};

// 테마 안 종목 고르는 방식 줄 — 평가금액 작은 종목부터(THEME) / 손해 큰 종목 우선 + 수익 실현(VALUE) (서버 저장)
export type PickStyle = 'THEME' | 'VALUE';
const PickStyleRow = ({ style, profitTake, onSave }: {
  style: PickStyle; profitTake: number; onSave: (v: { style: PickStyle; profitTakePct: number }) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [st, setSt] = React.useState<PickStyle>(style);
  const [pt, setPt] = React.useState(String(profitTake));
  React.useEffect(() => { setSt(style); setPt(String(profitTake)); }, [style, profitTake]);
  const ptN = parseFloat(pt);
  const valid = st === 'THEME' || (ptN >= 0 && ptN <= 100);
  if (!open) {
    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
        <span>
          {style === 'VALUE'
            ? <>종목 고르기: <b className="font-semibold text-slate-500 dark:text-slate-300">손해 큰 종목 우선</b> · {profitTake > 0 ? `수익 +${profitTake}% 넘으면 수익만 매도` : '수익 실현 안 함'}</>
            : <>종목 고르기: 테마 안에서 금액 작은 종목부터</>}
        </span>
        <button onClick={() => setOpen(true)} className="min-h-[32px] px-2 text-primary-500 font-medium">바꾸기</button>
      </div>
    );
  }
  const option = (value: PickStyle, title: string, desc: string) => (
    <button type="button" onClick={() => setSt(value)} aria-pressed={st === value}
      className={`w-full text-left rounded-xl px-3 py-2.5 min-h-[44px] ring-1 transition-colors ${
        st === value ? 'ring-primary-500 bg-primary-50/60 dark:bg-primary-900/20' : 'ring-slate-200 dark:ring-dark-border bg-white dark:bg-dark-card'
      }`}>
      <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">{st === value ? '✓ ' : ''}{title}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
    </button>
  );
  return (
    <div className="mt-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">테마 안에서 어떤 종목을 살까요?</p>
      {option('VALUE', '손해 큰 종목 우선', '1주 살 때마다 평균단가를 다시 계산해서 그 순간 가장 많이 떨어진 종목을 사요. 수익이 기준을 넘은 종목은 오른 만큼만 팔아 그 돈도 같이 써요.')}
      {option('THEME', '금액 작은 종목부터', '손익은 보지 않고 테마 비중만 맞춰요. 테마가 목표보다 밴드 넘게 커지면 팔아요(매도 허용일 때).')}
      {st === 'VALUE' && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">수익 실현 기준 +</label>
          <input inputMode="decimal" value={pt} onChange={e => setPt(e.target.value)} aria-label="수익 실현 기준 %"
            className="h-11 sm:h-9 w-20 rounded-lg bg-white dark:bg-dark-bg px-2 text-right text-sm tabular-nums text-slate-800 dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-400" />
          <span className="text-xs text-slate-400">% (0 = 팔지 않음)</span>
        </div>
      )}
      <div className="flex gap-2">
        <button disabled={!valid} onClick={() => { onSave({ style: st, profitTakePct: st === 'VALUE' ? ptN : profitTake }); setOpen(false); }}
          className="h-11 sm:h-9 px-4 rounded-full bg-primary-600 text-white text-xs font-semibold disabled:opacity-40">저장</button>
        <button onClick={() => setOpen(false)} className="h-11 sm:h-9 px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500">취소</button>
      </div>
    </div>
  );
};

export const themeColor = (themes: ThemeInfo[], id: number | null) => {
  const i = themes.findIndex(t => t.id === id);
  return i < 0 ? '#cbd5e1' : THEME_COLORS[i % THEME_COLORS.length];
};

export const ThemeTodo = ({
  themes, holdings, accounts, plan, blockers, threshold, monthlyBudget, withContribution, onToggleContribution, allowSell, onToggleSell, onTrade, children,
  feeRate, priceBuffer, onSaveCosts, pickStyle, profitTake, onSaveStyle,
}: {
  pickStyle: PickStyle; profitTake: number; onSaveStyle: (v: { style: PickStyle; profitTakePct: number }) => void;
  feeRate: number; priceBuffer: number; onSaveCosts: (v: { feeRate: number; priceBuffer: number }) => void;
  themes: ThemeInfo[]; holdings: ThemeHolding[]; accounts: ThemeAccount[]; plan: TRResult | null; blockers: Blocker[];
  threshold: number; monthlyBudget: number; withContribution: boolean; onToggleContribution: () => void;
  allowSell: boolean; onToggleSell: () => void;
  onTrade: (holdingId: number, side: 'BUY' | 'SELL', shares: number | null) => void;
  children?: React.ReactNode; // 이번 달 체결 내역
}) => {
  const byId = (id: number | null) => holdings.find(h => h.holdingId === id);
  const themeName = (id: number) => themes.find(t => t.id === id)?.name ?? '';
  const actions = plan?.actions ?? [];
  const sellTotal = actions.filter(a => a.side === 'SELL' || a.side === 'USE_CASH').reduce((s, a) => s + a.amount, 0);
  const buyTotal = actions.filter(a => a.side === 'BUY').reduce((s, a) => s + a.amount, 0);
  const tradeActions = actions.filter(a => a.side === 'BUY' || a.side === 'SELL');
  const overCap = overCapSatellites(themes, holdings, threshold);
  const hasSatellite = themes.some(t => t.satellite);

  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 dark:text-dark-text">이번 달 할 일</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {blockers.length > 0 ? '먼저 정리할 게 있어요'
              : tradeActions.length > 0 ? `${pickStyle === 'VALUE' ? '테마 비중 + 손해 큰 종목 우선' : `테마 비중 ±${threshold}%p 기준`} · 매도 ${actions.filter(a => a.side === 'SELL').length}건 · 매수 ${actions.filter(a => a.side === 'BUY').length}건`
              : '테마 비중이 목표 안이에요'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {monthlyBudget > 0 && (
            <button onClick={onToggleContribution} aria-pressed={withContribution}
              className={`shrink-0 h-11 sm:h-9 px-3.5 rounded-full text-xs font-medium transition-colors ${
                withContribution ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
              {withContribution ? '✓ ' : ''}이번 달 납입금 {fmt(monthlyBudget)}원 포함
            </button>
          )}
          {/* 끄면 무거운 테마도 팔지 않고 새 납입금으로만 비중을 맞춤 — VALUE는 수익 실현 기준으로만 팔아서 숨김 */}
          {pickStyle !== 'VALUE' && <button onClick={onToggleSell} aria-pressed={!allowSell}
            className={`shrink-0 h-11 sm:h-9 px-3.5 rounded-full text-xs font-medium transition-colors ${
              !allowSell ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
            {!allowSell ? '✓ ' : ''}매도 없이 납입금으로만
          </button>}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="mt-3 space-y-2">
          {blockers.map((b, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 px-3 py-2">
              <p className="text-xs text-amber-700 dark:text-amber-400 min-w-0">{b.text}</p>
              <Link to="/accounts?tab=invest" className="shrink-0 h-11 sm:h-9 px-3 inline-flex items-center rounded-full bg-amber-500 text-white text-xs font-medium">
                {b.kind === 'duplicate' ? '설정에서 합치기' : '설정 열기'}
              </Link>
            </div>
          ))}
        </div>
      )}

      <PickStyleRow style={pickStyle} profitTake={profitTake} onSave={onSaveStyle} />
      <TradeCosts feeRate={feeRate} priceBuffer={priceBuffer} onSave={onSaveCosts} />

      {withContribution && monthlyBudget > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">이번 달 납입금을 이미 이체해 예수금에 넣었다면 '납입금 포함'을 끄세요 — 켜 두면 같은 돈이 두 번 잡혀요.</p>
      )}

      {overCap.length > 0 && (
        <div className="mt-3 space-y-2">
          {overCap.map(({ theme, pct }) => (
            <p key={theme.id} className="rounded-lg bg-violet-50 dark:bg-violet-900/15 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
              위성 <b>{theme.name}</b>{josaIGa(theme.name)} 상한 {theme.targetPct}%를 넘었어요 (지금 {pct.toFixed(1)}%) —
              {allowSell ? ' 아래 할 일에 상한까지 줄이기가 들어 있어요.' : ' 더 사지 말고, 납입금은 코어 테마로만 보내요.'}
            </p>
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
            // 쓸 돈 = 납입금(토글) + 체결 반영분 + 이번에 꺼내 쓰는 예수금(현금성)
            const spend = acc.budget + list.filter(x => x.side === 'USE_CASH').reduce((t, x) => t + x.amount, 0);
            if (list.length === 0 && acc.budget === 0) return null;
            return (
              <div key={acc.id} className="rounded-xl ring-1 ring-slate-100 dark:ring-dark-border/60 p-3">
                <div className="flex items-baseline justify-between gap-3 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate min-w-0">{acc.name}</p>
                  {spend > 0 && <p className="text-[11px] text-slate-400 tabular-nums shrink-0">쓸 돈 {fmt(spend)}원</p>}
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
                            {a.fee > 0 && <p className="text-[10px] text-slate-400 tabular-nums">수수료 약 {fmt(a.fee)}원</p>}
                            {a.side === 'SELL' && pickStyle === 'VALUE' && <p className="text-[10px] text-blue-500 dark:text-blue-400">오른 만큼만 · 원금은 그대로</p>}
                            {a.side === 'SELL' && (() => {
                              if (taxFreeAccount(acc.type)) return <p className="text-[10px] text-slate-400">계좌 안 매매 · 지금 세금 없음</p>;
                              const avg = h && h.shares && h.purchaseAmt ? h.purchaseAmt / h.shares : null;
                              const gain = avg != null && a.shares ? (a.amount / a.shares - avg) * a.shares : null;
                              return gain != null && gain > 0
                                ? <p className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">세금 최대 약 {fmt(gain * GAIN_TAX)}원</p>
                                : null;
                            })()}
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
                {(left > 0 || (plan.reserve[acc.id] ?? 0) > 0) && (
                  <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                    {(plan.reserve[acc.id] ?? 0) > 0 && <>가격 여유 {fmt(plan.reserve[acc.id])}원 · </>}
                    {list.some(x => x.fee > 0) && <>수수료 약 {fmt(list.reduce((t, x) => t + x.fee, 0))}원 · </>}
                    {left > 0
                      ? <>남는 돈 {fmt(left)}원 — {list.some(x => x.side === 'BUY') ? '1주 가격보다 적게 남은 돈' : '이 계좌에서 살 수 있는 테마가 이미 목표를 채웠어요'} · </>
                      : null}
                    쓰지 않은 돈은 예수금으로 두고 다음 달에 써요
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {children}
      <p className="text-[11px] text-slate-400 mt-3">
        돈은 계좌 안에서만 움직여요. 살 수 있는 테마가 적은 계좌부터, 전체 기준으로 가장 모자란 테마의 종목을 1주씩 골랐어요.
        {pickStyle === 'VALUE'
          ? ` 같은 테마 안에서는 1주 살 때마다 평균단가를 다시 계산해 가장 많이 떨어진 종목을 골랐어요${profitTake > 0 ? ` — 수익 +${profitTake}% 넘은 종목은 오른 만큼만 팔아 그 돈도 같이 써요` : ''}.`
          : ' 같은 테마 안에서는 금액이 작은 종목부터 골랐어요.'} 증권 앱에서 실행 후 '체결 완료'를 누르면 보유 수량·평균단가가 바뀌고 다시 계산돼요.
        {hasSatellite && ' 위성 테마는 납입금으로 사지 않아요 — 남는 돈으로 상한 안에서 직접 사세요.'}
        {' 국내 상장 ETF라 환율은 원화 주가에 이미 들어 있어요(이름에 (H)가 붙은 상품은 환헤지). 주문은 지정가로 화면 현재가 근처에 넣으면 가격 여유 안에서 체결돼요. 세금 안내는 참고용이에요.'}
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
          const status = t.satellite
            ? diff > threshold
              ? { label: `상한 ${diff.toFixed(1)}%p 초과`, cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' }
              : { label: '상한 안', cls: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400' }
            : Math.abs(diff) <= threshold
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
                  {t.satellite && <span className="ml-1 text-[11px] font-normal text-violet-500">위성</span>}
                </p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text">
                    {cur.toFixed(1)}%<span className="text-xs font-medium text-slate-400 ml-1.5">{t.satellite ? '최대' : '목표'} {t.targetPct}%</span>
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
          테마가 없는 종목 {unassigned.length}개는 비중 계산에서 빠져요: {unassigned.map(h => h.ticker).join(', ')} — <Link to="/accounts?tab=invest" className="underline">설정</Link>
        </p>
      )}
    </section>
  );
};
