import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface DashHolding {
  recordId: number; holdingId: number; ticker: string;
  holdingTargetPct: number; overallTargetPct: number;
  plannedAmt: number; actualAmt: number; isPaid: boolean;
  currentPct: number; rebalanceNeeded: boolean; evalAmt: number | null;
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
const formatNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const InvestDashboardPage = () => {
  const navigate = useNavigate();
  const [ym, setYm] = useState(currentYm);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // recordId → 입력값
  const [editing, setEditing] = useState<Record<number, { actualAmt: string; currentPct: string; evalAmt: string }>>({});
  const [bulkAccounts, setBulkAccounts] = useState<Set<number>>(new Set());
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
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(ym); }, [ym]);

  const moveMonth = (d: number) => {
    const [y, m] = ym.split('-').map(Number);
    let nm = m + d, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    setYm(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const enterBulk = (acc: DashAccount) => {
    const init: Record<number, { actualAmt: string; currentPct: string; evalAmt: string }> = {};
    acc.holdings.forEach(h => {
      init[h.recordId] = {
        actualAmt: h.actualAmt > 0 ? h.actualAmt.toLocaleString() : '',
        currentPct: h.currentPct > 0 ? h.currentPct.toFixed(2) : '',
        evalAmt: h.evalAmt != null ? h.evalAmt.toLocaleString() : '',
      };
    });
    setEditing(prev => ({ ...prev, ...init }));
    setBulkAccounts(prev => new Set(prev).add(acc.id));
  };

  const cancelBulk = (acc: DashAccount) => {
    setBulkAccounts(prev => { const n = new Set(prev); n.delete(acc.id); return n; });
    setEditing(prev => {
      const n = { ...prev };
      acc.holdings.forEach(h => delete n[h.recordId]);
      return n;
    });
  };

  const saveBulk = async (acc: DashAccount, isPaid: boolean) => {
    setSavingAcc(prev => ({ ...prev, [acc.id]: true }));
    try {
      await Promise.all(
        acc.holdings.map(h => {
          const e = editing[h.recordId];
          const evalRaw = (e?.evalAmt || '').replace(/,/g, '');
          return api.put(`/invest/records/${h.recordId}`, {
            actualAmt: parseInt((e?.actualAmt || '0').replace(/,/g, ''), 10) || 0,
            isPaid,
            currentPct: parseFloat(e?.currentPct || '0') || null,
            evalAmt: evalRaw ? parseInt(evalRaw, 10) : null,
          });
        })
      );
      setBulkAccounts(prev => { const n = new Set(prev); n.delete(acc.id); return n; });
      setEditing(prev => {
        const n = { ...prev };
        acc.holdings.forEach(h => delete n[h.recordId]);
        return n;
      });
      await fetchData(ym);
    } catch { alert('저장 실패'); }
    finally { setSavingAcc(prev => ({ ...prev, [acc.id]: false })); }
  };

  const togglePaid = async (h: DashHolding) => {
    setSavingRecord(prev => ({ ...prev, [h.recordId]: true }));
    try {
      await api.put(`/invest/records/${h.recordId}`, {
        actualAmt: h.actualAmt, isPaid: !h.isPaid, currentPct: h.currentPct, evalAmt: h.evalAmt,
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
        <div className="bg-white dark:bg-dark-card rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">데이터를 불러오지 못했습니다</p>
          <p className="text-xs text-slate-400 mt-1">브라우저 콘솔(F12)에서 오류 내용을 확인해 주세요</p>
          <button onClick={() => fetchData(ym)} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold dark:text-dark-text">투자 현황</h1>
        <div className="bg-white dark:bg-dark-card rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="text-4xl mb-3">💹</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">아직 설정이 없습니다</p>
          <button onClick={() => navigate('/invest/settings')} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            투자 설정하기 →
          </button>
        </div>
      </div>
    );
  }

  const rebalanceHoldings = data?.accounts.flatMap(a => a.holdings.filter(h => h.rebalanceNeeded)) || [];
  const pensionRemaining = data ? Math.max(data.pensionLimit - data.pensionYtdActual, 0) : 0;
  const pensionRate = data && data.pensionLimit > 0 ? Math.min((data.pensionYtdActual / data.pensionLimit) * 100, 100) : 0;
  const overallRate = data && data.totalPlanned > 0 ? Math.min((data.totalActual / data.totalPlanned) * 100, 100) : 0;

  // 전체 평가금액 합산
  const totalEval = data.accounts.flatMap(a => a.holdings).reduce((sum, h) => sum + (h.evalAmt ?? 0), 0);
  const totalProfit = totalEval > 0 ? totalEval - data.totalActual : null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">적립식 투자 현황</p>
          <h1 className="text-2xl font-bold dark:text-dark-text">투자 현황</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">‹</button>
          <span className="text-sm font-semibold dark:text-dark-text min-w-[80px] text-center">{ym}</span>
          <button onClick={() => moveMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">›</button>
        </div>
      </div>

      <>

          {/* 리밸런싱 알림 */}
          {rebalanceHoldings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4">
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">⚠️ 리밸런싱 필요 종목</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {rebalanceHoldings.map(h => (
                  <span key={h.holdingId} className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                    {h.ticker} (목표 {h.overallTargetPct.toFixed(1)}% / 현재 {h.currentPct.toFixed(1)}%)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">이번 달 납입</p>
              <p className="text-xl font-bold mt-1 text-primary-600 tabular-nums">
                {data.totalActual.toLocaleString()}<span className="text-xs font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">목표 {data.totalPlanned.toLocaleString()}원</p>
              <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${overallRate}%` }} />
              </div>
              <p className="text-xs text-right text-slate-400 mt-1">{Math.round(overallRate)}%</p>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">총 평가금액</p>
              <p className="text-xl font-bold mt-1 dark:text-dark-text tabular-nums">
                {totalEval > 0 ? `${totalEval.toLocaleString()}` : '—'}<span className="text-xs font-medium ml-0.5">{totalEval > 0 ? '원' : ''}</span>
              </p>
              {totalProfit !== null && (
                <p className={`text-xs mt-0.5 font-medium tabular-nums ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}원
                </p>
              )}
              {totalEval === 0 && <p className="text-xs text-slate-400 mt-0.5">평가금액 입력 후 표시</p>}
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">월 투자금</p>
              <p className="text-xl font-bold mt-1 dark:text-dark-text tabular-nums">
                {data.monthlyBudget.toLocaleString()}<span className="text-xs font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">리밸런싱 ±{data.rebalanceThreshold}%</p>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4">
              <p className="text-xs text-slate-400 dark:text-slate-500">연금 세액공제 잔여</p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${pensionRemaining === 0 ? 'text-emerald-500' : 'text-violet-500'}`}>
                {pensionRemaining.toLocaleString()}<span className="text-xs font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">YTD {data.pensionYtdActual.toLocaleString()}원</p>
              <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pensionRate}%` }} />
              </div>
            </div>
          </div>

          {/* 계좌별 */}
          {data.accounts.map(acc => {
            const isBulk = bulkAccounts.has(acc.id);
            const isSaving = !!savingAcc[acc.id];
            const allPaid = acc.holdings.every(h => h.isPaid);
            const accEval = acc.holdings.reduce((sum, h) => sum + (h.evalAmt ?? 0), 0);
            const accProfit = accEval > 0 ? accEval - acc.accountActualAmt : null;

            return (
              <div key={acc.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
                {/* 계좌 헤더 */}
                <div className="px-5 py-3 border-b border-slate-100 dark:border-dark-border flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[acc.type]}`}>
                      {TYPE_LABEL[acc.type]}
                    </span>
                    <span className="font-semibold dark:text-dark-text truncate">{acc.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">{acc.targetPct}%</span>
                    {allPaid && <span className="text-xs text-emerald-500 font-medium shrink-0">✓ 완료</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {accProfit !== null && (
                      <span className={`text-xs font-bold tabular-nums ${accProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {accProfit >= 0 ? '+' : ''}{accProfit.toLocaleString()}원
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums dark:text-dark-text">{acc.accountActualAmt.toLocaleString()}원</p>
                      <p className="text-xs text-slate-400">/ {acc.accountPlannedAmt.toLocaleString()}원</p>
                    </div>
                    {!isBulk ? (
                      <button
                        onClick={() => enterBulk(acc)}
                        className="text-xs px-3 py-1.5 border border-slate-200 dark:border-dark-border rounded-lg dark:text-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                      >
                        입력
                      </button>
                    ) : (
                      <button onClick={() => cancelBulk(acc)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0">취소</button>
                    )}
                  </div>
                </div>

                {/* 종목 목록 */}
                <div className="divide-y divide-slate-50 dark:divide-dark-border/50">
                  {acc.holdings.map(h => {
                    const e = editing[h.recordId];
                    const rate = h.plannedAmt > 0 ? Math.min((h.actualAmt / h.plannedAmt) * 100, 100) : 0;
                    const profit = h.evalAmt != null ? h.evalAmt - h.actualAmt : null;

                    return (
                      <div key={h.recordId} className="px-5 py-3">
                        {isBulk ? (
                          /* 입력 모드 */
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold dark:text-dark-text">{h.ticker}</p>
                                <p className="text-xs text-slate-400">목표 {h.plannedAmt.toLocaleString()}원 · {h.overallTargetPct.toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <p className="text-xs text-slate-400 mb-1">납입금액</p>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={e?.actualAmt ?? ''}
                                    onChange={ev => setEditing(prev => ({ ...prev, [h.recordId]: { ...prev[h.recordId], actualAmt: formatNum(ev.target.value) } }))}
                                    placeholder="0"
                                    className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                                  />
                                  <span className="text-xs text-slate-400">원</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400 mb-1">평가금액</p>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={e?.evalAmt ?? ''}
                                    onChange={ev => setEditing(prev => ({ ...prev, [h.recordId]: { ...prev[h.recordId], evalAmt: formatNum(ev.target.value) } }))}
                                    placeholder="0"
                                    className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                                  />
                                  <span className="text-xs text-slate-400">원</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400 mb-1">현재비중</p>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={e?.currentPct ?? ''}
                                    onChange={ev => setEditing(prev => ({ ...prev, [h.recordId]: { ...prev[h.recordId], currentPct: ev.target.value } }))}
                                    placeholder="0"
                                    className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                                    step={0.01}
                                  />
                                  <span className="text-xs text-slate-400">%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* 보기 모드 */
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold dark:text-dark-text">{h.ticker}</p>
                                {h.rebalanceNeeded && (
                                  <span className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded font-medium">리밸런싱</span>
                                )}
                                {h.isPaid && (
                                  <span className="text-xs px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded font-medium">완료</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${h.isPaid ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${rate}%` }} />
                                </div>
                                <span className="text-xs text-slate-400 tabular-nums shrink-0">{Math.round(rate)}%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {/* 납입 */}
                              <div className="text-right">
                                <p className="text-xs text-slate-400">납입</p>
                                <p className={`text-sm font-bold tabular-nums ${h.isPaid ? 'text-emerald-500' : h.actualAmt > 0 ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                  {h.actualAmt > 0 ? `${h.actualAmt.toLocaleString()}원` : '—'}
                                </p>
                              </div>
                              {/* 평가/손익 */}
                              {h.evalAmt != null && (
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">평가</p>
                                  <p className="text-sm font-bold tabular-nums dark:text-dark-text">{h.evalAmt.toLocaleString()}원</p>
                                  {profit !== null && (
                                    <p className={`text-xs font-medium tabular-nums ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {profit >= 0 ? '+' : ''}{profit.toLocaleString()}원
                                    </p>
                                  )}
                                </div>
                              )}
                              {/* 완료 토글 */}
                              {h.actualAmt > 0 && (
                                <button
                                  onClick={() => togglePaid(h)}
                                  disabled={!!savingRecord[h.recordId]}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                    h.isPaid
                                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {h.isPaid ? '완료 취소' : '완료'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 일괄 저장 버튼 */}
                {isBulk && (
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-dark-border flex gap-2">
                    <button
                      onClick={() => saveBulk(acc, true)}
                      disabled={isSaving}
                      className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? '저장 중...' : '납입 완료'}
                    </button>
                    <button
                      onClick={() => saveBulk(acc, false)}
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
      </>
    </div>
  );
};