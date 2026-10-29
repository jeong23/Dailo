import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { TAX_CALC_RESULT_KEY, TaxCalcResult } from '../utils/taxCalc';
import { Toast, useToast } from '../components/Toast';
import { AvgPriceBasis, avgPriceFromReturn } from '../utils/avgPrice';
import { duplicateCodes, mergeDuplicates } from '../utils/mergeHoldings';
import { ACCOUNT_TYPES, liquidityOf } from '../utils/accountLiquidity';
import { DEFAULT_THEMES, THEME_COLORS, guessThemeIndex } from '../utils/themeDefaults';

interface Holding {
  id?: number; ticker: string; targetPct: number; sortOrder: number; avgPurchasePrice?: number; shares?: number; stockCode?: string | null;
  themeId?: number | null; manualValue?: number | null;
  themeKey?: string | null;   // 화면용: 저장 전 새 테마도 가리킬 수 있게 'id:5' / 'new:xxx'
}
// 투자 테마: 투자 자산 전체 대비 목표 % (합계 100). cash = 현금성(금액으로 평가)
interface ThemeRow { key: string; id?: number; name: string; targetPct: number; cash: boolean }
interface Account { id?: number; name: string; type: string; targetPct: number; sortOrder: number; holdings: Holding[]; }

// 계좌/종목 비중 막대 색 — 대시보드 도넛과 같은 팔레트
const SEGMENT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899', '#64748b'];
const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const FIELD = 'flex items-center min-w-0 h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500';
const FIELD_INPUT = 'w-full min-w-0 flex-1 bg-transparent outline-none text-sm tabular-nums text-slate-900 dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-slate-600';

const formatNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v: string) => parseInt(v.replace(/,/g, ''), 10) || 0;
const isHundred = (v: number) => Math.abs(v - 100) < 0.1;
// 종목코드·수량 없이 평균단가만 있는 줄은 시세로 값을 낼 수 없음 → 예수금·MMF 금액을 평균단가 칸에 넣은 것으로 보고 금액으로 옮김
//  (새 줄은 기본이 주식 입력칸이라 자주 생김 — 불러올 때와 저장할 때 둘 다 적용)
const priceOnlyToAmount = (h: Holding): Holding =>
  !h.stockCode && !h.shares && h.avgPurchasePrice && h.manualValue == null
    ? { ...h, manualValue: h.avgPurchasePrice, avgPurchasePrice: undefined }
    : h;

// 합계 100% 비중 막대 (뱅크샐러드 자산 비중 스타일) — 모자라면 회색 빈칸, 넘치면 빨간 테두리
const AllocationBar = ({ items }: { items: { key: string | number; pct: number; color: string }[] }) => {
  const sum = items.reduce((s, i) => s + (i.pct || 0), 0);
  return (
    <div className={`flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 ${sum > 100.1 ? 'ring-2 ring-rose-400' : ''}`}>
      {items.filter(i => i.pct > 0).map(i => (
        <div key={i.key} style={{ width: `${(i.pct / Math.max(sum, 100)) * 100}%`, background: i.color }} />
      ))}
    </div>
  );
};

const SumLabel = ({ label, sum, show = true }: { label: string; sum: number; show?: boolean }) => {
  if (!show) return null;
  const ok = isHundred(sum);
  return (
    <span className={`text-xs font-medium tabular-nums ${ok ? 'text-emerald-500' : 'text-rose-500'}`}>
      {label} {sum.toFixed(1).replace(/\.0$/, '')}%{ok ? ' ✓' : sum < 100 ? ` · ${(100 - sum).toFixed(1).replace(/\.0$/, '')}% 남음` : ' · 초과'}
    </span>
  );
};

// 평균단가 역산 패널 — 현재가(1주) 또는 평가금액(총액) + 수익률 → 평균단가
const AvgPriceCalc = ({ shares, initialValue, onApply, onClose }: {
  shares?: number; initialValue?: number; onApply: (avg: number) => void; onClose: () => void;
}) => {
  const [basis, setBasis] = useState<AvgPriceBasis>('price');
  const [valueInput, setValueInput] = useState(initialValue ? initialValue.toLocaleString() : '');
  const [rateInput, setRateInput] = useState('');
  const rate = parseFloat(rateInput);
  const result = rateInput.trim() === '' ? null : avgPriceFromReturn(parseNum(valueInput), rate, basis, shares);
  const needShares = basis === 'total' && !(shares && shares > 0);

  return (
    <div className="ml-3 rounded-xl bg-primary-50/60 dark:bg-primary-900/10 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">수익률로 평균단가 계산</p>
        <button onClick={onClose} aria-label="닫기" className="w-8 h-8 -mr-1 rounded-lg text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800">×</button>
      </div>
      <div className="flex gap-1 bg-white dark:bg-dark-bg rounded-lg p-1">
        {([['price', '현재가 (1주)'], ['total', '평가금액 (총액)']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setBasis(k)}
            className={`flex-1 h-9 rounded-md text-xs font-medium transition-colors ${
              basis === k ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400'
            }`}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className={`${FIELD} bg-white`}>
          <span className="text-xs text-slate-400 mr-2 shrink-0">{basis === 'price' ? '현재가' : '평가금액'}</span>
          <input type="text" inputMode="numeric" placeholder="0" value={valueInput}
            onChange={e => setValueInput(formatNum(e.target.value))} className={`${FIELD_INPUT} text-right`} />
          <span className="text-xs text-slate-400 ml-1">원</span>
        </label>
        <label className={`${FIELD} bg-white`}>
          <span className="text-xs text-slate-400 mr-2 shrink-0">수익률</span>
          <input type="text" inputMode="decimal" placeholder="예: 12.5 / -3.2" value={rateInput}
            onChange={e => setRateInput(e.target.value.replace(/[^0-9.-]/g, ''))} className={`${FIELD_INPUT} text-right`} />
          <span className="text-xs text-slate-400 ml-1">%</span>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums min-w-0">
          {needShares ? '평가금액으로 계산하려면 보유 수량을 먼저 입력하세요'
            : result !== null ? <>평균단가 <b className="text-sm text-slate-900 dark:text-dark-text">{result.toLocaleString()}원</b></>
            : rateInput.trim() !== '' ? '값을 확인해 주세요' : '수익률은 손실이면 −로 입력'}
        </p>
        <button disabled={result === null} onClick={() => result !== null && onApply(result)}
          className="h-11 px-4 shrink-0 rounded-full bg-primary-600 text-white text-sm font-medium disabled:opacity-40">적용</button>
      </div>
    </div>
  );
};

export const InvestSettingsPage = () => {
  const [calcKey, setCalcKey] = useState<string | null>(null);   // 평균단가 계산 패널이 열린 종목 (ai-hi)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgetInput, setBudgetInput] = useState('');
  const [pensionInput, setPensionInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('5');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'themes' | 'accounts'>('basic');
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const { toast, show } = useToast();

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

  const snapshotOf = (b: string, p: string, t: string, a: Account[], th: ThemeRow[]) => JSON.stringify({ b, p, t, a, th });

  // 서버 응답 → 화면 상태 (종목의 themeId를 themeKey로)
  const withThemeKeys = (list: Account[]): Account[] => list.map(acc => ({
    ...acc, holdings: acc.holdings.map(h => ({ ...priceOnlyToAmount(h), themeKey: h.themeId ? `id:${h.themeId}` : null })),
  }));
  const toThemeRows = (list: { id: number; name: string; targetPct: number; cash: boolean }[]): ThemeRow[] =>
    list.map(t => ({ key: `id:${t.id}`, id: t.id, name: t.name, targetPct: t.targetPct, cash: !!t.cash }));

  useEffect(() => {
    Promise.allSettled([api.get('/invest/setting'), api.get('/invest/accounts'), api.get('/invest/themes')]).then(([sRes, aRes, tRes]) => {
      let b = '', p = '6,000,000', t = '5', a: Account[] = [], th: ThemeRow[] = [];
      if (sRes.status === 'fulfilled' && sRes.value.data.data) {
        const s = sRes.value.data.data;
        b = s.monthlyBudget ? s.monthlyBudget.toLocaleString() : '';
        p = s.pensionLimit ? s.pensionLimit.toLocaleString() : '6,000,000';
        t = s.rebalanceThreshold != null ? String(s.rebalanceThreshold) : '5';
      }
      if (aRes.status === 'fulfilled') a = withThemeKeys(aRes.value.data.data || []);
      if (tRes.status === 'fulfilled') th = toThemeRows(tRes.value.data.data || []);
      setBudgetInput(b); setPensionInput(p); setThresholdInput(t); setAccounts(a); setThemes(th);
      setSavedSnapshot(snapshotOf(b, p, t, a, th));
      setLoaded(true);
    });
  }, []);

  const accountPctSum = accounts.reduce((s, a) => s + (a.targetPct || 0), 0);
  const budget = parseNum(budgetInput);
  const dirty = loaded && snapshotOf(budgetInput, pensionInput, thresholdInput, accounts, themes) !== savedSnapshot;
  const useThemes = themes.length > 0;   // 테마가 있으면 계좌 안 종목 %는 안 씀 (리밸런싱은 테마 기준)
  const themeSum = themes.reduce((s, t) => s + (t.targetPct || 0), 0);
  const themeOf = (h: Holding) => themes.find(t => t.key === h.themeKey) ?? null;
  // 예수금·펀드처럼 종목코드 없이 금액으로 입력하는 줄 — 현금성 테마이거나, 테마 없이 '금액으로 입력'을 고른 줄
  const isAmountRow = (h: Holding) => !h.stockCode && (!!themeOf(h)?.cash || h.manualValue != null);
  const unassigned = accounts.flatMap(a => a.holdings.filter(h => !themeOf(h)).map(h => ({ h, acc: a })));

  // alert 대신 저장바에 바로 보여줄 검증 메시지
  const errors: string[] = [];
  if (accounts.length > 0 && !isHundred(accountPctSum)) errors.push(`계좌 비중 합계가 ${accountPctSum.toFixed(1)}%예요`);
  accounts.forEach((acc, i) => {
    const sum = acc.holdings.reduce((s, h) => s + (h.targetPct || 0), 0);
    const name = acc.name.trim() || `${i + 1}번째 계좌`;
    if (!acc.name.trim()) errors.push(`${i + 1}번째 계좌 이름을 입력해주세요`);
    if (!useThemes && acc.holdings.length > 0 && !isHundred(sum)) errors.push(`${name} 종목 비중 합계가 ${sum.toFixed(1)}%예요`);
    if (acc.holdings.some(h => !h.ticker.trim())) errors.push(`${name}에 이름 없는 종목이 있어요`);
    acc.holdings
      .filter(h => h.stockCode && !/^[0-9A-Za-z]{6}$/.test(h.stockCode))
      .forEach(h => errors.push(`${h.ticker.trim() || '종목'} 종목코드는 6자리예요`));
    duplicateCodes(acc.holdings).forEach(c => errors.push(`${name}에 종목코드 ${c}가 두 줄 있어요 — 한 줄로 합쳐주세요`));
  });
  if (useThemes && !isHundred(themeSum)) errors.push(`테마 비중 합계가 ${themeSum.toFixed(1)}%예요`);
  if (themes.some(t => !t.name.trim())) errors.push('이름 없는 테마가 있어요');
  const threshold = parseFloat(thresholdInput);
  if (isNaN(threshold) || threshold <= 0) errors.push('리밸런싱 기준을 입력해주세요');

  // ── 테마 편집 ──
  const newKey = () => `new:${Math.random().toString(36).slice(2, 9)}`;
  const addTheme = () => setThemes(prev => [...prev, { key: newKey(), name: '', targetPct: Math.max(0, 100 - themeSum), cash: false }]);
  const updateTheme = (i: number, patch: Partial<ThemeRow>) => setThemes(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeTheme = (i: number) => {
    const key = themes[i].key;
    setThemes(prev => prev.filter((_, idx) => idx !== i));
    setAccounts(prev => prev.map(a => ({ ...a, holdings: a.holdings.map(h => h.themeKey === key ? { ...h, themeKey: null } : h) })));
  };
  // 추천 테마 만들고, 테마 없는 종목은 이름으로 자동 배정 (현금성은 평균단가 칸에 넣어 둔 금액을 금액으로 옮김)
  const startWithDefaults = () => {
    const rows: ThemeRow[] = DEFAULT_THEMES.map(d => ({ key: newKey(), name: d.name, targetPct: d.targetPct, cash: d.cash }));
    setThemes(rows);
    setAccounts(prev => prev.map(a => ({
      ...a, holdings: a.holdings.map(h => {
        if (h.themeKey) return h;
        const idx = guessThemeIndex(h.ticker);
        if (idx < 0) return h;
        const isCashRow = DEFAULT_THEMES[idx].cash && !h.stockCode && !h.shares;
        return { ...h, themeKey: rows[idx].key, ...(isCashRow && !h.manualValue && h.avgPurchasePrice ? { manualValue: h.avgPurchasePrice, avgPurchasePrice: undefined } : {}) };
      }),
    })));
    show('추천 테마를 만들고 종목을 자동으로 나눴어요 — 확인 후 저장해주세요');
  };

  const addAccount = () => {
    setAccounts(prev => [...prev, { name: '', type: 'GENERAL', targetPct: Math.max(0, 100 - accountPctSum), sortOrder: prev.length, holdings: [] }]);
  };

  const removeAccount = (i: number) => {
    const acc = accounts[i];
    if ((acc.id || acc.holdings.length > 0) && !window.confirm(`"${acc.name || '이 계좌'}"를 삭제할까요? 저장하면 종목과 납입 기록도 함께 사라질 수 있어요.`)) return;
    setAccounts(prev => prev.filter((_, idx) => idx !== i));
  };

  // 같은 종목코드 여러 줄 → 한 줄 (목표 비중·수량 합계, 평균단가 가중평균). 저장은 저장바로
  const mergeAccountDuplicates = (ai: number) => {
    setAccounts(prev => prev.map((a, idx) => idx === ai
      ? { ...a, holdings: mergeDuplicates(a.holdings).map((h, i) => ({ ...h, sortOrder: i })) }
      : a));
    setCalcKey(null);
    show('한 줄로 합쳤어요 — 저장을 눌러야 반영돼요');
  };

  const updateAccount = (i: number, key: keyof Account, value: any) => {
    setAccounts(prev => prev.map((a, idx) => idx === i ? { ...a, [key]: value } : a));
  };

  const addHolding = (ai: number) => {
    setAccounts(prev => prev.map((a, idx) => {
      if (idx !== ai) return a;
      const rest = Math.max(0, 100 - a.holdings.reduce((s, h) => s + (h.targetPct || 0), 0));
      return { ...a, holdings: [...a.holdings, { ticker: '', targetPct: rest, sortOrder: a.holdings.length }] };
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

  // 주식 ↔ 금액 입력 전환. 평균단가 칸에 금액을 넣어 둔 줄(수량 없음)은 그 값을 금액으로 옮김
  const setAmountMode = (ai: number, hi: number, on: boolean) => {
    setAccounts(prev => prev.map((a, idx) => idx !== ai ? a : {
      ...a, holdings: a.holdings.map((h, hIdx) => hIdx !== hi ? h : on
        ? { ...h, manualValue: (!h.shares && h.avgPurchasePrice) || 0, avgPurchasePrice: undefined, shares: undefined }
        : { ...h, manualValue: null })
    }));
  };

  // 종목 비중 균등 분배 — 나머지는 첫 종목에 몰아서 합계를 정확히 100으로
  const splitEvenly = (ai: number) => {
    setAccounts(prev => prev.map((a, idx) => {
      if (idx !== ai || a.holdings.length === 0) return a;
      const n = a.holdings.length;
      const base = Math.floor(100 / n);
      return { ...a, holdings: a.holdings.map((h, hi) => ({ ...h, targetPct: base + (hi === 0 ? 100 - base * n : 0) })) };
    }));
  };

  const handleSave = async () => {
    if (errors.length > 0) {
      show(errors[0], 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/invest/setting', {
        monthlyBudget: parseNum(budgetInput),
        rebalanceThreshold: threshold,
        pensionLimit: parseNum(pensionInput),
      });
      // 테마 먼저 저장 → 새 테마 id를 받아 종목에 연결 (응답은 보낸 순서 그대로)
      const tr = await api.post('/invest/themes', themes.map((t, i) => ({ id: t.id ?? null, name: t.name.trim(), targetPct: t.targetPct, cash: t.cash, sortOrder: i })));
      const savedThemes = toThemeRows(tr.data.data || []);
      const idByKey: Record<string, number> = {};
      themes.forEach((t, i) => { if (savedThemes[i]?.id) idByKey[t.key] = savedThemes[i].id!; });

      const accountsPayload = accounts.map((a, si) => {
        // 테마로 관리하면 계좌 안 종목 %는 의미 없음 → 균등으로 맞춰 둠 (이달 납입 계획 계산용)
        const n = a.holdings.length;
        const even = n > 0 ? Math.floor(1000 / n) / 10 : 0;
        return {
          ...a, sortOrder: si,
          holdings: a.holdings.map(priceOnlyToAmount).map((h, hi) => ({
            id: h.id, ticker: h.ticker, sortOrder: hi,
            targetPct: useThemes ? (hi === 0 ? Math.round((100 - even * (n - 1)) * 10) / 10 : even) : h.targetPct,
            avgPurchasePrice: h.avgPurchasePrice, shares: h.shares, stockCode: h.stockCode,
            themeId: h.themeKey ? idByKey[h.themeKey] ?? null : null,
            manualValue: h.manualValue ?? null,
          })),
        };
      });
      const r = await api.post('/invest/accounts', accountsPayload);
      const savedAccounts: Account[] = withThemeKeys(r.data.data || []);
      setAccounts(savedAccounts);
      setThemes(savedThemes);
      setSavedSnapshot(snapshotOf(budgetInput, pensionInput, thresholdInput, savedAccounts, savedThemes));
      show('저장했어요');
    } catch (e: any) {
      show(e?.response?.data?.message || '저장에 실패했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { key: 'basic', label: '기본 설정' },
    { key: 'themes', label: '테마' },
    { key: 'accounts', label: '계좌 & 종목' },
  ] as const;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link to="/invest" className="inline-flex items-center gap-1 -ml-1 mb-1 min-h-[32px] px-1 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400">
          ← 투자 현황
        </Link>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">적립식 투자 설정</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">투자 설정</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 기본 설정 탭 ── */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <section className={`${CARD} divide-y divide-slate-100 dark:divide-dark-border/60`}>
            {/* 설정 행: 왼쪽 라벨·설명 / 오른쪽 입력 (토스 설정 화면 구조) */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">월 투자금</p>
                <p className="text-xs text-slate-400 mt-0.5">매달 계좌 비중대로 나눠서 납입할 금액</p>
              </div>
              <div className={`${FIELD} sm:w-56`}>
                <input type="text" inputMode="numeric" value={budgetInput} placeholder="1,000,000"
                  onChange={e => setBudgetInput(formatNum(e.target.value))} className={`${FIELD_INPUT} text-right`} />
                <span className="text-xs text-slate-400 ml-1">원</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">리밸런싱 기준</p>
                <p className="text-xs text-slate-400 mt-0.5">현재 비중이 목표에서 이만큼 벗어나면 알려드려요</p>
              </div>
              <div className="flex items-center gap-2 sm:w-56">
                {['3', '5', '10'].map(v => (
                  <button key={v} type="button" onClick={() => setThresholdInput(v)}
                    className={`h-11 px-3 rounded-xl text-sm font-medium transition-colors ${
                      thresholdInput === v ? 'bg-primary-600 text-white' : 'bg-slate-50 dark:bg-dark-bg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}>±{v}</button>
                ))}
                <div className={`${FIELD} flex-1`}>
                  <input type="text" inputMode="decimal" value={thresholdInput}
                    onChange={e => setThresholdInput(e.target.value.replace(/[^0-9.]/g, ''))} className={`${FIELD_INPUT} text-right`} />
                  <span className="text-xs text-slate-400 ml-1">%</span>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">연금 세액공제 한도</p>
                <p className="text-xs text-slate-400 mt-0.5">연금저축 연간 한도 (IRP 합산 시 900만원)</p>
              </div>
              <div className={`${FIELD} sm:w-56`}>
                <input type="text" inputMode="numeric" value={pensionInput}
                  onChange={e => setPensionInput(formatNum(e.target.value))} className={`${FIELD_INPUT} text-right`} />
                <span className="text-xs text-slate-400 ml-1">원</span>
              </div>
            </div>
          </section>

          {/* 세액공제 추천 요약 카드 */}
          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-dark-text">세액공제 추천 납입액</h3>
              <Link to="/settings" className="text-xs text-primary-500 hover:text-primary-600 font-medium min-h-[32px] inline-flex items-center">
                계산기 열기 →
              </Link>
            </div>
            {taxSummary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded-xl bg-violet-50/60 dark:bg-violet-900/10 p-3 space-y-0.5 min-w-0">
                  <p className="text-xs text-violet-500 font-medium">연금저축 월</p>
                  <p className="font-bold tabular-nums text-slate-900 dark:text-dark-text">{Math.round(taxSummary.pensionMonthly / 10_000 * 10) / 10}만원</p>
                  <p className="text-xs text-slate-400">연 {Math.round(taxSummary.pensionAnnual / 10_000)}만원</p>
                </div>
                <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 p-3 space-y-0.5 min-w-0">
                  <p className="text-xs text-emerald-500 font-medium">IRP 월</p>
                  {taxSummary.irpNeeded ? (
                    <>
                      <p className="font-bold tabular-nums text-slate-900 dark:text-dark-text">{Math.round(taxSummary.irpMonthly / 10_000 * 10) / 10}만원</p>
                      <p className="text-xs text-slate-400">연 {Math.round(taxSummary.irpAnnual / 10_000)}만원</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 pt-1">불필요</p>
                  )}
                </div>
                <div className="rounded-xl bg-rose-50/60 dark:bg-rose-900/10 p-3 space-y-0.5 min-w-0">
                  <p className="text-xs text-rose-500 font-medium">예상 환급</p>
                  <p className="font-bold tabular-nums text-slate-900 dark:text-dark-text">{Math.round((taxSummary.pensionRefund + taxSummary.irpRefund) / 10_000)}만원</p>
                  <p className="text-xs text-slate-400">소득세 {Math.round(taxSummary.annualTax / 10_000)}만원</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/30 p-3 space-y-0.5 min-w-0">
                  <p className="text-xs text-slate-500 font-medium">세액공제율</p>
                  <p className={`font-bold ${taxSummary.creditRate === 0.165 ? 'text-violet-500' : 'text-blue-500'}`}>{(taxSummary.creditRate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-slate-400 truncate">연봉 {Math.round(taxSummary.annualSalary / 10_000).toLocaleString()}만원</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-dark-muted py-1">
                연봉을 넣고 계산기를 한 번 돌리면 여기에 추천 납입액이 표시돼요.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ── 테마 탭: 투자 자산을 테마로 나눈 목표 비중 ── */}
      {activeTab === 'themes' && (
        <div className="space-y-4">
          {themes.length === 0 ? (
            <section className={`${CARD} p-5 sm:p-6 space-y-3`}>
              <p className="text-base font-bold text-slate-900 dark:text-dark-text">테마로 비중 관리하기</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                종목은 유행을 타니까 비중은 <b>테마</b>(미국 지수 · AI · 원자재 · 현금성…)로 정하고, 리밸런싱도 테마 기준으로 해요.
                계좌에 들어가는 돈은 그대로 두고, 각 계좌에서 가장 모자란 테마의 종목을 사요.
              </p>
              <button onClick={startWithDefaults}
                className="h-11 px-5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold">추천 테마로 시작</button>
              <p className="text-xs text-slate-400">미국 지수 30 · AI·테크 25 · 원자재 20 · 국내 지수 10 · 현금성 15로 만들고, 종목 이름으로 자동 배정해요. 바로 고칠 수 있어요.</p>
              <button onClick={addTheme} className="block text-xs font-medium text-primary-500 min-h-[32px]">직접 만들기</button>
            </section>
          ) : (
            <section className={`${CARD} p-4 sm:p-5 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">테마 {themes.length}개</p>
                <SumLabel label="" sum={themeSum} />
              </div>
              <AllocationBar items={themes.map((t, i) => ({ key: t.key, pct: t.targetPct, color: THEME_COLORS[i % THEME_COLORS.length] }))} />
              {themes.map((t, i) => {
                const members = accounts.flatMap(a => a.holdings.filter(h => h.themeKey === t.key).map(h => ({ h, acc: a })));
                return (
                  <div key={t.key} className="rounded-xl bg-slate-50/70 dark:bg-slate-800/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: THEME_COLORS[i % THEME_COLORS.length] }} />
                      <div className={`${FIELD} flex-1 bg-white`}>
                        <input type="text" value={t.name} placeholder="테마 이름 (예: 원자재)" maxLength={50}
                          onChange={e => updateTheme(i, { name: e.target.value })} className={FIELD_INPUT} />
                      </div>
                      <div className={`${FIELD} w-24 shrink-0 bg-white`}>
                        <input type="text" inputMode="decimal" value={t.targetPct}
                          onChange={e => updateTheme(i, { targetPct: parseFloat(e.target.value) || 0 })} className={`${FIELD_INPUT} text-right`} />
                        <span className="text-xs text-slate-400 ml-1">%</span>
                      </div>
                      <button onClick={() => removeTheme(i)} aria-label="테마 삭제"
                        className="w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-lg">×</button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-4">
                      <p className="text-[11px] text-slate-400 min-w-0 truncate">
                        {members.length > 0 ? members.map(m => m.h.ticker || '이름 없음').join(' · ') : '배정된 종목 없음 — 계좌 & 종목 탭에서 고르세요'}
                      </p>
                      <button onClick={() => updateTheme(i, { cash: !t.cash })} aria-pressed={t.cash}
                        className={`shrink-0 h-9 px-3 rounded-full text-xs font-medium ${t.cash ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-dark-card text-slate-500 ring-1 ring-slate-200 dark:ring-dark-border'}`}>
                        {t.cash ? '✓ 현금성' : '현금성'}
                      </button>
                    </div>
                  </div>
                );
              })}
              <button onClick={addTheme}
                className="w-full h-11 rounded-xl border border-dashed border-slate-300 dark:border-dark-border text-sm font-medium text-slate-500 hover:text-primary-600 hover:border-primary-400">+ 테마 추가</button>
              {unassigned.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  테마가 없는 종목 {unassigned.length}개는 리밸런싱에서 빠져요: {unassigned.map(u => u.h.ticker || '이름 없음').join(', ')}
                </p>
              )}
              <p className="text-[11px] text-slate-400">현금성 테마의 종목(예수금·디폴트옵션 등)은 주수 대신 금액으로 입력해요.</p>
            </section>
          )}
        </div>
      )}

      {/* ── 계좌 & 종목 탭 ── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* 계좌 비중 요약 */}
          <section className={`${CARD} p-4 sm:p-5 space-y-3`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-dark-text">계좌 비중</h3>
                <SumLabel label="합계" sum={accountPctSum} show={accounts.length > 0} />
              </div>
              {budget > 0 && <p className="text-xs text-slate-400 tabular-nums shrink-0">월 {budget.toLocaleString()}원 기준</p>}
            </div>
            <AllocationBar items={accounts.map((a, i) => ({ key: i, pct: a.targetPct, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))} />
            {accounts.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {accounts.map((a, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                    <span className="truncate max-w-[140px]">{a.name || '이름 없음'}</span>
                    <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">{a.targetPct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {accounts.length === 0 && (
            <div className={`${CARD} p-10 text-center`}>
              <p className="text-3xl mb-2">🏦</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">아직 계좌가 없어요</p>
              <p className="text-xs text-slate-400 mt-1">연금저축·IRP·일반 계좌를 추가하고 종목 비중을 정해보세요</p>
            </div>
          )}

          {accounts.map((acc, ai) => {
            const holdingSum = acc.holdings.reduce((s, h) => s + (h.targetPct || 0), 0);
            const accAmount = budget * ((acc.targetPct || 0) / 100);
            const color = SEGMENT_COLORS[ai % SEGMENT_COLORS.length];

            return (
              <section key={acc.id ?? `new-${ai}`} className={`${CARD} overflow-hidden`}>
                <div className="h-1" style={{ background: color }} />
                <div className="p-4 sm:p-5 space-y-3">
                  {/* 계좌명 + 삭제 */}
                  <div className="flex items-center gap-2">
                    <div className={`${FIELD} flex-1`}>
                      <input type="text" value={acc.name} placeholder="계좌 이름 (예: KB증권 연금저축)"
                        onChange={e => updateAccount(ai, 'name', e.target.value)} className={`${FIELD_INPUT} font-semibold`} />
                    </div>
                    <button onClick={() => removeAccount(ai)} aria-label="계좌 삭제"
                      className="w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xl transition-colors">×</button>
                  </div>

                  {/* 계좌 종류 + 비중 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                      {ACCOUNT_TYPES.map(o => (
                        <button key={o.value} type="button" onClick={() => updateAccount(ai, 'type', o.value)}
                          className={`h-9 px-3 rounded-lg text-xs font-medium transition-all ${
                            acc.type === o.value ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm' : 'text-slate-500 dark:text-slate-400'
                          }`}>{o.label}</button>
                      ))}
                    </div>
                    <div className={`${FIELD} w-24`}>
                      <input type="text" inputMode="decimal" value={acc.targetPct}
                        onChange={e => updateAccount(ai, 'targetPct', parseFloat(e.target.value) || 0)}
                        className={`${FIELD_INPUT} text-right`} />
                      <span className="text-xs text-slate-400 ml-1">%</span>
                    </div>
                    {budget > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">월 {Math.round(accAmount).toLocaleString()}원</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{liquidityOf(acc.type).label} — {liquidityOf(acc.type).note}</p>
                </div>

                {/* 종목 */}
                <div className="border-t border-slate-100 dark:border-dark-border/60 bg-slate-50/50 dark:bg-slate-800/10 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">종목 {acc.holdings.length}개</p>
                      <SumLabel label="" sum={holdingSum} show={!useThemes && acc.holdings.length > 0} />
                    </div>
                    {!useThemes && acc.holdings.length > 1 && (
                      <button onClick={() => splitEvenly(ai)} className="text-xs text-primary-500 hover:text-primary-600 font-medium min-h-[32px] shrink-0">균등 분배</button>
                    )}
                  </div>
                  {duplicateCodes(acc.holdings).length > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 px-3 py-2.5">
                      <p className="text-xs text-amber-700 dark:text-amber-400 min-w-0">
                        같은 종목이 두 줄로 있어요 ({duplicateCodes(acc.holdings).join(', ')}) — 평가금액이 두 번 더해지고 리밸런싱이 틀어져요
                      </p>
                      <button onClick={() => mergeAccountDuplicates(ai)}
                        className="shrink-0 h-11 sm:h-9 px-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold">한 줄로 합치기</button>
                    </div>
                  )}
                  {!useThemes && acc.holdings.length > 0 && (
                    <AllocationBar items={acc.holdings.map((h, hi) => ({ key: hi, pct: h.targetPct, color: SEGMENT_COLORS[(ai + hi + 1) % SEGMENT_COLORS.length] }))} />
                  )}

                  {acc.holdings.map((h, hi) => {
                    const holdingAmount = accAmount * ((h.targetPct || 0) / 100);
                    return (
                      <div key={h.id ?? `new-${hi}`} className="bg-white dark:bg-dark-card rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: SEGMENT_COLORS[(ai + hi + 1) % SEGMENT_COLORS.length] }} />
                          <div className={`${FIELD} flex-1`}>
                            <input type="text" value={h.ticker} placeholder="종목명 (예: TIGER 미국S&P500)"
                              onChange={e => updateHolding(ai, hi, 'ticker', e.target.value)} className={FIELD_INPUT} />
                          </div>
                          {!useThemes && (
                            <div className={`${FIELD} w-20 shrink-0`}>
                              <input type="text" inputMode="decimal" value={h.targetPct}
                                onChange={e => updateHolding(ai, hi, 'targetPct', parseFloat(e.target.value) || 0)}
                                className={`${FIELD_INPUT} text-right`} />
                              <span className="text-xs text-slate-400 ml-1">%</span>
                            </div>
                          )}
                          <button onClick={() => removeHolding(ai, hi)} aria-label="종목 삭제"
                            className="w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-lg transition-colors">×</button>
                        </div>
                        {useThemes && (
                          <label className={`${FIELD} ml-3`}>
                            <span className="text-xs text-slate-400 mr-2 shrink-0">테마</span>
                            <select value={h.themeKey ?? ''} onChange={e => updateHolding(ai, hi, 'themeKey', e.target.value || null)}
                              className={`${FIELD_INPUT} text-right cursor-pointer ${!h.themeKey ? 'text-amber-600' : ''}`}>
                              <option value="">미분류 (리밸런싱 제외)</option>
                              {themes.map(t => <option key={t.key} value={t.key}>{t.name || '이름 없는 테마'}{t.cash ? ' · 현금성' : ''}</option>)}
                            </select>
                          </label>
                        )}
                        {isAmountRow(h) ? (
                          // 종목코드 없는 예수금·펀드: 주수 대신 금액 → 계좌 평가금액에 그대로 더해짐. 단기채권 ETF처럼 코드가 있으면 시세×수량
                          <>
                            <label className={`${FIELD} ml-3`}>
                              <span className="text-xs text-slate-400 mr-2 shrink-0">금액</span>
                              <input type="text" inputMode="numeric" placeholder="0"
                                value={h.manualValue ? h.manualValue.toLocaleString() : ''}
                                onChange={e => updateHolding(ai, hi, 'manualValue', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || (themeOf(h)?.cash ? null : 0))}
                                className={`${FIELD_INPUT} text-right`} />
                              <span className="text-xs text-slate-400 ml-1">원</span>
                            </label>
                            {!themeOf(h)?.cash && (
                              <div className="flex items-center justify-between gap-2 pl-3">
                                <p className="text-[11px] text-slate-400 min-w-0">예수금·펀드 — 계좌 합계에 포함, 매매 추천에선 제외</p>
                                <button onClick={() => setAmountMode(ai, hi, false)}
                                  className="shrink-0 min-h-[32px] text-xs font-medium text-primary-500 hover:text-primary-600">주식으로 입력</button>
                              </div>
                            )}
                          </>
                        ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-3">
                          {/* 종목코드가 있으면 투자 현황에서 실시간 시세로 현재가가 자동 갱신됨 */}
                          <label className={`${FIELD} col-span-2 sm:col-span-1`}>
                            <span className="text-xs text-slate-400 mr-2 shrink-0">종목코드</span>
                            <input type="text" inputMode="text" maxLength={6} placeholder="360750"
                              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                              value={h.stockCode ?? ''}
                              onChange={e => updateHolding(ai, hi, 'stockCode', e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase() || null)}
                              className={`${FIELD_INPUT} text-right`} />
                          </label>
                          <label className={FIELD}>
                            <span className="text-xs text-slate-400 mr-2 shrink-0">평균단가</span>
                            <input type="text" inputMode="numeric" placeholder="0"
                              value={h.avgPurchasePrice ? h.avgPurchasePrice.toLocaleString() : ''}
                              onChange={e => updateHolding(ai, hi, 'avgPurchasePrice', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || undefined)}
                              className={`${FIELD_INPUT} text-right`} />
                            <span className="text-xs text-slate-400 ml-1">원</span>
                          </label>
                          <label className={FIELD}>
                            <span className="text-xs text-slate-400 mr-2 shrink-0">보유</span>
                            <input type="number" inputMode="decimal" step="any" min={0} placeholder="0"
                              value={h.shares ?? ''}
                              onChange={e => updateHolding(ai, hi, 'shares', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                              className={`${FIELD_INPUT} text-right`} />
                            <span className="text-xs text-slate-400 ml-1">주</span>
                          </label>
                        </div>
                        )}
                        {!isAmountRow(h) && (
                        <div className="flex items-center justify-between gap-2 pl-3">
                          <p className="text-[11px] text-slate-400 tabular-nums min-w-0">
                            {!useThemes && budget > 0 && `매달 ${Math.round(holdingAmount).toLocaleString()}원 납입`}
                            {!useThemes && budget > 0 && h.avgPurchasePrice && h.shares ? ' · ' : ''}
                            {h.avgPurchasePrice && h.shares ? `원금 ${Math.round(h.avgPurchasePrice * h.shares).toLocaleString()}원` : ''}
                          </p>
                          <div className="flex items-center gap-3 shrink-0">
                            {!h.stockCode && (
                              <button onClick={() => setAmountMode(ai, hi, true)}
                                className="min-h-[32px] text-xs font-medium text-slate-400 hover:text-primary-600">금액으로 입력</button>
                            )}
                            {calcKey !== `${ai}-${hi}` && (
                              <button onClick={() => setCalcKey(`${ai}-${hi}`)}
                                className="min-h-[32px] text-xs font-medium text-primary-500 hover:text-primary-600">수익률로 계산</button>
                            )}
                          </div>
                        </div>
                        )}
                        {calcKey === `${ai}-${hi}` && (
                          <AvgPriceCalc shares={h.shares} initialValue={h.avgPurchasePrice}
                            onClose={() => setCalcKey(null)}
                            onApply={avg => { updateHolding(ai, hi, 'avgPurchasePrice', avg); setCalcKey(null); show(`평균단가 ${avg.toLocaleString()}원 적용 — 저장을 눌러야 반영돼요`); }} />
                        )}
                      </div>
                    );
                  })}

                  <button onClick={() => addHolding(ai)}
                    className="w-full h-11 rounded-xl border border-dashed border-slate-300 dark:border-dark-border text-sm font-medium text-slate-500 hover:text-primary-600 hover:border-primary-400 transition-colors">
                    + 종목 추가
                  </button>
                </div>
              </section>
            );
          })}

          <button onClick={addAccount}
            className="w-full h-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-dark-border text-sm font-semibold text-slate-500 hover:text-primary-600 hover:border-primary-400 transition-colors">
            + 계좌 추가
          </button>
        </div>
      )}

      {/* ── 하단 고정 저장바: 두 탭 공통, 변경사항 있을 때만 활성 ── */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 pt-2 pb-4 px-4 sm:px-0 bg-gradient-to-t from-slate-50 via-slate-50 dark:from-dark-bg dark:via-dark-bg to-transparent">
        <div className={`${CARD} p-3 flex items-center gap-3`}>
          <p className={`flex-1 min-w-0 text-xs truncate ${errors.length > 0 && dirty ? 'text-rose-500' : 'text-slate-400'}`}>
            {!dirty ? '모든 변경사항이 저장됐어요' : errors.length > 0 ? errors[0] : '저장하지 않은 변경사항이 있어요'}
          </p>
          <button onClick={handleSave} disabled={saving || !dirty || errors.length > 0}
            className="h-11 px-6 shrink-0 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors">
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
};
