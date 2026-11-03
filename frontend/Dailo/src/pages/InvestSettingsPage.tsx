import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { DEFAULT_TAX_INPUTS, TaxCalcResult, calcTaxOptimization, taxInputsFromSetting } from '../utils/taxCalc';
import { Toast, useToast } from '../components/Toast';
import { AvgPriceBasis, avgPriceFromReturn } from '../utils/avgPrice';
import { duplicateCodes, mergeDuplicates } from '../utils/mergeHoldings';
import { ACCOUNT_TYPES, liquidityOf } from '../utils/accountLiquidity';
import { PRESETS, PresetAnswers, StrategyPreset, defaultPurpose, recommendPreset, splitContribution } from '../utils/strategyPresets';
import { PURPOSE_OPTIONS } from '../utils/goalRisk';
import { DEFAULT_THEMES, THEME_COLORS, guessThemeIndex } from '../utils/themeDefaults';

interface Holding {
  id?: number; ticker: string; targetPct: number; sortOrder: number; avgPurchasePrice?: number; shares?: number; stockCode?: string | null;
  themeId?: number | null; manualValue?: number | null;
  themeKey?: string | null;   // 화면용: 저장 전 새 테마도 가리킬 수 있게 'id:5' / 'new:xxx'
}
// 투자 테마: 투자 자산 전체 대비 목표 % (합계 100). cash = 현금성(금액으로 평가)
// satellite = 위성 테마(코어-새틀라이트): 목표 %가 상한 — 납입금으로 사라고 추천 안 함, 넘으면 안내
interface ThemeRow { key: string; id?: number; name: string; targetPct: number; cash: boolean; satellite: boolean }
interface Account {
  id?: number; name: string; type: string; targetPct: number; sortOrder: number; holdings: Holding[];
  monthlyAmount?: number | null;   // 매달 납입금 (null = 월 투자금 × 계좌 %)
  purpose?: string | null;         // RETIRE / HOUSE / WEDDING / OTHER / null(미정)
  targetDate?: string | null;      // 'YYYY-MM' / null(미정)
  linkedBudgetLabel?: string | null; // 예산 설정 항목에 연결됨 → 월 납입금은 예산 설정이 기준 (여기선 읽기 전용)
  active?: boolean;                // false = 꺼진 계좌 — 납입금 0, 리밸런싱 추천 제외 (보유 자산은 합계에 포함)
}
interface Strategy { allowSell: boolean; preset: StrategyPreset | null }

// 꺼진 계좌는 아래로 — 안정 정렬이라 나머지는 원래 순서 유지 (투자 현황도 같은 규칙)
const offLast = <T extends { active?: boolean }>(list: T[]): T[] =>
  [...list].sort((a, b) => Number(a.active === false) - Number(b.active === false));

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

// embedded: '내 계좌'(/accounts) 투자 탭 안에서 쓸 때 — 페이지 제목·뒤로 링크 숨김
export const InvestSettingsPage = ({ embedded = false }: { embedded?: boolean }) => {
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
  const [strategy, setStrategy] = useState<Strategy>({ allowSell: true, preset: null });
  const [quiz, setQuiz] = useState<PresetAnswers | null>(null); // 전략 질문 패널 (null = 닫힘)
  // 목표 비중 맞추기(리밸런싱 모드) — 끄면 기록만: 전략·테마·종목 % 입력을 숨김. 저장바 없이 바로 저장
  const [rebalance, setRebalance] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const { toast, show } = useToast();

  // 세액공제 추천 — 회원의 최신 실수령액(월별 예산) + 서버에 저장된 계산기 입력으로 여기서 직접 계산
  const [taxSummary, setTaxSummary] = useState<TaxCalcResult | null>(null);

  const snapshotOf = (b: string, p: string, t: string, a: Account[], th: ThemeRow[], st: Strategy) => JSON.stringify({ b, p, t, a, th, st });

  // 서버 응답 → 화면 상태 (종목의 themeId를 themeKey로)
  // 꺼진 계좌는 아래로 (안정 정렬 — 나머지는 저장 순서 유지)
  const withThemeKeys = (list: Account[]): Account[] => offLast(list).map(acc => ({
    ...acc, holdings: acc.holdings.map(h => ({ ...priceOnlyToAmount(h), themeKey: h.themeId ? `id:${h.themeId}` : null })),
  }));
  const toThemeRows = (list: { id: number; name: string; targetPct: number; cash: boolean; satellite?: boolean }[]): ThemeRow[] =>
    list.map(t => ({ key: `id:${t.id}`, id: t.id, name: t.name, targetPct: t.targetPct, cash: !!t.cash, satellite: !!t.satellite }));

  useEffect(() => {
    Promise.allSettled([api.get('/invest/setting'), api.get('/invest/accounts'), api.get('/invest/themes')]).then(([sRes, aRes, tRes]) => {
      let b = '', p = '6,000,000', t = '5', a: Account[] = [], th: ThemeRow[] = [];
      let st: Strategy = { allowSell: true, preset: null };
      if (sRes.status === 'fulfilled' && sRes.value.data.data) {
        const s = sRes.value.data.data;
        b = s.monthlyBudget ? s.monthlyBudget.toLocaleString() : '';
        p = s.pensionLimit ? s.pensionLimit.toLocaleString() : '6,000,000';
        t = s.rebalanceThreshold != null ? String(s.rebalanceThreshold) : '5';
        st = { allowSell: s.allowSell !== false, preset: s.strategyPreset ?? null };
        setRebalance(s.rebalanceMode !== false);
      }
      if (aRes.status === 'fulfilled') a = withThemeKeys(aRes.value.data.data || []);
      if (tRes.status === 'fulfilled') th = toThemeRows(tRes.value.data.data || []);
      setBudgetInput(b); setPensionInput(p); setThresholdInput(t); setAccounts(a); setThemes(th); setStrategy(st);
      setSavedSnapshot(snapshotOf(b, p, t, a, th, st));
      setLoaded(true);
      const taxInputs = (sRes.status === 'fulfilled' && taxInputsFromSetting(sRes.value.data.data)) || DEFAULT_TAX_INPUTS;
      api.get('/monthly-budgets/mine').then(r => {
        const latest = (r.data.data || [])[0]; // 정산월 내림차순
        setTaxSummary(latest?.netSalary ? calcTaxOptimization(latest.netSalary, taxInputs.probation, taxInputs.joinMonth) : null);
      }).catch(() => setTaxSummary(null));
    });
  }, []);

  const accountPctSum = accounts.reduce((s, a) => s + (a.targetPct || 0), 0);
  const budget = parseNum(budgetInput);
  const dirty = loaded && snapshotOf(budgetInput, pensionInput, thresholdInput, accounts, themes, strategy) !== savedSnapshot;
  // 계좌 이번 달 납입금: 꺼진 계좌 0 > 직접 정한 금액 > 월 투자금 × 계좌 %
  const isOn = (acc: Account) => acc.active !== false;
  const contributionOf = (acc: Account) => !isOn(acc) ? 0 : acc.monthlyAmount ?? Math.round(budget * ((acc.targetPct || 0) / 100));
  const contributionTotal = accounts.reduce((s, a) => s + contributionOf(a), 0);
  const linkedAccounts = accounts.filter(a => a.linkedBudgetLabel && isOn(a));
  const linkedTotal = linkedAccounts.reduce((s, a) => s + (a.monthlyAmount ?? 0), 0);

  // 프리셋 적용: 월 투자금을 규칙대로 계좌별 납입금으로 나누고, 매도 허용·빈 계좌 목적을 채움 (저장바로 저장해야 반영)
  //  예산 설정과 연동된 계좌는 금액을 건드리지 않음 — 다음 예산 저장 때 덮어써지므로 기준은 예산 설정 하나
  const applyPreset = (preset: StrategyPreset, allowSell: boolean) => {
    // 꺼진 계좌도 금액을 나누지 않음 — 켜면 예전 납입금이 그대로 돌아옴
    const free = accounts.map((a, i) => ({ a, i })).filter(x => !x.a.linkedBudgetLabel && isOn(x.a));
    if (preset !== 'CUSTOM' && free.length > 0) {
      const split = splitContribution(preset, free.map(x => ({ id: x.i, type: x.a.type, targetPct: x.a.targetPct })), budget,
        taxSummary && { pensionMonthly: taxSummary.pensionMonthly, irpMonthly: taxSummary.irpMonthly });
      setAccounts(prev => prev.map((a, i) => ({ ...a, monthlyAmount: i in split ? split[i] : a.monthlyAmount })));
    }
    setAccounts(prev => prev.map(a => ({ ...a, purpose: a.purpose ?? defaultPurpose(a.type) })));
    setStrategy({ allowSell, preset });
    setQuiz(null);
    show(linkedAccounts.length > 0
      ? `'${PRESETS[preset].name}'을 적용했어요 — 예산 설정과 연동된 계좌 금액은 그대로예요. 저장을 눌러야 반영돼요`
      : `'${PRESETS[preset].name}'을 적용했어요 — 저장을 눌러야 반영돼요`);
  };
  const useThemes = themes.length > 0;   // 테마가 있으면 계좌 안 종목 %는 안 씀 (리밸런싱은 테마 기준)
  const holdingPctOff = useThemes || !rebalance; // 기록 모드도 종목 %를 안 씀 — 저장 때 균등으로 채움
  const toggleRebalance = async () => {
    const next = !rebalance;
    setRebalance(next);
    setSavingMode(true);
    try {
      await api.put('/invest/setting/rebalance-mode', { enabled: next });
      if (!next && activeTab === 'themes') setActiveTab('basic');
      show(next ? '목표 비중 맞추기를 켰어요 — 투자 현황에 이번 달 할 일이 나와요' : '기록 모드로 바꿨어요 — 보유·평가금액·손익만 보여요');
    } catch (e: any) {
      setRebalance(!next);
      show(e?.response?.data?.message || '저장하지 못했어요', 'error');
    } finally {
      setSavingMode(false);
    }
  };
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
    if (!holdingPctOff && acc.holdings.length > 0 && !isHundred(sum)) errors.push(`${name} 종목 비중 합계가 ${sum.toFixed(1)}%예요`);
    if (acc.holdings.some(h => !h.ticker.trim())) errors.push(`${name}에 이름 없는 종목이 있어요`);
    acc.holdings
      .filter(h => h.stockCode && !/^[0-9A-Za-z]{6}$/.test(h.stockCode))
      .forEach(h => errors.push(`${h.ticker.trim() || '종목'} 종목코드는 6자리예요`));
    duplicateCodes(acc.holdings).forEach(c => errors.push(`${name}에 종목코드 ${c}가 두 줄 있어요 — 한 줄로 합쳐주세요`));
  });
  if (rebalance && useThemes && !isHundred(themeSum)) errors.push(`테마 비중 합계가 ${themeSum.toFixed(1)}%예요`);
  if (rebalance && themes.some(t => !t.name.trim())) errors.push('이름 없는 테마가 있어요');
  const threshold = parseFloat(thresholdInput);
  if (rebalance && (isNaN(threshold) || threshold <= 0)) errors.push('리밸런싱 기준을 입력해주세요');

  // ── 테마 편집 ──
  const newKey = () => `new:${Math.random().toString(36).slice(2, 9)}`;
  const addTheme = () => setThemes(prev => [...prev, { key: newKey(), name: '', targetPct: Math.max(0, 100 - themeSum), cash: false, satellite: false }]);
  const updateTheme = (i: number, patch: Partial<ThemeRow>) => setThemes(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeTheme = (i: number) => {
    const key = themes[i].key;
    setThemes(prev => prev.filter((_, idx) => idx !== i));
    setAccounts(prev => prev.map(a => ({ ...a, holdings: a.holdings.map(h => h.themeKey === key ? { ...h, themeKey: null } : h) })));
  };
  // 추천 테마 만들고, 테마 없는 종목은 이름으로 자동 배정 (현금성은 평균단가 칸에 넣어 둔 금액을 금액으로 옮김)
  const startWithDefaults = () => {
    const rows: ThemeRow[] = DEFAULT_THEMES.map(d => ({ key: newKey(), name: d.name, targetPct: d.targetPct, cash: d.cash, satellite: false }));
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

  // 계좌 켜기/끄기는 저장바를 거치지 않고 바로 저장 (투자 현황 스위치와 같은 API)
  //  저장된 스냅샷의 그 계좌도 같이 바꿔서, 다른 미저장 변경사항은 그대로 '변경 있음'으로 남김
  //  카드가 위/아래로 옮겨가므로 옮겨간 자리로 스크롤
  const toggleActive = async (ai: number) => {
    const acc = accounts[ai];
    const next = acc.active === false;
    const flip = (list: Account[]) => offLast(list.map(a => (a === acc || (acc.id != null && a.id === acc.id) ? { ...a, active: next } : a)));
    if (acc.id == null) { setAccounts(flip); return; } // 새 계좌는 저장바로 같이 저장
    setAccounts(flip);
    try {
      await api.patch(`/invest/accounts/${acc.id}/active`, { active: next });
      setSavedSnapshot(prev => {
        try {
          const snap = JSON.parse(prev);
          snap.a = offLast((snap.a as Account[]).map(a => (a.id === acc.id ? { ...a, active: next } : a)));
          return JSON.stringify(snap);
        } catch { return prev; }
      });
      show(next ? `'${acc.name.replace(/\t/g, ' ')}' 계좌를 켰어요` : `'${acc.name.replace(/\t/g, ' ')}' 계좌를 껐어요 — 맨 아래로 옮겼어요`);
      requestAnimationFrame(() => document.getElementById(`acc-${acc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (e: any) {
      setAccounts(prev => offLast(prev.map(a => (a.id === acc.id ? { ...a, active: !next } : a))));
      show(e?.response?.data?.message || '계좌 상태를 바꾸지 못했어요', 'error');
    }
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
        rebalanceThreshold: isNaN(threshold) || threshold <= 0 ? 5 : threshold,
        pensionLimit: parseNum(pensionInput),
        allowSell: strategy.allowSell,
        strategyPreset: strategy.preset,
      });
      // 테마 먼저 저장 → 새 테마 id를 받아 종목에 연결 (응답은 보낸 순서 그대로)
      const tr = await api.post('/invest/themes', themes.map((t, i) => ({ id: t.id ?? null, name: t.name.trim(), targetPct: t.targetPct, cash: t.cash, satellite: t.satellite, sortOrder: i })));
      const savedThemes = toThemeRows(tr.data.data || []);
      const idByKey: Record<string, number> = {};
      themes.forEach((t, i) => { if (savedThemes[i]?.id) idByKey[t.key] = savedThemes[i].id!; });

      const accountsPayload = accounts.map((a, si) => {
        // 테마로 관리하거나 기록 모드면 계좌 안 종목 %는 의미 없음 → 균등으로 맞춰 둠 (이달 납입 계획 계산용)
        const n = a.holdings.length;
        const even = n > 0 ? Math.floor(1000 / n) / 10 : 0;
        return {
          ...a, sortOrder: si,
          holdings: a.holdings.map(priceOnlyToAmount).map((h, hi) => ({
            id: h.id, ticker: h.ticker, sortOrder: hi,
            targetPct: holdingPctOff ? (hi === 0 ? Math.round((100 - even * (n - 1)) * 10) / 10 : even) : h.targetPct,
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
      setSavedSnapshot(snapshotOf(budgetInput, pensionInput, thresholdInput, savedAccounts, savedThemes, strategy));
      show('저장했어요');
    } catch (e: any) {
      show(e?.response?.data?.message || '저장에 실패했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const TABS = ([
    { key: 'basic', label: '기본 설정' },
    { key: 'themes', label: '테마' },
    { key: 'accounts', label: '계좌 & 종목' },
  ] as const).filter(t => rebalance || t.key !== 'themes');

  return (
    <div className="space-y-5 max-w-3xl">
      {!embedded && <div>
        <Link to="/invest" className="inline-flex items-center gap-1 -ml-1 mb-1 min-h-[32px] px-1 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400">
          ← 투자 현황
        </Link>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">적립식 투자 설정</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">투자 설정</h1>
      </div>}

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
          {/* 목표 비중 맞추기 — 투자 방식은 사람마다 달라서 기본은 기록만, 원하는 사람만 켬 */}
          <section className={`${CARD} p-4 sm:p-5 flex items-center gap-4`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">목표 비중 맞추기</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {rebalance
                  ? '켜짐 — 내가 정한 목표 비중·테마로 이번 달 사고팔 수량을 계산해요'
                  : '꺼짐 — 보유 종목·평가금액·손익만 기록해요. 목표 비중을 정해 두고 맞추는 분만 켜세요'}
              </p>
            </div>
            <button type="button" role="switch" aria-checked={rebalance} aria-label="목표 비중 맞추기"
              onClick={toggleRebalance} disabled={savingMode}
              className={`relative w-12 h-7 shrink-0 rounded-full transition-colors disabled:opacity-50 ${rebalance ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${rebalance ? 'translate-x-5' : ''}`} />
            </button>
          </section>

          {/* 투자 전략: 프리셋 = 납입 정책 + 매도 허용 + 계좌 목적을 한 번에 채우는 출발점 */}
          {rebalance && <section className={`${CARD} p-4 sm:p-5 space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">투자 전략</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {strategy.preset ? `${PRESETS[strategy.preset].name} — ${PRESETS[strategy.preset].summary}` : '아직 고르지 않았어요 — 질문 3개로 골라보세요'}
                </p>
              </div>
              {!quiz && (
                <button onClick={() => setQuiz({ bigSpendIn5y: false, preferTaxCredit: false, sellWhenLosing: strategy.allowSell })}
                  className="shrink-0 h-11 sm:h-9 px-3.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-xs font-semibold text-primary-600 dark:text-primary-400">질문으로 고르기</button>
              )}
            </div>
            {quiz && (() => {
              const rec = recommendPreset(quiz);
              // 컴포넌트로 만들면 렌더마다 새 타입이라 다시 마운트됨 → 함수 호출로 JSX만 반환
              const question = (k: keyof PresetAnswers, label: string) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-700 dark:text-slate-200 min-w-0">{label}</p>
                  <div className="flex gap-1 shrink-0">
                    {[true, false].map(v => (
                      <button key={String(v)} type="button" onClick={() => setQuiz(q => q && { ...q, [k]: v })}
                        className={`h-11 sm:h-9 w-14 rounded-xl text-xs font-medium ${quiz[k] === v ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {v ? '네' : '아니요'}
                      </button>
                    ))}
                  </div>
                </div>
              );
              return (
                <div className="rounded-xl bg-slate-50 dark:bg-dark-bg p-3 space-y-3">
                  {question('bigSpendIn5y', '5년 안에 결혼·집처럼 큰돈 쓸 계획이 있나요?')}
                  {question('preferTaxCredit', '출금 자유보다 연금 세액공제가 더 중요한가요?')}
                  {question('sellWhenLosing', '손실 중인 종목도 팔아서 비중을 맞출까요?')}
                  <div className="pt-2 border-t border-slate-200/70 dark:border-dark-border/60">
                    <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">추천: {PRESETS[rec.preset].name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{PRESETS[rec.preset].summary} · {rec.allowSell ? '비중 맞출 때 팔기도 함' : '팔지 않고 새 납입금으로만 맞춤'}</p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button onClick={() => applyPreset(rec.preset, rec.allowSell)} disabled={budget <= 0 && rec.preset !== 'CUSTOM'}
                        className="h-11 sm:h-9 px-4 rounded-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-semibold">적용</button>
                      <button onClick={() => setQuiz(null)} className="h-11 sm:h-9 px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500">닫기</button>
                    </div>
                    {budget <= 0 && <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">아래 '월 투자금'을 먼저 입력해주세요 — 이 금액을 계좌별로 나눠요</p>}
                  </div>
                </div>
              );
            })()}
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(PRESETS) as StrategyPreset[]).map(id => (
                <button key={id} type="button" onClick={() => applyPreset(id, id === 'CUSTOM' ? strategy.allowSell : PRESETS[id].allowSell)}
                  disabled={budget <= 0 && id !== 'CUSTOM'}
                  className={`h-11 sm:h-9 px-3 rounded-full text-xs font-medium disabled:opacity-40 ${
                    strategy.preset === id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>{PRESETS[id].name}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">프리셋은 출발점이에요 — 적용 후 계좌별 납입금·매도 허용을 따로 바꿀 수 있어요. 종목은 추천하지 않아요.</p>
          </section>}

          <section className={`${CARD} divide-y divide-slate-100 dark:divide-dark-border/60`}>
            {/* 설정 행: 왼쪽 라벨·설명 / 오른쪽 입력 (토스 설정 화면 구조) */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">월 투자금</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {linkedAccounts.length > 0
                    ? <>예산 설정 연동 {linkedTotal.toLocaleString()}원 ({linkedAccounts.map(a => a.linkedBudgetLabel).join(', ')}) · 이 칸은 연동 안 된 계좌에 나눌 금액</>
                    : '전략을 적용할 때 계좌별로 나눌 총액'}
                  {contributionTotal > 0 && contributionTotal !== budget ? ` · 지금 계좌 납입금 합계 ${contributionTotal.toLocaleString()}원` : ''}
                </p>
              </div>
              <div className={`${FIELD} sm:w-56`}>
                <input type="text" inputMode="numeric" value={budgetInput} placeholder="1,000,000"
                  onChange={e => setBudgetInput(formatNum(e.target.value))} className={`${FIELD_INPUT} text-right`} />
                <span className="text-xs text-slate-400 ml-1">원</span>
              </div>
            </div>
            {rebalance && <>
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
            <div className="p-4 sm:p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-dark-text">비중 맞출 때 팔기도 하기</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  켜면: 목표 비중보다 많아진 종목을 일부 팔아서 모자란 종목을 사요 (예: 목표 20%인데 60%면 40%p만큼 매도 추천)
                </p>
                <p className="text-xs text-slate-400">끄면: 아무것도 팔지 않고 매달 새로 넣는 돈으로만 모자란 종목을 사요 — 손실 확정이 싫을 때</p>
              </div>
              <button type="button" role="switch" aria-checked={strategy.allowSell} aria-label="비중 맞출 때 팔기도 하기"
                onClick={() => setStrategy(s => ({ ...s, allowSell: !s.allowSell }))}
                className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${strategy.allowSell ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${strategy.allowSell ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            </>}
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
      {activeTab === 'themes' && rebalance && (
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
                        {t.satellite && <span className="text-[10px] text-violet-500 mr-1 shrink-0">최대</span>}
                        <input type="text" inputMode="decimal" value={t.targetPct}
                          onChange={e => updateTheme(i, { targetPct: parseFloat(e.target.value) || 0 })} className={`${FIELD_INPUT} text-right min-w-0`} />
                        <span className="text-xs text-slate-400 ml-1">%</span>
                      </div>
                      <button onClick={() => removeTheme(i)} aria-label="테마 삭제"
                        className="w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-lg">×</button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-4">
                      <p className="text-[11px] text-slate-400 min-w-0 truncate">
                        {members.length > 0 ? members.map(m => m.h.ticker || '이름 없음').join(' · ') : '배정된 종목 없음 — 계좌 & 종목 탭에서 고르세요'}
                      </p>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => updateTheme(i, { satellite: !t.satellite, cash: t.satellite ? t.cash : false })} aria-pressed={t.satellite}
                          className={`h-9 px-3 rounded-full text-xs font-medium ${t.satellite ? 'bg-violet-500 text-white' : 'bg-white dark:bg-dark-card text-slate-500 ring-1 ring-slate-200 dark:ring-dark-border'}`}>
                          {t.satellite ? '✓ 위성' : '위성'}
                        </button>
                        <button onClick={() => updateTheme(i, { cash: !t.cash, satellite: t.cash ? t.satellite : false })} aria-pressed={t.cash}
                          className={`h-9 px-3 rounded-full text-xs font-medium ${t.cash ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-dark-card text-slate-500 ring-1 ring-slate-200 dark:ring-dark-border'}`}>
                          {t.cash ? '✓ 현금성' : '현금성'}
                        </button>
                      </div>
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
              <p className="text-[11px] text-slate-400">
                <b className="text-violet-500">위성</b> 테마(AI·반도체 같은 성장주)는 % 가 <b>상한</b>이에요 — 매달 납입금은 나머지 코어 테마로만 가고,
                위성은 남는 돈으로 직접 사요. 상한을 넘으면 투자 현황에서 알려줘요.
              </p>
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
            const accAmount = contributionOf(acc);
            const color = SEGMENT_COLORS[ai % SEGMENT_COLORS.length];
            const on = isOn(acc);
            const dim = on ? '' : 'opacity-50';

            return (
              <section key={acc.id ?? `new-${ai}`} id={acc.id != null ? `acc-${acc.id}` : undefined} className={`${CARD} overflow-hidden scroll-mt-4`}>
                <div className="h-1" style={{ background: on ? color : '#94a3b8' }} />
                <div className="p-4 sm:p-5 space-y-3">
                  {/* 계좌명 + 사용 토글 + 삭제 */}
                  <div className="flex items-center gap-2">
                    <div className={`${FIELD} flex-1 ${dim}`}>
                      <input type="text" value={acc.name} placeholder="계좌 이름 (예: KB증권 연금저축)"
                        onChange={e => updateAccount(ai, 'name', e.target.value)} className={`${FIELD_INPUT} font-semibold`} />
                    </div>
                    <button type="button" role="switch" aria-checked={on} aria-label={`${acc.name || '계좌'} 사용`}
                      onClick={() => toggleActive(ai)}
                      className="h-11 shrink-0 flex items-center gap-1.5 px-1">
                      <span className={`text-xs font-medium ${on ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>{on ? '사용' : '꺼짐'}</span>
                      <span className={`relative w-12 h-7 rounded-full transition-colors ${on ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                      </span>
                    </button>
                    <button onClick={() => removeAccount(ai)} aria-label="계좌 삭제"
                      className="w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xl transition-colors">×</button>
                  </div>
                  {!on && (
                    <p className="rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      꺼진 계좌예요 — 이번 달 할 일·납입금(0원)·리밸런싱 추천에서 빠져요. 이미 가진 자산은 평가금액 합계에 그대로 들어가요
                    </p>
                  )}
                  <div className={`space-y-3 ${dim}`}>

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
                  </div>
                  {/* 납입 정책: 매달 이 계좌에 넣는 돈. 비우면 월 투자금 × 계좌 % */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {acc.linkedBudgetLabel ? (
                      // 예산 설정이 기준 — 여기서 고치면 다음 예산 저장 때 덮어써지므로 읽기 전용
                      <Link to="/settings" className={`${FIELD} flex-1 min-w-[180px] justify-between hover:ring-2 hover:ring-primary-500/40`}>
                        <span className="text-xs text-slate-400 mr-2 shrink-0">월 납입금</span>
                        <span className="min-w-0 truncate text-sm tabular-nums text-slate-900 dark:text-dark-text">
                          {(acc.monthlyAmount ?? 0).toLocaleString()}원
                          <span className="ml-1.5 text-[11px] text-primary-500">예산 '{acc.linkedBudgetLabel}' 연동 →</span>
                        </span>
                      </Link>
                    ) : (
                    <label className={`${FIELD} flex-1 min-w-[180px]`}>
                      <span className="text-xs text-slate-400 mr-2 shrink-0">월 납입금</span>
                      <input type="text" inputMode="numeric"
                        placeholder={Math.round(budget * ((acc.targetPct || 0) / 100)).toLocaleString()}
                        value={acc.monthlyAmount != null ? acc.monthlyAmount.toLocaleString() : ''}
                        onChange={e => { const d = e.target.value.replace(/[^0-9]/g, ''); updateAccount(ai, 'monthlyAmount', d === '' ? null : parseInt(d, 10)); }}
                        className={`${FIELD_INPUT} text-right`} />
                      <span className="text-xs text-slate-400 ml-1">원</span>
                    </label>
                    )}
                    <label className={`${FIELD} w-32 shrink-0`}>
                      <span className="sr-only">계좌 목적</span>
                      <select value={acc.purpose ?? ''} onChange={e => updateAccount(ai, 'purpose', e.target.value || null)}
                        className={`${FIELD_INPUT} cursor-pointer`}>
                        <option value="">목적 미정</option>
                        {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    {acc.purpose && acc.purpose !== 'RETIRE' && (
                      <label className={`${FIELD} w-40 shrink-0`}>
                        <span className="text-xs text-slate-400 mr-2 shrink-0">쓸 때</span>
                        <input type="month" value={acc.targetDate ?? ''} onChange={e => updateAccount(ai, 'targetDate', e.target.value || null)}
                          className={`${FIELD_INPUT} text-right`} />
                      </label>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{liquidityOf(acc.type).label} — {liquidityOf(acc.type).note}</p>
                  </div>
                </div>

                {/* 종목 */}
                <div className={`${dim} border-t border-slate-100 dark:border-dark-border/60 bg-slate-50/50 dark:bg-slate-800/10 p-4 sm:p-5 space-y-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">종목 {acc.holdings.length}개</p>
                      <SumLabel label="" sum={holdingSum} show={!holdingPctOff && acc.holdings.length > 0} />
                    </div>
                    {!holdingPctOff && acc.holdings.length > 1 && (
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
                  {!holdingPctOff && acc.holdings.length > 0 && (
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
                          {!holdingPctOff && (
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
                        {useThemes && rebalance && (
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
                            {!holdingPctOff && budget > 0 && `매달 ${Math.round(holdingAmount).toLocaleString()}원 납입`}
                            {!holdingPctOff && budget > 0 && h.avgPurchasePrice && h.shares ? ' · ' : ''}
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
