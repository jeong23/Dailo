import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { TAX_CALC_RESULT_KEY, TaxCalcResult } from '../utils/taxCalc';

interface Holding { id?: number; ticker: string; targetPct: number; sortOrder: number; }
interface Account { id?: number; name: string; type: string; targetPct: number; sortOrder: number; holdings: Holding[]; }
interface Setting { monthlyBudget: number; rebalanceThreshold: number; pensionLimit: number; }

const TYPE_COLORS: Record<string, string> = { PENSION: 'text-violet-500', GENERAL: 'text-blue-500', IRP: 'text-emerald-500' };

const formatNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v: string) => parseInt(v.replace(/,/g, ''), 10) || 0;

export const InvestSettingsPage = () => {
  const [setting, setSetting] = useState<Setting>({ monthlyBudget: 0, rebalanceThreshold: 5, pensionLimit: 6000000 });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgetInput, setBudgetInput] = useState('');
  const [pensionInput, setPensionInput] = useState('');
  const [saving, setSaving] = useState(false);

  // 세액공제 추천 요약 — 설정 페이지에서 계산된 결과를 localStorage에서 읽어옴
  const [taxSummary, setTaxSummary] = useState<TaxCalcResult | null>(() => {
    try { return JSON.parse(localStorage.getItem(TAX_CALC_RESULT_KEY) || 'null'); } catch { return null; }
  });

  useEffect(() => {
    const onStorage = () => {
      try { setTaxSummary(JSON.parse(localStorage.getItem(TAX_CALC_RESULT_KEY) || 'null')); } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    api.get('/invest/setting').then(r => {
      const s = r.data.data;
      setSetting(s);
      setBudgetInput(s.monthlyBudget ? s.monthlyBudget.toLocaleString() : '');
      setPensionInput(s.pensionLimit ? s.pensionLimit.toLocaleString() : '6,000,000');
    }).catch(() => {});
    api.get('/invest/accounts').then(r => setAccounts(r.data.data || [])).catch(() => {});
  }, []);

  const accountPctSum = accounts.reduce((s, a) => s + (a.targetPct || 0), 0);

  const addAccount = () => {
    setAccounts(prev => [...prev, { name: '', type: 'GENERAL', targetPct: 0, sortOrder: prev.length, holdings: [] }]);
  };

  const removeAccount = (i: number) => setAccounts(prev => prev.filter((_, idx) => idx !== i));

  const updateAccount = (i: number, key: keyof Account, value: any) => {
    setAccounts(prev => prev.map((a, idx) => idx === i ? { ...a, [key]: value } : a));
  };

  const addHolding = (ai: number) => {
    setAccounts(prev => prev.map((a, idx) => idx !== ai ? a : {
      ...a, holdings: [...a.holdings, { ticker: '', targetPct: 0, sortOrder: a.holdings.length }]
    }));
  };

  const removeHolding = (ai: number, hi: number) => {
    setAccounts(prev => prev.map((a, idx) => idx !== ai ? a : {
      ...a, holdings: a.holdings.filter((_, hIdx) => hIdx !== hi)
    }));
  };

  const updateHolding = (ai: number, hi: number, key: keyof Holding, value: any) => {
    setAccounts(prev => prev.map((a, idx) => idx !== ai ? a : {
      ...a, holdings: a.holdings.map((h, hIdx) => hIdx !== hi ? h : { ...h, [key]: value })
    }));
  };

  const handleSave = async () => {
    // 유효성 검사
    for (const acc of accounts) {
      const sum = acc.holdings.reduce((s, h) => s + (h.targetPct || 0), 0);
      if (acc.holdings.length > 0 && Math.abs(sum - 100) > 0.1) {
        alert(`"${acc.name}" 계좌의 종목 비중 합계가 ${sum.toFixed(1)}%입니다. 100%여야 합니다.`);
        return;
      }
    }
    if (accounts.length > 0 && Math.abs(accountPctSum - 100) > 0.1) {
      alert(`계좌 비중 합계가 ${accountPctSum.toFixed(1)}%입니다. 100%여야 합니다.`);
      return;
    }
    setSaving(true);
    try {
      await api.post('/invest/setting', {
        monthlyBudget: parseNum(budgetInput),
        rebalanceThreshold: setting.rebalanceThreshold,
        pensionLimit: parseNum(pensionInput),
      });
      const accountsPayload = accounts.map((a, si) => ({
        ...a, sortOrder: si,
        holdings: a.holdings.map((h, hi) => ({ ...h, sortOrder: hi }))
      }));
      await api.post('/invest/accounts', accountsPayload);
      alert('저장되었습니다!');
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const budget = parseNum(budgetInput);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">적립식 투자 설정</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">투자 설정</h1>
      </div>

      {/* 세액공제 추천 요약 카드 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold dark:text-dark-text">세액공제 추천 납입액</h3>
          <Link to="/settings" className="text-xs text-primary-500 hover:text-primary-600 font-medium">
            계산기 설정 →
          </Link>
        </div>
        {taxSummary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl bg-violet-50/60 dark:bg-violet-900/10 p-3 space-y-0.5">
              <p className="text-xs text-violet-400 font-medium">연금저축 월</p>
              <p className="font-bold tabular-nums dark:text-dark-text">
                {Math.round(taxSummary.pensionMonthly / 10_000 * 10) / 10}만원
              </p>
              <p className="text-xs text-slate-400">연 {Math.round(taxSummary.pensionAnnual / 10_000)}만원</p>
            </div>
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 p-3 space-y-0.5">
              <p className="text-xs text-emerald-400 font-medium">IRP 월</p>
              {taxSummary.irpNeeded ? (
                <>
                  <p className="font-bold tabular-nums dark:text-dark-text">
                    {Math.round(taxSummary.irpMonthly / 10_000 * 10) / 10}만원
                  </p>
                  <p className="text-xs text-slate-400">연 {Math.round(taxSummary.irpAnnual / 10_000)}만원</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 pt-1">불필요</p>
              )}
            </div>
            <div className="rounded-xl bg-rose-50/60 dark:bg-rose-900/10 p-3 space-y-0.5">
              <p className="text-xs text-rose-400 font-medium">연간 소득세</p>
              <p className="font-bold tabular-nums dark:text-dark-text">
                {Math.round(taxSummary.annualTax / 10_000)}만원
              </p>
              <p className="text-xs text-slate-400">
                환급 {Math.round((taxSummary.pensionRefund + taxSummary.irpRefund) / 10_000)}만원
              </p>
            </div>
            <div className="rounded-xl bg-slate-50/60 dark:bg-slate-800/20 p-3 space-y-0.5">
              <p className="text-xs text-slate-400 font-medium">세액공제율</p>
              <p className={`font-bold ${taxSummary.creditRate === 0.165 ? 'text-violet-500' : 'text-blue-500'}`}>
                {(taxSummary.creditRate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-slate-400">
                {Math.round(taxSummary.annualSalary / 10_000).toLocaleString()}만원 기준
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-dark-muted py-2">
            <span>설정 페이지에서 계산기를 먼저 실행하세요.</span>
            <Link to="/settings" className="text-primary-500 hover:underline font-medium">바로가기 →</Link>
          </div>
        )}
      </div>

      {/* 기본 설정 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6 space-y-4">
        <h3 className="text-base font-semibold dark:text-dark-text">기본 설정</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">월 투자금</label>
            <input
              type="text" value={budgetInput}
              onChange={e => setBudgetInput(formatNum(e.target.value))}
              className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="1,000,000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">리밸런싱 트리거 (%)</label>
            <input
              type="number" value={setting.rebalanceThreshold}
              onChange={e => setSetting(s => ({ ...s, rebalanceThreshold: parseFloat(e.target.value) || 5 }))}
              className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              step={0.5} min={1} max={20}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">연금 세액공제 한도</label>
            <input
              type="text" value={pensionInput}
              onChange={e => setPensionInput(formatNum(e.target.value))}
              className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 계좌 설정 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6 space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-semibold dark:text-dark-text">계좌 & 종목 비중</h3>
            <p className={`text-xs mt-0.5 ${Math.abs(accountPctSum - 100) < 0.1 ? 'text-emerald-500' : 'text-rose-500'}`}>
              계좌 합계 {accountPctSum.toFixed(1)}% {Math.abs(accountPctSum - 100) < 0.1 ? '✓' : '(100%여야 함)'}
            </p>
          </div>
          <button onClick={addAccount} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            + 계좌 추가
          </button>
        </div>

        {accounts.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">계좌를 추가하세요</p>
        )}

        {accounts.map((acc, ai) => {
          const holdingSum = acc.holdings.reduce((s, h) => s + (h.targetPct || 0), 0);
          const accAmount = budget * (acc.targetPct / 100);

          return (
            <div key={ai} className="border border-slate-200 dark:border-dark-border rounded-xl p-4 space-y-3">
              {/* 계좌 헤더 */}
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={acc.type}
                  onChange={e => updateAccount(ai, 'type', e.target.value)}
                  className="p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="PENSION">연금저축</option>
                  <option value="GENERAL">일반</option>
                  <option value="IRP">IRP</option>
                </select>
                <input
                  type="text" value={acc.name}
                  onChange={e => updateAccount(ai, 'name', e.target.value)}
                  placeholder="계좌명 (예: KB증권 연금저축)"
                  className="flex-1 min-w-[140px] p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" value={acc.targetPct}
                    onChange={e => updateAccount(ai, 'targetPct', parseFloat(e.target.value) || 0)}
                    className="w-16 p-1.5 rounded-lg border text-sm text-center dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                    min={0} max={100} step={1}
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
                {budget > 0 && (
                  <span className={`text-xs font-medium ${TYPE_COLORS[acc.type] || 'text-slate-500'}`}>
                    {accAmount.toLocaleString()}원
                  </span>
                )}
                <button onClick={() => removeAccount(ai)} className="text-slate-300 hover:text-rose-500 text-lg transition-colors ml-auto">×</button>
              </div>

              {/* 종목 */}
              <div className="pl-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className={`text-[11px] font-medium ${Math.abs(holdingSum - 100) < 0.1 || acc.holdings.length === 0 ? 'text-slate-400' : 'text-rose-500'}`}>
                    종목 합계 {holdingSum.toFixed(1)}%
                  </p>
                  <button onClick={() => addHolding(ai)} className="text-xs text-primary-500 hover:text-primary-600 font-medium">+ 종목 추가</button>
                </div>

                {acc.holdings.map((h, hi) => {
                  const holdingAmount = accAmount * (h.targetPct / 100);
                  return (
                    <div key={hi} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text" value={h.ticker}
                        onChange={e => updateHolding(ai, hi, 'ticker', e.target.value)}
                        placeholder="종목명 (예: TIGER 미국S&P500)"
                        className="flex-1 min-w-[160px] p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" value={h.targetPct}
                          onChange={e => updateHolding(ai, hi, 'targetPct', parseFloat(e.target.value) || 0)}
                          className="w-14 p-1.5 rounded-lg border text-sm text-center dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                          min={0} max={100} step={1}
                        />
                        <span className="text-sm text-slate-400">%</span>
                      </div>
                      {budget > 0 && (
                        <span className="text-xs text-slate-400 tabular-nums">{Math.round(holdingAmount).toLocaleString()}원</span>
                      )}
                      <button onClick={() => removeHolding(ai, hi)} className="text-slate-300 hover:text-rose-500 text-base transition-colors">×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>

    </div>
  );
};