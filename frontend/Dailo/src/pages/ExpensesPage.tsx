import React, { useState, useEffect } from 'react';
import { DailyExpense, Category, BudgetType } from '../types';
import api, { getStoredMemberId } from '../api/axios';
import { formatNumber, parseNumber, getCurrentSettleMonth, getSettleMonthForDate } from '../utils/format';

interface Income {
  id: number;
  amount: number;
  incomeDate: string;
  settleMonth: string;
  source: string;
  memo: string;
}

export const ExpensesPage = () => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentSettleMonth());
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({});

  useEffect(() => {
    api.get(`/monthly-budgets/member/${getStoredMemberId()}`)
      .then(res => {
        const budgets: any[] = res.data.data || [];
        const months: string[] = budgets.map((b: any) => b.settleMonth);
        const map: Record<string, number> = {};
        budgets.forEach((b: any) => { map[b.settleMonth] = b.id; });
        setBudgetMap(map);
        setMonthOptions(months);
        if (months.length > 0 && !months.includes(selectedMonth)) {
          setSelectedMonth(months[0]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 지출 상태
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyBudgetId, setMonthlyBudgetId] = useState<number>(0);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);
  const [itemName, setItemName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('카드');
  const [budgetType, setBudgetType] = useState<BudgetType>('생활비');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [expenseMemo, setExpenseMemo] = useState('');

  // 수입 상태
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState('');
  const [incomeMemo, setIncomeMemo] = useState('');

  const fetchExpenses = async () => {
    try {
      const [expenseRes, categoryRes, budgetRes] = await Promise.allSettled([
        api.get(`/daily-expenses/month/${selectedMonth}`),
        api.get('/categories'),
        api.get(`/monthly-budgets/member/${getStoredMemberId()}/month/${selectedMonth}`)
      ]);
      if (expenseRes.status === 'fulfilled') setExpenses(expenseRes.value.data.data || []);
      if (categoryRes.status === 'fulfilled') {
        const cats = categoryRes.value.data.data || [];
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
      }
      if (budgetRes.status === 'fulfilled' && budgetRes.value.data.data?.id) {
        setMonthlyBudgetId(budgetRes.value.data.data.id);
      }
    } catch (error) {
      console.error('지출 데이터 로드 실패:', error);
    }
  };

  const fetchIncomes = async () => {
    try {
      const res = await api.get(`/incomes/month/${selectedMonth}`);
      setIncomes(res.data.data || []);
    } catch (error) {
      console.error('수입 데이터 로드 실패:', error);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchIncomes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  // 지출 폼
  const resetExpenseForm = () => {
    setItemName('');
    setExpenseAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('카드');
    setBudgetType('생활비');
    setCategoryId(categories.length > 0 ? categories[0].id : 0);
    setExpenseMemo('');
    setEditingExpense(null);
  };

  const openExpenseCreateModal = () => {
    resetExpenseForm();
    setIsExpenseModalOpen(true);
  };

  const openExpenseEditModal = (expense: DailyExpense) => {
    setEditingExpense(expense);
    setItemName(expense.itemName);
    setExpenseAmount(formatNumber(expense.amount));
    setExpenseDate(expense.expenseDate);
    setPaymentMethod(expense.paymentMethod);
    setBudgetType(expense.budgetType);
    setCategoryId(expense.categoryId || categories[0]?.id || 0);
    setExpenseMemo(expense.memo || '');
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const expenseSettleMonth = getSettleMonthForDate(expenseDate);
    const resolvedBudgetId = budgetMap[expenseSettleMonth] || monthlyBudgetId;
    if (!resolvedBudgetId) {
      alert(`${expenseSettleMonth} 월별 예산이 없습니다. 설정에서 먼저 예산을 등록해주세요.`);
      return;
    }
    const requestData = {
      monthlyBudgetId: resolvedBudgetId,
      categoryId,
      itemName,
      amount: parseNumber(expenseAmount),
      expenseDate,
      settleMonth: expenseSettleMonth,
      paymentMethod,
      budgetType,
      memo: expenseMemo,
    };
    try {
      if (editingExpense?.id) {
        await api.put(`/daily-expenses/${editingExpense.id}`, requestData);
      } else {
        await api.post('/daily-expenses', requestData);
      }
      setIsExpenseModalOpen(false);
      resetExpenseForm();
      fetchExpenses();
    } catch (error: any) {
      const msg = error?.response?.status
        ? `${error.response.status} - ${JSON.stringify(error.response.data)}`
        : error?.message || '네트워크 오류';
      alert(`저장 실패: ${msg}`);
    }
  };

  const handleExpenseDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await api.delete(`/daily-expenses/${id}`);
      fetchExpenses();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  // 수입 폼
  const resetIncomeForm = () => {
    setIncomeAmount('');
    setIncomeDate(new Date().toISOString().split('T')[0]);
    setSource('');
    setIncomeMemo('');
    setEditingIncome(null);
  };

  const openIncomeCreateModal = () => {
    resetIncomeForm();
    setIsIncomeModalOpen(true);
  };

  const openIncomeEditModal = (item: Income) => {
    setEditingIncome(item);
    setIncomeAmount(formatNumber(item.amount));
    setIncomeDate(item.incomeDate);
    setSource(item.source || '');
    setIncomeMemo(item.memo || '');
    setIsIncomeModalOpen(true);
  };

  const handleIncomeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      memberId: getStoredMemberId(),
      amount: parseNumber(incomeAmount),
      incomeDate,
      settleMonth: getSettleMonthForDate(incomeDate),
      source,
      memo: incomeMemo,
    };
    try {
      if (editingIncome) {
        await api.put(`/incomes/${editingIncome.id}`, body);
      } else {
        await api.post('/incomes', body);
      }
      setIsIncomeModalOpen(false);
      resetIncomeForm();
      fetchIncomes();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 실패');
    }
  };

  const handleIncomeDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await api.delete(`/incomes/${id}`);
      fetchIncomes();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };


  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

  const EditIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
  const DeleteIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
            {selectedMonth.replace('-', '년 ')}월
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">수입 / 지출 관리</h1>
          <p className="text-sm text-slate-400 dark:text-dark-muted mt-1">
            지출 <span className="font-semibold text-rose-500 tabular-nums">-{totalExpense.toLocaleString()}원</span>
            <span className="mx-2 text-slate-300">·</span>
            수입 <span className="font-semibold text-blue-500 tabular-nums">+{totalIncome.toLocaleString()}원</span>
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-600 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {activeTab === 'expense' ? (
            <button onClick={openExpenseCreateModal} className="px-4 py-1.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition-colors">
              + 지출
            </button>
          ) : (
            <button onClick={openIncomeCreateModal} className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors">
              + 수입
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-slate-200 dark:border-dark-border">
        <button
          onClick={() => setActiveTab('expense')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'expense'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-dark-muted'
          }`}
        >
          지출 {expenses.length > 0 && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{expenses.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'income'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-dark-muted'
          }`}
        >
          수입 {incomes.length > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{incomes.length}</span>}
        </button>
      </div>

      {/* 지출 목록 */}
      {activeTab === 'expense' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
          {expenses.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">등록된 지출 내역이 없습니다.</p>
          ) : (
            <>
              {/* 모바일 카드 */}
              <div className="divide-y divide-slate-50 dark:divide-dark-border/50 md:hidden">
                {expenses.map(item => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-400 tabular-nums">{item.expenseDate?.substring(5)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.paymentMethod === '카드'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                          }`}>{item.paymentMethod}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.budgetType === '생활비'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : item.budgetType === '투자'
                              ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>{item.budgetType}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 dark:text-dark-text mt-1">{item.itemName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.categoryName || item.category?.name || ''}{item.memo ? ` · ${item.memo}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-rose-500 tabular-nums">-{item.amount?.toLocaleString()}원</span>
                        <button onClick={() => openExpenseEditModal(item)} className="p-1 text-slate-300 hover:text-primary-500 transition-colors"><EditIcon /></button>
                        <button onClick={() => item.id && handleExpenseDelete(item.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크탑 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                      <th className="px-6 py-3">날짜</th>
                      <th className="px-6 py-3">항목명</th>
                      <th className="px-6 py-3">카테고리</th>
                      <th className="px-6 py-3 text-right">금액</th>
                      <th className="px-6 py-3 text-center">결제</th>
                      <th className="px-6 py-3 text-center">구분</th>
                      <th className="px-6 py-3 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
                    {expenses.map((item) => (
                      <tr key={item.id} className="hover:bg-primary-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-slate-400 tabular-nums">{item.expenseDate?.substring(5)}</td>
                        <td className="px-6 py-3.5">
                          <div className="text-sm font-medium text-slate-800 dark:text-dark-text">{item.itemName}</div>
                          {item.memo && <div className="text-xs text-slate-400 mt-0.5">{item.memo}</div>}
                        </td>
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
                          }`}>{item.paymentMethod}</span>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.budgetType === '생활비'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : item.budgetType === '투자'
                              ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>{item.budgetType}</span>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => openExpenseEditModal(item)} className="text-slate-300 hover:text-primary-500 transition-colors"><EditIcon /></button>
                            <button onClick={() => item.id && handleExpenseDelete(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 수입 목록 */}
      {activeTab === 'income' && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
          {incomes.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">등록된 수입 내역이 없습니다.</p>
          ) : (
            <>
              {/* 모바일 카드 */}
              <div className="divide-y divide-slate-50 dark:divide-dark-border/50 md:hidden">
                {incomes.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 tabular-nums">{item.incomeDate?.substring(5)}</span>
                        <span className="text-sm font-medium text-slate-800 dark:text-dark-text">{item.source || '-'}</span>
                      </div>
                      {item.memo && <p className="text-xs text-slate-400 mt-0.5">{item.memo}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-blue-500 tabular-nums">+{item.amount.toLocaleString()}원</span>
                      <button onClick={() => openIncomeEditModal(item)} className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><EditIcon /></button>
                      <button onClick={() => handleIncomeDelete(item.id)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크탑 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                      <th className="px-6 py-3">날짜</th>
                      <th className="px-6 py-3">출처</th>
                      <th className="px-6 py-3 text-right">금액</th>
                      <th className="px-6 py-3">메모</th>
                      <th className="px-6 py-3 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
                    {incomes.map((item) => (
                      <tr key={item.id} className="hover:bg-primary-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3.5 text-sm text-slate-400 tabular-nums">{item.incomeDate?.substring(5)}</td>
                        <td className="px-6 py-3.5 text-sm font-medium text-slate-800 dark:text-dark-text">{item.source || '-'}</td>
                        <td className="px-6 py-3.5 text-sm text-right font-semibold tabular-nums text-blue-500">+{item.amount.toLocaleString()}원</td>
                        <td className="px-6 py-3.5 text-sm text-slate-400">{item.memo || '-'}</td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => openIncomeEditModal(item)} className="text-slate-300 hover:text-blue-500 transition-colors"><EditIcon /></button>
                            <button onClick={() => handleIncomeDelete(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* 지출 모달 */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-dark-text">
                {editingExpense ? '지출 수정' : '새 지출 등록'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form className="space-y-4" onSubmit={handleExpenseSave}>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">항목명</label>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="예: 이마트, 주유소" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">금액</label>
                  <input type="text" value={expenseAmount} onChange={(e) => setExpenseAmount(formatNumber(e.target.value))}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">날짜</label>
                  <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500" />
                  <p className="text-xs text-slate-400 mt-1">
                    → <span className="font-medium text-primary-500">{getSettleMonthForDate(expenseDate)}</span> 정산
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">카테고리</label>
                <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500">
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">결제 수단</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="카드">카드</option>
                    <option value="현금">현금</option>
                    <option value="이체">이체</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">예산 구분</label>
                  <select value={budgetType} onChange={(e) => setBudgetType(e.target.value as BudgetType)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="생활비">생활비</option>
                    <option value="비상금">비상금</option>
                    <option value="투자">투자</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">메모 (선택)</label>
                <input type="text" value={expenseMemo} onChange={(e) => setExpenseMemo(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="메모" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-dark-border rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-dark-text">
                  취소
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors">
                  {editingExpense ? '수정하기' : '저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수입 모달 */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-dark-text">
                {editingIncome ? '수입 수정' : '수입 등록'}
              </h3>
              <button onClick={() => setIsIncomeModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <form onSubmit={handleIncomeSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">금액</label>
                  <input type="text" value={incomeAmount} onChange={(e) => setIncomeAmount(formatNumber(e.target.value))}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-dark-muted">날짜</label>
                  <input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">출처</label>
                <input type="text" value={source} onChange={(e) => setSource(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 은행이자, 환급금" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">메모 (선택)</label>
                <input type="text" value={incomeMemo} onChange={(e) => setIncomeMemo(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="메모" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsIncomeModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-dark-border rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-dark-text">
                  취소
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
                  {editingIncome ? '수정하기' : '저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
