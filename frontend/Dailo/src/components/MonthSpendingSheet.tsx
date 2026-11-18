import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { BudgetType, DailyExpense } from '../types';

/**
 * 리포트 월 카드 → 그 달 어디에 가장 많이 썼는지
 *  - 분류별 순위 (지난달 대비 증감)
 *  - 자주 쓴 곳 (지출 이름별 횟수·합계)
 *  - 큰 지출 Top 10
 */

type Filter = '전체' | BudgetType;
type Tab = 'category' | 'places' | 'items';
const FILTERS: Filter[] = ['전체', '생활비', '비상금', '투자'];
const TABS: [Tab, string][] = [['category', '분류별'], ['places', '자주 쓴 곳'], ['items', '큰 지출']];

const BADGE: Record<string, string> = {
  생활비: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  비상금: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  투자: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
};

// 같은 달을 다시 열 때 재요청하지 않게 (페이지 떠나면 사라져도 됨). 실패는 캐시 안 함
const cache = new Map<string, Promise<DailyExpense[]>>();
const loadMonth = (month: string): Promise<DailyExpense[]> => {
  let p = cache.get(month);
  if (!p) {
    p = api.get(`/daily-expenses/month/${month}`).then(res => (res.data.data || []) as DailyExpense[]);
    p.catch(() => cache.delete(month));
    cache.set(month, p);
  }
  return p;
};

export const prevMonthOf = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** 같은 가게를 '스타벅스 ', '스타벅스' 처럼 다르게 적어도 한 곳으로 */
const placeKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const won = (v: number) => `${v.toLocaleString()}원`;

const filterSpent = (list: DailyExpense[], filter: Filter) =>
  // 적금·청약 납입은 소비가 아니라 옮긴 돈이라 순위에서 뺌
  list.filter(e => e.savingsId == null && (filter === '전체' || e.budgetType === filter));

const sumByCategory = (list: DailyExpense[]) => {
  const map = new Map<string, number>();
  list.forEach(e => map.set(e.categoryName || '미분류', (map.get(e.categoryName || '미분류') ?? 0) + e.amount));
  return map;
};

export const MonthSpendingSheet = ({ month, onClose }: { month: string; onClose: () => void }) => {
  const prevMonth = prevMonthOf(month);
  const [expenses, setExpenses] = useState<DailyExpense[] | null>(null);
  const [prevExpenses, setPrevExpenses] = useState<DailyExpense[] | null>(null); // null = 없음/실패 → 비교 안 함
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('전체');
  const [tab, setTab] = useState<Tab>('category');
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setExpenses(null);
    setPrevExpenses(null);
    setError(false);
    Promise.allSettled([loadMonth(month), loadMonth(prevMonth)]).then(([cur, prev]) => {
      if (!alive) return;
      if (cur.status === 'fulfilled') setExpenses(cur.value);
      else setError(true);
      if (prev.status === 'fulfilled') setPrevExpenses(prev.value);
    });
    return () => { alive = false; };
  }, [month, prevMonth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spent = useMemo(() => filterSpent(expenses ?? [], filter), [expenses, filter]);
  const prevSpent = useMemo(() => (prevExpenses ? filterSpent(prevExpenses, filter) : null), [prevExpenses, filter]);
  // 지난달 지출이 하나도 없으면(가계부 시작 전 달) 비교하지 않음 — 전부 '+ 신규'로 보이면 의미 없음
  const hasPrev = !!prevSpent && prevSpent.length > 0;
  const savingsCount = useMemo(() => (expenses ?? []).filter(e => e.savingsId != null).length, [expenses]);
  const total = spent.reduce((s, e) => s + e.amount, 0);
  const prevTotal = hasPrev ? prevSpent!.reduce((s, e) => s + e.amount, 0) : 0;

  const categories = useMemo(() => {
    const prevMap = hasPrev ? sumByCategory(prevSpent!) : new Map<string, number>();
    const map = new Map<string, { name: string; amount: number; items: DailyExpense[] }>();
    spent.forEach(e => {
      const name = e.categoryName || '미분류';
      const c = map.get(name) ?? { name, amount: 0, items: [] };
      c.amount += e.amount;
      c.items.push(e);
      map.set(name, c);
    });
    const rows = Array.from(map.values()).map(c => ({
      ...c,
      items: [...c.items].sort((a, b) => b.amount - a.amount),
      prev: prevMap.get(c.name) ?? 0,
    }));
    // 이번 달엔 안 썼지만 지난달엔 쓴 분류 — 줄어든 것도 보여야 비교가 됨
    const gone = Array.from(prevMap.entries())
      .filter(([name]) => !map.has(name))
      .map(([name, prev]) => ({ name, amount: 0, items: [] as DailyExpense[], prev }));
    return [...rows.sort((a, b) => b.amount - a.amount), ...gone.sort((a, b) => b.prev - a.prev)];
  }, [spent, prevSpent, hasPrev]);

  const places = useMemo(() => {
    const map = new Map<string, { name: string; count: number; amount: number; items: DailyExpense[] }>();
    spent.forEach(e => {
      const key = placeKey(e.itemName);
      const p = map.get(key) ?? { name: e.itemName.trim(), count: 0, amount: 0, items: [] };
      p.count += 1;
      p.amount += e.amount;
      p.items.push(e);
      map.set(key, p);
    });
    // 횟수 많은 순, 같으면 금액 큰 순. 한 번만 쓴 곳은 '자주'가 아니라서 뺌
    return Array.from(map.values())
      .filter(p => p.count >= 2)
      .map(p => ({ ...p, items: [...p.items].sort((a, b) => (a.expenseDate < b.expenseDate ? -1 : 1)) }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount);
  }, [spent]);

  const topItems = useMemo(() => [...spent].sort((a, b) => b.amount - a.amount).slice(0, 10), [spent]);
  const maxCat = categories[0]?.amount || 1;

  const [y, m] = month.split('-');
  const pm = Number(prevMonth.split('-')[1]);

  const changeTab = (t: Tab) => { setTab(t); setOpenKey(null); };

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
                  총 <span className="font-semibold text-slate-700 dark:text-dark-text">{won(total)}</span> · {spent.length}건
                  {hasPrev && <> · <Delta diff={total - prevTotal} label={`${pm}월 대비`} /></>}
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
                onClick={() => { setFilter(f); setOpenKey(null); }}
                className={`shrink-0 px-3 h-9 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >{f}</button>
            ))}
          </div>

          {/* 탭 */}
          <div className="grid grid-cols-3 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-sm">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => changeTab(k)}
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
          ) : spent.length === 0 && !(tab === 'category' && categories.length > 0) ? (
            <div className="py-12 text-center text-sm text-slate-400">이 달에 {filter === '전체' ? '' : `${filter} `}지출이 없어요.</div>
          ) : tab === 'category' ? (
            <ol className="space-y-1">
              {categories.map((c, i) => {
                const open = openKey === c.name;
                const pct = total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0;
                const ranked = c.amount > 0;
                return (
                  <li key={c.name}>
                    <button
                      onClick={() => ranked && setOpenKey(open ? null : c.name)}
                      aria-expanded={ranked ? open : undefined}
                      disabled={!ranked}
                      className="w-full text-left px-2 py-3 rounded-xl enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                          !ranked ? 'bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600'
                            : i < 3 ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>{ranked ? i + 1 : '–'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-baseline gap-2">
                            <span className={`text-sm font-medium truncate ${ranked ? 'text-slate-800 dark:text-dark-text' : 'text-slate-400'}`}>
                              {c.name} {ranked && <span className="text-xs font-normal text-slate-400">{c.items.length}건</span>}
                            </span>
                            <span className={`shrink-0 text-sm font-semibold tabular-nums ${ranked ? 'dark:text-dark-text' : 'text-slate-400'}`}>
                              {won(c.amount)}
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
                          {hasPrev && (
                            <p className="mt-1 text-xs">
                              <Delta diff={c.amount - c.prev} label={`${pm}월 ${won(c.prev)}`} isNew={c.prev === 0} />
                            </p>
                          )}
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
          ) : tab === 'places' ? (
            places.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">두 번 이상 쓴 곳이 없어요.</div>
            ) : (
              <ol className="space-y-1">
                {places.map((p, i) => {
                  const open = openKey === p.name;
                  return (
                    <li key={p.name}>
                      <button
                        onClick={() => setOpenKey(open ? null : p.name)}
                        aria-expanded={open}
                        className="w-full text-left px-2 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center gap-3"
                      >
                        <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                          i < 3 ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-dark-text truncate">{p.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                            {p.count}번 · 한 번에 평균 {won(Math.round(p.amount / p.count))}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums dark:text-dark-text">{won(p.amount)}</span>
                      </button>
                      {open && (
                        <ul className="ml-12 mr-2 mb-2 divide-y divide-slate-50 dark:divide-dark-border/50">
                          {p.items.map(e => <ItemRow key={e.id} e={e} showCategory />)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )
          ) : (
            <ol className="divide-y divide-slate-50 dark:divide-dark-border/50">
              {topItems.map((e, i) => <ItemRow key={e.id} e={e} rank={i + 1} showCategory />)}
            </ol>
          )}

          {expenses && (
            <div className="mt-3 px-2 space-y-1 text-xs text-slate-400">
              {tab === 'places' && <p>지출 이름이 같은 것끼리 묶었어요 (띄어쓰기·대소문자 무시). 두 번 이상 쓴 곳만 보여요.</p>}
              {savingsCount > 0 && <p>적금·청약 납입 {savingsCount}건은 소비가 아니라서 순위에서 뺐어요.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** 지출 증감 — 늘면 빨강(rose), 줄면 파랑(blue). 지출은 줄어드는 게 좋은 쪽 */
const Delta = ({ diff, label, isNew }: { diff: number; label: string; isNew?: boolean }) => {
  if (isNew && diff > 0) return <span className="text-rose-500 font-medium">새로 씀 <span className="text-slate-400 font-normal">· {label}</span></span>;
  if (diff === 0) return <span className="text-slate-400">같음 · {label}</span>;
  const up = diff > 0;
  return (
    <span className="tabular-nums">
      <span className={`font-medium ${up ? 'text-rose-500' : 'text-blue-500'}`}>
        {up ? '▲' : '▼'} {Math.abs(diff).toLocaleString()}원
      </span>
      <span className="text-slate-400"> · {label}</span>
    </span>
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
