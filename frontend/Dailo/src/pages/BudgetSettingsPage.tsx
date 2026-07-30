import React, { useState, useEffect, useMemo } from 'react';
import { MonthlyBudget } from '../types';
import api, { getStoredMemberId } from '../api/axios';
import { formatNumber, parseNumber, formatSignedNumber, parseSignedNumber, getCurrentSettleMonth } from '../utils/format';
import { getAllocationLabels, setAllocationLabels, AllocationKey } from '../utils/allocationLabels';
import { calcTaxOptimization, TAX_CALC_RESULT_KEY, TAX_CALC_INPUTS_KEY } from '../utils/taxCalc';

// 고정 5항목(레거시 비상금 포함) — 이 5개는 백엔드 컬럼(livingRate~discretionaryRate)이 그대로 유지된다.
const ALLOCATION_BASE = [
  { rateKey: 'livingRate' as const,        labelKey: 'living' as AllocationKey,       color: 'bg-blue-500',    text: 'text-blue-500' },
  { rateKey: 'isaRate' as const,           labelKey: 'isa' as AllocationKey,          color: 'bg-emerald-500', text: 'text-emerald-500' },
  { rateKey: 'pensionRate' as const,       labelKey: 'pension' as AllocationKey,      color: 'bg-violet-500',  text: 'text-violet-500' },
  { rateKey: 'emergencyRate' as const,     labelKey: 'emergency' as AllocationKey,    color: 'bg-amber-500',   text: 'text-amber-500' },
  { rateKey: 'discretionaryRate' as const, labelKey: 'discretionary' as AllocationKey, color: 'bg-rose-500',  text: 'text-rose-500' },
];

type RateKey = typeof ALLOCATION_BASE[number]['rateKey'];

// 가변 추가 항목(옛 extra1~3, 이제 개수 제한 없음) 미리보기용 색상 팔레트 — 인덱스 기반 순환
const ITEM_PALETTE = [
  { color: 'bg-sky-500',      text: 'text-sky-500' },
  { color: 'bg-pink-500',     text: 'text-pink-500' },
  { color: 'bg-teal-500',     text: 'text-teal-500' },
  { color: 'bg-cyan-500',     text: 'text-cyan-500' },
  { color: 'bg-fuchsia-500',  text: 'text-fuchsia-500' },
  { color: 'bg-lime-500',     text: 'text-lime-500' },
  { color: 'bg-orange-500',   text: 'text-orange-500' },
  { color: 'bg-indigo-500',   text: 'text-indigo-500' },
];

interface AllocationItemForm {
  label: string;
  rate: number; // percent 0~100
}

// 레거시(비상금 항목 있던 시절) 기본값은 35/25/15/15/10 이었음 — 과거 데이터는 existingBudget.emergencyRate로 판단하므로
// 이 상수 자체는 더 이상 참조하지 않는다 (참고용 주석으로만 남김)

// 비상금 폐지 후 4항목 기본값 — 기존 비상금 비율(15%)을 생활비 쪽으로 흡수 (35 + 15 = 50)
const DEFAULT_RATES_4: Record<RateKey, number> = {
  livingRate: 50, isaRate: 25, pensionRate: 15, emergencyRate: 0, discretionaryRate: 10,
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

  // 비상금 레거시 판단: 현재 선택된 달의 MonthlyBudget에 emergencyRate가 남아있으면(과거 데이터) 5항목 그대로,
  // 아니면(신규 달) 비상금 제외 4항목만 사용 — 날짜 비교 금지, 저장된 emergencyRate 값 자체로 판단
  const isLegacyEmergency = !!existingBudget?.emergencyRate && existingBudget.emergencyRate > 0;

  // Active fixed allocation items = 레거시면 5, 아니면 4
  const activeAllocationBase = isLegacyEmergency
    ? ALLOCATION_BASE
    : ALLOCATION_BASE.filter(a => a.rateKey !== 'emergencyRate');

  // 폼 상태 — 고정 5항목 비율
  const [netSalary, setNetSalary] = useState('');
  const [cardGoal, setCardGoal] = useState('');
  const [livingCarryover, setLivingCarryover] = useState('');
  const [rates, setRates] = useState<Record<RateKey, number>>({ ...DEFAULT_RATES_4 });

  // 가변 추가 항목(라벨+비율) — 개수 제한 없음
  const [allocationItems, setAllocationItems] = useState<AllocationItemForm[]>([]);

  // 금액 입력 모드
  const [inputMode, setInputMode] = useState<'rate' | 'amount'>('rate');
  const [amountInputs, setAmountInputs] = useState<Record<RateKey, string>>({
    livingRate: '', isaRate: '', pensionRate: '', emergencyRate: '', discretionaryRate: '',
  });
  const [itemAmountInputs, setItemAmountInputs] = useState<string[]>([]);

  // 고정비 합계 (서버에서 조회)
  const [fixedCostTotal, setFixedCostTotal] = useState(0);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [allBudgets, setAllBudgets] = useState<MonthlyBudget[]>([]);
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);
  const [emergencyCumulative, setEmergencyCumulative] = useState<number | null>(null);
  const [cashAssetBalance, setCashAssetBalance] = useState<number | null>(null);
  const [salaryDay, setSalaryDay] = useState<number>(
    parseInt(localStorage.getItem('salaryDay') || '25', 10)
  );
  const [isSavingDay, setIsSavingDay] = useState(false);

  // 세액공제 계산기 — lazy initializer로 초기 1회만 localStorage 읽기
  const [taxProbation, setTaxProbation] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(TAX_CALC_INPUTS_KEY) || '{}').isProbation ?? false; } catch { return false; }
  });
  const [taxProbEndMonth, setTaxProbEndMonth] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(TAX_CALC_INPUTS_KEY) || '{}').probEndMonth ?? 3; } catch { return 3; }
  });
  const [taxJoinMonth, setTaxJoinMonth] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(TAX_CALC_INPUTS_KEY) || '{}').joinMonth ?? 1; } catch { return 1; }
  });

  // 입력 변경 시 localStorage 저장 + 결과 계산
  const taxResult = useMemo(() => {
    const inputs = { isProbation: taxProbation, probEndMonth: taxProbEndMonth, joinMonth: taxJoinMonth };
    localStorage.setItem(TAX_CALC_INPUTS_KEY, JSON.stringify(inputs));
    const result = calcTaxOptimization(parseNumber(netSalary), taxProbation, taxJoinMonth);
    if (result) localStorage.setItem(TAX_CALC_RESULT_KEY, JSON.stringify(result));
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netSalary, taxProbation, taxJoinMonth, taxProbEndMonth]);

  // 미리보기 계산값
  const net = parseNumber(netSalary);
  const available = Math.max(net - fixedCostTotal, 0);

  // 고정 항목 + 가변 항목을 합친 통합 행 목록 — 합계 검증·미리보기·모드 전환에 공통 사용
  const combinedRows = useMemo(() => [
    ...activeAllocationBase.map(a => ({
      kind: 'fixed' as const,
      id: a.rateKey as string,
      label: labels[a.labelKey],
      color: a.color,
      text: a.text,
      rate: rates[a.rateKey],
      amountInput: amountInputs[a.rateKey],
      fixedKey: a.rateKey,
    })),
    ...allocationItems.map((item, index) => ({
      kind: 'item' as const,
      id: `item-${index}`,
      label: item.label,
      color: ITEM_PALETTE[index % ITEM_PALETTE.length].color,
      text: ITEM_PALETTE[index % ITEM_PALETTE.length].text,
      rate: item.rate,
      amountInput: itemAmountInputs[index] ?? '',
      index,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [activeAllocationBase, labels, rates, amountInputs, allocationItems, itemAmountInputs]);

  const rateTotal = combinedRows.reduce((s, r) => s + r.rate, 0);

  // 금액 모드: 생활비는 직접 입력받지 않고 "가용금액 - 나머지 항목 합계"로 자동 계산 — 나머지가 전부 생활비로 흡수되어
  // ISA/연금저축처럼 딱 떨어지는 금액만 맞추면 되고, 합계를 100%로 수동 조정할 필요가 없어진다.
  const livingRowIndex = combinedRows.findIndex(r => r.kind === 'fixed' && r.fixedKey === 'livingRate');
  const rawAmounts = combinedRows.map(r => parseNumber(r.amountInput));
  const otherAmountsTotal = rawAmounts.reduce((s, v, i) => (i === livingRowIndex ? s : s + v), 0);
  const livingRemainder = Math.max(available - otherAmountsTotal, 0);
  const parsedAmounts = rawAmounts.map((v, i) => (i === livingRowIndex ? livingRemainder : v));
  const amountTotal = parsedAmounts.reduce((s, v) => s + v, 0);
  const amountDiff = available - amountTotal;

  // 미리보기 (rate 또는 amount 모드에 따라 실효 비율/금액 계산)
  const preview = combinedRows.map((r, i) => {
    const effectivePercent = inputMode === 'rate'
      ? r.rate
      : (available > 0 ? Math.round(parsedAmounts[i] / available * 100) : 0);
    const effectiveAmount = inputMode === 'rate'
      ? Math.floor(available * r.rate / 100)
      : parsedAmounts[i];
    return { ...r, ratio: effectivePercent / 100, amount: effectiveAmount };
  });

  // 가변 항목 라벨 중복 검사 (백엔드 UNIQUE 제약과 동일 기준 — 저장 전 프론트에서 미리 안내)
  const trimmedItemLabels = allocationItems.map(it => it.label.trim());
  const duplicateItemLabels = Array.from(new Set(
    trimmedItemLabels.filter((label, idx) => label !== '' && trimmedItemLabels.indexOf(label) !== idx)
  ));
  const hasBlankItemLabel = allocationItems.some(it => it.label.trim() === '');

  const switchToAmount = () => {
    if (available > 0 && combinedRows.length > 0) {
      const amounts = combinedRows.map(r => Math.floor(available * r.rate / 100));
      const remainder = available - amounts.slice(0, -1).reduce((s, v) => s + v, 0);
      amounts[amounts.length - 1] = remainder;

      const newAmountInputs = { ...amountInputs };
      const newItemAmountInputs = [...itemAmountInputs];
      combinedRows.forEach((r, i) => {
        if (r.kind === 'fixed') newAmountInputs[r.fixedKey] = formatNumber(amounts[i]);
        else newItemAmountInputs[r.index] = formatNumber(amounts[i]);
      });
      setAmountInputs(newAmountInputs);
      setItemAmountInputs(newItemAmountInputs);
    } else {
      setAmountInputs(prev => Object.fromEntries(
        activeAllocationBase.map(a => [a.rateKey, ''])
      ) as Record<RateKey, string>);
      setItemAmountInputs(allocationItems.map(() => ''));
    }
    setInputMode('amount');
  };

  const switchToRate = () => {
    if (available > 0 && amountTotal > 0) {
      const newRates = { ...rates };
      const newItems = allocationItems.map(it => ({ ...it }));
      combinedRows.forEach((r, i) => {
        const pct = Math.round(parsedAmounts[i] / available * 100);
        if (r.kind === 'fixed') newRates[r.fixedKey] = pct;
        else newItems[r.index].rate = pct;
      });
      setRates(newRates);
      setAllocationItems(newItems);
    }
    setInputMode('rate');
  };

  useEffect(() => {
    api.get('/monthly-budgets/mine')
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
    const [budgetRes, fixedRes, emergencyRes, cashAssetRes] = await Promise.allSettled([
      api.get(`/monthly-budgets/mine/month/${month}`),
      api.get(`/fixed-costs/member/${memberId}`),
      api.get('/dashboard/emergency-history'),
      api.get('/cash-assets'),
    ]);

    if (budgetRes.status === 'fulfilled') {
      const budget: MonthlyBudget = budgetRes.value.data.data;
      if (budget) {
        setExistingBudget(budget);
        setNetSalary(formatNumber(budget.netSalary));
        setCardGoal(formatNumber(budget.cardGoal));
        setLivingCarryover(formatSignedNumber(budget.livingCarryover));
        setRates({
          livingRate:        Math.round(budget.livingRate * 100),
          isaRate:           Math.round(budget.isaRate * 100),
          pensionRate:       Math.round(budget.pensionRate * 100),
          emergencyRate:     Math.round(budget.emergencyRate * 100),
          discretionaryRate: Math.round(budget.discretionaryRate * 100),
        });
        const items = (budget.allocationItems || [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(a => ({ label: a.label, rate: Math.round(a.rate * 100) }));
        setAllocationItems(items);
        setItemAmountInputs(items.map(() => ''));
      }
    } else {
      setExistingBudget(null);
      setLivingCarryover('');

      const prev = budgetList
        .filter(b => b.settleMonth < selectedMonth)
        .sort((a, b) => b.settleMonth.localeCompare(a.settleMonth))[0];

      if (prev) {
        setNetSalary(formatNumber(prev.netSalary));
        setCardGoal(formatNumber(prev.cardGoal));
        // 신규 달은 항상 4항목 — 전월에 비상금 비율이 남아있었다면 생활비 쪽으로 흡수해서 이전
        const prevLivingRate = prev.livingRate ? Math.round(prev.livingRate * 100) : DEFAULT_RATES_4.livingRate;
        const prevEmergencyRate = prev.emergencyRate ? Math.round(prev.emergencyRate * 100) : 0;
        setRates({
          livingRate:        prevLivingRate + prevEmergencyRate,
          isaRate:           prev.isaRate           ? Math.round(prev.isaRate * 100)           : DEFAULT_RATES_4.isaRate,
          pensionRate:       prev.pensionRate       ? Math.round(prev.pensionRate * 100)       : DEFAULT_RATES_4.pensionRate,
          emergencyRate:     0,
          discretionaryRate: prev.discretionaryRate ? Math.round(prev.discretionaryRate * 100) : DEFAULT_RATES_4.discretionaryRate,
        });
        // carry-forward: 전월 allocationItems(라벨+비율) 전체를 그대로 복사 (드롭다운 선택월과 무관하게 항상 직전 저장월 기준)
        const prevItems = (prev.allocationItems || [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(a => ({ label: a.label, rate: Math.round(a.rate * 100) }));
        setAllocationItems(prevItems);
        setItemAmountInputs(prevItems.map(() => ''));
      } else {
        setNetSalary('');
        setCardGoal('');
        setRates({ ...DEFAULT_RATES_4 });
        setAllocationItems([]);
        setItemAmountInputs([]);
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

    if (cashAssetRes.status === 'fulfilled') {
      const list: any[] = cashAssetRes.value.data.data || [];
      setCashAssetBalance(list.length > 0 ? list[list.length - 1].balance : null);
    } else {
      setCashAssetBalance(null);
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
    if (duplicateItemLabels.length > 0) {
      alert(`중복된 항목명이 있습니다: ${duplicateItemLabels.join(', ')}`);
      return;
    }
    if (hasBlankItemLabel) {
      alert('추가 항목의 이름을 입력해주세요.');
      return;
    }
    setIsSaving(true);

    // 현재 입력 모드(비율/금액)와 무관하게 최종 비율(%)로 정규화해서 전송
    // 금액 모드는 정수 %로 반올림하면 500,000원 → 27% → 저장 후 509,113원처럼 오차가 생기므로
    // DB 컬럼(DECIMAL(5,4), 소수 4자리)에 맞춰 소수점 넷째 자리까지 정밀하게 변환한다.
    // 비율 모드는 사용자가 애초에 정수 %로만 입력하므로(step=1) 그대로 사용해도 오차가 없다.
    const finalRates: Record<RateKey, number> = { ...rates };
    const finalItems = allocationItems.map(it => ({ ...it }));
    combinedRows.forEach((row, i) => {
      const pct = inputMode === 'rate'
        ? row.rate
        : (available > 0 ? Math.round((parsedAmounts[i] / available) * 1000000) / 10000 : 0);
      if (row.kind === 'fixed') finalRates[row.fixedKey] = pct;
      else finalItems[row.index].rate = pct;
    });

    const body = {
      settleMonth: selectedMonth,
      netSalary: net,
      cardGoal:          parseNumber(cardGoal),
      livingCarryover:   parseSignedNumber(livingCarryover),
      livingRate:        finalRates.livingRate / 100,
      isaRate:           finalRates.isaRate / 100,
      pensionRate:       finalRates.pensionRate / 100,
      // 신규 달(비 레거시)은 비상금 폐지 — 실수로라도 값이 남아있지 않도록 저장 시 항상 0 고정
      emergencyRate:     isLegacyEmergency ? finalRates.emergencyRate / 100 : 0,
      discretionaryRate: finalRates.discretionaryRate / 100,
      allocationItems:   finalItems.map(item => ({ label: item.label.trim(), rate: item.rate / 100 })),
    };

    try {
      if (existingBudget?.id) {
        await api.put(`/monthly-budgets/${existingBudget.id}`, body);
      } else {
        await api.post('/monthly-budgets', body);
      }
      alert('저장되었습니다!');
      fetchData();
    } catch (error: any) {
      console.error('저장 실패:', error);
      const msg = error?.response?.data?.message || '저장 실패';
      alert(msg);
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

  const handleSaveLabels = () => {
    const trimmed = Object.fromEntries(
      Object.entries(labelDraft).map(([k, v]) => {
        // 고정 항목은 항상 값이 있어야 함 — 비워두면 기존 라벨 유지
        const val = (v as string).trim();
        return [k, val || labels[k as AllocationKey]];
      })
    ) as Record<AllocationKey, string>;
    setAllocationLabels(trimmed);
    setLabels(trimmed);
    setLabelEditMode(false);
  };

  // 가변 추가 항목 관리
  const addAllocationItem = () => {
    setAllocationItems(prev => [...prev, { label: '새 항목', rate: 0 }]);
    setItemAmountInputs(prev => [...prev, '']);
  };

  const updateAllocationItemLabel = (index: number, label: string) => {
    setAllocationItems(prev => prev.map((it, i) => i === index ? { ...it, label } : it));
  };

  const updateAllocationItemRate = (index: number, rate: number) => {
    setAllocationItems(prev => prev.map((it, i) => i === index ? { ...it, rate } : it));
  };

  const updateAllocationItemAmount = (index: number, value: string) => {
    setItemAmountInputs(prev => prev.map((v, i) => i === index ? formatNumber(value) : v));
  };

  const removeAllocationItem = (index: number) => {
    setAllocationItems(prev => prev.filter((_, i) => i !== index));
    setItemAmountInputs(prev => prev.filter((_, i) => i !== index));
  };

  const [activeTab, setActiveTab] = useState<'budget' | 'tax' | 'memo'>('budget');

  const TABS = [
    { key: 'budget' as const, label: '예산 설정' },
    { key: 'tax'    as const, label: '세액공제 계산기' },
    { key: 'memo'   as const, label: '메모' },
  ];

  const saveDisabled = isSaving
    || !netSalary
    || (inputMode === 'rate' ? rateTotal !== 100 : Math.abs(amountDiff) > 1)
    || duplicateItemLabels.length > 0
    || hasBlankItemLabel;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-end flex-wrap gap-2">
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

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 예산 설정 탭 ── */}
      {activeTab === 'budget' && <div className="space-y-8">

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
                  onChange={(e) => setLivingCarryover(formatSignedNumber(e.target.value))}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
              </div>
              {isLegacyEmergency ? (
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
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">
                    현재 현금 자산
                  </label>
                  <div className="w-full p-2.5 rounded-lg border dark:border-dark-border bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-dark-muted text-sm">
                    {cashAssetBalance !== null
                      ? `${cashAssetBalance.toLocaleString()}원`
                      : '—'}
                  </div>
                  <a href="/emergency" className="text-xs text-primary-500 hover:text-primary-600 mt-1 inline-block">
                    현금 자산 페이지에서 관리 →
                  </a>
                </div>
              )}
            </div>

            {/* 고정 항목명 편집 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium dark:text-dark-muted">고정 항목명</label>
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
                      onClick={handleSaveLabels}
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
                  {/* 고정 항목 (레거시 달은 5개, 신규 달은 비상금 제외 4개) */}
                  {activeAllocationBase.map(a => (
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
                  {activeAllocationBase.map(a => (
                    <span key={a.labelKey} className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${a.text}`}>
                      {labels[a.labelKey]}
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
                    {/* 고정 항목 */}
                    {activeAllocationBase.map(a => (
                      <div key={a.rateKey} className="flex items-center gap-2">
                        <span className={`text-xs font-medium w-16 truncate ${a.text}`}>{labels[a.labelKey]}</span>
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
                    {/* 가변 추가 항목 — 라벨 직접 입력 + 비율 + 삭제 */}
                    {allocationItems.map((item, i) => (
                      <div key={`item-${i}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => updateAllocationItemLabel(i, e.target.value)}
                          maxLength={10}
                          placeholder="항목명"
                          className={`w-16 shrink-0 p-1.5 rounded-lg border text-xs font-medium ${ITEM_PALETTE[i % ITEM_PALETTE.length].text} dark:bg-dark-bg dark:border-dark-border outline-none focus:ring-2 focus:ring-primary-500`}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={item.rate}
                          onChange={e => updateAllocationItemRate(i, Math.floor(Number(e.target.value)))}
                          className="w-20 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-xs text-slate-400">%</span>
                        {available > 0 && (
                          <span className="text-xs text-slate-400 tabular-nums ml-auto">
                            {Math.floor(available * item.rate / 100).toLocaleString()}원
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAllocationItem(i)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                          title="항목 삭제"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAllocationItem}
                      className="w-full min-h-[44px] py-1.5 text-xs text-primary-500 hover:text-primary-600 border border-dashed border-primary-300 dark:border-primary-700 rounded-lg transition-colors"
                    >
                      + 항목 추가
                    </button>
                  </div>
                  <p className={`text-xs font-bold mt-2 ${rateTotal === 100 ? 'text-emerald-500' : 'text-red-500'}`}>
                    합계 {rateTotal}%{rateTotal !== 100 && ' (100%여야 합니다)'}
                  </p>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    {activeAllocationBase.map(a => {
                      const isLivingAuto = a.rateKey === 'livingRate';
                      return (
                        <div key={a.rateKey} className="flex items-center gap-2">
                          <span className={`text-xs font-medium w-16 truncate ${a.text}`}>{labels[a.labelKey]}</span>
                          {isLivingAuto ? (
                            <div
                              className="flex-1 p-1.5 rounded-lg border border-dashed dark:border-dark-border text-sm text-right tabular-nums bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-dark-muted"
                              title="나머지 항목을 다 채우고 남은 금액이 자동으로 들어갑니다"
                            >
                              {livingRemainder.toLocaleString()}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={amountInputs[a.rateKey]}
                              onChange={e => setAmountInputs(prev => ({ ...prev, [a.rateKey]: formatNumber(e.target.value) }))}
                              placeholder="0"
                              className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                            />
                          )}
                          <span className="text-xs text-slate-400">원</span>
                          {isLivingAuto ? (
                            <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">나머지 자동</span>
                          ) : (
                            available > 0 && parseNumber(amountInputs[a.rateKey]) > 0 && (
                              <span className="text-xs text-slate-400 tabular-nums w-8 text-right">
                                {Math.round(parseNumber(amountInputs[a.rateKey]) / available * 100)}%
                              </span>
                            )
                          )}
                        </div>
                      );
                    })}
                    {allocationItems.map((item, i) => (
                      <div key={`item-${i}`} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => updateAllocationItemLabel(i, e.target.value)}
                          maxLength={10}
                          placeholder="항목명"
                          className={`w-16 shrink-0 p-1.5 rounded-lg border text-xs font-medium ${ITEM_PALETTE[i % ITEM_PALETTE.length].text} dark:bg-dark-bg dark:border-dark-border outline-none focus:ring-2 focus:ring-primary-500`}
                        />
                        <input
                          type="text"
                          value={itemAmountInputs[i] ?? ''}
                          onChange={e => updateAllocationItemAmount(i, e.target.value)}
                          placeholder="0"
                          className="flex-1 p-1.5 rounded-lg border text-sm dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-right"
                        />
                        <span className="text-xs text-slate-400">원</span>
                        {available > 0 && parseNumber(itemAmountInputs[i] ?? '') > 0 && (
                          <span className="text-xs text-slate-400 tabular-nums w-8 text-right">
                            {Math.round(parseNumber(itemAmountInputs[i] ?? '') / available * 100)}%
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAllocationItem(i)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                          title="항목 삭제"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAllocationItem}
                      className="w-full min-h-[44px] py-1.5 text-xs text-primary-500 hover:text-primary-600 border border-dashed border-primary-300 dark:border-primary-700 rounded-lg transition-colors"
                    >
                      + 항목 추가
                    </button>
                  </div>
                  <div className={`flex justify-between items-center mt-2 text-xs font-bold ${Math.abs(amountDiff) <= 1 ? 'text-emerald-500' : 'text-red-500'}`}>
                    <span>합계 {amountTotal.toLocaleString()}원</span>
                    {Math.abs(amountDiff) > 1 && (
                      <span>{amountDiff > 0 ? `${amountDiff.toLocaleString()}원 남음` : `${Math.abs(amountDiff).toLocaleString()}원 초과`}</span>
                    )}
                  </div>
                </>
              )}
              {duplicateItemLabels.length > 0 && (
                <p className="text-xs font-bold text-red-500 mt-2">
                  중복된 항목명이 있습니다: {duplicateItemLabels.join(', ')}
                </p>
              )}
              {hasBlankItemLabel && duplicateItemLabels.length === 0 && (
                <p className="text-xs font-bold text-red-500 mt-2">
                  추가 항목의 이름을 입력해주세요.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saveDisabled}
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
              <div key={item.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-medium truncate ${item.text}`}>{item.label || '(이름 없음)'}</span>
                    <span className="text-xs text-slate-400 shrink-0">{Math.round(item.ratio * 100)}%</span>
                  </div>
                  <span className="font-bold dark:text-dark-text shrink-0">{item.amount.toLocaleString()}원</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${item.color} h-full rounded-full transition-all duration-500`}
                    style={{ width: available > 0 ? `${item.ratio * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      </div>} {/* 예산 설정 탭 끝 */}

      {/* ── 세액공제 계산기 탭 ── */}
      {activeTab === 'tax' &&
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold dark:text-dark-text">세액공제 최적화 계산기</h3>
          <p className="text-xs text-slate-400 dark:text-dark-muted mt-0.5">
            실수령액은 위 입력값 자동 반영 — 결과 참고해 위 비율 직접 조정하세요
          </p>
        </div>

        {/* 추가 입력 */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">입사월</label>
            <select
              value={taxJoinMonth}
              onChange={e => setTaxJoinMonth(Number(e.target.value))}
              className="p-2 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
            <input
              type="checkbox"
              checked={taxProbation}
              onChange={e => setTaxProbation(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <span className="text-sm text-slate-600 dark:text-dark-text">수습 중</span>
          </label>
          {taxProbation && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-dark-muted mb-1">수습 종료 예정월</label>
              <select
                value={taxProbEndMonth}
                onChange={e => setTaxProbEndMonth(Number(e.target.value))}
                className="p-2 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 결과 */}
        {taxResult ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 기본 정보 */}
            <div className="sm:col-span-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/20 px-4 py-3 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-dark-muted">예상 연봉</span>
                <span className="font-semibold tabular-nums dark:text-dark-text">
                  {Math.round(taxResult.annualSalary / 10_000).toLocaleString()}만원
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-dark-muted">세액공제율</span>
                <span className={`font-semibold ${taxResult.creditRate === 0.165 ? 'text-violet-500' : 'text-blue-500'}`}>
                  {(taxResult.creditRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-dark-muted">연간 소득세</span>
                <span className="font-semibold text-rose-500 tabular-nums">
                  {Math.round(taxResult.annualTax / 10_000).toLocaleString()}만원
                </span>
              </div>
            </div>

            {/* 연금저축 */}
            <div className="rounded-xl border border-violet-100 dark:border-violet-900/30 bg-violet-50/40 dark:bg-violet-900/10 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide">연금저축</p>
              {taxResult.pensionAnnual > 0 ? (
                <>
                  <p className="text-sm font-bold tabular-nums dark:text-dark-text">
                    연 {Math.round(taxResult.pensionAnnual / 10_000).toLocaleString()}만원
                  </p>
                  <p className="text-xs text-slate-400">
                    월 {Math.round(taxResult.pensionMonthly / 10_000 * 10) / 10}만원
                  </p>
                  <p className="text-xs text-emerald-500 font-medium">
                    환급 {Math.round(taxResult.pensionRefund / 10_000).toLocaleString()}만원
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">소득세 없음</p>
              )}
            </div>

            {/* IRP */}
            <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-900/10 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">IRP</p>
              {taxResult.irpNeeded ? (
                <>
                  <p className="text-sm font-bold tabular-nums dark:text-dark-text">
                    연 {Math.round(taxResult.irpAnnual / 10_000).toLocaleString()}만원
                  </p>
                  <p className="text-xs text-slate-400">
                    월 {Math.round(taxResult.irpMonthly / 10_000 * 10) / 10}만원
                  </p>
                  <p className="text-xs text-emerald-500 font-medium">
                    환급 {Math.round(taxResult.irpRefund / 10_000).toLocaleString()}만원
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">연금저축으로 전액 상계</p>
              )}
            </div>

            {/* ISA */}
            <div className="rounded-xl border border-slate-100 dark:border-dark-border bg-slate-50/40 dark:bg-slate-800/10 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">ISA</p>
              <p className="text-xs text-slate-400 leading-relaxed">세액공제 없음</p>
              <p className="text-xs text-slate-400">여유자금에서 납입 권장</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-dark-border py-6 text-center">
            <p className="text-sm text-slate-400 dark:text-dark-muted">실수령액을 입력하면 결과가 표시됩니다</p>
          </div>
        )}
      </div>

      } {/* 세액공제 탭 끝 */}

      {/* ── 메모 탭 ── */}
      {activeTab === 'memo' &&
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
      } {/* 메모 탭 끝 */}

    </div>
  );
};
