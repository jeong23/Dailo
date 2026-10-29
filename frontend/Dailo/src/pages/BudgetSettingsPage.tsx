import React, { useState, useEffect, useMemo } from 'react';
import { MonthlyBudget, AllocationInputMode } from '../types';
import api, { getStoredMemberId } from '../api/axios';
import { formatNumber, parseNumber, formatSignedNumber, parseSignedNumber, getCurrentSettleMonth } from '../utils/format';
import { calcTaxOptimization, TAX_CALC_RESULT_KEY, TAX_CALC_INPUTS_KEY } from '../utils/taxCalc';

// 예산 분배 항목(옛 생활비/ISA/연금저축/비상금/자유재량 고정 5슬롯 폐지) 미리보기용 색상 팔레트 — 인덱스 기반 순환
// 항목 개수 제한 없이 자유롭게 추가/삭제/이름변경 가능 (allocationItems 배열 하나로 통합 관리)
const ITEM_PALETTE = [
  { color: 'bg-blue-500',     text: 'text-blue-500' },
  { color: 'bg-emerald-500',  text: 'text-emerald-500' },
  { color: 'bg-violet-500',   text: 'text-violet-500' },
  { color: 'bg-amber-500',    text: 'text-amber-500' },
  { color: 'bg-rose-500',     text: 'text-rose-500' },
  { color: 'bg-sky-500',      text: 'text-sky-500' },
  { color: 'bg-pink-500',     text: 'text-pink-500' },
  { color: 'bg-teal-500',     text: 'text-teal-500' },
  { color: 'bg-cyan-500',     text: 'text-cyan-500' },
  { color: 'bg-fuchsia-500',  text: 'text-fuchsia-500' },
  { color: 'bg-lime-500',     text: 'text-lime-500' },
  { color: 'bg-orange-500',   text: 'text-orange-500' },
  { color: 'bg-indigo-500',   text: 'text-indigo-500' },
];

// 항목별 입력모드(RATE: 비율 %, AMOUNT: 금액 원)를 함께 들고 다니는 폼 상태.
// AMOUNT 모드는 amountInput(사용자가 입력한 원 단위 문자열)을 저장/전송 시 그대로 정수 변환해서 보내고,
// 절대 rate로 환산했다가 다시 금액으로 역산하지 않는다 (왕복 변환에서 300,000원 → 299,996원 같은 반올림 오차가 생기던 버그의 원인이었음).
interface AllocationItemForm {
  label: string;
  inputMode: AllocationInputMode;
  rate: number;        // percent 0~100 (RATE 모드에서 사용)
  amountInput: string; // "300,000" 형태 (AMOUNT 모드에서 사용)
}

export const BudgetSettingsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentSettleMonth());
  const [existingBudget, setExistingBudget] = useState<MonthlyBudget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);

  // 비상금 레거시 판단: 현재 선택된 달의 MonthlyBudget에 emergencyRate가 남아있으면(과거 고정 슬롯 시절 데이터) 레거시 표시 사용
  // 날짜 비교 금지, 저장된 emergencyRate 값 자체로 판단 (EmergencyPage/비상금 로직은 이번 스코프 제외 — 읽기 전용 표시만 그대로 유지)
  const isLegacyEmergency = !!existingBudget?.emergencyRate && existingBudget.emergencyRate > 0;

  // 폼 상태
  const [netSalary, setNetSalary] = useState('');
  const [cardGoal, setCardGoal] = useState('');
  const [livingCarryover, setLivingCarryover] = useState('');

  // 예산 분배 항목 — 고정 슬롯 없이 개수 제한 없는 리스트 하나로 관리 (라벨/입력모드/비율/금액 전부 사용자 정의)
  const [allocationItems, setAllocationItems] = useState<AllocationItemForm[]>([]);

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

  // 항목 1개의 실제 배분 금액 — 백엔드 계산 원칙과 동일하게 유지
  // RATE: Math.round(available * rate) / AMOUNT: 사용자가 입력한 정수 그대로 (재계산 절대 금지)
  const itemAmount = (item: AllocationItemForm): number =>
    item.inputMode === 'RATE'
      ? Math.round(available * item.rate / 100)
      : parseNumber(item.amountInput);

  const totalAllocated = allocationItems.reduce((s, it) => s + itemAmount(it), 0);
  const allocationDiff = available - totalAllocated;

  // 저장 버튼 활성화 조건: "비율 모드 항목들의 rate 합 + 금액 모드 항목들이 가용금액에서 차지하는 비율"의 합이 100%가 되어야 함
  // (기존엔 모드가 전역이라 비율 합만 보면 됐지만, 이제 항목마다 모드가 다르므로 두 비율을 합쳐서 하나의 기준으로 검증한다)
  const rateItemsPercentTotal = allocationItems
    .filter(it => it.inputMode === 'RATE')
    .reduce((s, it) => s + it.rate, 0);
  const amountItemsTotal = allocationItems
    .filter(it => it.inputMode === 'AMOUNT')
    .reduce((s, it) => s + parseNumber(it.amountInput), 0);
  const amountItemsPercent = available > 0 ? Math.round((amountItemsTotal / available) * 100) : 0;
  const combinedPercentTotal = rateItemsPercentTotal + amountItemsPercent;

  // 미리보기 (항목별 실효 비율/금액)
  const preview = allocationItems.map((item, index) => {
    const palette = ITEM_PALETTE[index % ITEM_PALETTE.length];
    const amount = itemAmount(item);
    const percent = available > 0 ? Math.round((amount / available) * 100) : 0;
    return { id: `item-${index}`, label: item.label, color: palette.color, text: palette.text, ratio: percent / 100, amount };
  });

  // 항목 라벨 중복 검사 (백엔드 UNIQUE 제약과 동일 기준 — 저장 전 프론트에서 미리 안내)
  const trimmedItemLabels = allocationItems.map(it => it.label.trim());
  const duplicateItemLabels = Array.from(new Set(
    trimmedItemLabels.filter((label, idx) => label !== '' && trimmedItemLabels.indexOf(label) !== idx)
  ));
  const hasBlankItemLabel = allocationItems.some(it => it.label.trim() === '');

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

  // 서버 응답(AllocationItemResponseDto[])을 폼 상태로 변환 — AMOUNT 모드는 budgetAmount(서버가 그대로 저장한 값)를 신뢰해서 표시,
  // rate로 역산하지 않는다 (역산하면 표시 단계에서부터 오차가 생김)
  const toItemForm = (items: MonthlyBudget['allocationItems'] | undefined): AllocationItemForm[] =>
    (items || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(a => ({
        label: a.label,
        inputMode: a.inputMode || 'RATE',
        rate: Math.round((a.rate || 0) * 100),
        amountInput: a.inputMode === 'AMOUNT' ? formatNumber(String(a.budgetAmount ?? 0)) : '',
      }));

  const fetchData = async (budgetList = allBudgets, month = selectedMonth) => {
    const [budgetRes, fixedRes, emergencyRes, cashAssetRes] = await Promise.allSettled([
      api.get(`/monthly-budgets/mine/month/${month}`),
      api.get('/fixed-costs/mine'),
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
        setAllocationItems(toItemForm(budget.allocationItems));
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
        // carry-forward: 전월 allocationItems(라벨+비율/금액) 전체를 그대로 복사 (드롭다운 선택월과 무관하게 항상 직전 저장월 기준)
        setAllocationItems(toItemForm(prev.allocationItems));
      } else {
        // 첫 달(직전 저장 데이터 없음): 빈 리스트로 시작 — 사용자가 직접 항목을 추가
        setNetSalary('');
        setCardGoal('');
        setAllocationItems([]);
      }
    }

    if (fixedRes.status === 'fulfilled') {
      const fixedList = fixedRes.value.data.data || [];
      const total = fixedList
        .filter((f: any) => f.countedThisMonth)   // 활성 + 할부는 이번 달 결제 있는 것만 (백엔드 합계와 같은 기준)
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

    const body = {
      settleMonth: selectedMonth,
      netSalary: net,
      cardGoal:          parseNumber(cardGoal),
      livingCarryover:   parseSignedNumber(livingCarryover),
      // 고정 5슬롯(생활비/ISA/연금/비상금/자유재량) 입력 UI는 완전히 제거됨 — 이제 분배는 allocationItems 하나로만 관리한다.
      // 단, MonthlyBudget 엔티티의 livingRate~discretionaryRate 컬럼은 DB상 NOT NULL이라 null을 보낼 수 없고,
      // 과거(레거시) 달의 경우 이 값들을 이 페이지가 더 이상 편집하지 않는데도 저장할 때마다 0으로 덮어쓰면
      // ReportPage/EmergencyPage가 참조하는 해당 월 스냅샷이 조용히 깨진다.
      // → 기존 값이 있으면 그대로 되돌려보내고(신규 달은 existingBudget이 없으니 자연히 0), UI에서만 완전히 숨긴다.
      livingRate:        existingBudget?.livingRate ?? 0,
      isaRate:           existingBudget?.isaRate ?? 0,
      pensionRate:       existingBudget?.pensionRate ?? 0,
      emergencyRate:     existingBudget?.emergencyRate ?? 0,
      discretionaryRate: existingBudget?.discretionaryRate ?? 0,
      allocationItems: allocationItems.map(item => {
        const label = item.label.trim();
        if (item.inputMode === 'AMOUNT') {
          // AMOUNT 모드: 사용자가 입력한 정수 그대로 전송 — 프론트에서 반올림/역산 절대 금지
          // (300,000원 입력 시 299,996원으로 저장되던 오차의 원인이 여기서의 왕복 계산이었음)
          return { label, inputMode: 'AMOUNT' as const, amount: parseNumber(item.amountInput) };
        }
        return { label, inputMode: 'RATE' as const, rate: item.rate / 100 };
      }),
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

  // 예산 분배 항목 관리 (개수 제한 없음)
  const addAllocationItem = () => {
    setAllocationItems(prev => [...prev, { label: '새 항목', inputMode: 'RATE', rate: 0, amountInput: '' }]);
  };

  const updateAllocationItemLabel = (index: number, label: string) => {
    setAllocationItems(prev => prev.map((it, i) => i === index ? { ...it, label } : it));
  };

  const updateAllocationItemRate = (index: number, rate: number) => {
    setAllocationItems(prev => prev.map((it, i) => i === index ? { ...it, rate } : it));
  };

  const updateAllocationItemAmount = (index: number, value: string) => {
    setAllocationItems(prev => prev.map((it, i) => i === index ? { ...it, amountInput: formatNumber(value) } : it));
  };

  // 입력모드 토글 — 전환 시점에 available 기준으로 한 번만 값을 옮겨서 편집 편의를 제공 (자동 왕복 계산이 아니라
  // 사용자가 명시적으로 토글을 누른 그 순간에만 일어나는 1회성 변환이며, 실제 저장 값은 토글 이후 그 모드의 필드를 그대로 사용한다)
  const updateAllocationItemMode = (index: number, mode: AllocationInputMode) => {
    setAllocationItems(prev => prev.map((it, i) => {
      if (i !== index || it.inputMode === mode) return it;
      if (mode === 'AMOUNT') {
        const seedAmount = available > 0 ? Math.round(available * it.rate / 100) : 0;
        return { ...it, inputMode: mode, amountInput: formatNumber(String(seedAmount)) };
      }
      const seedRate = available > 0 ? Math.round((parseNumber(it.amountInput) / available) * 100) : 0;
      return { ...it, inputMode: mode, rate: seedRate };
    }));
  };

  const removeAllocationItem = (index: number) => {
    setAllocationItems(prev => prev.filter((_, i) => i !== index));
  };

  const [activeTab, setActiveTab] = useState<'budget' | 'tax' | 'memo'>('budget');

  const TABS = [
    { key: 'budget' as const, label: '예산 설정' },
    { key: 'tax'    as const, label: '세액공제 계산기' },
    { key: 'memo'   as const, label: '메모' },
  ];

  const saveDisabled = isSaving
    || !netSalary
    || (available > 0 && combinedPercentTotal !== 100)
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

            {/* 예산 분배 항목 — 고정 슬롯 없이 자유롭게 추가/삭제/이름변경, 항목마다 비율(%)/금액(원) 모드 선택 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium dark:text-dark-muted">분배 항목</label>
                <span className="text-xs text-slate-400">항목마다 비율 · 금액 모드를 각각 선택할 수 있어요</span>
              </div>

              <div className="space-y-2">
                {allocationItems.map((item, i) => {
                  const palette = ITEM_PALETTE[i % ITEM_PALETTE.length];
                  const amount = itemAmount(item);
                  return (
                    <div key={`item-${i}`} className="p-3 rounded-xl border border-slate-100 dark:border-dark-border space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => updateAllocationItemLabel(i, e.target.value)}
                          maxLength={50}
                          placeholder="항목명"
                          className={`flex-1 min-w-0 p-2 rounded-lg border text-sm font-medium ${palette.text} dark:bg-dark-bg dark:border-dark-border outline-none focus:ring-2 focus:ring-primary-500`}
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocationItem(i)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                          title="항목 삭제"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateAllocationItemMode(i, 'RATE')}
                            className={`min-h-[44px] px-3 rounded-md text-xs font-medium transition-colors ${item.inputMode === 'RATE' ? 'bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                          >
                            비율
                          </button>
                          <button
                            type="button"
                            onClick={() => updateAllocationItemMode(i, 'AMOUNT')}
                            className={`min-h-[44px] px-3 rounded-md text-xs font-medium transition-colors ${item.inputMode === 'AMOUNT' ? 'bg-white dark:bg-dark-card text-slate-800 dark:text-dark-text shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                          >
                            금액
                          </button>
                        </div>
                        {item.inputMode === 'RATE' ? (
                          <div className="flex items-center gap-1.5">
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
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                            <input
                              type="text"
                              value={item.amountInput}
                              onChange={e => updateAllocationItemAmount(i, e.target.value)}
                              placeholder="0"
                              className="flex-1 min-w-0 p-1.5 rounded-lg border text-sm text-right dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <span className="text-xs text-slate-400 shrink-0">원</span>
                          </div>
                        )}
                        <span className="text-xs text-slate-400 tabular-nums ml-auto shrink-0">
                          {amount.toLocaleString()}원{available > 0 && ` (${Math.round((amount / available) * 100)}%)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addAllocationItem}
                  className="w-full min-h-[44px] py-1.5 text-xs text-primary-500 hover:text-primary-600 border border-dashed border-primary-300 dark:border-primary-700 rounded-lg transition-colors"
                >
                  + 항목 추가
                </button>
              </div>

              {/* 검증 문구 — 비율 항목 합(%) + 금액 항목이 가용금액에서 차지하는 비율(%)의 합이 100%가 되어야 저장 가능 */}
              {available > 0 ? (
                <p className={`text-xs font-bold mt-2 ${combinedPercentTotal === 100 ? 'text-emerald-500' : 'text-red-500'}`}>
                  분배 합계 {combinedPercentTotal}% · {totalAllocated.toLocaleString()}원 / 가용 {available.toLocaleString()}원
                  {combinedPercentTotal !== 100 && (
                    allocationDiff > 0
                      ? ` (${allocationDiff.toLocaleString()}원 남음 — 100%를 채워야 저장할 수 있습니다)`
                      : ` (${Math.abs(allocationDiff).toLocaleString()}원 초과 — 100% 이내로 줄여야 저장할 수 있습니다)`
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-2">가용 금액이 없어 분배할 금액이 없습니다.</p>
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
            {preview.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-dark-muted text-center py-4">
                아직 분배 항목이 없습니다. 항목을 추가해주세요.
              </p>
            )}
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
