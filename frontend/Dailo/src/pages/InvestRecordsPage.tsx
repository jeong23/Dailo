import React, { useState, useEffect } from 'react';
import api from '../api/axios';

interface DashHolding {
  recordId: number; holdingId: number; ticker: string;
  overallTargetPct: number; plannedAmt: number; actualAmt: number;
  isPaid: boolean; currentPct: number; rebalanceNeeded: boolean;
}
interface DashAccount { id: number; name: string; type: string; targetPct: number; holdings: DashHolding[]; }
interface Dashboard { yearMonth: string; monthlyBudget: number; totalPlanned: number; totalActual: number; accounts: DashAccount[]; }

const TYPE_LABEL: Record<string, string> = { PENSION: '연금저축', GENERAL: '일반', IRP: 'IRP' };
const now = new Date();
const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const formatNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const InvestRecordsPage = () => {
  const [ym, setYm] = useState(currentYm);
  const [data, setData] = useState<Dashboard | null>(null);
  // recordId → { actualAmt, currentPct }
  const [editing, setEditing] = useState<Record<number, { actualAmt: string; currentPct: string }>>({});
  // 계좌 단위 일괄 저장 중인 accountId set
  const [bulkAccounts, setBulkAccounts] = useState<Set<number>>(new Set());
  const [savingAcc, setSavingAcc] = useState<Record<number, boolean>>({});
  const [savingRecord, setSavingRecord] = useState<Record<number, boolean>>({});

  const fetchData = async (yearMonth: string) => {
    try {
      const r = await api.get(`/invest/dashboard?yearMonth=${yearMonth}`);
      setData(r.data.data);
    } catch { setData(null); }
  };

  useEffect(() => { fetchData(ym); }, [ym]);

  const moveMonth = (d: number) => {
    const [y, m] = ym.split('-').map(Number);
    let nm = m + d, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    setYm(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  // 계좌 전체 입력 모드 진입
  const enterBulk = (acc: DashAccount) => {
    const init: Record<number, { actualAmt: string; currentPct: string }> = {};
    acc.holdings.forEach(h => {
      init[h.recordId] = {
        actualAmt: h.actualAmt > 0 ? h.actualAmt.toLocaleString() : '',
        currentPct: h.currentPct > 0 ? h.currentPct.toFixed(2) : '',
      };
    });
    setEditing(prev => ({ ...prev, ...init }));
    setBulkAccounts(prev => new Set(prev).add(acc.id));
  };

  // 계좌 전체 일괄 저장
  const saveBulk = async (acc: DashAccount, isPaid: boolean) => {
    setSavingAcc(prev => ({ ...prev, [acc.id]: true }));
    try {
      await Promise.all(
        acc.holdings.map(h => {
          const e = editing[h.recordId];
          return api.put(`/invest/records/${h.recordId}`, {
            actualAmt: parseInt((e?.actualAmt || '0').replace(/,/g, ''), 10) || 0,
            isPaid,
            currentPct: parseFloat(e?.currentPct || '0') || null,
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

  // 계좌 일괄 취소
  const cancelBulk = (acc: DashAccount) => {
    setBulkAccounts(prev => { const n = new Set(prev); n.delete(acc.id); return n; });
    setEditing(prev => {
      const n = { ...prev };
      acc.holdings.forEach(h => delete n[h.recordId]);
      return n;
    });
  };

  // 종목 단건 완료 토글
  const togglePaid = async (h: DashHolding) => {
    setSavingRecord(prev => ({ ...prev, [h.recordId]: true }));
    try {
      await api.put(`/invest/records/${h.recordId}`, {
        actualAmt: h.actualAmt, isPaid: !h.isPaid, currentPct: h.currentPct,
      });
      await fetchData(ym);
    } catch { alert('저장 실패'); }
    finally { setSavingRecord(prev => ({ ...prev, [h.recordId]: false })); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">실제 납입금액 입력</p>
          <h1 className="text-2xl font-bold dark:text-dark-text">납입 기록</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">‹</button>
          <span className="text-sm font-semibold dark:text-dark-text min-w-[80px] text-center">{ym}</span>
          <button onClick={() => moveMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 text-lg">›</button>
        </div>
      </div>

      {!data ? (
        <div className="bg-white dark:bg-dark-card rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="text-slate-400">설정 후 사용 가능합니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">총 목표</p>
              <p className="text-lg font-bold dark:text-dark-text tabular-nums">{data.totalPlanned.toLocaleString()}원</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">납입 완료</p>
              <p className="text-lg font-bold text-emerald-500 tabular-nums">{data.totalActual.toLocaleString()}원</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">미납</p>
              <p className="text-lg font-bold text-rose-500 tabular-nums">
                {Math.max(data.totalPlanned - data.totalActual, 0).toLocaleString()}원
              </p>
            </div>
          </div>

          {/* 계좌별 */}
          {data.accounts.map(acc => {
            const isBulk = bulkAccounts.has(acc.id);
            const isSaving = !!savingAcc[acc.id];
            const allPaid = acc.holdings.every(h => h.isPaid);

            return (
              <div key={acc.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
                {/* 계좌 헤더 */}
                <div className="px-5 py-3 border-b border-slate-100 dark:border-dark-border flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold dark:text-dark-text">{acc.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{TYPE_LABEL[acc.type]} · {acc.targetPct}%</span>
                    {allPaid && <span className="ml-2 text-xs text-emerald-500 font-medium">✓ 전체 완료</span>}
                  </div>
                  {!isBulk ? (
                    <button
                      onClick={() => enterBulk(acc)}
                      className="text-xs px-3 py-1.5 border border-slate-200 dark:border-dark-border rounded-lg dark:text-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      전체 입력
                    </button>
                  ) : (
                    <button
                      onClick={() => cancelBulk(acc)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      취소
                    </button>
                  )}
                </div>

                {/* 종목 목록 */}
                <div className="divide-y divide-slate-50 dark:divide-dark-border/50">
                  {acc.holdings.map(h => {
                    const e = editing[h.recordId];
                    return (
                      <div key={h.recordId} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                        {/* 종목 정보 */}
                        <div className="flex-1 min-w-[120px]">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold dark:text-dark-text">{h.ticker}</p>
                            <span className="text-xs text-slate-400">{h.overallTargetPct.toFixed(1)}%</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">목표 {h.plannedAmt.toLocaleString()}원</p>
                        </div>

                        {isBulk ? (
                          /* 일괄 입력 모드 */
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={e?.actualAmt ?? ''}
                              onChange={ev => setEditing(prev => ({
                                ...prev,
                                [h.recordId]: { ...prev[h.recordId], actualAmt: formatNum(ev.target.value) }
                              }))}
                              placeholder="납입금액"
                              className="w-32 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                            />
                            <span className="text-xs text-slate-400">원</span>
                            <input
                              type="number"
                              value={e?.currentPct ?? ''}
                              onChange={ev => setEditing(prev => ({
                                ...prev,
                                [h.recordId]: { ...prev[h.recordId], currentPct: ev.target.value }
                              }))}
                              placeholder="현재비중"
                              className="w-24 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                              step={0.01}
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </div>
                        ) : (
                          /* 보기 모드 */
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className={`text-sm font-bold tabular-nums ${h.isPaid ? 'text-emerald-500' : h.actualAmt > 0 ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                {h.actualAmt > 0 ? `${h.actualAmt.toLocaleString()}원` : '—'}
                              </p>
                              {h.isPaid && <p className="text-xs text-emerald-500">✓ 완료</p>}
                            </div>
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
                      {isSaving ? '저장 중...' : '전체 납입 완료'}
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
      )}
    </div>
  );
};