import React, { useState, useEffect } from 'react';
import { MonthlyBudget } from '../types';
import api, { getStoredMemberId } from '../api/axios';
import { formatNumber, parseNumber, getCurrentSettleMonth } from '../utils/format';
import { getAllocationLabels, setAllocationLabels, AllocationKey } from '../utils/allocationLabels';

const ALLOCATION_BASE = [
  { rateKey: 'livingRate' as const,        labelKey: 'living' as AllocationKey,       color: 'bg-blue-500',    text: 'text-blue-500' },
  { rateKey: 'isaRate' as const,           labelKey: 'isa' as AllocationKey,          color: 'bg-emerald-500', text: 'text-emerald-500' },
  { rateKey: 'pensionRate' as const,       labelKey: 'pension' as AllocationKey,      color: 'bg-violet-500',  text: 'text-violet-500' },
  { rateKey: 'emergencyRate' as const,     labelKey: 'emergency' as AllocationKey,    color: 'bg-amber-500',   text: 'text-amber-500' },
  { rateKey: 'discretionaryRate' as const, labelKey: 'discretionary' as AllocationKey, color: 'bg-rose-500',  text: 'text-rose-500' },
];

type RateKey = typeof ALLOCATION_BASE[number]['rateKey'];

const DEFAULT_RATES: Record<RateKey, number> = {
  livingRate: 35,
  isaRate: 25,
  pensionRate: 15,
  emergencyRate: 15,
  discretionaryRate: 10,
};

export const BudgetSettingsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentSettleMonth());
  const [existingBudget, setExistingBudget] = useState<MonthlyBudget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);

  const [labels, setLabels] = useState(getAllocationLabels());
  const [labelEditMode, setLabelEditMode] = useState(false);
  const [labelDraft, setLabelDraft] = useState(getAllocationLabels());

  const allocationMeta = ALLOCATION_BASE.map(a => ({ ...a, label: labels[a.labelKey] }));

  // 폼 상태
  const [netSalary, setNetSalary] = useState('');
  const [cardGoal, setCardGoal] = useState('');
  const [livingCarryover, setLivingCarryover] = useState('');
  const [rates, setRates] = useState<Record<RateKey, number>>({ ...DEFAULT_RATES });

  // 금액 입력 모드
  const [inputMode, setInputMode] = useState<'rate' | 'amount'>('rate');
  const [amountInputs, setAmountInputs] = useState<Record<RateKey, string>>({
    livingRate: '', isaRate: '', pensionRate: '', emergencyRate: '', discretionaryRate: '',
  });

  // 고정비 합계 (서버에서 조회)
  const [fixedCostTotal, setFixedCostTotal] = useState(0);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [allBudgets, setAllBudgets] = useState<MonthlyBudget[]>([]);
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);
  const [emergencyCumulative, setEmergencyCumulative] = useState<number | null>(null);
  const [salaryDay, setSalaryDay] = useState<number>(
    parseInt(localStorage.getItem('salaryDay') || '25', 10)
  );
  const [isSavingDay, setIsSavingDay] = useState(false);

  // 미리보기 계산값
  const net = parseNumber(netSalary);
  const available = Math.max(net - fixedCostTotal, 0);
  const rateTotal = Object.values(rates).reduce((s, v) => s + v, 0);

  // 금액 모드: 입력 금액에서 비율 계산
  const parsedAmounts = ALLOCATION_BASE.map(a => parseNumber(amountInputs[a.rateKey]));
  const amountTotal = parsedAmounts.reduce((s, v) => s + v, 0);
  const amountDiff = available - amountTotal; // 남은 금액 (0이면 정확히 맞음)
  const computedRates: Record<RateKey, number> = available > 0
    ? Object.fromEntries(
        ALLOCATION_BASE.map((a, i) => [a.rateKey, Math.round(parsedAmounts[i] / available * 100)])
      ) as Record<RateKey, number>
    : { livingRate: 0, isaRate: 0, pensionRate: 0, emergencyRate: 0, discretionaryRate: 0 };

  const activeRates = inputMode === 'rate' ? rates : computedRates;
  const preview = allocationMeta.map((a, i) => ({
    ...a,
    rate: activeRates[a.rateKey] / 100,
    amount: inputMode === 'rate'
      ? Math.floor(available * rates[a.rateKey] / 100)
      : parsedAmounts[i],
  }));

  const switchToAmount = () => {
    // 비율 → 금액: 현재 비율로 금액 계산, 마지막 항목은 나머지로
    if (available > 0) {
      const keys = ALLOCATION_BASE.map(a => a.rateKey);
      const amounts = keys.map(k => Math.floor(available * rates[k] / 100));
      const remainder = available - amounts.slice(0, -1).reduce((s, v) => s + v, 0);
      amounts[amounts.length - 1] = remainder;
      setAmountInputs(Object.fromEntries(keys.map((k, i) => [k, formatNumber(amounts[i])])) as Record<RateKey, string>);
    } else {
      setAmountInputs({ livingRate: '', isaRate: '', pensionRate: '', emergencyRate: '', discretionaryRate: '' });
    }
    setInputMode('amount');
  };

  const switchToRate = () => {
    // 금액 → 비율: 입력 금액으로 비율 계산
    if (available > 0 && amountTotal > 0) {
      setRates(computedRates);
    }
    setInputMode('rate');
  };

  useEffect(() => {
    api.get(`/monthly-budgets/member/${getStoredMemberId()}`)
      .then(res => {
        const budgets: MonthlyBudget[] = res.data.data || [];
        setAllBudgets(budgets);
        const saved = budgets.map(b => b.settleMonth);
        const current = getCurrentSettleMonth();
        const [y, m] = current.split('-').map(Number);
        const next = new Date(y, m, 1);
        const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        const base = saved.includes(current) ? saved : [current, ...saved];
        const options = saved.includes(nextMonth) ? base : [nextMonth, ...base];
        setMonthOptions(options);
        setBudgetsLoaded(true);
        fetchData(budgets);
      })
      .catch(() => {
        setMonthOptions([getCurrentSettleMonth()]);
        setBudgetsLoaded(true);
        fetchData([]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async (budgetList = allBudgets, month = selectedMonth) => {
    const memberId = getStoredMemberId();
    const [budgetRes, fixedRes, emergencyRes] = await Promise.allSettled([
      api.get(`/monthly-budgets/member/${memberId}/month/${month}`),
      api.get(`/fixed-costs/member/${memberId}`),
      api.get(`/dashboard/emergency-history?memberId=${memberId}`),
    ]);

    if (budgetRes.status === 'fulfilled') {
      const budget: MonthlyBudget = budgetRes.value.data.data;
      if (budget) {
        setExistingBudget(budget);
        setNetSalary(formatNumber(budget.netSalary));
        setCardGoal(formatNumber(budget.cardGoal));
        setLivingCarryover(formatNumber(budget.livingCarryover));
        setRates({
          livingRate:        Math.round(budget.livingRate * 100),
          isaRate:           Math.round(budget.isaRate * 100),
          pensionRate:       Math.round(budget.pensionRate * 100),
          emergencyRate:     Math.round(budget.emergencyRate * 100),
          discretionaryRate: Math.round(budget.discretionaryRate * 100),
        });
      }
    } else {
      setExistingBudget(null);
      setLivingCarryover('');

      // 이전 달 예산을 찾아 월급·비율 기본값으로 사용
      const prev = budgetList
        .filter(b => b.settleMonth < selectedMonth)
        .sort((a, b) => b.settleMonth.localeCompare(a.settleMonth))[0];

      if (prev) {
        setNetSalary(formatNumber(prev.netSalary));
        setCardGoal(formatNumber(prev.cardGoal));
        setRates({
          livingRate:        prev.livingRate        ? Math.round(prev.livingRate * 100)        : DEFAULT_RATES.livingRate,
          isaRate:           prev.isaRate           ? Math.round(prev.isaRate * 100)           : DEFAULT_RATES.isaRate,
          pensionRate:       prev.pensionRate       ? Math.round(prev.pensionRate * 100)       : DEFAULT_RATES.pensionRate,
          emergencyRate:     prev.emergencyRate     ? Math.round(prev.emergencyRate * 100)     : DEFAULT_RATES.emergencyRate,
          discretionaryRate: prev.discretionaryRate ? Math.round(prev.discretionaryRate * 100) : DEFAULT_RATES.discretionaryRate,
        });
      } else {
        setNetSalary('');
        setCardGoal('');
        setRates({ ...DEFAULT_RATES });
      }
    }

    if (fixedRes.status === 'fulfilled') {
      const fixedList = fixedRes.value.data.data || [];
      const total = fixedList
        .filter((f: any) => f.isActive)
        .reduce((sum: number, f: any) => sum + f.amount, 0);
      setFixedCostTotal(total);
    }

    if (emergencyRes.status === 'fulfilled') {
      const history: any[] = emergencyRes.value.data.data || [];
      const entry = history.find(h => h.settleMonth === month);
      setEmergencyCumulative(entry ? entry.cumulativeAmount : null);
    }
  };

  useEffect(() => {
    if (budgetsLoaded) fetchData(allBudgets, selectedMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  useEffect(() => {
    const saved = localStorage.getItem(`settingsMemo-${selectedMonth}`) || '';
    setMemo(saved);
    setMemoSaved(false);
  }, [selectedMonth]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`settingsMemo-${selectedMonth}`, memo);
      if (memo) setMemoSaved(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [memo, selectedMonth]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const finalRates = activeRates;
    const body = {
      memberId: getStoredMemberId(),
      settleMonth: selectedMonth,
      netSalary: net,
      cardGoal:        parseNumber(cardGoal),
      livingCarryover: parseNumber(livingCarryover),
      livingRate:        finalRates.livingRate / 100,
      isaRate:           finalRates.isaRate / 100,
      pensionRate:       finalRates.pensionRate / 100,
      emergencyRate:     finalRates.emergencyRate / 100,
      discretionaryRate: finalRates.discretionaryRate / 100,
    };

    try {
      if (existingBudget?.id) {
        await api.put(`/monthly-budgets/${existingBudget.id}`, body);
      } else {
        await api.post('/monthly-budgets', body);
      }
      alert('저장되었습니다!');
      fetchData();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 실패');
    } finally {
      setIsSaving(false);
    }
  };


  const handleSaveSalaryDay = async () => {
    const memberId = getStoredMemberId();
    const day = Math.min(28, Math.max(1, salaryDay));
    setIsSavingDay(true);
    try {
      await api.put(`/members/${memberId}`, { salaryDay: day });
      localStorage.setItem('salaryDay', String(day));
      setSalaryDay(day);
      alert('월급날이 저장되었습니다.');
    } catch {
      alert('저장 실패');
    } finally {
      setIsSavingDay(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">급여 · 분배 비율 설정</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">월별 예산 설정</h1>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 rounded-full text-sm border dark:bg-dark-card dark:border-dark-border dark:text-dark-text"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* 월급날 설정 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
        <h3 className="text-base font-semibold mb-3 dark:text-dark-text">월급날 설정</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
          매월 이 날짜를 기준으로 정산월이 계산됩니다. (예: 25일 → 4/25 이후는 "5월 예산"으로 분류)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium dark:text-dark-muted whitespace-nowrap">매월</label>
          <input
            type="number"
            min={1}
            max={28}
            value={salaryDay}
            onChange={e => setSalaryDay(Number(e.target.value))}
            className="w-20 p-2 rounded-lg border text-center text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
          />
          <label className="text-sm font-medium dark:text-dark-muted">일</label>
          <button
            onClick={handleSaveSalaryDay}
            disabled={isSavingDay}
            className="sm:ml-auto px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isSavingDay ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 입력 폼 */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
          <h3 className="text-lg font-semibold mb-6 dark:text-dark-text">급여 정보 입력</h3>

          <form onSubmit={handleSave} className="space-y-5">
            {/* 고정비 안내 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-dark-border">
              <p className="text-xs text-slate-500 dark:text-dark-muted">고정비 합계 (설정에서 관리)</p>
              <p className="text-base font-bold text-red-500 mt-0.5">
                − {fixedCostTotal.toLocaleString()}원
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-dark-muted">
                실수령액 (월급)
              </label>
              <input
                type="text"
                value={netSalary}
                onChange={(e) => setNetSalary(formatNumber(e.target.value))}
                className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="예: 2,304,600"
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                수습 80% 기준 ≈ 1,843,680원 / 정규 ≈ 2,304,600원
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-dark-muted">
                카드 실적 목표
              </label>
              <input
                type="text"
                value={cardGoal}
                onChange={(e) => setCardGoal(formatNumber(e.target.value))}
                className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="예: 500,000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">
                  생활비 이월액
                </label>
                <input
                  type="text"
                  value={livingCarryover}
                  onChange={(e) => setLivingCarryover(formatNumber(e.target.value))}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">
                  비상금 누적액
                </label>
                <div className="w-full p-2.5 rounded-lg border dark:border-dark-border bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-dark-muted text-sm">
                  {emergencyCumulative !== null
                    ? `${emergencyCumulative.toLocaleString()}원`
                    : '—'}
                </div>
                <p className="text-xs text-slate-400 mt-1">비상금 페이지에서 자동 계산됩니다</p>
              </div>
            </div>

            {/* 항목명 편집 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium dark:text-dark-muted">항목명</label>
                {!labelEditMode ? (
                  <button
                    type="button"
                    onClick={() => { setLabelDraft({ ...labels }); setLabelEditMode(true); }}
                    className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                  >
                    편집
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = Object.fromEntries(
                          Object.entries(labelDraft).map(([k, v]) => [k, v.trim() || labels[k as AllocationKey]])
                        ) as typeof labelDraft;
                        setAllocationLabels(trimmed);
                        setLabels(trimmed);
                        setLabelEditMode(false);
                      }}
                      className="text-xs text-emerald-500 hover:text-emerald-600 font-medium"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelEditMode(false)}
                      className="text-xs text-slate-400 hover:text-slate-500 font-medium"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
              {labelEditMode ? (
                <div className="space-y-2">
                  {ALLOCATION_BASE.map(a => (
                    <div key={a.labelKey} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.color}`} />
                      <input
                        type="text"
                        value={labelDraft[a.labelKey]}
                        onChange={e => setLabelDraft(prev => ({ ...prev, [a.labelKey]: e.target.value }))}
                        maxLength={10}
                        className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allocationMeta.map(a => (
                    <span key={a.labelKey} className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${a.text}`}>
                      {a.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 분배 입력 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium dark:text-dark-muted">분배 설정</label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={switchToRate}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${inputMode === 'rate' ? 'bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                  >
                    비율
                  </button>
                  <button
                    type="button"
                    onClick={switchToAmount}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${inputMode === 'amount' ? 'bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                  >
                    금액
                  </button>
                </div>
              </div>

              {inputMode === 'rate' ? (
                <>
                  <div className="space-y-2">
                    {allocationMeta.map(a => (
                      <div key={a.rateKey} className="flex items-center gap-2">
                        <span className={`text-xs font-medium w-16 truncate ${a.text}`}>{a.label}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={rates[a.rateKey]}
                          onChange={e => setRates(prev => ({ ...prev, [a.rateKey]: Math.floor(Number(e.target.value)) }))}
                          className="w-20 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-xs text-slate-400">%</span>
                        {available > 0 && (
                          <span className="text-xs text-slate-400 tabular-nums ml-auto">
                            {Math.floor(available * rates[a.rateKey] / 100).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className={`text-xs font-bold mt-2 ${rateTotal === 100 ? 'text-emerald-500' : 'text-red-500'}`}>
                    합계 {rateTotal}%{rateTotal !== 100 && ' (100%여야 합니다)'}
                  </p>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    {allocationMeta.map((a, i) => (
                      <div key={a.rateKey} className="flex items-center gap-2">
                        <span className={`text-xs font-medium w-16 truncate ${a.text}`}>{a.label}</span>
                        <input
                          type="text"
                          value={amountInputs[a.rateKey]}
                          onChange={e => setAmountInputs(prev => ({ ...prev, [a.rateKey]: formatNumber(e.target.value) }))}
                          placeholder="0"
                          className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                        />
                        <span className="text-xs text-slate-400">원</span>
                        {available > 0 && parsedAmounts[i] > 0 && (
                          <span className="text-xs text-slate-400 tabular-nums w-8 text-right">
                            {Math.round(parsedAmounts[i] / available * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={`flex justify-between items-center mt-2 text-xs font-bold ${Math.abs(amountDiff) <= 1 ? 'text-emerald-500' : 'text-red-500'}`}>
                    <span>합계 {amountTotal.toLocaleString()}원</span>
                    {Math.abs(amountDiff) > 1 && (
                      <span>{amountDiff > 0 ? `${amountDiff.toLocaleString()}원 남음` : `${Math.abs(amountDiff).toLocaleString()}원 초과`}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || !netSalary || (inputMode === 'rate' ? rateTotal !== 100 : Math.abs(amountDiff) > 1)}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? '저장 중...' : existingBudget ? '수정하기' : '저장하기'}
            </button>
          </form>
        </div>

        {/* 분배 미리보기 */}
        <div className="space-y-4">
          {/* 가용 금액 */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-dark-text">분배 계산 미리보기</h3>

            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-dark-muted">실수령액</span>
              <span className="font-bold dark:text-dark-text">{net.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-dark-muted">고정비</span>
              <span className="font-bold text-red-500">−{fixedCostTotal.toLocaleString()}원</span>
            </div>
            <div className="border-t dark:border-dark-border my-3" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold dark:text-dark-text">가용 금액</span>
              <span className="text-xl font-bold text-primary-600">{available.toLocaleString()}원</span>
            </div>
          </div>

          {/* 항목별 분배 */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6 space-y-4">
            {preview.map((item) => (
              <div key={item.rateKey}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${item.text}`}>{item.label}</span>
                    <span className="text-xs text-slate-400">{Math.round(item.rate * 100)}%</span>
                  </div>
                  <span className="font-bold dark:text-dark-text">{item.amount.toLocaleString()}원</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${item.color} h-full rounded-full transition-all duration-500`}
                    style={{ width: available > 0 ? `${item.rate * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-semibold dark:text-dark-text">{selectedMonth} 메모</h3>
          {memoSaved && (
            <span className="text-xs text-emerald-500 font-medium">저장됨</span>
          )}
        </div>
        <textarea
          value={memo}
          onChange={(e) => { setMemo(e.target.value); setMemoSaved(false); }}
          rows={5}
          placeholder="이달의 메모, 특이사항, 계획 등을 자유롭게 작성하세요..."
          className="w-full p-3 rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg text-sm text-slate-800 dark:text-dark-text placeholder-slate-400 dark:placeholder-slate-600 resize-none outline-none focus:ring-2 focus:ring-primary-500 transition-all"
        />
      </div>
    </div>
  );
};
