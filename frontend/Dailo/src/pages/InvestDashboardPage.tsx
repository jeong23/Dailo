import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface DashHolding {
  recordId: number; holdingId: number; ticker: string;
  avgPurchasePrice: number | null; shares: number | null;
  holdingTargetPct: number; overallTargetPct: number;
  plannedAmt: number; actualAmt: number; isPaid: boolean;
  currentPrice: number | null; evalAmt: number | null;
  purchaseAmt: number | null; profitAmt: number | null; profitPct: number | null;
  currentPct: number; rebalanceNeeded: boolean;
}
interface DashAccount {
  id: number; name: string; type: string; targetPct: number;
  accountPlannedAmt: number; accountActualAmt: number;
  holdings: DashHolding[];
}
interface Dashboard {
  yearMonth: string; monthlyBudget: number; rebalanceThreshold: number;
  pensionLimit: number; totalPlanned: number; totalActual: number;
  pensionYtdActual: number; accounts: DashAccount[];
}

const TYPE_BADGE: Record<string, string> = {
  PENSION: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
  GENERAL: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  IRP: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
};
const TYPE_LABEL: Record<string, string> = { PENSION: '연금저축', GENERAL: '일반', IRP: 'IRP' };

const now = new Date();
const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const fmtNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmt = (n: number) => n.toLocaleString();
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const profitColor = (v: number) => v > 0 ? 'text-rose-500' : v < 0 ? 'text-blue-500' : 'text-slate-400';

export const InvestDashboardPage = () => {
  const navigate = useNavigate();
  const [ym, setYm] = useState(currentYm);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // recordId → { currentPrice, actualAmt }
  const [editing, setEditing] = useState<Record<number, { currentPrice: string; actualAmt: string }>>({});
  const [editingAccs, setEditingAccs] = useState<Set<number>>(new Set());
  const [savingAcc, setSavingAcc] = useState<Record<number, boolean>>({});
  const [savingRecord, setSavingRecord] = useState<Record<number, boolean>>({});

  const fetchData = async (yearMonth: string) => {
    setLoading(true);
    setFetchError(false);
    try {
      const r = await api.get(`/invest/dashboard?yearMonth=${yearMonth}`);
      setData(r.data.data);
    } catch (e) {
      console.error('[InvestDashboard] API 오류:', e);
      setFetchError(true);
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(ym); }, [ym]);

  const moveMonth = (d: number) => {
    const [y, m] = ym.split('-').map(Number);
    let nm = m + d, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    setYm(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const enterEdit = (acc: DashAccount) => {
    const init: Record<number, { currentPrice: string; actualAmt: string }> = {};
    acc.holdings.forEach(h => {
      init[h.recordId] = {
        currentPrice: h.currentPrice != null ? h.currentPrice.toLocaleString() : '',
        actualAmt: h.actualAmt > 0 ? h.actualAmt.toLocaleString() : '',
      };
    });
    setEditing(prev => ({ ...prev, ...init }));
    setEditingAccs(prev => new Set(prev).add(acc.id));
  };

  const cancelEdit = (acc: DashAccount) => {
    setEditingAccs(prev => { const n = new Set(prev); n.delete(acc.id); return n; });
    setEditing(prev => {
      const n = { ...prev };
      acc.holdings.forEach(h => delete n[h.recordId]);
      return n;
    });
  };

  const saveAcc = async (acc: DashAccount, isPaid: boolean) => {
    setSavingAcc(prev => ({ ...prev, [acc.id]: true }));
    try {
      await Promise.all(
        acc.holdings.map(h => {
          const e = editing[h.recordId];
          const cp = e?.currentPrice ? parseInt(e.currentPrice.replace(/,/g, ''), 10) || null : null;
          return api.put(`/invest/records/${h.recordId}`, {
            actualAmt: parseInt((e?.actualAmt || '0').replace(/,/g, ''), 10) || 0,
            isPaid,
            currentPrice: cp,
          });
        })
      );
      cancelEdit(acc);
      await fetchData(ym);
    } catch { alert('저장 실패'); }
    finally { setSavingAcc(prev => ({ ...prev, [acc.id]: false })); }
  };

  const togglePaid = async (h: DashHolding) => {
    setSavingRecord(prev => ({ ...prev, [h.recordId]: true }));
    try {
      await api.put(`/invest/records/${h.recordId}`, {
        actualAmt: h.actualAmt, isPaid: !h.isPaid, currentPrice: h.currentPrice,
      });
      await fetchData(ym);
    } catch { alert('저장 실패'); }
    finally { setSavingRecord(prev => ({ ...prev, [h.recordId]: false })); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold dark:text-dark-text">투자 현황</h1>
        <div className="text-center py-20 text-slate-400">불러오는 중...</div>
      </div>
    );
  }
  if (fetchError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold dark:text-dark-text">투자 현황</h1>
        <div className="bg-white dark:bg-dark-card rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">데이터를 불러오지 못했습니다</p>
          <button onClick={() => fetchData(ym)} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">다시 시도</button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold dark:text-dark-text">투자 현황</h1>
        <div className="bg-white dark:bg-dark-card rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-4xl mb-3">💹</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">아직 설정이 없습니다</p>
          <button onClick={() => navigate('/invest/settings')} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">투자 설정하기 →</button>
        </div>
      </div>
    );
  }

  const allHoldings = data.accounts.flatMap(a => a.holdings);
  const totalEval = allHoldings.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  const totalPurchase = allHoldings.reduce((s, h) => s + (h.purchaseAmt ?? 0), 0);
  const totalProfit = totalEval > 0 && totalPurchase > 0 ? totalEval - totalPurchase : null;
  const totalProfitPct = totalProfit !== null && totalPurchase > 0 ? totalProfit * 100 / totalPurchase : null;
  const overallRate = data.totalPlanned > 0 ? Math.min((data.totalActual / data.totalPlanned) * 100, 100) : 0;
  const pensionRemaining = Math.max(data.pensionLimit - data.pensionYtdActual, 0);
  const pensionRate = data.pensionLimit > 0 ? Math.min((data.pensionYtdActual / data.pensionLimit) * 100, 100) : 0;
  const rebalanceHoldings = allHoldings.filter(h => h.rebalanceNeeded);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">포트폴리오 현황</p>
          <h1 className="text-2xl font-bold dark:text-dark-text">투자 현황</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">‹</button>
          <span className="text-sm font-semibold dark:text-dark-text min-w-[80px] text-center">{ym}</span>
          <button onClick={() => moveMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">›</button>
        </div>
      </div>

      {/* 상단 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 총 평가금액 + 손익 */}
        <div className="col-span-2 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">총 평가금액</p>
          {totalEval > 0 ? (
            <>
              <p className="text-2xl font-bold mt-1 dark:text-dark-text tabular-nums">{fmt(totalEval)}<span className="text-sm font-medium ml-0.5">원</span></p>
              {totalProfit !== null && (
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-sm font-bold tabular-nums ${profitColor(totalProfit)}`}>
                    {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)}원
                  </span>
                  {totalProfitPct !== null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                      totalProfitPct > 0 ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' :
                      totalProfitPct < 0 ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20' : 'bg-slate-100 text-slate-400'
                    }`}>{fmtPct(totalProfitPct)}</span>
                  )}
                </div>
              )}
              {totalPurchase > 0 && <p className="text-xs text-slate-400 mt-0.5">매입 {fmt(totalPurchase)}원</p>}
            </>
          ) : (
            <>
              <p className="text-2xl font-bold mt-1 text-slate-300 dark:text-slate-600">—</p>
              <p className="text-xs text-slate-400 mt-1">현재가 입력 후 표시</p>
            </>
          )}
        </div>

        {/* 이달 납입 */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">이달 납입</p>
          <p className="text-xl font-bold mt-1 text-primary-600 tabular-nums">{fmt(data.totalActual)}<span className="text-xs font-medium ml-0.5">원</span></p>
          <p className="text-xs text-slate-400 mt-0.5">목표 {fmt(data.totalPlanned)}원</p>
          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${overallRate}%` }} />
          </div>
          <p className="text-xs text-right text-slate-400 mt-0.5">{Math.round(overallRate)}%</p>
        </div>

        {/* 연금 세액공제 */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">연금 세액공제 잔여</p>
          <p className={`text-xl font-bold mt-1 tabular-nums ${pensionRemaining === 0 ? 'text-emerald-500' : 'text-violet-500'}`}>
            {fmt(pensionRemaining)}<span className="text-xs font-medium ml-0.5">원</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">YTD {fmt(data.pensionYtdActual)}원</p>
          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pensionRate}%` }} />
          </div>
        </div>
      </div>

      {/* 리밸런싱 알림 */}
      {rebalanceHoldings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">⚠️ 리밸런싱 필요 종목</p>
          <div className="flex flex-wrap gap-2">
            {rebalanceHoldings.map(h => (
              <span key={h.holdingId} className="text-xs px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                {h.ticker} — 목표 {h.overallTargetPct.toFixed(1)}% / 현재 {h.currentPct.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 계좌별 포트폴리오 */}
      {data.accounts.map(acc => {
        const isEditing = editingAccs.has(acc.id);
        const isSaving = !!savingAcc[acc.id];
        const allPaid = acc.holdings.length > 0 && acc.holdings.every(h => h.isPaid);
        const accEval = acc.holdings.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
        const accPurchase = acc.holdings.reduce((s, h) => s + (h.purchaseAmt ?? 0), 0);
        const accProfit = accEval > 0 && accPurchase > 0 ? accEval - accPurchase : null;
        const accProfitPct = accProfit !== null && accPurchase > 0 ? accProfit * 100 / accPurchase : null;

        return (
          <div key={acc.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
            {/* 계좌 헤더 */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-dark-border flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[acc.type]}`}>{TYPE_LABEL[acc.type]}</span>
                <span className="font-semibold dark:text-dark-text truncate">{acc.name}</span>
                {allPaid && <span className="text-xs text-emerald-500 font-medium shrink-0">✓ 완료</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {accProfit !== null && (
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${profitColor(accProfit)}`}>
                      {accProfit >= 0 ? '+' : ''}{fmt(accProfit)}원
                    </p>
                    {accProfitPct !== null && (
                      <p className={`text-xs tabular-nums ${profitColor(accProfit)}`}>{fmtPct(accProfitPct)}</p>
                    )}
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-slate-400">이달 납입</p>
                  <p className="text-sm font-bold tabular-nums dark:text-dark-text">{fmt(acc.accountActualAmt)}원</p>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => enterEdit(acc)}
                    className="text-xs px-3 py-1.5 border border-slate-200 dark:border-dark-border rounded-lg dark:text-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    입력
                  </button>
                ) : (
                  <button onClick={() => cancelEdit(acc)} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
                )}
              </div>
            </div>

            {/* 종목 리스트 */}
            <div className="divide-y divide-slate-50 dark:divide-dark-border/30">
              {acc.holdings.map(h => {
                const e = editing[h.recordId];
                const hasPortfolio = h.avgPurchasePrice != null && h.shares != null;
                const rate = h.plannedAmt > 0 ? Math.min((h.actualAmt / h.plannedAmt) * 100, 100) : 0;

                // 입력 중인 현재가로 실시간 손익 미리보기
                let previewEval: number | null = null;
                let previewProfit: number | null = null;
                let previewPct: number | null = null;
                if (isEditing && e?.currentPrice && h.shares) {
                  const cp = parseInt(e.currentPrice.replace(/,/g, ''), 10);
                  if (!isNaN(cp) && cp > 0) {
                    previewEval = Math.round(cp * h.shares);
                    if (h.purchaseAmt) {
                      previewProfit = previewEval - h.purchaseAmt;
                      previewPct = previewProfit * 100 / h.purchaseAmt;
                    }
                  }
                }

                return (
                  <div key={h.recordId} className="px-4 sm:px-5 py-3">
                    {isEditing ? (
                      /* ── 입력 모드 ── */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold dark:text-dark-text">{h.ticker}</p>
                            {hasPortfolio && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {h.shares}주 · 매입단가 {fmt(h.avgPurchasePrice!)}원
                                {h.purchaseAmt && <span> · 매입금액 {fmt(h.purchaseAmt)}원</span>}
                              </p>
                            )}
                          </div>
                          {previewEval !== null && (
                            <div className="text-right">
                              <p className="text-xs text-slate-400">예상 평가금액</p>
                              <p className="text-sm font-bold tabular-nums dark:text-dark-text">{fmt(previewEval)}원</p>
                              {previewProfit !== null && (
                                <p className={`text-xs font-semibold tabular-nums ${profitColor(previewProfit)}`}>
                                  {previewProfit >= 0 ? '+' : ''}{fmt(previewProfit)}원 ({fmtPct(previewPct!)})
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">
                              현재가 {hasPortfolio ? `(${h.shares}주)` : ''}
                            </p>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={e?.currentPrice ?? ''}
                                onChange={ev => setEditing(prev => ({ ...prev, [h.recordId]: { ...prev[h.recordId], currentPrice: fmtNum(ev.target.value) } }))}
                                placeholder="0"
                                className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right tabular-nums"
                              />
                              <span className="text-xs text-slate-400">원</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">이달 납입</p>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={e?.actualAmt ?? ''}
                                onChange={ev => setEditing(prev => ({ ...prev, [h.recordId]: { ...prev[h.recordId], actualAmt: fmtNum(ev.target.value) } }))}
                                placeholder="0"
                                className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right tabular-nums"
                              />
                              <span className="text-xs text-slate-400">원</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── 보기 모드 ── */
                      <>
                        {/* 모바일: 카드형 */}
                        <div className="md:hidden space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-sm font-semibold dark:text-dark-text truncate">{h.ticker}</p>
                              {h.rebalanceNeeded && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded font-medium shrink-0">리밸런싱</span>}
                              {h.isPaid && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded font-medium shrink-0">완료</span>}
                            </div>
                            {h.actualAmt > 0 && (
                              <button
                                onClick={() => togglePaid(h)}
                                disabled={!!savingRecord[h.recordId]}
                                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0 ${h.isPaid ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'}`}
                              >
                                {h.isPaid ? '완료 취소' : '완료'}
                              </button>
                            )}
                          </div>
                          {hasPortfolio && (
                            <div className="text-xs text-slate-400">
                              {h.shares}주 × {h.currentPrice ? `${fmt(h.currentPrice)}원` : '?원'} = {h.evalAmt ? <span className="font-semibold text-slate-600 dark:text-slate-300">{fmt(h.evalAmt)}원</span> : '—'}
                            </div>
                          )}
                          {h.profitAmt !== null && (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold tabular-nums ${profitColor(h.profitAmt)}`}>
                                {h.profitAmt >= 0 ? '+' : ''}{fmt(h.profitAmt)}원
                              </span>
                              {h.profitPct !== null && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                                  h.profitPct > 0 ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' :
                                  h.profitPct < 0 ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20' : 'bg-slate-100 text-slate-400'
                                }`}>{fmtPct(h.profitPct)}</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${h.isPaid ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                              {h.actualAmt > 0 ? `${fmt(h.actualAmt)}원` : '미납입'} / {fmt(h.plannedAmt)}원
                            </span>
                          </div>
                        </div>

                        {/* 데스크탑: 인라인 */}
                        <div className="hidden md:flex items-center gap-4">
                          {/* 종목명 + 배지 */}
                          <div className="w-36 lg:w-44 min-w-0 shrink-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold dark:text-dark-text">{h.ticker}</p>
                              {h.rebalanceNeeded && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded font-medium">리밸런싱</span>}
                              {h.isPaid && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded font-medium">완료</span>}
                            </div>
                            {hasPortfolio && <p className="text-xs text-slate-400 mt-0.5">{h.shares}주 보유</p>}
                          </div>

                          {/* 매입단가 */}
                          <div className="w-24 text-right shrink-0">
                            <p className="text-xs text-slate-400">매입단가</p>
                            <p className="text-sm tabular-nums dark:text-dark-text">
                              {h.avgPurchasePrice ? `${fmt(h.avgPurchasePrice)}원` : '—'}
                            </p>
                          </div>

                          {/* 현재가 */}
                          <div className="w-24 text-right shrink-0">
                            <p className="text-xs text-slate-400">현재가</p>
                            <p className="text-sm font-medium tabular-nums dark:text-dark-text">
                              {h.currentPrice ? `${fmt(h.currentPrice)}원` : '—'}
                            </p>
                          </div>

                          {/* 평가금액 */}
                          <div className="w-28 text-right shrink-0">
                            <p className="text-xs text-slate-400">평가금액</p>
                            <p className="text-sm font-bold tabular-nums dark:text-dark-text">
                              {h.evalAmt ? `${fmt(h.evalAmt)}원` : '—'}
                            </p>
                          </div>

                          {/* 손익 */}
                          <div className="w-28 text-right shrink-0">
                            <p className="text-xs text-slate-400">평가손익</p>
                            {h.profitAmt !== null ? (
                              <>
                                <p className={`text-sm font-bold tabular-nums ${profitColor(h.profitAmt)}`}>
                                  {h.profitAmt >= 0 ? '+' : ''}{fmt(h.profitAmt)}원
                                </p>
                                {h.profitPct !== null && (
                                  <p className={`text-xs tabular-nums ${profitColor(h.profitAmt)}`}>{fmtPct(h.profitPct)}</p>
                                )}
                              </>
                            ) : <p className="text-sm text-slate-300 dark:text-slate-600">—</p>}
                          </div>

                          {/* 납입 진행 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-400">이달 납입</span>
                              <span className="text-xs text-slate-400 tabular-nums">{Math.round(rate)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${h.isPaid ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${rate}%` }} />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                              {h.actualAmt > 0 ? `${fmt(h.actualAmt)}원` : '미납입'} / {fmt(h.plannedAmt)}원
                            </p>
                          </div>

                          {/* 완료 버튼 */}
                          {h.actualAmt > 0 && (
                            <button
                              onClick={() => togglePaid(h)}
                              disabled={!!savingRecord[h.recordId]}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shrink-0 ${
                                h.isPaid ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                              }`}
                            >
                              {h.isPaid ? '완료 취소' : '완료'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 입력 모드 저장 버튼 */}
            {isEditing && (
              <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-dark-border flex gap-2">
                <button
                  onClick={() => saveAcc(acc, true)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? '저장 중...' : '납입 완료'}
                </button>
                <button
                  onClick={() => saveAcc(acc, false)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? '저장 중...' : '임시 저장'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};