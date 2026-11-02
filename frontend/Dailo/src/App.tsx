import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Layout } from './components/Layout';
import { ExpensesPage } from './pages/ExpensesPage';
import { BudgetSettingsPage } from './pages/BudgetSettingsPage';
import { FixedCostPage } from './pages/FixedCostPage';
import { ReportPage } from './pages/ReportPage';
import { EmergencyPage } from './pages/EmergencyPage';
import { TodoPage } from './pages/TodoPage';
import { PlannerBoardPage } from './pages/PlannerBoardPage';
import { RunningPage } from './pages/RunningPage';
import { HabitPage } from './pages/HabitPage';
import { InvestDashboardPage } from './pages/InvestDashboardPage';
import { MyAccountsPage } from './pages/MyAccountsPage';
import { InvestDiaryPage } from './pages/InvestDiaryPage';
import { DisplaySettingsPage } from './pages/DisplaySettingsPage';
import { AllocationPage } from './pages/AllocationPage';
import { SavingsPage } from './pages/SavingsPage';
import { LoginPage } from './pages/LoginPage';
import { isAuthenticated } from './api/axios';
import { expireStaleSession } from './utils/session';
import { BudgetType, DailyExpense, Category, DashboardSummary, DailyStats, CategoryStats } from './types';
import api from './api/axios';
import { formatNumber, parseNumber, getCurrentSettleMonth, getSettleMonthForDate, todayYmd } from './utils/format';
import { ExpenseAccountField, SavingsOption, SavingsSelect, useExpenseLinks } from './components/ExpenseLinkFields';
import { useEscapeKey } from './hooks/useEscapeKey';
import { Toast, useToast } from './components/Toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// "이번 달 예산 분배" 카드의 가변 추가 항목(summary.allocationItems)용 색상 팔레트 — 인덱스 기반 순환
const ALLOCATION_ITEM_PALETTE = [
  { color: 'text-sky-500',     bg: 'bg-sky-50 dark:bg-sky-900/20' },
  { color: 'text-pink-500',    bg: 'bg-pink-50 dark:bg-pink-900/20' },
  { color: 'text-teal-500',    bg: 'bg-teal-50 dark:bg-teal-900/20' },
  { color: 'text-cyan-500',    bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  { color: 'text-fuchsia-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20' },
  { color: 'text-lime-500',    bg: 'bg-lime-50 dark:bg-lime-900/20' },
  { color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { color: 'text-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
];

// 예산구분 select 옵션: 고정 3개(생활비/비상금/투자) + 이번 달 활성 allocationItems 라벨 (ExpensesPage와 동일 규칙)
const BASE_BUDGET_TYPES = ['생활비', '비상금', '투자'];

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, name, percent }: any) => {
  if (percent < 0.02) return null;
  const radius = outerRadius + 36;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#94a3b8"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={13}
      fontWeight={600}
    >
      {name}
    </text>
  );
};

const CategoryPieTooltip = ({ active, payload, expenses }: any) => {
  if (!active || !payload?.length) return null;

  const categoryName: string = payload[0].payload.categoryName;
  const total: number = payload[0].value;

  const top3 = Object.entries(
    expenses
      .filter((e: any) => e.categoryName === categoryName)
      .reduce((acc: Record<string, number>, e: any) => {
        acc[e.itemName] = (acc[e.itemName] || 0) + e.amount;
        return acc;
      }, {})
  )
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '10px', padding: '12px 16px', minWidth: '180px' }}>
      <p style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '8px', fontSize: '13px' }}>
        {payload[0].name} · {total.toLocaleString()}원
      </p>
      {top3.map(([name, amount], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: i < top3.length - 1 ? '6px' : 0 }}>
          <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 600 }}>{i + 1}. {name}</span>
          <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{(amount as number).toLocaleString()}원</span>
        </div>
      ))}
    </div>
  );
};

const DailyBarTooltip = ({ active, payload, label, expenses }: any) => {
  if (!active || !payload?.length) return null;

  const top3 = [...expenses]
    .filter((e: any) => e.expenseDate?.substring(8) === label)
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 3);

  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '10px', padding: '12px 16px', minWidth: '180px' }}>
      <p style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '8px', fontSize: '13px' }}>
        {label}일 · {(payload[0].value as number).toLocaleString()}원
      </p>
      {top3.length > 0 ? top3.map((e: any, i: number) => (
        <div key={i} style={{ marginBottom: i < top3.length - 1 ? '6px' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 600 }}>
              {i + 1}. {e.itemName}
            </span>
            <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {e.amount.toLocaleString()}원
            </span>
          </div>
          {e.memo && (
            <p style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', paddingLeft: '12px' }}>
              {e.memo}
            </p>
          )}
        </div>
      )) : (
        <p style={{ color: '#64748b', fontSize: '12px' }}>내역 없음</p>
      )}
    </div>
  );
};

const DashboardHome = () => {
  const { toast, show } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentSettleMonth());

  // 입력 폼 상태
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayYmd());
  const [paymentMethod, setPaymentMethod] = useState('카드');
  const [budgetType, setBudgetType] = useState<BudgetType>('생활비');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [memo, setMemo] = useState('');
  // 현금 계좌·적금 납입 연결 — 지출 / 수입 화면과 같은 칸 (예전엔 대시보드에서 적으면 항상 기본 계좌)
  const { cashAccounts, savingsList } = useExpenseLinks();
  const [cashAccountId, setCashAccountId] = useState('');
  const [savingsId, setSavingsId] = useState('');
  const pickSavings = (v: string, s?: SavingsOption) => {
    setSavingsId(v);
    if (!s) return;
    if (!itemName.trim()) setItemName(s.name);
    if (!amount) setAmount(formatNumber(s.monthlyAmount));
    if (paymentMethod === '카드') setPaymentMethod('이체');
  };

  // 데이터 상태
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyBudgetId, setMonthlyBudgetId] = useState<number>(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [detailModalType, setDetailModalType] = useState<string | null>(null);
  const [fixedCosts, setFixedCosts] = useState<{ id: number; name: string; amount: number; isActive: boolean; sortOrder: number; costType?: string; paidMonths?: number; installmentMonths?: number; countedThisMonth?: boolean }[]>([]);
  const [fixedModalOpen, setFixedModalOpen] = useState(false);

  // 저장된 정산월 목록 로드
  useEffect(() => {
    api.get('/monthly-budgets/mine')
      .then(res => {
        const months: string[] = (res.data.data || []).map((b: any) => b.settleMonth);
        setMonthOptions(months);
        if (months.length > 0 && !months.includes(selectedMonth)) {
          setSelectedMonth(months[0]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 데이터 로드
  const fetchData = async () => {
    const [expenseRes, categoryRes, summaryRes, dailyRes, budgetRes, categoryStatsRes, fixedCostRes] = await Promise.allSettled([
      api.get(`/daily-expenses/month/${selectedMonth}`),
      api.get('/categories'),
      api.get(`/dashboard/summary?month=${selectedMonth}`),
      api.get(`/dashboard/daily-stats?month=${selectedMonth}`),
      api.get(`/monthly-budgets/mine/month/${selectedMonth}`),
      api.get(`/dashboard/category-stats?month=${selectedMonth}`),
      api.get('/fixed-costs/mine')
    ]);

    if (expenseRes.status === 'fulfilled') setExpenses(expenseRes.value.data.data || []);
    if (categoryRes.status === 'fulfilled') {
      const cats = categoryRes.value.data.data || [];
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    }
    setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value.data.data ?? null : null);
    if (dailyRes.status === 'fulfilled') setDailyStats(dailyRes.value.data.data || []);
    if (budgetRes.status === 'fulfilled' && budgetRes.value.data.data?.id) {
      setMonthlyBudgetId(budgetRes.value.data.data.id);
    }
    if (categoryStatsRes.status === 'fulfilled') setCategoryStats(categoryStatsRes.value.data.data || []);
    if (fixedCostRes.status === 'fulfilled') setFixedCosts(fixedCostRes.value.data.data || []);
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  // 차트 데이터 가공
  const pieChartData = categoryStats.map(s => ({
    name: `${s.icon ? s.icon + ' ' : ''}${s.categoryName}`,
    categoryName: s.categoryName,
    value: s.totalAmount,
  }));

  // 일별 막대 그래프 데이터
  const barChartData = dailyStats.length > 0
    ? dailyStats.map(d => ({
        date: d.date.substring(8), // DD만 표시
        amount: d.totalAmount
      }))
    : Object.values(
        expenses.reduce((acc: Record<string, { date: string; amount: number }>, cur) => {
          const date = cur.expenseDate?.substring(8) || '';
          if (!acc[date]) acc[date] = { date, amount: 0 };
          acc[date].amount += cur.amount;
          return acc;
        }, {})
      ).sort((a, b) => a.date.localeCompare(b.date));

  // 예산 대비 소진율
  const livingExpenses = expenses.filter(e => e.budgetType === '생활비').reduce((sum, e) => sum + e.amount, 0);
  const emergencyExpenses = expenses.filter(e => e.budgetType === '비상금').reduce((sum, e) => sum + e.amount, 0);
  const investExpenses = expenses.filter(e => e.budgetType === '투자').reduce((sum, e) => sum + e.amount, 0);
  // 이번 달 투자 계획 = 예산 분배 항목 중 투자 계좌에 연결된 금액 합계 (내 계좌 > 투자의 월 납입금과 같은 기준)
  const investPlanned = (summary?.allocationItems ?? []).filter(i => i.investAccountId != null).reduce((t, i) => t + (i.budgetAmount || 0), 0);
  const investRate = investPlanned > 0 ? Math.round((investExpenses / investPlanned) * 100) : 0;
  // 가변 예산 분배 항목(allocationItems)의 라벨을 budgetType으로 쓴 지출 합계 — 항목별 소진율 표시용
  const allocationItemSpent = (label: string) =>
    expenses.filter(e => e.budgetType === label).reduce((sum, e) => sum + e.amount, 0);

  // 지출 등록 모달의 예산구분 옵션: 고정 3개 + 이번 달 summary.allocationItems 라벨 (중복 제거)
  const budgetTypeOptions = React.useMemo(() => {
    const extraLabels = (summary?.allocationItems || [])
      .map(item => (item.label || '').trim())
      .filter(label => label !== '');
    return [...BASE_BUDGET_TYPES, ...extraLabels].filter(
      (label, idx, arr) => arr.indexOf(label) === idx
    );
  }, [summary]);

  useEscapeKey(isModalOpen, () => setIsModalOpen(false));
  useEscapeKey(detailModalType !== null, () => setDetailModalType(null));
  useEscapeKey(fixedModalOpen, () => setFixedModalOpen(false));

  // 상세 모달 데이터 (생활비 카드는 비상금과 통합 표시 — OR 조건)
  const detailModalItems = detailModalType === null ? [] :
    detailModalType === '카드'
      ? expenses.filter(e => e.paymentMethod === '카드')
      : detailModalType === '생활비'
      ? expenses.filter(e => e.budgetType === '생활비' || e.budgetType === '비상금')
      : expenses.filter(e => e.budgetType === detailModalType);
  const detailModalTotal = detailModalItems.reduce((sum, e) => sum + e.amount, 0);
  const detailModalTitle = detailModalType === '카드'
    ? '카드 지출 내역'
    : detailModalType === '생활비'
    ? '생활비·비상금 지출 내역'
    : `${detailModalType} 지출 내역`;
  // 고정 5슬롯(생활비/ISA/연금/비상금/자유재량) 폐지 이후: "생활비"/"비상금" 이름의 항목이 summary.allocationItems에
  // 있으면 그 값을 우선 사용하고, 없으면(과거 달) 레거시 컬럼으로 폴백한다. 신규 달에는 레거시 컬럼이 전부 0으로
  // 저장되므로 이 폴백이 없으면 카드가 항상 0원으로 보인다 — 하지만 라벨을 다르게 지었거나 항목을 아예 안 만든
  // 신규 달에는 이 카드 자체를 최소 가드로 숨긴다 (아래 hasLivingAllocation 참고, 전면 재설계는 스코프 아님).
  const livingAllocationItem = summary?.allocationItems?.find(i => i.label === '생활비');
  const emergencyAllocationItem = summary?.allocationItems?.find(i => i.label === '비상금');
  const hasLivingAllocation = !!livingAllocationItem;
  const livingBudget = livingAllocationItem?.budgetAmount ?? (summary?.livingBudget || 0);
  const emergencyBudget = emergencyAllocationItem?.budgetAmount ?? (summary?.emergencyBudget || 0);
  const discretionaryBudget = summary?.discretionaryBudget || 0;
  // 생활비 + 비상금 통합 소진율 (분모 0 가드)
  const combinedBudget = livingBudget + emergencyBudget;
  const combinedExpenses = livingExpenses + emergencyExpenses;
  const combinedRate = combinedBudget > 0 ? Math.round((combinedExpenses / combinedBudget) * 100) : 0;
  const getBarColor = (rate: number) => {
    if (rate <= 50) return 'bg-green-500';
    if (rate <= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  // 경고 알림 목록 (생활비·비상금 통합 기준)
  const alerts: { type: 'danger' | 'warning'; msg: string }[] = [];
  if (summary) {
    if (combinedRate >= 100) alerts.push({ type: 'danger', msg: `생활비·비상금 예산을 초과했습니다 (${combinedRate}%)` });
    else if (combinedRate >= 80) alerts.push({ type: 'warning', msg: `생활비·비상금 예산 ${combinedRate}% 소진 — 주의가 필요합니다` });
  }

  // 카드 실적 달성률 (cardGoal 미설정 시 0 가드, 하드코딩 폴백 제거)
  const cardTotal = expenses.filter(e => e.paymentMethod === '카드').reduce((sum, e) => sum + e.amount, 0);
  const cardGoal = summary?.cardGoal || 0;
  const cardRate = cardGoal > 0 ? Math.min(Math.round((cardTotal / cardGoal) * 100), 100) : 0;

  // 지출 저장
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categories.length === 0) return; // 카테고리 미로드 상태에서 존재하지 않는 categoryId로 저장 방지

    const requestData = {
      monthlyBudgetId: monthlyBudgetId,
      categoryId: categoryId,
      itemName: itemName,
      amount: parseNumber(amount),
      expenseDate: expenseDate,
      // 정산월은 날짜로 — 보고 있는 달(selectedMonth)로 보내면 지난 달 화면에서 적은 오늘 지출이 지난 달로 들어갔음
      settleMonth: getSettleMonthForDate(expenseDate),
      paymentMethod: paymentMethod,
      budgetType: budgetType,
      memo: memo,
      cashAccountId: cashAccountId ? Number(cashAccountId) : null,
      savingsId: savingsId ? Number(savingsId) : null,
    };

    try {
      await api.post('/daily-expenses', requestData);
      show(requestData.settleMonth === selectedMonth ? '저장되었습니다!' : `${requestData.settleMonth} 정산월에 저장했어요`);
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('저장 실패:', error);
      show(error?.response?.data?.message || '저장 실패', 'error');
    }
  };

  const resetForm = () => {
    setItemName('');
    setAmount('');
    setExpenseDate(todayYmd());
    setMemo('');
    setCashAccountId('');
    setSavingsId('');
    setCategoryId(categories.length > 0 ? categories[0].id : 0);
  };


  return (
    <div className="relative space-y-8">
      <Toast toast={toast} />
      {/* 헤더 */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">
            {selectedMonth.split('-')[1]}월 예산 현황
          </h1>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-600 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* 경고 배너 */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium ${
                alert.type === 'danger'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              }`}
            >
              {alert.type === 'danger' ? (
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {alert.msg}
            </div>
          ))}
        </div>
      )}

      {/* 상단 요약 카드 */}
      {/* 폰(폴드 커버)에선 위 2개는 전체 폭, 카드 실적·투자 납입은 2열로 붙여 스크롤 줄임 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* 가용금액 */}
        <div className="col-span-2 sm:col-span-1 p-5 sm:p-6 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">이번 달 가용 금액</p>
          <p className="text-3xl font-bold mt-2 tabular-nums text-primary-600">
            {(summary?.availableAmount || 0).toLocaleString()}
            <span className="text-lg font-medium ml-0.5">원</span>
          </p>
          <p className="text-xs text-slate-400 mt-2">
            생활비 예산 {livingBudget.toLocaleString()}원
          </p>
        </div>

        {/* 생활비·비상금 소진율 (통합) — "생활비" 라벨의 allocationItems 항목(또는 과거 레거시 컬럼)이 있을 때만 표시.
            신규 달에서 항목을 아예 안 만들었거나 다른 이름으로 지었으면 값을 신뢰할 수 없으므로 카드 자체를 숨긴다 (최소 가드). */}
        {hasLivingAllocation && (
        <div className="col-span-2 sm:col-span-1 p-5 sm:p-6 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailModalType('생활비')}>
          <div className="flex justify-between items-start">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">생활비{emergencyBudget > 0 ? '·비상금' : ''} 소진율</p>
            {combinedRate >= 100 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400 animate-pulse">초과</span>
            )}
            {combinedRate >= 80 && combinedRate < 100 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400">주의</span>
            )}
          </div>
          <p className="text-3xl font-bold mt-2 tabular-nums text-slate-800 dark:text-dark-text">
            {combinedExpenses.toLocaleString()}
            <span className="text-lg font-medium ml-0.5">원</span>
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">예산 {combinedBudget.toLocaleString()}원</span>
              <span className={`font-semibold ${combinedRate >= 100 ? 'text-red-500' : combinedRate >= 80 ? 'text-amber-500' : 'text-slate-500'}`}>{combinedRate}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className={`${getBarColor(combinedRate)} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(combinedRate, 100)}%` }} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            생활비 {livingBudget.toLocaleString()}원{emergencyBudget > 0 ? ` · 비상금 ${emergencyBudget.toLocaleString()}원` : ''} · 자유재량 {discretionaryBudget.toLocaleString()}원
          </p>
        </div>
        )}

        {/* 카드 실적 */}
        <div className="min-w-0 p-4 sm:p-6 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailModalType('카드')}>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">카드 실적</p>
          {cardGoal > 0 ? (
            <>
              <div className="mt-2 flex items-end gap-2">
                <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${cardRate >= 100 ? 'text-emerald-500' : 'text-blue-500'}`}>{cardRate}%</span>
                {cardRate >= 100 && <span className="text-xs font-semibold text-emerald-500 mb-1">달성!</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1 tabular-nums truncate">
                {cardTotal.toLocaleString()} / {cardGoal.toLocaleString()}원
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${cardRate >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(cardRate, 100)}%` }} />
              </div>
            </>
          ) : (
            <>
              <p className="text-xl sm:text-2xl font-bold mt-2 tabular-nums truncate text-slate-800 dark:text-dark-text">
                {cardTotal.toLocaleString()}<span className="text-base font-medium ml-0.5">원</span>
              </p>
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 font-medium">카드 목표 미설정</p>
              <a
                href="/settings"
                className="text-xs text-primary-600 hover:underline mt-0.5 inline-block"
                onClick={(e) => e.stopPropagation()}
              >
                설정에서 등록 →
              </a>
            </>
          )}
        </div>

        {/* 투자 납입 */}
        <div className="min-w-0 p-4 sm:p-6 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailModalType('투자')}>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">투자 납입</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 tabular-nums truncate text-violet-500">
            {investExpenses.toLocaleString()}
            <span className="text-base sm:text-lg font-medium ml-0.5">원</span>
          </p>
          {investPlanned > 0 ? (
            <>
              <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(investRate, 100)}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1.5 tabular-nums truncate">계획 {investPlanned.toLocaleString()}원 · {investRate}%</p>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-2 truncate">예산에 연결된 투자 계좌 없음</p>
          )}
        </div>
      </div>

      {/* 예산 분배 현황 */}
      {summary && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
          <div className="flex justify-between items-center mb-5">
            <p className="font-semibold text-slate-800 dark:text-dark-text">이번 달 예산 분배</p>
            <span className="text-xs text-slate-400 tabular-nums">
              실수령 {summary.netSalary.toLocaleString()}원 − 고정비 {summary.fixedCostTotal.toLocaleString()}원
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(() => {
              // 지출입력 예산구분 드롭다운에 뜨는 라벨은 전부 실제로 그 이름으로 지출을 등록할 수 있으므로,
              // 여기서도 동일하게 배분 예산 대비 소진율을 계산해서 보여준다.
              // 고정비만 예외 — FixedCost 테이블 기반이라 DailyExpense.budgetType 개념 자체가 없음.
              const withUsage = (label: string, value: number, color: string, bg: string) => {
                const spent = allocationItemSpent(label);
                const usageRate = value > 0 ? Math.round((spent / value) * 100) : 0;
                // 이 항목이 가용금액 중 몇 %를 배분받았는지 — 소진율(usageRate)과 별개 지표
                const percent = summary.availableAmount > 0 ? Math.round((value / summary.availableAmount) * 100) : 0;
                return { label, value, color, bg, spent, usageRate, percent };
              };
              return [
                // 고정비는 실수령액에서 가장 먼저 빠져나가는 돈이라 분모가 availableAmount가 아닌 netSalary — 0 가드 포함, 소진율 대상 아님
                { label: '고정비', value: summary.fixedCostTotal, percent: summary.netSalary > 0 ? Math.round((summary.fixedCostTotal / summary.netSalary) * 100) : 0, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700/40' },
                // 고정 5슬롯(생활비/ISA/연금/비상금/자유재량) 하드코딩 카드 제거 — 이제 summary.allocationItems 하나만 순회한다.
                // 라벨까지 전부 사용자가 설정 페이지에서 직접 지은 이름 그대로 표시됨 (하드코딩 없음)
                ...(summary.allocationItems || []).map((item, i) => {
                  const p = ALLOCATION_ITEM_PALETTE[i % ALLOCATION_ITEM_PALETTE.length];
                  return withUsage(item.label, item.budgetAmount, p.color, p.bg);
                }),
              ];
            })().map((item, i) => (
              <div
                key={`${item.label}-${i}`}
                className={`text-center p-4 ${item.bg} rounded-xl min-w-0 cursor-pointer hover:shadow-md transition-shadow`}
                onClick={'spent' in item ? () => setDetailModalType(item.label) : () => setFixedModalOpen(true)}
              >
                <div className="flex items-center justify-center gap-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
                  <span className="text-[10px] text-slate-400 shrink-0">· {item.percent}%</span>
                </div>
                <p className={`text-lg font-bold mt-1 tabular-nums ${item.color}`}>
                  {(item.value || 0).toLocaleString()}
                </p>
                {'spent' in item && (
                  <>
                    <div className="w-full bg-slate-200/70 dark:bg-slate-700 h-1 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.usageRate >= 100 ? 'bg-red-500' : item.usageRate >= 80 ? 'bg-amber-500' : item.color.replace('text-', 'bg-')}`}
                        style={{ width: `${Math.min(item.usageRate, 100)}%` }}
                      />
                    </div>
                    <p className={`text-[10px] mt-1 tabular-nums ${item.usageRate >= 100 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                      {item.spent.toLocaleString()}원 소진 ({item.usageRate}%)
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 예산 미설정 안내 */}
      {!summary && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-10 text-center">
          <p className="text-slate-400 dark:text-dark-muted">이번 달 예산이 설정되지 않았습니다.</p>
          <a href="/settings" className="mt-2 inline-block text-primary-600 text-sm font-medium hover:underline">
            설정에서 실수령액을 입력하세요 →
          </a>
        </div>
      )}

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 파이 차트 */}
        <div className="p-6 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="font-semibold text-slate-800 dark:text-dark-text mb-4">카테고리별 지출 비율</p>
          <div className="h-72">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    key={pieChartData.map(d => d.name).join(',')}
                    data={pieChartData}
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={900}
                    label={renderPieLabel}
                    labelLine={{ stroke: '#475569', strokeWidth: 1 }}
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => <CategoryPieTooltip {...props} expenses={expenses} />}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                데이터를 등록하면 차트가 나타납니다.
              </div>
            )}
          </div>
        </div>

        {/* 막대 차트 */}
        <div className="p-6 bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none">
          <p className="font-semibold text-slate-800 dark:text-dark-text mb-4">일별 지출 추이</p>
          <div className="h-64">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${(v/1000)}k`} />
                  <Tooltip
                    content={(props) => <DailyBarTooltip {...props} expenses={expenses} />}
                    cursor={{ fill: 'rgba(148,163,184,0.1)' }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                데이터를 등록하면 차트가 나타납니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 최근 지출 내역 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
        <div className="px-6 py-5 flex justify-between items-center">
          <p className="font-semibold text-slate-800 dark:text-dark-text">최근 지출 내역</p>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">{expenses.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                <th className="px-6 py-3 font-medium">날짜</th>
                <th className="px-6 py-3 font-medium">항목명</th>
                <th className="px-6 py-3 font-medium">카테고리</th>
                <th className="px-6 py-3 font-medium text-right">금액</th>
                <th className="px-6 py-3 font-medium text-center">결제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
              {expenses.length > 0 ? (
                expenses.slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-primary-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.expenseDate?.substring(5)}
                    </td>
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-800 dark:text-dark-text">{item.itemName}</td>
                    <td className="px-6 py-3.5 text-sm text-slate-400 dark:text-dark-muted">
                      {item.categoryName || item.category?.name || '-'}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-right font-semibold tabular-nums text-rose-500">
                      -{item.amount?.toLocaleString()}원
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.paymentMethod === '카드'
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {item.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    등록된 지출 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-8 flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-2xl shadow-lg hover:bg-primary-700 text-sm font-semibold z-40 transition-all hover:scale-105 hover:shadow-xl"
      >
        <span className="text-lg leading-none">+</span>
        <span>지출 추가</span>
      </button>

      {/* 지출 상세 모달 */}
      {detailModalType && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setDetailModalType(null)}
        >
          <div
            className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start px-6 pt-6 pb-4">
              <div>
                <h3 className="text-lg font-bold dark:text-dark-text">{detailModalTitle}</h3>
                <p className="text-sm text-slate-400 mt-0.5 tabular-nums">
                  총 {detailModalTotal.toLocaleString()}원 · {detailModalItems.length}건
                </p>
              </div>
              <button onClick={() => setDetailModalType(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none p-1">×</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-2 divide-y divide-slate-50 dark:divide-dark-border/50">
              {detailModalItems.length > 0 ? detailModalItems.map(item => (
                <div key={item.id} className="py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-dark-text truncate">{item.itemName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.expenseDate?.substring(5)}
                      {item.categoryName ? ` · ${item.categoryName}` : ''}
                      {item.memo ? ` · ${item.memo}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.paymentMethod === '카드'
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>{item.paymentMethod}</span>
                    <span className="text-sm font-semibold text-rose-500 tabular-nums">-{item.amount.toLocaleString()}원</span>
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center text-sm text-slate-400">내역이 없습니다.</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border">
              <a href="/expenses" className="text-sm text-primary-600 font-medium hover:underline">
                지출 페이지에서 보기 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 고정비 항목 모달 */}
      {fixedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setFixedModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start px-6 pt-6 pb-4">
              <div>
                <h3 className="text-lg font-bold dark:text-dark-text">고정비 항목</h3>
                <p className="text-sm text-slate-400 mt-0.5 tabular-nums">
                  이번 달 합계 {fixedCosts.filter(f => f.countedThisMonth).reduce((s, f) => s + f.amount, 0).toLocaleString()}원 · {fixedCosts.filter(f => f.countedThisMonth).length}건
                </p>
              </div>
              <button onClick={() => setFixedModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none p-1 min-h-[44px] min-w-[44px]">×</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-2 divide-y divide-slate-50 dark:divide-dark-border/50">
              {fixedCosts.length > 0 ? [...fixedCosts].sort((a, b) => b.amount - a.amount).map(item => (
                <div key={item.id} className={`py-3 flex justify-between items-center gap-3 ${!item.countedThisMonth ? 'opacity-40' : ''}`}>
                  <p className="text-sm font-medium text-slate-800 dark:text-dark-text truncate min-w-0">
                    {item.name}
                    {item.costType === 'INSTALLMENT' && (
                      <span className="ml-1.5 text-xs font-normal text-violet-500 tabular-nums">할부 {item.paidMonths}/{item.installmentMonths}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {!item.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">비활성</span>
                    )}
                    <span className="text-sm font-semibold text-rose-500 tabular-nums">{item.amount.toLocaleString()}원</span>
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center text-sm text-slate-400">등록된 고정비가 없습니다.</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border">
              <a href="/fixed-costs" className="text-sm text-primary-600 font-medium hover:underline">
                고정비 관리에서 보기 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 지출 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-dark-text">새 지출 등록</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <form className="space-y-4" onSubmit={handleSave}>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">항목명</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="예: 이마트, 주유소"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">금액</label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(formatNumber(e.target.value))}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">날짜</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">카테고리</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  disabled={categories.length === 0}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {categories.length > 0 ? (
                    categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))
                  ) : (
                    <option value={0}>카테고리를 불러오는 중...</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">결제 수단</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="카드">카드</option>
                    <option value="현금">현금</option>
                    <option value="이체">이체</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">예산 구분</label>
                  <select
                    value={budgetType}
                    onChange={(e) => setBudgetType(e.target.value as BudgetType)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {budgetTypeOptions.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <SavingsSelect list={savingsList} value={savingsId} onChange={pickSavings} />
              <ExpenseAccountField accounts={cashAccounts} value={cashAccountId} onChange={setCashAccountId} paymentMethod={paymentMethod} />

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">메모 (선택)</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="메모"
                />
              </div>

              <button
                type="submit"
                disabled={categories.length === 0}
                className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold mt-4 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {categories.length === 0 ? '카테고리를 불러오는 중...' : '저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  if (isAuthenticated()) return <>{children}</>;
  expireStaleSession();
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/settings" element={<BudgetSettingsPage />} />
                <Route path="/fixed-costs" element={<FixedCostPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/cash" element={<EmergencyPage />} />
                <Route path="/emergency" element={<Navigate to="/cash" replace />} />
                <Route path="/todo" element={<TodoPage />} />
                <Route path="/planner-board" element={<PlannerBoardPage />} />
                <Route path="/running" element={<RunningPage />} />
                <Route path="/habits" element={<HabitPage />} />
                <Route path="/invest" element={<InvestDashboardPage />} />
                <Route path="/invest/records" element={<Navigate to="/invest" replace />} />
                <Route path="/invest/settings" element={<Navigate to="/accounts?tab=invest" replace />} />
                <Route path="/accounts" element={<MyAccountsPage />} />
                <Route path="/invest/diary" element={<InvestDiaryPage />} />
                <Route path="/preferences" element={<DisplaySettingsPage />} />
                <Route path="/assets" element={<AllocationPage />} />
                <Route path="/allocation" element={<Navigate to="/assets" replace />} />
                <Route path="/savings" element={<SavingsPage />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
