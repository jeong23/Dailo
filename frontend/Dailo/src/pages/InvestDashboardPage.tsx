import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { LiveQuote, QuoteStatus, useLiveQuotes } from '../hooks/useLiveQuotes';
import { PlanItem, rebalancePlan } from '../utils/rebalance';
import { duplicateCodes } from '../utils/mergeHoldings';
import { LIQUIDITY_DISCLAIMER, LiquidityLevel, accountTypeLabel, liquidityOf } from '../utils/accountLiquidity';
import { checkGoal, isSafeHolding, purposeLabel } from '../utils/goalRisk';
import { rebalanceByTheme } from '../utils/themeRebalance';
import { Blocker, PickStyle, ThemeBreakdown, ThemeTodo, themeColor } from '../components/invest/ThemePanels';
import { Toast, useToast } from '../components/Toast';

interface DashHolding {
  recordId: number; holdingId: number; ticker: string; stockCode: string | null;
  themeId: number | null; manualValue: number | null; // 투자 테마 / 현금성 직접 입력 금액
  live?: LiveQuote; // 실시간 시세가 적용된 경우
  avgPurchasePrice: number | null; shares: number | null;
  holdingTargetPct: number; overallTargetPct: number;
  plannedAmt: number; actualAmt: number; isPaid: boolean;
  currentPrice: number | null; evalAmt: number | null;
  purchaseAmt: number | null; profitAmt: number | null; profitPct: number | null;
  currentPct: number; rebalanceNeeded: boolean;
}
interface DashAccount {
  id: number; name: string; type: string; targetPct: number;
  contribution: number;                       // 이번 달 납입금 (계좌 월 납입금 또는 월 투자금 × %)
  purpose: string | null; targetDate: string | null;
  active?: boolean;                           // false = 꺼진 계좌 — 납입 0·추천 제외, 평가금액은 합계에 포함
  accountPlannedAmt: number; accountActualAmt: number;
  holdings: DashHolding[];
}
// 체결이 쓸 돈에 주는 영향. 예수금 줄에 반영된 체결(cashDelta)은 예수금 금액이 이미 바뀌었으니
// 매도는 0, 매수는 예수금으로 못 낸 부분(납입금에서 쓴 돈)만 뺌 — 수수료 차이로 +가 되지 않게 0에서 자름
const tradeNet = (x: { side: 'BUY' | 'SELL'; amount: number; cashDelta?: number | null }) =>
  x.cashDelta == null ? (x.side === 'SELL' ? x.amount : -x.amount)
    : x.side === 'SELL' ? 0 : Math.min(-x.amount - x.cashDelta, 0);

interface Trade {
  id: number; accountId: number; holdingId: number; ticker: string; stockCode: string | null;
  side: 'BUY' | 'SELL'; shares: number; price: number; amount: number; tradeDate: string;
  cashDelta?: number | null; // 예수금 줄에 이미 반영한 금액 (매수 음수) — 쓸 돈 계산에서 두 번 빼지 않게
}
interface TradeSheet { holdingId: number; side: 'BUY' | 'SELL'; shares: string; price: string; suggested: number | null }

interface Dashboard {
  yearMonth: string; monthlyBudget: number; rebalanceThreshold: number;
  pensionLimit: number; totalPlanned: number; totalActual: number;
  pensionYtdActual: number; accounts: DashAccount[];
  allowSell: boolean; strategyPreset: string | null;
  contributionDeposited?: boolean; // 이 달 납입금이 이미 예수금에 있음
  feeRate?: number; priceBuffer?: number; // 매매 수수료 % / 가격 변동 여유 %
  rebalanceStyle?: PickStyle; profitTakePct?: number; // 테마 안 종목 고르기 (VALUE = 손해 큰 종목 우선 + 수익 실현 %)
  rebalanceMode?: boolean;       // false = 기록 모드 (할 일·목표 비중 숨김)
  rebalanceModeChosen?: boolean; // false = 아직 안 고름 → 맨 위에서 한 번 물어봄
  themes: { id: number; name: string; targetPct: number; cash: boolean; satellite?: boolean; sortOrder: number }[];
}

const TYPE_BADGE: Record<string, string> = {
  PENSION: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
  GENERAL: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  IRP: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  ISA: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400',
};
// 인출 가능성 문구 색 — 꺼내기 어려울수록 경고색
const LIQUIDITY_TEXT: Record<LiquidityLevel, string> = {
  FREE: 'text-slate-400', PRINCIPAL: 'text-slate-400',
  PENALTY: 'text-amber-600 dark:text-amber-400', LOCKED: 'text-rose-500 dark:text-rose-400',
};

// 도넛·종목 행 왼쪽 컬러바에 같은 색을 써서 차트와 리스트를 눈으로 연결 (토스증권 방식)
const HOLDING_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899', '#64748b'];

const now = new Date();
const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const fmtNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v?: string) => parseInt((v || '').replace(/,/g, ''), 10);
const fmt = (n: number) => n.toLocaleString();
const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
// 한국 증시 관례: 상승 빨강 / 하락 파랑
const profitColor = (v: number) => v > 0 ? 'text-rose-500' : v < 0 ? 'text-blue-500' : 'text-slate-400';
const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';

const Progress = ({ value, tone }: { value: number; tone: string }) => (
  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
    <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
  </div>
);

// 실시간 시세를 현재가로 덮어쓰고 평가금액·손익·비중·리밸런싱 여부를 다시 계산 (백엔드 getDashboard와 같은 규칙)
const applyLiveQuotes = (d: Dashboard, quotes: Record<string, LiveQuote>): Dashboard => {
  let applied = false;
  const priced = d.accounts.map(acc => ({
    ...acc,
    holdings: acc.holdings.map(h => {
      const q = h.stockCode ? quotes[h.stockCode] : undefined;
      if (!q) return h;
      applied = true;
      const evalAmt = h.shares != null ? Math.round(q.price * h.shares) : h.evalAmt;
      const profitAmt = evalAmt != null && h.purchaseAmt != null ? evalAmt - h.purchaseAmt : h.profitAmt;
      const profitPct = profitAmt != null && h.purchaseAmt ? (profitAmt * 100) / h.purchaseAmt : h.profitPct;
      return { ...h, currentPrice: q.price, evalAmt, profitAmt, profitPct, live: q };
    }),
  }));
  if (!applied) return d;
  const total = priced.flatMap(a => a.holdings).reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  const accounts = priced.map(acc => ({
    ...acc,
    holdings: acc.holdings.map(h => {
      const cur = total > 0 && h.evalAmt != null ? (h.evalAmt * 100) / total : h.overallTargetPct;
      return { ...h, currentPct: cur, rebalanceNeeded: Math.abs(cur - h.overallTargetPct) > d.rebalanceThreshold };
    }),
  }));
  return { ...d, accounts };
};

// 현금성·펀드처럼 시세가 없는 항목은 직접 입력한 금액을 평가금액으로 (손익 없음)
// 금액이 더해지면 전체 합계가 바뀌므로 현재 비중도 다시 계산 (안 하면 예수금이 0.0%로 보임)
const applyManualValues = (d: Dashboard): Dashboard => {
  let applied = false;
  const valued = d.accounts.map(acc => ({
    ...acc,
    holdings: acc.holdings.map(h => {
      // 설정에서 금액을 평균단가 칸에 넣은 줄(종목코드·수량 없음)도 금액으로 취급
      const manualValue = h.manualValue ?? (!h.stockCode && !h.shares && h.avgPurchasePrice ? h.avgPurchasePrice : null);
      if (manualValue == null || h.evalAmt != null) return h;
      applied = true;
      return { ...h, manualValue, avgPurchasePrice: null, evalAmt: manualValue, purchaseAmt: null, profitAmt: null, profitPct: null };
    }),
  }));
  if (!applied) return d;
  const total = valued.flatMap(a => a.holdings).reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  return {
    ...d,
    accounts: valued.map(acc => ({
      ...acc,
      holdings: acc.holdings.map(h => {
        const cur = total > 0 && h.evalAmt != null ? (h.evalAmt * 100) / total : h.overallTargetPct;
        return { ...h, currentPct: cur, rebalanceNeeded: Math.abs(cur - h.overallTargetPct) > d.rebalanceThreshold };
      }),
    })),
  };
};

const LiveBadge = ({ status, streaming, hasCodes }: { status: QuoteStatus | null; streaming: boolean; hasCodes: boolean }) => {
  let label = '수동 현재가';
  let tone = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  let dot = '';
  if (status?.provider === 'NAVER' && hasCodes) {
    // KIS 키 없을 때 네이버 금융 폴링 — 체결 즉시가 아니라 20초 간격
    if (!status.marketOpen) label = '장 마감 · 종가 기준';
    else if (streaming && status.connected) {
      label = '네이버 시세 · 20초';
      tone = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
      dot = 'bg-emerald-500';
    } else {
      label = '시세 연결 중…';
      tone = 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
    }
  } else if (status?.configured && hasCodes) {
    if (!status.marketOpen) {
      label = '장 마감 · 종가 기준';
    } else if (streaming && status.connected) {
      label = '실시간';
      tone = 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400';
      dot = 'bg-rose-500 animate-pulse';
    } else {
      label = '시세 연결 중…';
      tone = 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
    }
  }
  return (
    <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium ${tone}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  );
};

// 계좌는 금액 합계, 계좌 안 종목은 금액 높은 순 — 금액 = 평가금액, 현재가가 없으면 원금(평균단가×수량)
// 같으면 목표 비중·납입 계획 순, 그래도 같으면 설정 순서 (stable sort)
const holdingValue = (h: DashHolding) =>
  h.evalAmt || h.purchaseAmt || (h.avgPurchasePrice && h.shares ? h.avgPurchasePrice * h.shares : 0);
const sortByValue = (d: Dashboard): Dashboard => {
  const accValue = (a: DashAccount) => a.holdings.reduce((s, h) => s + holdingValue(h), 0);
  return {
    ...d,
    accounts: d.accounts
      .map(acc => ({
        ...acc,
        holdings: [...acc.holdings].sort((a, b) => holdingValue(b) - holdingValue(a) || b.holdingTargetPct - a.holdingTargetPct),
      }))
      .sort((a, b) => accValue(b) - accValue(a) || b.accountPlannedAmt - a.accountPlannedAmt),
  };
};

// 손익은 현재가가 있는 종목만 — 현재가 없는 종목 원금까지 넣으면 손실로 보임
const statsOf = (holdings: DashHolding[]) => {
  const evalAmt = holdings.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  // 현금성(직접 입력 금액)처럼 원금이 없는 항목은 손익 계산에서 뺌
  const pl = holdings.filter(h => h.evalAmt != null && h.purchaseAmt != null && h.purchaseAmt > 0);
  const plEval = pl.reduce((s, h) => s + (h.evalAmt ?? 0), 0);
  const purchase = pl.reduce((s, h) => s + (h.purchaseAmt ?? 0), 0);
  const profit = plEval > 0 && purchase > 0 ? plEval - purchase : null;
  return { evalAmt, purchase, profit, profitPct: profit !== null ? (profit * 100) / purchase : null };
};

const ACTION_STYLE: Record<'BUY' | 'SELL', { label: string; chip: string; text: string }> = {
  BUY:  { label: '매수', chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400', text: 'text-rose-500' },
  SELL: { label: '매도', chip: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', text: 'text-blue-500' },
};

const PageHeader = ({ right }: { right?: React.ReactNode }) => (
  <div className="flex items-end justify-between flex-wrap gap-3">
    <div>
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">포트폴리오 현황</p>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">투자 현황</h1>
    </div>
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {right}
      {/* 투자 설정 진입점 — 사이드바에서 빠졌으므로 여기서만 들어감 */}
      <Link to="/accounts?tab=invest" aria-label="투자 설정" title="투자 설정"
        className="h-11 px-3.5 flex items-center gap-1.5 rounded-full bg-white dark:bg-dark-card shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="hidden sm:inline">설정</span>
      </Link>
    </div>
  </div>
);

export const InvestDashboardPage = () => {
  const navigate = useNavigate();
  const [ym, setYm] = useState(currentYm);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const { toast, show } = useToast();

  // 입력 바텀시트: 계좌 단위로 열어서 종목별 현재가/이달 납입을 한 번에 입력
  const [sheetAccId, setSheetAccId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Record<number, { currentPrice: string; actualAmt: string }>>({});
  const [savingSheet, setSavingSheet] = useState(false);
  const [savingRecord, setSavingRecord] = useState<Record<number, boolean>>({});
  // 리밸런싱 추천에 이번 달 납입금(월 투자금 × 계좌 비중)을 매수 재원으로 포함할지
  // 납입금을 이미 이체해 예수금(현금성 금액)에 넣었으면 끔 — 켜 두면 같은 돈이 두 번 잡힘.
  // 기기마다 달라지면 안 돼서 서버에 달별 저장 (PUT /invest/setting/deposited), 낙관적 반영 후 실패 시 되돌림
  const withContribution = data?.contributionDeposited !== true;
  const feeRate = data?.feeRate ?? 0.015;
  const priceBuffer = data?.priceBuffer ?? 0.5;
  const saveTradeCosts = async (next: { feeRate: number; priceBuffer: number }) => {
    const prev = { feeRate, priceBuffer };
    setData(d => d && { ...d, ...next });
    try {
      await api.put('/invest/setting/trade-costs', next);
      show('매매 비용을 저장했어요');
    } catch (e: any) {
      setData(d => d && { ...d, ...prev });
      show(e?.response?.data?.message || '매매 비용을 저장하지 못했어요', 'error');
    }
  };
  const pickStyle: PickStyle = data?.rebalanceStyle === 'VALUE' ? 'VALUE' : 'THEME';
  const profitTake = data?.profitTakePct ?? 5;
  const saveStyle = async (next: { style: PickStyle; profitTakePct: number }) => {
    const prev = { rebalanceStyle: pickStyle, profitTakePct: profitTake };
    setData(d => d && { ...d, rebalanceStyle: next.style, profitTakePct: next.profitTakePct });
    try {
      await api.put('/invest/setting/rebalance-style', { style: next.style, profitTakePct: next.profitTakePct });
      show('종목 고르는 방식을 저장했어요');
    } catch (e: any) {
      setData(d => d && { ...d, ...prev });
      show(e?.response?.data?.message || '저장하지 못했어요', 'error');
    }
  };
  const setWithContribution = async (fn: (v: boolean) => boolean) => {
    const next = fn(withContribution);
    setData(d => d && { ...d, contributionDeposited: !next });
    try {
      await api.put('/invest/setting/deposited', { yearMonth: ym, deposited: !next });
    } catch {
      setData(d => d && { ...d, contributionDeposited: next });
      show('저장하지 못했어요', 'error');
    }
  };
  // 테마 리밸런싱 매도 허용 — 기기별 선호라 localStorage (기본: 허용)
  // 비중 맞출 때 팔기 — 회원 설정(서버). 토글은 낙관적 반영 후 저장, 실패 시 되돌림
  const allowSell = data?.allowSell !== false;
  const toggleAllowSell = async () => {
    const next = !allowSell;
    setData(d => d && { ...d, allowSell: next });
    try {
      const cur = (await api.get('/invest/setting')).data.data;
      await api.post('/invest/setting', { ...cur, allowSell: next });
    } catch {
      setData(d => d && { ...d, allowSell: !next });
      show('설정을 저장하지 못했어요', 'error');
    }
  };
  // 목표 비중 맞추기(리밸런싱 모드) — 끄면 보유·평가·손익 기록만. 투자 방식은 사람마다 달라서 기본은 기록, 원하는 사람만 켬
  const rebalance = data?.rebalanceMode !== false;
  const [choosingMode, setChoosingMode] = useState(false);
  const chooseMode = async (enabled: boolean) => {
    setChoosingMode(true);
    try {
      await api.put('/invest/setting/rebalance-mode', { enabled });
      setData(d => d && { ...d, rebalanceMode: enabled, rebalanceModeChosen: true });
      show(enabled ? '목표 비중 맞추기를 켰어요 — 내 계좌 > 투자에서 목표 비중을 정해주세요' : '기록만 할게요 — 내 계좌 > 투자에서 언제든 켤 수 있어요');
    } catch (e: any) {
      show(e?.response?.data?.message || '저장하지 못했어요', 'error');
    } finally {
      setChoosingMode(false);
    }
  };
  // 계좌 켜기/끄기 — 바로 저장 후 다시 불러옴 (납입금·추천·정렬이 서버 계산값 기준이라). 실패 시 되돌림
  const [togglingAcc, setTogglingAcc] = useState<number | null>(null);
  const toggleAccount = async (acc: DashAccount) => {
    const next = acc.active === false;
    setTogglingAcc(acc.id);
    setData(d => d && { ...d, accounts: d.accounts.map(a => (a.id === acc.id ? { ...a, active: next } : a)) });
    try {
      await api.patch(`/invest/accounts/${acc.id}/active`, { active: next });
      await fetchData(ym, true);
      show(next ? '계좌를 켰어요 — 이번 달 할 일에 다시 들어가요' : '계좌를 껐어요 — 납입·추천에서 빠지고 맨 아래로 옮겼어요');
    } catch (e: any) {
      setData(d => d && { ...d, accounts: d.accounts.map(a => (a.id === acc.id ? { ...a, active: !next } : a)) });
      show(e?.response?.data?.message || '계좌 상태를 바꾸지 못했어요', 'error');
    } finally {
      setTogglingAcc(null);
    }
  };
  // 이번 달 체결 기록 + 체결 완료 시트
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeSheet, setTradeSheet] = useState<TradeSheet | null>(null);
  const [savingTrade, setSavingTrade] = useState(false);

  useEscapeKey(sheetAccId !== null, () => setSheetAccId(null));
  useEscapeKey(tradeSheet !== null, () => setTradeSheet(null));
  const { quotes, status: quoteStatus, streaming } = useLiveQuotes(true);

  const fetchData = async (yearMonth: string, silent = false) => {
    if (!silent) setLoading(true);
    setFetchError(false);
    try {
      const [dash, tr] = await Promise.allSettled([
        api.get(`/invest/dashboard?yearMonth=${yearMonth}`),
        api.get(`/invest/trades?yearMonth=${yearMonth}`),
      ]);
      if (dash.status === 'rejected') throw dash.reason;
      setData(dash.value.data.data);
      setTrades(tr.status === 'fulfilled' ? tr.value.data.data : []);
    } catch (e) {
      console.error('[InvestDashboard] API 오류:', e);
      setFetchError(true);
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(ym); }, [ym]);

  const moveMonth = (d: number) => {
    const [y, m] = ym.split('-').map(Number);
    let nm = m + d, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1) { nm = 12; ny--; }
    setYm(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const openSheet = (acc: DashAccount) => {
    const init: Record<number, { currentPrice: string; actualAmt: string }> = {};
    acc.holdings.forEach(h => {
      init[h.recordId] = {
        currentPrice: h.currentPrice != null ? h.currentPrice.toLocaleString() : '',
        actualAmt: h.actualAmt > 0 ? h.actualAmt.toLocaleString() : '',
      };
    });
    setEditing(init);
    setSheetAccId(acc.id);
  };

  const saveSheet = async (acc: DashAccount, isPaid: boolean) => {
    setSavingSheet(true);
    try {
      const results = await Promise.allSettled(
        acc.holdings.map(h => {
          const e = editing[h.recordId];
          const cp = parseNum(e?.currentPrice);
          return api.put(`/invest/records/${h.recordId}`, {
            actualAmt: parseNum(e?.actualAmt) || 0,
            isPaid,
            currentPrice: cp > 0 ? cp : null,
          });
        })
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        show(`${failed}개 종목 저장에 실패했어요`, 'error');
      } else {
        show(isPaid ? '납입 완료로 저장했어요' : '저장했어요');
        setSheetAccId(null);
      }
      await fetchData(ym, true);
    } finally { setSavingSheet(false); }
  };

  const saveTrade = async () => {
    if (!tradeSheet) return;
    const shares = parseFloat(tradeSheet.shares);
    const price = parseNum(tradeSheet.price);
    if (!(shares > 0) || !(price > 0)) { show('수량과 체결 단가를 입력해주세요', 'error'); return; }
    setSavingTrade(true);
    try {
      await api.post(`/invest/holdings/${tradeSheet.holdingId}/trades`, { side: tradeSheet.side, shares, price });
      show(`${tradeSheet.side === 'BUY' ? '매수' : '매도'} 체결을 반영했어요 — 보유 수량·평균단가 갱신`);
      setTradeSheet(null);
      await fetchData(ym, true);
    } catch (e: any) {
      show(e?.response?.data?.message || '체결 기록에 실패했어요', 'error');
    } finally { setSavingTrade(false); }
  };

  const undoTrade = async (t: Trade) => {
    if (!window.confirm(`${t.ticker} ${t.side === 'BUY' ? '매수' : '매도'} ${t.shares}주 체결을 되돌릴까요? 보유 수량·평균단가가 체결 전으로 돌아가요.`)) return;
    try {
      await api.delete(`/invest/trades/${t.id}`);
      show('되돌렸어요');
      await fetchData(ym, true);
    } catch (e: any) {
      show(e?.response?.data?.message || '되돌리지 못했어요', 'error');
    }
  };

  const togglePaid = async (h: DashHolding) => {
    setSavingRecord(prev => ({ ...prev, [h.recordId]: true }));
    try {
      await api.put(`/invest/records/${h.recordId}`, {
        actualAmt: h.actualAmt, isPaid: !h.isPaid, currentPrice: h.currentPrice,
      });
      await fetchData(ym, true);
    } catch { show('저장에 실패했어요', 'error'); }
    finally { setSavingRecord(prev => ({ ...prev, [h.recordId]: false })); }
  };

  const [yy, mm] = ym.split('-').map(Number);
  const monthPicker = (
    <div className={`inline-flex items-center rounded-full ${CARD}`}>
      <button onClick={() => moveMonth(-1)} aria-label="이전 달" className="w-11 h-11 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg">‹</button>
      <span className="text-sm font-semibold text-slate-700 dark:text-dark-text min-w-[88px] text-center tabular-nums">{yy}년 {mm}월</span>
      <button onClick={() => moveMonth(1)} aria-label="다음 달" className="w-11 h-11 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg">›</button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader right={monthPicker} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={`${CARD} h-56 animate-pulse`} />
          <div className={`${CARD} h-56 animate-pulse`} />
        </div>
        <div className={`${CARD} h-48 animate-pulse`} />
      </div>
    );
  }
  if (fetchError) {
    return (
      <div className="space-y-5">
        <PageHeader right={monthPicker} />
        <div className={`${CARD} p-12 text-center`}>
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">데이터를 불러오지 못했어요</p>
          <button onClick={() => fetchData(ym)} className="mt-4 px-5 h-11 bg-primary-600 text-white rounded-full text-sm font-medium">다시 시도</button>
        </div>
      </div>
    );
  }
  if (!data || data.accounts.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader right={monthPicker} />
        <div className={`${CARD} p-12 text-center`}>
          <p className="text-4xl mb-3">💹</p>
          <p className="text-slate-700 dark:text-slate-200 font-semibold">아직 투자 계좌가 없어요</p>
          <p className="text-sm text-slate-400 mt-1">계좌와 종목 비중을 먼저 설정해주세요</p>
          <button onClick={() => navigate('/accounts?tab=invest')} className="mt-5 px-5 h-11 bg-primary-600 text-white rounded-full text-sm font-medium">투자 설정하기 →</button>
        </div>
      </div>
    );
  }

  // 실시간 시세·할 일 계산은 이번 달과 다음 달 이후(미리 보기)에만 — 지난 달은 그 달에 저장된 현재가 유지
  //  다음 달 이후는 아직 체결이 없으니 그 달 납입금으로 미리 계산 (체결 완료 버튼은 숨김 — 체결은 그 달에)
  const isCurrentMonth = ym === currentYm;
  const isPreview = ym > currentYm;
  const isLive = isCurrentMonth || isPreview;
  const priced = applyManualValues(isLive ? applyLiveQuotes(data, quotes) : data);
  // 종목 색은 설정 순서로 고정 — 정렬 뒤에 매기면 실시간 시세로 순위가 바뀔 때마다 색이 바뀜
  const colorOf: Record<number, string> = {};
  priced.accounts.flatMap(a => a.holdings).forEach((h, i) => { colorOf[h.holdingId] = HOLDING_COLORS[i % HOLDING_COLORS.length]; });
  const view = sortByValue(priced);
  const allHoldings = view.accounts.flatMap(a => a.holdings);
  const hasCodes = allHoldings.some(h => !!h.stockCode);

  const { evalAmt: totalEval, purchase: totalPurchase, profit: totalProfit, profitPct: totalProfitPct } = statsOf(allHoldings);
  const overallRate = data.totalPlanned > 0 ? (data.totalActual / data.totalPlanned) * 100 : 0;
  const pensionRemaining = Math.max(data.pensionLimit - data.pensionYtdActual, 0);
  const pensionRate = data.pensionLimit > 0 ? (data.pensionYtdActual / data.pensionLimit) * 100 : 0;

  // 평가금액이 하나라도 있으면 현재 비중, 없으면 목표 비중으로 도넛을 그림
  const hasEval = totalEval > 0;
  const slices = allHoldings
    .map(h => ({ id: h.holdingId, name: h.ticker, value: hasEval ? (h.evalAmt ?? 0) : rebalance ? h.overallTargetPct : 0 }))
    .filter(s => s.value > 0);

  const sheetAcc = data.accounts.find(a => a.id === sheetAccId) || null;

  // 리밸런싱 추천 (이번 달만): 계좌 안에서 목표 ±밴드 넘게 무거운 종목 매도 → 판 돈 + 납입금으로 가벼운 종목 매수
  // 보유 수량은 있는데 현재가가 없는 종목이 있으면 비중을 알 수 없어서 추천하지 않음
  const holdingById: Record<number, DashHolding> = {};
  allHoldings.forEach(h => { holdingById[h.holdingId] = h; });
  const plans = isLive && rebalance
    ? view.accounts.filter(a => a.holdings.length > 0 && a.active !== false).map(acc => {
        const missing = acc.holdings.filter(h => (h.shares ?? 0) > 0 && h.evalAmt == null);
        const dupCodes = duplicateCodes(acc.holdings);
        // 이번 달 체결을 반영한 남은 현금 = 납입금 + 판 돈 − 산 돈 (체결 완료 후 같은 추천이 또 나오지 않게)
        const accTrades = trades.filter(t => t.accountId === acc.id);
        const net = accTrades.reduce((t, x) => t + tradeNet(x), 0);
        const contribution = withContribution ? acc.contribution : 0;
        const accBudget = Math.max(contribution + net, 0);
        const stats = statsOf(acc.holdings);
        const items = missing.length === 0 && dupCodes.length === 0 && (stats.evalAmt > 0 || accBudget > 0)
          ? rebalancePlan(
              // 금액으로 입력한 예수금·펀드는 합계엔 들어가지만 매매 대상은 아님 (목표 0%라 '전량 매도'로 나옴)
              acc.holdings.filter(h => !(h.manualValue != null && !h.stockCode)).map(h => ({ id: h.holdingId, value: h.evalAmt ?? 0, weight: h.holdingTargetPct, price: h.currentPrice })),
              accBudget, view.rebalanceThreshold, { sell: allowSell })
          : [];
        const actions = items.filter(i => i.action !== 'HOLD')
          .sort((x, y) => (x.action === y.action ? y.amount - x.amount : x.action === 'SELL' ? -1 : 1));
        return { acc, missing, dupCodes, contribution, accBudget, accTrades, stats, items, actions };
      })
    : [];
  const planById: Record<number, PlanItem> = {};
  plans.forEach(pl => pl.items.forEach(i => { planById[i.id] = i; }));
  const allActions = plans.flatMap(pl => pl.actions);
  const sellTotal = allActions.filter(i => i.action === 'SELL').reduce((t, i) => t + i.amount, 0);
  const buyTotal = allActions.filter(i => i.action === 'BUY').reduce((t, i) => t + i.amount, 0);
  const sellCount = allActions.filter(i => i.action === 'SELL').length;
  const buyCount = allActions.filter(i => i.action === 'BUY').length;
  const todoCount = sellCount + buyCount;

  // ── 테마 모드: 테마가 있으면 비중·리밸런싱을 테마 기준으로 ──
  const themes = (view.themes ?? []).map(t => ({ id: t.id, name: t.name, targetPct: t.targetPct, cash: !!t.cash, satellite: !!t.satellite }));
  const themeMode = themes.length > 0 && rebalance; // 기록 모드면 테마가 있어도 목표 비중 화면을 안 씀
  const isCashTheme = (id: number | null) => themes.some(t => t.id === id && t.cash);
  const themeHoldings = view.accounts.flatMap(acc => acc.holdings.map(h => ({
    holdingId: h.holdingId, accountId: acc.id, ticker: h.ticker, themeId: h.themeId,
    evalAmt: h.evalAmt, purchaseAmt: h.purchaseAmt, profitPct: h.profitPct, shares: h.shares, currentPrice: h.currentPrice,
  })));
  // 꺼진 계좌는 돈도 안 들어오고 매매도 안 함 — 종목 평가금액은 themeHoldings로 테마 비중에만 들어감
  const themeAccounts = view.accounts.filter(acc => acc.active !== false).map(acc => {
    const net = trades.filter(t => t.accountId === acc.id).reduce((t, x) => t + tradeNet(x), 0);
    const contribution = withContribution ? acc.contribution : 0;
    return { id: acc.id, name: acc.name, type: acc.type, contribution, budget: Math.max(contribution + net, 0), tradeCount: trades.filter(t => t.accountId === acc.id).length };
  });
  const blockers: Blocker[] = [];
  if (themeMode) {
    view.accounts.forEach(acc => {
      const dup = acc.active === false ? [] : duplicateCodes(acc.holdings);
      if (dup.length) blockers.push({ accountId: acc.id, kind: 'duplicate', text: `${acc.name}: 같은 종목이 두 줄 (${dup.join(', ')})` });
      const noPrice = acc.holdings.filter(h => (h.shares ?? 0) > 0 && h.evalAmt == null && !isCashTheme(h.themeId));
      if (noPrice.length) blockers.push({ accountId: acc.id, kind: 'price', text: `${acc.name}: 현재가 없는 종목 — ${noPrice.map(h => h.ticker).join(', ')} (종목코드를 넣으면 시세가 들어와요)` });
    });
  }
  const themePlan = themeMode && isLive && blockers.length === 0
    ? rebalanceByTheme(
        themes,
        themeHoldings.map(h => ({
          id: h.holdingId, accountId: h.accountId, themeId: h.themeId, value: h.evalAmt ?? 0,
          price: isCashTheme(h.themeId) ? null : h.currentPrice,
          shares: h.shares, cost: h.purchaseAmt,
        })),
        themeAccounts.map(a => ({ id: a.id, budget: a.budget })),
        view.rebalanceThreshold, { sell: allowSell, feeRate, buffer: priceBuffer, style: pickStyle, profitTake })
    : null;
  const openTrade = (holdingId: number, side: 'BUY' | 'SELL', shares: number | null) => {
    const h = holdingById[holdingId];
    if (!h) return;
    setTradeSheet({ holdingId, side, shares: shares ? String(shares) : '', price: h.currentPrice ? fmt(h.currentPrice) : '', suggested: shares });
  };

  // 이번 달 체결 내역 — 종목별 가장 최근 체결만 되돌리기 가능 (계좌 모드·테마 모드 공통)
  const tradeHistory = trades.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">이번 달 체결 내역</p>
              <ul className="divide-y divide-slate-50 dark:divide-dark-border/50">
                {trades.map(t => {
                  const st = ACTION_STYLE[t.side];
                  const latest = trades.find(x => x.holdingId === t.holdingId)?.id === t.id;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2 min-w-0">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.chip}`}>{st.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{t.ticker}</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">{t.tradeDate.slice(5).replace('-', '/')} · {t.shares}주 × {fmt(t.price)}원</p>
                      </div>
                      <p className={`text-sm font-semibold tabular-nums shrink-0 ${st.text}`}>{t.side === 'SELL' ? '−' : '+'}{fmt(t.amount)}원</p>
                      {latest && (
                        <button onClick={() => undoTrade(t)} className="shrink-0 h-11 sm:h-8 px-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">되돌리기</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );

  return (
    <div className="space-y-5">
      <PageHeader right={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isLive && <LiveBadge status={quoteStatus} streaming={streaming} hasCodes={hasCodes} />}
          {monthPicker}
        </div>
      } />

      {/* ── 처음 한 번: 목표 비중을 맞추는 사람인지 물어봄 (안 고른 새 사용자만) ── */}
      {data.rebalanceModeChosen === false && (
        <section className={`${CARD} p-4 sm:p-5`}>
          <p className="text-base font-bold text-slate-900 dark:text-dark-text">목표 비중을 정해 두고 맞추시나요?</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            예: '미국 지수 50%, 국내 30%, 현금 20%'처럼 정해 두고 매달 모자란 쪽을 사는 방식이에요.
            켜면 내가 정한 비중으로 이번 달 사고팔 수량을 계산해 드려요. 아니면 보유 종목·평가금액·손익만 기록해요.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={() => chooseMode(true)} disabled={choosingMode}
              className="h-11 px-4 rounded-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold">네, 맞춰요</button>
            <button onClick={() => chooseMode(false)} disabled={choosingMode}
              className="h-11 px-4 rounded-full bg-slate-100 dark:bg-slate-800 disabled:opacity-50 text-sm font-medium text-slate-600 dark:text-slate-300">아니요, 기록만 할게요</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">나중에 내 계좌 › 투자 › 기본 설정에서 바꿀 수 있어요. 종목은 추천하지 않아요.</p>
        </section>
      )}

      {/* ── 기록 모드: 이번 달 체결 내역만 (종목 행 '매매'로 기록) ── */}
      {!rebalance && isCurrentMonth && trades.length > 0 && (
        <section className={`${CARD} p-4 sm:p-5 [&>div]:mt-0`}>{tradeHistory}</section>
      )}

      {/* ── 이번 달 할 일: 리밸런싱 추천 → 증권 앱에서 실행 → 체결 완료(보유 수량·평균단가 자동 반영) ── */}
      {themeMode && isLive && (
        <ThemeTodo preview={isPreview ? Number(ym.slice(5)) : null} themes={themes} holdings={themeHoldings} accounts={themeAccounts} plan={themePlan} blockers={blockers}
          threshold={view.rebalanceThreshold} monthlyBudget={view.monthlyBudget}
          withContribution={withContribution} onToggleContribution={() => setWithContribution(v => !v)}
          allowSell={allowSell} onToggleSell={toggleAllowSell} onTrade={openTrade}
          feeRate={feeRate} priceBuffer={priceBuffer} onSaveCosts={saveTradeCosts}
          pickStyle={pickStyle} profitTake={profitTake} onSaveStyle={saveStyle}>
          {tradeHistory}
        </ThemeTodo>
      )}
      {!themeMode && plans.length > 0 && (
        <section className={`${CARD} p-4 sm:p-5`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 dark:text-dark-text">{isPreview ? `${Number(ym.slice(5))}월 할 일 미리 보기` : '이번 달 할 일'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {todoCount > 0
                  ? <>매도 {sellCount}건 · 매수 {buyCount}건{trades.length > 0 && ` · 체결 ${trades.length}건 완료`}</>
                  : trades.length > 0 ? `이번 달 체결 ${trades.length}건 완료 — 남은 할 일 없음` : `목표 비중 ±${view.rebalanceThreshold}%p 기준으로 계산해요`}
              </p>
            </div>
            {view.monthlyBudget > 0 && (
              <button onClick={() => setWithContribution(v => !v)} aria-pressed={withContribution}
                className={`shrink-0 h-11 sm:h-9 px-3.5 rounded-full text-xs font-medium transition-colors ${
                  withContribution ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                {withContribution ? '✓ ' : ''}이번 달 납입금 {fmt(view.monthlyBudget)}원 포함
              </button>
            )}
          </div>

          {(sellTotal > 0 || buyTotal > 0) && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-blue-50/70 dark:bg-blue-900/10 px-3 py-2.5 min-w-0">
                <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80">팔 금액</p>
                <p className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400 truncate">{fmt(sellTotal)}원</p>
              </div>
              <div className="rounded-xl bg-rose-50/70 dark:bg-rose-900/10 px-3 py-2.5 min-w-0">
                <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">살 금액</p>
                <p className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400 truncate">{fmt(buyTotal)}원</p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {plans.map(({ acc, missing, dupCodes, contribution, accBudget, accTrades, stats, actions, items }) => (
              <div key={acc.id} className="rounded-xl ring-1 ring-slate-100 dark:ring-dark-border/60 p-3">
                <div className="flex items-baseline justify-between gap-3 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate min-w-0">{acc.name}</p>
                  <p className="text-xs tabular-nums shrink-0">
                    {stats.evalAmt > 0 && <span className="text-slate-500 dark:text-slate-400">{fmt(stats.evalAmt)}원 </span>}
                    {stats.profitPct !== null && <span className={`font-semibold ${profitColor(stats.profitPct)}`}>{fmtPct(stats.profitPct)}</span>}
                  </p>
                </div>
                {(contribution > 0 || accTrades.length > 0) && (
                  <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                    쓸 수 있는 돈 {fmt(accBudget)}원{accTrades.length > 0 && ' (이번 달 체결 반영)'}
                  </p>
                )}

                {dupCodes.length > 0 ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 px-3 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400 min-w-0">같은 종목이 두 줄로 등록돼 있어 계산할 수 없어요 ({dupCodes.join(', ')})</p>
                    <Link to="/accounts?tab=invest" className="shrink-0 h-11 sm:h-9 px-3 inline-flex items-center rounded-full bg-amber-500 text-white text-xs font-medium">설정에서 합치기</Link>
                  </div>
                ) : missing.length > 0 ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 px-3 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-400 min-w-0">
                      현재가가 없는 종목 {missing.length}개 — {missing.map(h => h.ticker).join(', ')}
                    </p>
                    <button onClick={() => openSheet(acc)} className="shrink-0 h-11 sm:h-9 px-3 rounded-full bg-amber-500 text-white text-xs font-medium">현재가 입력</button>
                  </div>
                ) : items.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">보유 수량과 현재가를 입력하면 추천이 나와요</p>
                ) : actions.length === 0 ? (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">✓ 목표 비중 ±{view.rebalanceThreshold}%p 안이에요 — 이번 달은 그대로 두세요</p>
                ) : (
                  <ul className="mt-1 divide-y divide-slate-50 dark:divide-dark-border/50">
                    {actions.map(it => {
                      const h = holdingById[it.id];
                      const st = ACTION_STYLE[it.action as 'BUY' | 'SELL'];
                      return (
                        <li key={it.id} className="flex items-center gap-3 py-2.5 min-w-0">
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${st.chip}`}>{st.label}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 break-all" title={h?.ticker}>{h?.ticker}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              {h?.profitPct != null && <span className={profitColor(h.profitPct)}>수익률 {fmtPct(h.profitPct)} · </span>}
                              비중 {it.currentPct.toFixed(1)}% → {it.afterPct.toFixed(1)}% <span className="text-slate-300 dark:text-slate-600">(목표 {it.targetPct.toFixed(1)}%)</span>
                            </p>
                            {it.action === 'SELL' && it.targetPct === 0 && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400">목표 비중이 0%라 전량 매도로 계산됐어요 — 투자 설정 확인</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold tabular-nums ${st.text}`}>{it.shares ? `${it.shares}주` : `${fmt(it.amount)}원`}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">{it.shares ? `${fmt(it.amount)}원` : it.shares === 0 ? '1주 미만' : ''}</p>
                          </div>
                          {h && !isPreview && (
                            <button onClick={() => setTradeSheet({
                                holdingId: h.holdingId, side: it.action as 'BUY' | 'SELL',
                                shares: it.shares ? String(it.shares) : '', price: h.currentPrice ? fmt(h.currentPrice) : '',
                                suggested: it.shares,
                              })}
                              className="shrink-0 h-11 sm:h-9 px-3 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700">
                              체결 완료
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {tradeHistory}
          <p className="text-[11px] text-slate-400 mt-3">
            증권 앱에서 실행한 뒤 '체결 완료'를 누르면 보유 수량·평균단가가 자동으로 바뀌고 추천이 다시 계산돼요. 계좌 안에서만 사고팔고, 세금·수수료는 빠진 참고값이에요.
          </p>
        </section>
      )}

      {/* ── 상단: 총 평가금액 + 비중 도넛 ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={`${CARD} p-5 sm:p-6 flex flex-col gap-5`}>
          <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">총 평가금액</p>
          {hasEval ? (
            <>
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-dark-text mt-1">
                {fmt(totalEval)}<span className="text-lg font-semibold ml-0.5">원</span>
              </p>
              {totalProfit !== null && totalProfitPct !== null && (
                <p className={`text-sm font-semibold tabular-nums mt-1 ${profitColor(totalProfit)}`}>
                  {fmtSigned(totalProfit)}원 ({fmtPct(totalProfitPct)})
                </p>
              )}
              {totalPurchase > 0 && <p className="text-xs text-slate-400 mt-1 tabular-nums">원금 {fmt(totalPurchase)}원</p>}
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-300 dark:text-slate-600 mt-1">—</p>
              <p className="text-xs text-slate-400 mt-1">종목의 현재가를 입력하면 평가금액과 손익이 계산돼요</p>
            </>
          )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-auto pt-5 border-t border-slate-100 dark:border-dark-border/60">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">이달 납입</p>
              <p className="text-base font-bold tabular-nums text-slate-800 dark:text-dark-text truncate mt-0.5">{fmt(data.totalActual)}원</p>
              <div className="mt-2"><Progress value={overallRate} tone={overallRate >= 100 ? 'bg-emerald-500' : 'bg-primary-500'} /></div>
              <p className="text-[11px] text-slate-400 mt-1 tabular-nums truncate">목표 {fmt(data.totalPlanned)}원 · {Math.round(overallRate)}%</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">세액공제 남은 한도</p>
              <p className={`text-base font-bold tabular-nums truncate mt-0.5 ${pensionRemaining === 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-dark-text'}`}>
                {pensionRemaining === 0 ? '한도 채움 🎉' : `${fmt(pensionRemaining)}원`}
              </p>
              <div className="mt-2"><Progress value={pensionRate} tone="bg-violet-500" /></div>
              <p className="text-[11px] text-slate-400 mt-1 tabular-nums truncate">올해 {fmt(data.pensionYtdActual)} / {fmt(data.pensionLimit)}원</p>
            </div>
          </div>
        </div>

        {themeMode ? (
          // 테마 모드: 도넛도 테마 단위 (현재 vs 목표)
          <div className={`${CARD} p-5 sm:p-6`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-dark-text">테마 비중</p>
              <p className="text-xs text-slate-400">현재 · 목표</p>
            </div>
            {(() => {
              const val = (id: number) => themeHoldings.filter(h => h.themeId === id).reduce((t, h) => t + (h.evalAmt ?? 0), 0);
              const sum = themes.reduce((t, th) => t + val(th.id), 0);
              const tSlices = themes.map(th => ({ id: th.id, name: th.name, value: sum > 0 ? val(th.id) : th.targetPct })).filter(x => x.value > 0);
              return (
                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie key={tSlices.map(d => d.name).join(',')} data={tSlices} dataKey="value" nameKey="name"
                          innerRadius="62%" outerRadius="100%" paddingAngle={tSlices.length > 1 ? 2 : 0} stroke="none">
                          {tSlices.map(x => <Cell key={x.id} fill={themeColor(themes, x.id)} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex-1 min-w-0 space-y-2">
                    {themes.map(th => {
                      const cur = sum > 0 ? (val(th.id) / sum) * 100 : 0;
                      const off = Math.abs(cur - th.targetPct) > view.rebalanceThreshold;
                      return (
                        <li key={th.id} className="flex items-center gap-2 text-xs min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: themeColor(themes, th.id) }} />
                          <span className="truncate flex-1 text-slate-600 dark:text-slate-300">{th.name}</span>
                          <span className={`tabular-nums font-semibold shrink-0 ${off ? 'text-amber-500' : 'text-slate-800 dark:text-dark-text'}`}>{cur.toFixed(1)}%</span>
                          <span className="tabular-nums text-slate-400 shrink-0 w-12 text-right">{th.targetPct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}
          </div>
        ) : (
        <div className={`${CARD} p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-dark-text">{hasEval || !rebalance ? '현재 비중' : '목표 비중'}</p>
            {rebalance && <p className="text-xs text-slate-400">목표 대비</p>}
          </div>
          {slices.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">{rebalance ? '종목 비중을 설정해주세요' : '현재가가 들어오면 종목별 비중이 보여요'}</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie key={slices.map(d => d.name).join(',')} data={slices} dataKey="value" nameKey="name"
                      innerRadius="62%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="none">
                      {slices.map(s => <Cell key={s.id} fill={colorOf[s.id]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 min-w-0 space-y-2">
                {allHoldings.map(h => {
                  const cur = hasEval ? h.currentPct : rebalance ? h.overallTargetPct : 0;
                  return (
                    <li key={h.holdingId} className="flex items-center gap-2 text-xs min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf[h.holdingId] }} />
                      <span className="truncate flex-1 text-slate-600 dark:text-slate-300">{h.ticker}</span>
                      <span className={`tabular-nums font-semibold shrink-0 ${rebalance && h.rebalanceNeeded ? 'text-amber-500' : 'text-slate-800 dark:text-dark-text'}`}>{cur.toFixed(1)}%</span>
                      {hasEval && rebalance && <span className="tabular-nums text-slate-400 shrink-0 w-12 text-right">{h.overallTargetPct.toFixed(1)}%</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── 테마별 비중·종목 (테마 모드) ── */}
      {themeMode && (
        <ThemeBreakdown themes={themes} holdings={themeHoldings} plan={themePlan} threshold={view.rebalanceThreshold}
          accountName={id => view.accounts.find(a => a.id === id)?.name ?? ''} />
      )}

      {/* ── 계좌별 보유 종목 ── */}
      {/* 꺼진 계좌는 맨 아래로 (정렬은 안정 정렬이라 나머지 순서 유지) */}
      {[...view.accounts].sort((a, b) => Number(a.active === false) - Number(b.active === false)).map(acc => {
        const allPaid = acc.holdings.length > 0 && acc.holdings.every(h => h.isPaid);
        const st = statsOf(acc.holdings);
        const off = acc.active === false;

        return (
          <section key={acc.id} className={`${CARD} overflow-hidden`}>
            <div className="px-4 sm:px-5 pt-4 pb-3 space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-medium px-3 py-1 rounded-full shrink-0 ${off ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : TYPE_BADGE[acc.type] ?? TYPE_BADGE.GENERAL}`}>{accountTypeLabel(acc.type)}</span>
                <h2 className={`font-semibold truncate flex-1 min-w-0 ${off ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-dark-text'}`}>{acc.name}</h2>
                <button type="button" role="switch" aria-checked={!off} aria-label={`${acc.name} 사용`}
                  onClick={() => toggleAccount(acc)} disabled={togglingAcc === acc.id}
                  className="h-11 shrink-0 -my-1 flex items-center gap-1.5 px-1 disabled:opacity-50">
                  <span className={`text-xs font-medium ${off ? 'text-slate-400' : 'text-primary-600 dark:text-primary-400'}`}>{off ? '꺼짐' : '사용'}</span>
                  <span className={`relative w-11 h-6 rounded-full transition-colors ${off ? 'bg-slate-300 dark:bg-slate-600' : 'bg-primary-600'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${off ? '' : 'translate-x-5'}`} />
                  </span>
                </button>
                {!off && <button onClick={() => openSheet(acc)}
                  className="shrink-0 h-11 sm:h-9 px-4 -my-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  입력
                </button>}
              </div>
              {off && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  꺼진 계좌예요 — 이번 달 할 일·납입·리밸런싱 추천에서 빠지고, 평가금액만 합계에 들어가요. 오른쪽 스위치로 다시 켤 수 있어요
                </p>
              )}
              <div className={`space-y-2 ${off ? 'opacity-50' : ''}`}>
              <p className={`text-[11px] ${LIQUIDITY_TEXT[liquidityOf(acc.type).level]}`} title={LIQUIDITY_DISCLAIMER}>
                <span className="font-semibold">{liquidityOf(acc.type).label}</span> · {liquidityOf(acc.type).note}
              </p>
              {/* 계좌 목적·쓸 날짜 — 날짜가 가까운데 위험자산이 많으면 안내 (날짜 없으면 안내 안 함) */}
              {acc.purpose && !off && (() => {
                const g = checkGoal(acc.purpose, acc.targetDate,
                  acc.holdings.map(h => ({ value: h.evalAmt ?? 0, safe: isSafeHolding(h, isCashTheme(h.themeId)) })));
                return (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      목적 <span className="font-semibold">{purposeLabel(acc.purpose)}</span>
                      {acc.purpose !== 'RETIRE' && (acc.targetDate
                        ? <> · {acc.targetDate} 사용 예정{g && g.months >= 0 ? ` (${g.months}개월 남음)` : ''}</>
                        : ' · 쓸 때 미정')}
                    </p>
                    {g?.over && (
                      <p className="rounded-lg bg-amber-50 dark:bg-amber-900/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" title={LIQUIDITY_DISCLAIMER}>
                        쓸 날까지 {Math.max(g.months, 0)}개월 — 위험자산이 {g.riskyPct.toFixed(0)}%예요. 흔히 쓰는 기준은 {g.cap}% 이하예요.
                        새 납입금을 채권·현금성 쪽으로 돌리는 걸 고려해 보세요. (참고용)
                      </p>
                    )}
                  </div>
                );
              })()}
              {/* 계좌 총 평가금액 · 손익 */}
              <div className="flex items-end justify-between gap-3 flex-wrap pt-1">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">평가금액</p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-dark-text truncate">
                    {st.evalAmt > 0 ? <>{fmt(st.evalAmt)}<span className="text-base font-semibold ml-0.5">원</span></> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </p>
                </div>
                {st.profit !== null && st.profitPct !== null ? (
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold tabular-nums ${profitColor(st.profit)}`}>{fmtPct(st.profitPct)}</p>
                    <p className={`text-xs font-medium tabular-nums ${profitColor(st.profit)}`}>{fmtSigned(st.profit)}원</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 shrink-0">현재가를 입력하면 손익이 나와요</p>
                )}
              </div>
              <p className="text-xs text-slate-400 tabular-nums truncate">
                {st.purchase > 0 && `원금 ${fmt(st.purchase)}원${off ? '' : ' · '}`}
                {!off && <>
                  {allPaid ? <span className="text-emerald-500 font-medium">✓ 납입 완료 </span> : '이달 납입 '}
                  {fmt(acc.accountActualAmt)} / {fmt(acc.accountPlannedAmt)}원
                </>}
              </p>
              </div>
            </div>

            {/* 데스크탑 컬럼 라벨 */}
            <div className={off ? 'opacity-50' : ''}>
            <div className="hidden xl:flex items-center gap-4 px-5 py-2 bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400">
              <span className="flex-1">종목</span>
              <span className="w-20 text-right">보유 수량</span>
              <span className="w-24 text-right">평균단가</span>
              <span className="w-24 text-right">현재가</span>
              <span className="w-32 text-right">평가금액 · 수익률</span>
              <span className="w-56">이달 납입</span>
            </div>

            <ul className="divide-y divide-slate-50 dark:divide-dark-border/50">
              {acc.holdings.map(h => {
                const rate = h.plannedAmt > 0 ? (h.actualAmt / h.plannedAmt) * 100 : 0;
                const busy = !!savingRecord[h.recordId];
                const paidButton = h.actualAmt > 0 ? (
                  <button onClick={() => togglePaid(h)} disabled={busy}
                    className={`shrink-0 h-11 xl:h-8 px-3 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                      h.isPaid
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                    }`}>
                    {h.isPaid ? '✓ 완료' : '완료 처리'}
                  </button>
                ) : (
                  <button onClick={() => openSheet(acc)}
                    className="shrink-0 h-11 xl:h-8 px-3 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                    미납입
                  </button>
                );

                return (
                  <li key={h.recordId} className="px-4 sm:px-5 py-3 hover:bg-primary-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3 xl:gap-4">
                      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: colorOf[h.holdingId] }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-dark-text truncate" title={h.ticker}>{h.ticker}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate tabular-nums">
                          {planById[h.holdingId] && planById[h.holdingId].action !== 'HOLD' && (() => {
                            const pl = planById[h.holdingId];
                            const sty = ACTION_STYLE[pl.action as 'BUY' | 'SELL'];
                            return <span className={`font-semibold ${sty.text}`}>{sty.label} {pl.shares ? `${pl.shares}주` : `${fmt(pl.amount)}원`} · </span>;
                          })()}
                          <span className="xl:hidden">
                            {h.shares != null ? <span className="font-semibold text-slate-600 dark:text-slate-300">보유 {h.shares}주</span> : h.manualValue != null ? '직접 입력 금액' : '수량 미입력'}
                            {h.avgPurchasePrice != null && ` · 평균 ${fmt(h.avgPurchasePrice)}원`}
                          </span>
                        </p>
                        {h.live && (
                          <p className="xl:hidden text-xs mt-0.5 tabular-nums truncate">
                            <span className="text-slate-500 dark:text-slate-400">현재 {fmt(h.live.price)}원 </span>
                            <span className={profitColor(h.live.changeRate)}>{fmtPct(h.live.changeRate)}</span>
                          </p>
                        )}
                      </div>
                      <p className="hidden xl:block w-20 text-right text-sm font-semibold tabular-nums text-slate-800 dark:text-dark-text">{h.shares != null ? `${h.shares}주` : <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>}</p>
                      <p className="hidden xl:block w-24 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">{h.avgPurchasePrice != null ? `${fmt(h.avgPurchasePrice)}원` : '—'}</p>
                      <div className="hidden xl:block w-24 text-right tabular-nums">
                        <p className="text-sm text-slate-600 dark:text-slate-300">{h.currentPrice != null ? `${fmt(h.currentPrice)}원` : '—'}</p>
                        {h.live && <p className={`text-[11px] ${profitColor(h.live.changeRate)}`}>{fmtPct(h.live.changeRate)}</p>}
                      </div>
                      {!rebalance && isCurrentMonth && !off && !(h.manualValue != null && !h.stockCode) && (
                        <button onClick={() => openTrade(h.holdingId, 'BUY', null)} aria-label={`${h.ticker} 매매 기록`}
                          className="order-last xl:order-none shrink-0 h-11 xl:h-8 px-3 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                          매매
                        </button>
                      )}
                      <div className="text-right shrink-0 xl:w-32">
                        <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-dark-text">{h.evalAmt ? `${fmt(h.evalAmt)}원` : '—'}</p>
                        {h.profitAmt !== null && h.profitPct !== null ? (
                          <p className={`text-sm font-bold tabular-nums ${profitColor(h.profitAmt)}`}>
                            {fmtPct(h.profitPct)} <span className="text-[11px] font-medium">{fmtSigned(h.profitAmt)}</span>
                          </p>
                        ) : <p className="text-xs text-slate-300 dark:text-slate-600">{h.manualValue != null ? '현금·펀드' : '현재가 미입력'}</p>}
                      </div>
                      {/* 데스크탑: 납입 진행을 같은 줄에 */}
                      <div className="hidden xl:flex items-center gap-3 w-56">
                        <div className="flex-1 min-w-0">
                          <Progress value={rate} tone={h.isPaid ? 'bg-emerald-500' : 'bg-primary-500'} />
                          <p className="text-[11px] text-slate-400 mt-1 tabular-nums truncate">{fmt(h.actualAmt)} / {fmt(h.plannedAmt)}원</p>
                        </div>
                        {paidButton}
                      </div>
                    </div>
                    {/* 모바일·태블릿·좁은 데스크탑: 납입 진행을 아래 줄에 */}
                    <div className="xl:hidden flex items-center gap-3 mt-2 pl-4">
                      <div className="flex-1 min-w-0">
                        <Progress value={rate} tone={h.isPaid ? 'bg-emerald-500' : 'bg-primary-500'} />
                        <p className="text-[11px] text-slate-400 mt-1 tabular-nums truncate">이달 {fmt(h.actualAmt)} / {fmt(h.plannedAmt)}원</p>
                      </div>
                      {paidButton}
                    </div>
                  </li>
                );
              })}
            </ul>
            </div>

            {/* 계좌 합계 — 보유 종목 평가금액을 모두 더한 값 */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-dark-border/60 bg-slate-50/80 dark:bg-slate-800/30">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">합계</p>
                <p className="text-[11px] text-slate-400 tabular-nums truncate">
                  {acc.holdings.filter(h => (h.shares ?? 0) > 0).length}개 종목 보유
                  {st.purchase > 0 && ` · 원금 ${fmt(st.purchase)}원`}
                  {acc.holdings.some(h => (h.shares ?? 0) > 0 && h.evalAmt == null) && ' · 현재가 없는 종목 제외'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-dark-text">{st.evalAmt > 0 ? `${fmt(st.evalAmt)}원` : '—'}</p>
                {st.profit !== null && st.profitPct !== null && (
                  <p className={`text-xs font-semibold tabular-nums ${profitColor(st.profit)}`}>{fmtSigned(st.profit)}원 ({fmtPct(st.profitPct)})</p>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* ── 입력 바텀시트 ── */}
      {sheetAcc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSheetAccId(null)}>
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{yy}년 {mm}월 · {accountTypeLabel(sheetAcc.type)}</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text truncate">{sheetAcc.name}</h3>
              </div>
              <button onClick={() => setSheetAccId(null)} aria-label="닫기" className="w-11 h-11 -mr-2 -mt-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl shrink-0">×</button>
            </div>

            <div className="px-6 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-dark-border/60">
              {sheetAcc.holdings.map(h => {
                const e = editing[h.recordId];
                const cp = parseNum(e?.currentPrice);
                const previewEval = cp > 0 && h.shares ? Math.round(cp * h.shares) : null;
                const previewProfit = previewEval !== null && h.purchaseAmt ? previewEval - h.purchaseAmt : null;
                const setField = (key: 'currentPrice' | 'actualAmt', v: string) =>
                  setEditing(prev => ({ ...prev, [h.recordId]: { ...prev[h.recordId], [key]: fmtNum(v) } }));

                return (
                  <div key={h.recordId} className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">{h.ticker}</p>
                        <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                          {h.shares != null && h.avgPurchasePrice != null ? `${h.shares}주 · 평균 ${fmt(h.avgPurchasePrice)}원` : '보유수량·평균단가는 투자 설정에서 입력'}
                        </p>
                      </div>
                      {previewEval !== null && (
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-dark-text">{fmt(previewEval)}원</p>
                          {previewProfit !== null && h.purchaseAmt ? (
                            <p className={`text-xs font-medium tabular-nums ${profitColor(previewProfit)}`}>{fmtPct(previewProfit * 100 / h.purchaseAmt)}</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-xs text-slate-500 dark:text-dark-muted mb-1">현재가</span>
                        <div className="flex items-center h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500">
                          <input type="text" inputMode="numeric" value={e?.currentPrice ?? ''} placeholder="0"
                            onChange={ev => setField('currentPrice', ev.target.value)}
                            className="min-w-0 flex-1 bg-transparent outline-none text-right text-sm tabular-nums dark:text-dark-text" />
                          <span className="text-xs text-slate-400 ml-1">원</span>
                        </div>
                      </label>
                      <label className="block">
                        <span className="block text-xs text-slate-500 dark:text-dark-muted mb-1">이달 납입 <span className="text-slate-400">(목표 {fmt(h.plannedAmt)})</span></span>
                        <div className="flex items-center h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500">
                          <input type="text" inputMode="numeric" value={e?.actualAmt ?? ''} placeholder="0"
                            onChange={ev => setField('actualAmt', ev.target.value)}
                            className="min-w-0 flex-1 bg-transparent outline-none text-right text-sm tabular-nums dark:text-dark-text" />
                          <span className="text-xs text-slate-400 ml-1">원</span>
                        </div>
                      </label>
                    </div>
                    {!e?.actualAmt && h.plannedAmt > 0 && (
                      <button type="button" onClick={() => setField('actualAmt', String(h.plannedAmt))}
                        className="text-xs font-medium text-primary-500 hover:text-primary-600 min-h-[32px]">
                        목표 금액 {fmt(h.plannedAmt)}원 그대로 넣기
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border/60 flex gap-2">
              <button onClick={() => saveSheet(sheetAcc, false)} disabled={savingSheet}
                className="flex-1 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
                임시 저장
              </button>
              <button onClick={() => saveSheet(sheetAcc, true)} disabled={savingSheet}
                className="flex-[1.4] h-12 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {savingSheet ? '저장 중...' : '납입 완료로 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 체결 완료 시트 ── */}
      {tradeSheet && (() => {
        const h = holdingById[tradeSheet.holdingId];
        if (!h) return null;
        const q = parseFloat(tradeSheet.shares);
        const p = parseNum(tradeSheet.price);
        const cur = h.shares ?? 0;
        const valid = q > 0 && p > 0 && (tradeSheet.side === 'BUY' || q <= cur);
        const nextShares = tradeSheet.side === 'BUY' ? cur + (q || 0) : cur - (q || 0);
        const nextAvg = tradeSheet.side === 'BUY' && valid
          ? Math.round(((h.avgPurchasePrice ?? 0) * cur + p * q) / nextShares)
          : h.avgPurchasePrice;
        const st = ACTION_STYLE[tradeSheet.side];
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setTradeSheet(null)}>
            <div className="bg-white dark:bg-dark-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${st.chip}`}>{st.label} 체결 완료</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text mt-1.5 break-all">{h.ticker}</h3>
                  <p className="text-xs text-slate-400 tabular-nums">지금 {cur}주 · 평균 {h.avgPurchasePrice != null ? `${fmt(h.avgPurchasePrice)}원` : '—'}</p>
                </div>
                <button onClick={() => setTradeSheet(null)} aria-label="닫기" className="w-11 h-11 -mr-2 -mt-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl shrink-0">×</button>
              </div>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {(['BUY', 'SELL'] as const).map(sd => (
                  <button key={sd} onClick={() => setTradeSheet({ ...tradeSheet, side: sd })}
                    className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${
                      tradeSheet.side === sd ? `bg-white dark:bg-dark-card shadow-sm ${ACTION_STYLE[sd].text}` : 'text-slate-500'
                    }`}>{ACTION_STYLE[sd].label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-xs text-slate-500 dark:text-dark-muted mb-1">체결 수량{tradeSheet.suggested ? <span className="text-slate-400"> (추천 {tradeSheet.suggested}주)</span> : null}</span>
                  <div className="flex items-center h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500">
                    <input type="text" inputMode="decimal" autoFocus value={tradeSheet.shares} placeholder="0"
                      onChange={e => setTradeSheet({ ...tradeSheet, shares: e.target.value.replace(/[^0-9.]/g, '') })}
                      className="min-w-0 flex-1 bg-transparent outline-none text-right text-sm tabular-nums dark:text-dark-text" />
                    <span className="text-xs text-slate-400 ml-1">주</span>
                  </div>
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-500 dark:text-dark-muted mb-1">체결 단가</span>
                  <div className="flex items-center h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500">
                    <input type="text" inputMode="numeric" value={tradeSheet.price} placeholder="0"
                      onChange={e => setTradeSheet({ ...tradeSheet, price: fmtNum(e.target.value) })}
                      className="min-w-0 flex-1 bg-transparent outline-none text-right text-sm tabular-nums dark:text-dark-text" />
                    <span className="text-xs text-slate-400 ml-1">원</span>
                  </div>
                </label>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm tabular-nums space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">체결 금액</span><span className="font-semibold text-slate-800 dark:text-dark-text">{q > 0 && p > 0 ? `${fmt(Math.round(q * p))}원` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">체결 후 보유</span><span className="font-semibold text-slate-800 dark:text-dark-text">{valid ? `${cur}주 → ${Math.round(nextShares * 1000) / 1000}주` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">체결 후 평균단가</span><span className="font-semibold text-slate-800 dark:text-dark-text">{valid && nextAvg != null ? `${fmt(nextAvg)}원` : '—'}</span></div>
                {tradeSheet.side === 'SELL' && q > cur && <p className="text-xs text-rose-500">보유 수량({cur}주)보다 많이 팔 수 없어요</p>}
              </div>
              <button onClick={saveTrade} disabled={!valid || savingTrade}
                className="w-full h-12 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors">
                {savingTrade ? '반영 중...' : '보유 수량·평균단가에 반영'}
              </button>
            </div>
          </div>
        );
      })()}

      <Toast toast={toast} />
    </div>
  );
};
