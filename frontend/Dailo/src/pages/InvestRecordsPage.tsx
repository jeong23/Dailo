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
  const [editing, setEditing] = useState<Record<number, { actualAmt: string; currentPct: string }>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

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

  const startEdit = (h: DashHolding) => {
    setEditing(prev => ({
      ...prev,
      [h.recordId]: {
        actualAmt: h.actualAmt > 0 ? h.actualAmt.toLocaleString() : '',
        currentPct: h.currentPct > 0 ? h.currentPct.toFixed(2) : '',
      }
    }));
  };

  const saveRecord = async (recordId: number, isPaid: boolean) => {
    const e = editing[recordId];
    if (!e) return;
    setSaving(prev => ({ ...prev, [recordId]: true }));
    try {
      await api.put(`/invest/records/${recordId}`, {
        actualAmt: parseInt(e.actualAmt.replace(/,/g, ''), 10) || 0,
        isPaid,
        currentPct: parseFloat(e.currentPct) || null,
      });
      setEditing(prev => { const n = { ...prev }; delete n[recordId]; return n; });
      await fetchData(ym);
    } catch { alert('저장 실패'); }
    finally { setSaving(prev => ({ ...prev, [recordId]: false })); }
  };

  const togglePaid = async (recordId: number, currentIsPaid: boolean, actualAmt: number, currentPct: number) => {
    setSaving(prev => ({ ...prev, [recordId]: true }));
    try {
      await api.put(`/invest/records/${recordId}`, {
        actualAmt, isPaid: !currentIsPaid, currentPct,
      });
      await fetchData(ym);
    } catch { alert('저장 실패'); }
    finally { setSaving(prev => ({ ...prev, [recordId]: false })); }
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
          {data.accounts.map(acc => (
            <div key={acc.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-dark-border">
                <span className="text-sm font-bold dark:text-dark-text">{acc.name}</span>
                <span className="text-xs text-slate-400 ml-2">{TYPE_LABEL[acc.type]} · {acc.targetPct}%</span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-dark-border/50">
                {acc.holdings.map(h => {
                  const isEditing = !!editing[h.recordId];
                  const e = editing[h.recordId];
                  return (
                    <div key={h.recordId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold dark:text-dark-text">{h.ticker}</p>
                            <span className="text-xs text-slate-400">{h.overallTargetPct.toFixed(1)}%</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">목표 {h.plannedAmt.toLocaleString()}원</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isEditing ? (
                            <>
                              <div className="flex flex-col gap-1.5">
                                <input
                                  type="text"
                                  value={e.actualAmt}
                                  onChange={ev => setEditing(prev => ({
                                    ...prev,
                                    [h.recordId]: { ...e, actualAmt: formatNum(ev.target.value) }
                                  }))}
                                  placeholder="실제 납입금액"
                                  className="w-36 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <input
                                  type="number"
                                  value={e.currentPct}
                                  onChange={ev => setEditing(prev => ({
                                    ...prev,
                                    [h.recordId]: { ...e, currentPct: ev.target.value }
                                  }))}
                                  placeholder="현재 비중 (%)"
                                  className="w-36 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                                  step={0.01}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <button
                                  onClick={() => saveRecord(h.recordId, true)}
                                  disabled={saving[h.recordId]}
                                  className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                >
                                  납입 완료
                                </button>
                                <button
                                  onClick={() => saveRecord(h.recordId, false)}
                                  disabled={saving[h.recordId]}
                                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                                >
                                  임시 저장
                                </button>
                              </div>
                              <button
                                onClick={() => setEditing(prev => { const n = { ...prev }; delete n[h.recordId]; return n; })}
                                className="text-slate-400 hover:text-slate-600 text-xl"
                              >×</button>
                            </>
                          ) : (
                            <>
                              <div className="text-right">
                                <p className={`text-sm font-bold tabular-nums ${h.isPaid ? 'text-emerald-500' : h.actualAmt > 0 ? 'text-primary-500' : 'text-slate-400'}`}>
                                  {h.actualAmt > 0 ? `${h.actualAmt.toLocaleString()}원` : '—'}
                                </p>
                                {h.isPaid && <p className="text-xs text-emerald-500">✓ 완료</p>}
                              </div>
                              <button
                                onClick={() => startEdit(h)}
                                className="px-3 py-1.5 border border-slate-200 dark:border-dark-border rounded-lg text-sm dark:text-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                입력
                              </button>
                              {h.actualAmt > 0 && (
                                <button
                                  onClick={() => togglePaid(h.recordId, h.isPaid, h.actualAmt, h.currentPct)}
                                  disabled={saving[h.recordId]}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    h.isPaid
                                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {h.isPaid ? '완료 취소' : '완료 처리'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
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