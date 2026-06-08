import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';

interface Holding { id?: number; ticker: string; targetPct: number; sortOrder: number; }
interface Account { id?: number; name: string; type: string; targetPct: number; sortOrder: number; holdings: Holding[]; }
interface Setting { monthlyBudget: number; rebalanceThreshold: number; pensionLimit: number; }

// ── 세액공제 계산 유틸 ──────────────────────────────────────────────────
// 근로소득공제 (소득세법 제47조)
function calcEarnedDeduction(g: number): number {
  if (g <= 5_000_000) return g * 0.7;
  if (g <= 15_000_000) return 3_500_000 + (g - 5_000_000) * 0.4;
  if (g <= 45_000_000) return 7_500_000 + (g - 15_000_000) * 0.15;
  if (g <= 100_000_000) return 12_000_000 + (g - 45_000_000) * 0.05;
  return 14_750_000;
}

// 누진세율 (소득세법 제55조, 2024 기준)
function calcProgressiveTax(t: number): number {
  if (t <= 0) return 0;
  if (t <= 14_000_000) return t * 0.06;
  if (t <= 50_000_000) return 840_000 + (t - 14_000_000) * 0.15;
  if (t <= 88_000_000) return 6_240_000 + (t - 50_000_000) * 0.24;
  if (t <= 150_000_000) return 15_360_000 + (t - 88_000_000) * 0.35;
  if (t <= 300_000_000) return 37_060_000 + (t - 150_000_000) * 0.38;
  if (t <= 500_000_000) return 94_060_000 + (t - 300_000_000) * 0.40;
  if (t <= 1_000_000_000) return 174_060_000 + (t - 500_000_000) * 0.42;
  return 384_060_000 + (t - 1_000_000_000) * 0.45;
}

// 연간 소득세 (국세 + 지방소득세 포함) — 기본인적공제 150만원만 반영한 간이 추정
function calcAnnualTax(annualGross: number): number {
  if (annualGross <= 0) return 0;
  const earned = annualGross - calcEarnedDeduction(annualGross);
  const taxable = Math.max(0, earned - 1_500_000);
  const grossTax = calcProgressiveTax(taxable);
  // 근로소득세액공제 한도 (소득세법 제59조)
  const creditLimit = annualGross <= 33_000_000 ? 740_000
    : annualGross <= 70_000_000 ? 660_000 : 500_000;
  const credit = Math.min(
    grossTax <= 500_000 ? grossTax * 0.55 : 275_000 + (grossTax - 500_000) * 0.3,
    creditLimit,
  );
  // 지방소득세 10% 포함해서 반환 (세액공제율 16.5% = 국세 15% × 1.1 구조와 일치)
  return Math.round(Math.max(0, grossTax - credit) * 1.1);
}

// 실수령액 → 세전 월급 역산 (4대보험 + 소득세 반복 수렴)
// 4대보험 공제율: 국민연금 4.5% / 건강보험 3.545% / 장기요양 건강보험×12.81% / 고용보험 0.9%
function calcGrossFromNet(net: number): number {
  if (net <= 0) return 0;
  let g = net * 1.15;
  for (let i = 0; i < 80; i++) {
    const health = Math.round(g * 0.03545);
    const deductions =
      Math.round(g * 0.045) +          // 국민연금
      health +                          // 건강보험
      Math.round(health * 0.1281) +    // 장기요양
      Math.round(g * 0.009) +          // 고용보험
      Math.round(calcAnnualTax(g * 12) / 12); // 소득세+지방
    const diff = net - (g - deductions);
    if (Math.abs(diff) < 10) break;
    g += diff * 0.6;
  }
  return Math.max(0, Math.round(g));
}
// ────────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = { PENSION: 'text-violet-500', GENERAL: 'text-blue-500', IRP: 'text-emerald-500' };

const formatNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v: string) => parseInt(v.replace(/,/g, ''), 10) || 0;

export const InvestSettingsPage = () => {
  const [setting, setSetting] = useState<Setting>({ monthlyBudget: 0, rebalanceThreshold: 5, pensionLimit: 6000000 });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgetInput, setBudgetInput] = useState('');
  const [pensionInput, setPensionInput] = useState('');
  const [saving, setSaving] = useState(false);

  // 세액공제 계산기 입력 상태
  const [taxNetInput, setTaxNetInput] = useState('');
  const [taxProbation, setTaxProbation] = useState(false);
  const [taxProbEndMonth, setTaxProbEndMonth] = useState(3);
  const [taxJoinMonth, setTaxJoinMonth] = useState(1);

  // 세액공제 계산 결과 (입력 변경 시 자동 재계산)
  const taxResult = useMemo(() => {
    const net = parseNum(taxNetInput);
    if (net <= 0) return null;

    const probGross = calcGrossFromNet(net);
    const regGross = taxProbation ? Math.round(probGross / 0.8) : probGross;
    const annualSalary = regGross * 12;
    const creditRate = annualSalary <= 55_000_000 ? 0.165 : 0.132;
    const annualTax = calcAnnualTax(annualSalary);

    // 연금저축: 소득세를 완전히 상계하는 최적 납입액 (한도 600만)
    const pensionRaw = annualTax > 0 ? annualTax / creditRate : 0;
    const pensionAnnual = Math.min(Math.round(pensionRaw / 10000) * 10000, 6_000_000);
    const pensionRefund = Math.round(pensionAnnual * creditRate);

    // IRP: 연금저축으로 상계 후 남은 세금 처리 (한도 300만)
    const remainTax = annualTax - pensionRefund;
    const irpNeeded = remainTax > 0;
    const irpAnnual = irpNeeded
      ? Math.min(Math.round((remainTax / creditRate) / 10000) * 10000, 3_000_000) : 0;
    const irpRefund = Math.round(irpAnnual * creditRate);

    const remainMonths = Math.max(1, 13 - taxJoinMonth);

    return {
      annualSalary,
      creditRate,
      annualTax,
      pensionAnnual,
      pensionMonthly: Math.round(pensionAnnual / remainMonths),
      pensionRefund,
      irpNeeded,
      irpAnnual,
      irpMonthly: irpNeeded ? Math.round(irpAnnual / remainMonths) : 0,
      irpRefund,
    };
  }, [taxNetInput, taxProbation, taxJoinMonth]);

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

      {/* 세액공제 최적화 계산기 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold dark:text-dark-text">세액공제 최적화 계산기</h3>
          <p className="text-xs text-slate-400 dark:text-dark-muted mt-0.5">결과를 참고해 위 계좌 비중 %를 직접 설정하세요</p>
        </div>

        {/* 입력 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">월 실수령액</label>
            <input
              type="text"
              value={taxNetInput}
              onChange={e => setTaxNetInput(formatNum(e.target.value))}
              placeholder="2,800,000"
              className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">입사월</label>
            <select
              value={taxJoinMonth}
              onChange={e => setTaxJoinMonth(Number(e.target.value))}
              className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={taxProbation}
              onChange={e => setTaxProbation(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <span className="text-sm text-slate-600 dark:text-dark-text">수습 중</span>
          </label>
          {taxProbation && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-dark-muted whitespace-nowrap">수습 종료 예정월</label>
              <select
                value={taxProbEndMonth}
                onChange={e => setTaxProbEndMonth(Number(e.target.value))}
                className="p-1.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 결과 카드 */}
        {taxResult ? (
          <div className="rounded-xl border border-slate-100 dark:border-dark-border overflow-hidden text-sm">
            {/* 기본 정보 */}
            <div className="px-4 py-3 space-y-2 bg-slate-50/60 dark:bg-slate-800/20">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-dark-muted">예상 연봉</span>
                <span className="font-semibold tabular-nums dark:text-dark-text">
                  {Math.round(taxResult.annualSalary / 10000).toLocaleString()}만원
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-dark-muted">세액공제율</span>
                <span className={`font-semibold ${taxResult.creditRate === 0.165 ? 'text-violet-500' : 'text-blue-500'}`}>
                  {(taxResult.creditRate * 100).toFixed(1)}%
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    (총급여 {taxResult.annualSalary <= 55_000_000 ? '5,500만 이하' : '5,500만 초과'})
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-dark-muted">연간 소득세</span>
                <span className="font-semibold text-rose-500 tabular-nums">
                  {Math.round(taxResult.annualTax / 10000).toLocaleString()}만원
                  <span className="text-xs font-normal text-slate-400 ml-1">(지방소득세 포함)</span>
                </span>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-dark-border" />

            {/* 연금저축 추천 */}
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide">연금저축 추천</p>
              {taxResult.pensionAnnual > 0 ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-dark-muted">납입액</span>
                    <span className="font-semibold tabular-nums dark:text-dark-text">
                      연 {Math.round(taxResult.pensionAnnual / 10000).toLocaleString()}만원
                      <span className="text-slate-400 font-normal mx-1">/</span>
                      월 {Math.round(taxResult.pensionMonthly / 10000 * 10) / 10}만원
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-dark-muted">예상 환급액</span>
                    <span className="font-semibold text-emerald-500 tabular-nums">
                      {Math.round(taxResult.pensionRefund / 10000).toLocaleString()}만원
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 dark:text-dark-muted text-xs">소득세 없음 — 납입 불필요</p>
              )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-dark-border" />

            {/* IRP 추천 */}
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">IRP 추천</p>
              {taxResult.irpNeeded ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-dark-muted">납입액</span>
                    <span className="font-semibold tabular-nums dark:text-dark-text">
                      연 {Math.round(taxResult.irpAnnual / 10000).toLocaleString()}만원
                      <span className="text-slate-400 font-normal mx-1">/</span>
                      월 {Math.round(taxResult.irpMonthly / 10000 * 10) / 10}만원
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-dark-muted">예상 환급액</span>
                    <span className="font-semibold text-emerald-500 tabular-nums">
                      {Math.round(taxResult.irpRefund / 10000).toLocaleString()}만원
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 dark:text-dark-muted text-xs">연금저축으로 소득세 전액 상계 — IRP 불필요</p>
              )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-dark-border" />

            {/* ISA 안내 */}
            <div className="px-4 py-3 bg-slate-50/40 dark:bg-slate-800/10">
              <p className="text-xs text-slate-400 dark:text-dark-muted">
                ISA는 세액공제 없음 — 여유자금에서 별도 납입 권장
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-dark-border py-8 text-center">
            <p className="text-sm text-slate-400 dark:text-dark-muted">월 실수령액을 입력하면 결과가 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
};