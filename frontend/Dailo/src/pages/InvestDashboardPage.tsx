import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface DashHolding {
  recordId: number; holdingId: number; ticker: string;
  holdingTargetPct: number; overallTargetPct: number;
  plannedAmt: number; actualAmt: number; isPaid: boolean;
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

export const InvestDashboardPage = () => {
  const navigate = useNavigate();
  const [ym, setYm] = useState(currentYm);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = async (yearMonth: string) => {
    setLoading(true);
    try {
      const r = await api.get(`/invest/dashboard?yearMonth=${yearMonth}`);
      setData(r.data.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(ym); }, [ym]);

  const moveMonth = (d: number) => {
    const [y, m] = ym.split('-').map(Number);
    let nm = m + d, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    setYm(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const rebalanceHoldings = data?.accounts.flatMap(a => a.holdings.filter(h => h.rebalanceNeeded)) || [];
  const pensionRemaining = data ? Math.max(data.pensionLimit - data.pensionYtdActual, 0) : 0;
  const pensionRate = data && data.pensionLimit > 0 ? Math.min((data.pensionYtdActual / data.pensionLimit) * 100, 100) : 0;
  const overallRate = data && data.totalPlanned > 0 ? Math.min((data.totalActual / data.totalPlanned) * 100, 100) : 0;

  if (!data && !loading) {
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
          <button onClick={() => navigate('/invest/records')} className="ml-2 px-3 py-1.5 text-sm border border-slate-200 dark:border-dark-border rounded-lg dark:text-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            납입 기록
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-slate-400">불러오는 중...</div>}

      {data && !loading && (
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
              <p className="text-xs text-slate-400 dark:text-slate-500">이번 달 납입 현황</p>
              <p className="text-2xl font-bold mt-1 text-primary-600 tabular-nums">
                {data.totalActual.toLocaleString()}<span className="text-base font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">목표 {data.totalPlanned.toLocaleString()}원</p>
              <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${overallRate}%` }} />
              </div>
              <p className="text-xs text-right text-slate-400 mt-1">{Math.round(overallRate)}%</p>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
              <p className="text-xs text-slate-400 dark:text-slate-500">월 투자금</p>
              <p className="text-2xl font-bold mt-1 dark:text-dark-text tabular-nums">
                {data.monthlyBudget.toLocaleString()}<span className="text-base font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">리밸런싱 트리거 ±{data.rebalanceThreshold}%</p>
            </div>

            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
              <p className="text-xs text-slate-400 dark:text-slate-500">연금 세액공제 잔여</p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${pensionRemaining === 0 ? 'text-emerald-500' : 'text-violet-500'}`}>
                {pensionRemaining.toLocaleString()}<span className="text-base font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">YTD {data.pensionYtdActual.toLocaleString()}원 / 한도 {data.pensionLimit.toLocaleString()}원</p>
              <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pensionRate}%` }} />
              </div>
            </div>
          </div>

          {/* 계좌별 종목 현황 */}
          {data.accounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-dark-border">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_BADGE[acc.type]}`}>
                    {TYPE_LABEL[acc.type]}
                  </span>
                  <span className="font-semibold dark:text-dark-text">{acc.name}</span>
                  <span className="text-xs text-slate-400">{acc.targetPct}%</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums dark:text-dark-text">{acc.accountActualAmt.toLocaleString()}원</p>
                  <p className="text-xs text-slate-400">/ {acc.accountPlannedAmt.toLocaleString()}원</p>
                </div>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-dark-border/50">
                {acc.holdings.map(h => {
                  const rate = h.plannedAmt > 0 ? Math.min((h.actualAmt / h.plannedAmt) * 100, 100) : 0;
                  return (
                    <div key={h.holdingId} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold dark:text-dark-text truncate">{h.ticker}</p>
                          {h.rebalanceNeeded && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded font-medium shrink-0">리밸런싱</span>
                          )}
                          {h.isPaid && (
                            <span className="text-xs px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded font-medium shrink-0">완료</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${h.isPaid ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${rate}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 tabular-nums shrink-0">{Math.round(rate)}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums dark:text-dark-text">{h.actualAmt.toLocaleString()}원</p>
                        <p className="text-xs text-slate-400">{h.plannedAmt.toLocaleString()}원 목표</p>
                      </div>
                      <div className="text-right shrink-0 text-xs text-slate-400">
                        <p>{h.holdingTargetPct.toFixed(0)}%</p>
                        <p className="text-[10px]">(전체 {h.overallTargetPct.toFixed(1)}%)</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};