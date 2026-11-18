import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { BudgetType, DailyExpense } from '../types';

/** 리포트 월 카드 → 그 달 어디에 가장 많이 썼는지 (분류 순위 + 큰 지출 Top 10) */

type Filter = '전체' | BudgetType;
const FILTERS: Filter[] = ['전체', '생활비', '비상금', '투자'];

const BADGE: Record<string, string> = {
  생활비: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  비상금: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  투자: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
};

// 같은 달을 다시 열 때 재요청하지 않게 (페이지 떠나면 사라져도 됨)
const cache = new Map<string, DailyExpense[]>();

export const MonthSpendingSheet = ({ month, onClose }: { month: string; onClose: () => void }) => {
  const [expenses, setExpenses] = useState<DailyExpense[] | null>(cache.get(month) ?? null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('전체');
  const [tab, setTab] = useState<'category' | 'items'>('category');
  const [openCat, setOpenCat] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(month)) return;
    let alive = true;
    api.get(`/daily-expenses/month/${month}`)
      .then(res => {
        const list: DailyExpense[] = res.data.data || [];
        cache.set(month, list);
        if (alive) setExpenses(list);
      })
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 적금·청약 납입은 소비가 아니라 옮긴 돈이라 순위에서 뺌
  const spent = useMemo(
    () => (expenses ?? []).filter(e => e.savingsId == null && (filter === '전체' || e.budgetType === filter)),
    [expenses, filter],
  );
  const savingsCount = useMemo(() => (expenses ?? []).filter(e => e.savingsId != null).length, [expenses]);
  const total = spent.reduce((s, e) => s + e.amount, 0);

  const categories = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; items: DailyExpense[] }>();
    spent.forEach(e => {
      const name = e.categoryName || '미분류';
      const c = map.get(name) ?? { name, amount: 0, items: [] };
      c.amount += e.amount;
      c.items.push(e);
      map.set(name, c);
    });
    return Array.from(map.values())
      .map(c => ({ ...c, items: [...c.items].sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.amount - a.amount);
  }, [spent]);

  const topItems = useMemo(() => [...spent].sort((a, b) => b.amount - a.amount).slice(0, 10), [spent]);
  const maxCat = categories[0]?.amount || 1;

  const [y, m] = month.split('-');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${y}년 ${Number(m)}월 지출 순위`}
        className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] pb-[env(safe-area-inset-bottom)] sm:pb-0 animate-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-3">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{y}년 {Number(m)}월 정산</p>
              <h3 className="text-lg font-bold dark:text-dark-text">어디에 가장 많이 썼을까</h3>
              {expenses && (
                <p className="text-sm text-slate-400 mt-0.5 tabular-nums">
                  총 <span className="font-semibold text-slate-700 dark:text-dark-text">{total.toLocaleString()}원</span> · {spent.length}건
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-slate-400 hover:text-slate-600 text-2xl leading-none shrink-0"
            >×</button>
          </div>

          {/* 예산 구분 칩 */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setOpenCat(null); }}
                className={`shrink-0 px-3 h-9 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >{f}</button>
            ))}
          </div>

          {/* 탭 */}
          <div className="grid grid-cols-2 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-sm">
            {([['category', '분류별 순위'], ['items', '큰 지출 Top 10']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`h-9 rounded-lg font-medium transition-colors ${
                  tab === k
                    ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto overscroll-contain themed-scrollbar flex-1 px-4 pb-4">
          {error ? (
            <div className="py-12 text-center text-sm text-slate-400">지출을 불러오지 못했어요.</div>
          ) : !expenses ? (
            <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : spent.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">이 달에 {filter === '전체' ? '' : `${filter} `}지출이 없어요.</div>
          ) : tab === 'category' ? (
            <ol className="space-y-1">
              {categories.map((c, i) => {
                const open = openCat === c.name;
                const pct = total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0;
                return (
                  <li key={c.name}>
                    <button
                      onClick={() => setOpenCat(open ? null : c.name)}
                      aria-expanded={open}
                      className="w-full text-left px-2 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                          i < 3 ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-baseline gap-2">
                            <span className="text-sm font-medium text-slate-800 dark:text-dark-text truncate">
                              {c.name} <span className="text-xs font-normal text-slate-400">{c.items.length}건</span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums dark:text-dark-text">
                              {c.amount.toLocaleString()}원
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${i < 3 ? 'bg-primary-500' : 'bg-slate-400'}`}
                                style={{ width: `${(c.amount / maxCat) * 100}%` }}
                              />
                            </div>
                            <span className="w-11 text-right text-xs text-slate-400 tabular-nums">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    {open && (
                      <ul className="ml-12 mr-2 mb-2 divide-y divide-slate-50 dark:divide-dark-border/50">
                        {c.items.map(e => <ItemRow key={e.id} e={e} />)}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <ol className="divide-y divide-slate-50 dark:divide-dark-border/50">
              {topItems.map((e, i) => <ItemRow key={e.id} e={e} rank={i + 1} showCategory />)}
            </ol>
          )}

          {expenses && savingsCount > 0 && (
            <p className="mt-3 px-2 text-xs text-slate-400">적금·청약 납입 {savingsCount}건은 소비가 아니라서 순위에서 뺐어요.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ItemRow = ({ e, rank, showCategory }: { e: DailyExpense; rank?: number; showCategory?: boolean }) => (
  <li className="py-2.5 flex items-center gap-3">
    {rank != null && (
      <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400 tabular-nums">{rank}</span>
    )}
    <div className="min-w-0 flex-1">
      <p className="text-sm text-slate-800 dark:text-dark-text truncate">{e.itemName}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">
        {e.expenseDate?.substring(5).replace('-', '/')}
        {showCategory && e.categoryName ? ` · ${e.categoryName}` : ''}
        {` · ${e.paymentMethod}`}
      </p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {e.budgetType !== '생활비' && (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${BADGE[e.budgetType] ?? ''}`}>{e.budgetType}</span>
      )}
      <span className="text-sm font-semibold text-rose-500 tabular-nums">{e.amount.toLocaleString()}원</span>
    </div>
  </li>
);
