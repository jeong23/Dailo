import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Toast, useToast } from '../components/Toast';
import { THEME_COLORS } from '../utils/themeDefaults';
import { currentPrincipal, toYmd } from '../utils/savings';
import { LIQUIDITY_DISCLAIMER, accountTypeLabel, liquidityOf } from '../utils/accountLiquidity';
import { assetGuide } from '../utils/assetGuide';
import { AssetGuidePanel } from '../components/AssetGuidePanel';
import { getCurrentSettleMonth } from '../utils/format';
import { NetWorthTrend, Snapshot } from '../components/NetWorthTrend';

// 자산 현황 (/assets, 옛 /allocation) — 전체 자산을 칸(현금·투자·부동산·적금 …)으로 모아 보고, 맨 아래 '목표 배분'에서 목표 비중 대비 현재를 본다.
//  CASH: 현금 자산 페이지 최신 잔액 / INVEST: 투자 현황 평가금액 합계(시세 반영) / SAVINGS: 적금 현재 원금 합계 / MANUAL: 직접 입력
//  투자 칸 안은 테마 비중(투자 설정 > 테마)으로 한 번 더 나눠 보여줌
//  오른쪽(모바일은 목표 배분 위) 리밸런싱 가이드: 칸 사이 이동 + 투자 안 테마별 매수·줄이기 (utils/assetGuide)
//  기록 모드(투자 설정 '목표 비중 맞추기' 꺼짐): 목표 %·가이드·테마 비중을 숨기고 칸별 금액·비중만 — 투자 방식은 사람마다 달라서
//  순자산 추이: 열 때마다 이번 정산월 스냅샷을 덮어씀(PUT /assets/snapshots/current) — 연동 칸 데이터를 다 불러왔을 때만 (일부 실패면 빠진 값이 0으로 기록돼 그래프가 꺼짐)
//  꺼낼 수 있는 돈 / 묶인 돈: 현금·적금·일반·ISA vs 연금저축·IRP (계좌 종류로 판단 — utils/accountLiquidity), 직접 입력 칸은 제외

interface Bucket { id?: number; name: string; kind: 'CASH' | 'INVEST' | 'SAVINGS' | 'MANUAL'; targetPct: number; manualAmount: number | null; sortOrder?: number }
interface Theme { id: number; name: string; targetPct: number; cash: boolean; satellite?: boolean }
interface Holding { stockCode: string | null; shares: number | null; currentPrice: number | null; evalAmt: number | null; manualValue: number | null; avgPurchasePrice: number | null; themeId: number | null }
interface AccountValue { id: number; name: string; type: string; value: number }

const BUCKET_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4'];
const KIND_LABEL: Record<Bucket['kind'], string> = { CASH: '현금 자산 연동', INVEST: '투자 현황 연동', SAVINGS: '적금 연동', MANUAL: '직접 입력' };
const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const FIELD = 'flex items-center min-w-0 h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500';
const FIELD_INPUT = 'w-full min-w-0 flex-1 bg-transparent outline-none text-sm tabular-nums text-slate-900 dark:text-dark-text placeholder:text-slate-300';
const fmt = (n: number) => Math.round(n).toLocaleString();
const fmtNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v: string) => parseInt(v.replace(/,/g, ''), 10) || 0;
const now = new Date();
const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// 종목 평가금액: 시세(네이버/KIS) > 저장된 현재가 > 직접 입력 금액
const holdingValue = (h: Holding, quotes: Record<string, { price: number }>) => {
  const price = (h.stockCode && quotes[h.stockCode]?.price) || h.currentPrice;
  if (price && h.shares) return price * h.shares;
  // 종목코드·수량 없이 평균단가만 있는 줄은 예수금 금액을 평균단가 칸에 넣은 것 (투자 현황과 같은 처리)
  return h.evalAmt ?? h.manualValue ?? (!h.stockCode && !h.shares ? h.avgPurchasePrice : null) ?? 0;
};

export const AllocationPage = () => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [investTotal, setInvestTotal] = useState<number | null>(null);
  const [savingsTotal, setSavingsTotal] = useState<number | null>(null);
  const [themes, setThemes] = useState<{ theme: Theme; value: number }[]>([]);
  const [accountValues, setAccountValues] = useState<AccountValue[]>([]);
  // 투자 설정: 비중 맞출 때 팔기 / 리밸런싱 기준(%p) — 가이드가 '팔기' 대신 '새 돈 돌리기'로 안내할지, 테마 밴드
  const [investPrefs, setInvestPrefs] = useState({ allowSell: true, threshold: 5, rebalance: true });
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [editing, setEditing] = useState<Bucket[] | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();
  useEscapeKey(editing !== null, () => setEditing(null));

  // 칸 금액을 종류별로 합쳐 이번 달 스냅샷 저장 → 목록 다시 읽기. 저장 실패해도 화면은 그대로 (목록만 읽음)
  const recordSnapshot = async (bs: Bucket[], v: { cash: number | null; invest: number | null; savings: number | null }, ok: boolean) => {
    const sumOf = (kind: Bucket['kind']) => bs.filter(b => b.kind === kind)
      .reduce((t, b) => t + (kind === 'CASH' ? v.cash ?? 0 : kind === 'INVEST' ? v.invest ?? 0 : kind === 'SAVINGS' ? v.savings ?? 0 : b.manualAmount ?? 0), 0);
    if (ok && bs.length > 0) {
      try {
        await api.put('/assets/snapshots/current', {
          cash: Math.round(sumOf('CASH')), invest: Math.round(sumOf('INVEST')),
          savings: Math.round(sumOf('SAVINGS')), manual: Math.round(sumOf('MANUAL')),
        });
      } catch { /* 기록 실패는 조용히 — 다음에 열 때 다시 */ }
    }
    try { setSnapshots((await api.get('/assets/snapshots')).data.data || []); } catch {}
  };

  const load = async () => {
    const [bRes, cRes, dRes, qRes, sRes] = await Promise.allSettled([
      api.get('/assets/buckets'), api.get(`/cash-assets?settleMonth=${getCurrentSettleMonth()}`),
      api.get(`/invest/dashboard?yearMonth=${currentYm}`), api.get('/invest/quotes'), api.get('/savings'),
    ]);
    let cashValue: number | null = null, investValue: number | null = null, savingsValue: number | null = null;
    if (sRes.status === 'fulfilled') {
      const today = toYmd(new Date());
      // 만기 지난 적금도 아직 안 찾았으면 자산 — 삭제할 때까지 원금 합계에 포함
      savingsValue = (sRes.value.data.data || []).reduce((t: number, s: any) => t + currentPrincipal({ ...s, ratePct: s.ratePct ?? 0 }, today), 0);
      setSavingsTotal(savingsValue);
    }
    if (bRes.status === 'fulfilled') setBuckets(bRes.value.data.data || []);
    if (cRes.status === 'fulfilled') {
      const hist = cRes.value.data.data || [];
      cashValue = hist.length ? hist[hist.length - 1].balance : null;
      setCashBalance(cashValue);
    }
    if (dRes.status === 'fulfilled') {
      const d = dRes.value.data.data;
      setInvestPrefs({ allowSell: d.allowSell !== false, threshold: d.rebalanceThreshold ?? 5, rebalance: d.rebalanceMode !== false });
      const quotes = qRes.status === 'fulfilled' ? qRes.value.data.data?.quotes || {} : {};
      const holdings: Holding[] = (d.accounts || []).flatMap((a: any) => a.holdings);
      investValue = holdings.reduce((s, h) => s + holdingValue(h, quotes), 0);
      setInvestTotal(investValue);
      setAccountValues((d.accounts || []).map((a: any) => ({
        id: a.id, name: a.name, type: a.type,
        value: (a.holdings as Holding[]).reduce((s, h) => s + holdingValue(h, quotes), 0),
      })));
      setThemes((d.themes || []).map((t: Theme) => ({
        theme: t, value: holdings.filter(h => h.themeId === t.id).reduce((s, h) => s + holdingValue(h, quotes), 0),
      })));
    }
    setLoading(false);
    const bs: Bucket[] = bRes.status === 'fulfilled' ? bRes.value.data.data || [] : [];
    const has = (k: Bucket['kind']) => bs.some(b => b.kind === k);
    const ok = bRes.status === 'fulfilled'
      && (!has('CASH') || cRes.status === 'fulfilled')
      && (!has('INVEST') || dRes.status === 'fulfilled')
      && (!has('SAVINGS') || sRes.status === 'fulfilled');
    recordSnapshot(bs, { cash: cashValue, invest: investValue, savings: savingsValue }, ok);
  };
  // 처음 한 번만 불러옴 (load는 매 렌더 새로 만들어지는 함수)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const amountOf = (b: Bucket) => b.kind === 'CASH' ? cashBalance ?? 0 : b.kind === 'INVEST' ? investTotal ?? 0 : b.kind === 'SAVINGS' ? savingsTotal ?? 0 : b.manualAmount ?? 0;
  const total = buckets.reduce((s, b) => s + amountOf(b), 0);
  const slices = buckets.map((b, i) => ({ key: i, name: b.name, value: amountOf(b) })).filter(x => x.value > 0);

  // 꺼낼 수 있는 돈 / 55세까지 묶인 돈 — 투자 칸은 계좌 종류로 나누고, 직접 입력 칸(부동산 등)은 따로
  const lockedAccounts = accountValues.filter(a => !liquidityOf(a.type).accessible && a.value > 0);
  const investLocked = buckets.some(b => b.kind === 'INVEST') ? lockedAccounts.reduce((s, a) => s + a.value, 0) : 0;
  const manualTotal = buckets.filter(b => b.kind === 'MANUAL').reduce((s, b) => s + amountOf(b), 0);
  const accessibleTotal = Math.max(total - investLocked - manualTotal, 0);
  const accessPct = total > 0 ? (accessibleTotal / total) * 100 : 0;
  const lockedPct = total > 0 ? (investLocked / total) * 100 : 0;

  const BUCKET_BAND = 2;
  const guide = assetGuide(
    buckets.map((b, i) => ({ key: String(b.id ?? `i${i}`), name: b.name, kind: b.kind, amount: amountOf(b), targetPct: b.targetPct })),
    themes.map(t => ({ id: t.theme.id, name: t.theme.name, value: t.value, targetPct: t.theme.targetPct, cash: t.theme.cash, satellite: !!t.theme.satellite })),
    { band: BUCKET_BAND, themeBand: investPrefs.threshold, allowSell: investPrefs.allowSell },
  );

  const rebalance = investPrefs.rebalance;
  const editSum = editing?.reduce((s, b) => s + (b.targetPct || 0), 0) ?? 0;
  const editErr = editing && (rebalance && Math.abs(editSum - 100) > 0.1 ? `목표 합계가 ${editSum.toFixed(1)}%예요` : editing.some(b => !b.name.trim()) ? '이름 없는 칸이 있어요' : null);
  const save = async () => {
    if (!editing || editErr) return;
    setSaving(true);
    try {
      // 기록 모드는 목표 % 칸이 없음 — 서버는 합계 100을 요구하니 칸을 빼고 더해 어긋났으면 균등으로 채움
      const even = editing.length > 0 && Math.abs(editSum - 100) > 0.1 ? Math.floor(1000 / editing.length) / 10 : null;
      const r = await api.post('/assets/buckets', editing.map((b, i) => ({
        ...b, name: b.name.trim(), sortOrder: i,
        targetPct: even == null ? b.targetPct : i === 0 ? Math.round((100 - even * (editing.length - 1)) * 10) / 10 : even,
      })));
      setBuckets(r.data.data);
      setEditing(null);
      recordSnapshot(r.data.data, { cash: cashBalance, invest: investTotal, savings: savingsTotal }, true);
      show('저장했어요');
    } catch (e: any) {
      show(e?.response?.data?.message || '저장에 실패했어요', 'error');
    } finally { setSaving(false); }
  };
  const patch = (i: number, p: Partial<Bucket>) => setEditing(prev => prev && prev.map((b, idx) => idx === i ? { ...b, ...p } : b));

  return (
    <div className="space-y-5 max-w-3xl xl:max-w-6xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">현금 · 투자 · 부동산 · 적금 — 내 돈이 지금 어디에 얼마</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">자산 현황</h1>
        </div>
        <button onClick={() => setEditing(buckets.map(b => ({ ...b })))}
          className="h-11 px-4 rounded-full bg-white dark:bg-dark-card shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600">
          {rebalance ? '목표·금액 수정' : '칸·금액 수정'}
        </button>
      </div>

      {loading ? (
        <div className={`${CARD} h-64 animate-pulse`} />
      ) : (
        // xl: 왼쪽 자산·목표 배분 / 오른쪽 sticky 가이드. 모바일 순서: 요약 → 가이드 → 목표 배분 (grid-cols-1 필수 — 가로 스크롤 방지)
        <div className={`grid grid-cols-1 gap-5 items-start ${rebalance ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
          <div className="space-y-5 min-w-0 xl:col-start-1">
          {/* 전체 자산 + 도넛 */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">전체 자산</p>
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-dark-text mt-1">{fmt(total)}<span className="text-lg font-semibold ml-0.5">원</span></p>
            <div className="mt-4 flex items-center gap-5">
              <div className="w-28 h-28 sm:w-36 sm:h-36 shrink-0">
                {slices.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie key={slices.map(x => x.name).join(',')} data={slices} dataKey="value" nameKey="name"
                        innerRadius="62%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="none">
                        {slices.map(x => <Cell key={x.key} fill={BUCKET_COLORS[x.key % BUCKET_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <ul className="flex-1 min-w-0 space-y-2">
                {buckets.map((b, i) => {
                  const cur = total > 0 ? (amountOf(b) / total) * 100 : 0;
                  return (
                    <li key={b.id ?? i} className="flex items-center gap-2 text-sm min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BUCKET_COLORS[i % BUCKET_COLORS.length] }} />
                      <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{b.name}</span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-dark-text">{cur.toFixed(1)}%</span>
                      {rebalance && <span className="tabular-nums text-xs text-slate-400 w-12 text-right">{b.targetPct}%</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* 꺼낼 수 있는 돈 vs 묶인 돈 — 결혼·집처럼 55세 전에 쓸 목돈 기준 */}
          {total > 0 && (
            <section className={`${CARD} p-5 sm:p-6`}>
              <p className="text-sm font-semibold text-slate-900 dark:text-dark-text">지금 꺼내 쓸 수 있는 돈</p>
              <p className="text-xs text-slate-400 mt-0.5">결혼·집처럼 55세 전에 쓸 목돈 기준</p>
              <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                <div className="bg-emerald-500" style={{ width: `${accessPct}%` }} />
                <div className="bg-slate-400 dark:bg-slate-500" style={{ width: `${lockedPct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />꺼낼 수 있는 돈</p>
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text truncate">{fmt(accessibleTotal)}원</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">{accessPct.toFixed(0)}% · 현금·적금·일반·ISA</p>
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />55세까지 묶인 돈</p>
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-dark-text truncate">{fmt(investLocked)}원</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">{lockedPct.toFixed(0)}% · 연금저축·IRP</p>
                </div>
              </div>
              {lockedAccounts.length > 0 && (
                <ul className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-border/60 space-y-1.5">
                  {lockedAccounts.map(a => (
                    <li key={a.id} className="text-xs min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">{accountTypeLabel(a.type)}</span>
                        <span className="truncate text-slate-400 flex-1 min-w-0">{a.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-700 dark:text-slate-200">{fmt(a.value)}원</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{liquidityOf(a.type).note}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
                적금·청약은 꺼낼 수 있지만 해지하면 이자·정부 기여금·청약 자격을 잃을 수 있어요.
                {manualTotal > 0 && ` 직접 입력 칸(${fmt(manualTotal)}원)은 계산에서 뺐어요.`} {LIQUIDITY_DISCLAIMER}
              </p>
            </section>
          )}

          <NetWorthTrend snapshots={snapshots} className={`${CARD} p-5 sm:p-6`} />

          </div>

          {rebalance && (
          <div className="min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-4">
            <AssetGuidePanel guide={guide} band={BUCKET_BAND} themeBand={investPrefs.threshold} allowSell={investPrefs.allowSell}
              themeOrder={themes.map(t => t.theme.id)} hasThemes={themes.length > 0} />
          </div>
          )}

          {/* 목표 배분 — 칸별 현재 vs 목표, 얼마나 옮겨야 하는지 */}
          <section className="space-y-3 min-w-0 xl:col-start-1">
            <div className="flex items-end justify-between gap-2 px-1 pt-2">
              <h2 className="text-base font-semibold text-slate-800 dark:text-dark-text">{rebalance ? '목표 배분' : '칸별 자산'}</h2>
              <p className="text-xs text-slate-400">{rebalance ? '목표 대비 모자람·넘침' : '전체 자산 대비 비중'}</p>
            </div>
            {buckets.map((b, i) => {
              const amount = amountOf(b);
              const cur = total > 0 ? (amount / total) * 100 : 0;
              const gap = total * (b.targetPct / 100) - amount; // + 모자람 / − 넘침
              const color = BUCKET_COLORS[i % BUCKET_COLORS.length];
              const missing = (b.kind === 'CASH' && cashBalance === null) || (b.kind === 'MANUAL' && b.manualAmount == null) || (b.kind === 'SAVINGS' && !savingsTotal);
              return (
                <div key={b.id ?? i} className={`${CARD} p-4 sm:p-5`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <p className="text-base font-bold text-slate-900 dark:text-dark-text truncate flex-1 min-w-0">{b.name}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">{KIND_LABEL[b.kind]}</span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-dark-text truncate">{fmt(amount)}원</p>
                      <p className="text-xs text-slate-400 tabular-nums">현재 {cur.toFixed(1)}%{rebalance && ` · 목표 ${b.targetPct}%`}</p>
                    </div>
                    {rebalance && total > 0 && !missing && Math.abs(gap) >= 1 && (
                      <p className={`text-sm font-semibold tabular-nums shrink-0 ${gap > 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                        {gap > 0 ? `${fmt(gap)}원 부족` : `${fmt(-gap)}원 초과`}
                      </p>
                    )}
                  </div>
                  <div className="relative mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(cur, 100)}%`, background: color }} />
                    {rebalance && <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-500 dark:bg-slate-300" style={{ left: `${Math.min(b.targetPct, 100)}%` }} />}
                  </div>
                  {missing && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      {b.kind === 'CASH' ? <>현금 자산 기록이 없어요 — <Link to="/cash" className="underline">현금 자산</Link>에서 입력</>
                        : b.kind === 'SAVINGS' ? <>등록된 적금이 없어요 — <Link to="/savings" className="underline">적금</Link>에서 추가</>
                        : <>금액이 비어 있어요 — 위의 '목표·금액 수정'에서 입력</>}
                    </p>
                  )}
                  {b.kind === 'INVEST' && rebalance && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-border/60">
                      {themes.length > 0 ? (
                        <>
                          <div className="h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                            {themes.map((t, ti) => amount > 0 && t.value > 0
                              ? <div key={t.theme.id} style={{ width: `${(t.value / amount) * 100}%`, background: THEME_COLORS[ti % THEME_COLORS.length] }} />
                              : null)}
                          </div>
                          <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                            {themes.map((t, ti) => (
                              <li key={t.theme.id} className="flex items-center gap-1.5 text-xs min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: THEME_COLORS[ti % THEME_COLORS.length] }} />
                                <span className="truncate text-slate-500 dark:text-slate-400">{t.theme.name}</span>
                                <span className="ml-auto tabular-nums text-slate-700 dark:text-slate-200">{amount > 0 ? ((t.value / amount) * 100).toFixed(0) : 0}%</span>
                                <span className="tabular-nums text-slate-400">/{t.theme.targetPct}</span>
                              </li>
                            ))}
                          </ul>
                          <Link to="/invest" className="mt-2 inline-block text-xs font-medium text-primary-500 min-h-[32px] leading-8">투자 현황에서 리밸런싱 →</Link>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">투자 안 비중은 <Link to="/accounts?tab=invest" className="underline">내 계좌 &gt; 투자 &gt; 테마</Link>에서 나눌 수 있어요</p>
                      )}
                    </div>
                  )}
                  {b.kind === 'INVEST' && !rebalance && (
                    <Link to="/invest" className="mt-2 inline-block text-xs font-medium text-primary-500 min-h-[32px] leading-8">투자 현황 →</Link>
                  )}
                  {b.kind === 'CASH' && (
                    <Link to="/cash" className="mt-2 inline-block text-xs font-medium text-primary-500 min-h-[32px] leading-8">현금 자산 →</Link>
                  )}
                  {b.kind === 'SAVINGS' && (
                    <Link to="/savings" className="mt-2 inline-block text-xs font-medium text-primary-500 min-h-[32px] leading-8">적금 →</Link>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* 편집 시트 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text">{rebalance ? '목표·금액 수정' : '칸·금액 수정'}</h3>
              <button onClick={() => setEditing(null)} aria-label="닫기" className="w-11 h-11 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
            </div>
            <div className="px-6 overflow-y-auto flex-1 space-y-3 pb-3">
              {editing.map((b, i) => (
                <div key={i} className="rounded-xl bg-slate-50/70 dark:bg-slate-800/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`${FIELD} flex-1 bg-white`}>
                      <input value={b.name} maxLength={50} placeholder="이름 (예: 부동산)" onChange={e => patch(i, { name: e.target.value })} className={FIELD_INPUT} />
                    </div>
                    {rebalance && <div className={`${FIELD} w-24 bg-white`}>
                      <input inputMode="decimal" value={b.targetPct} onChange={e => patch(i, { targetPct: parseFloat(e.target.value) || 0 })} className={`${FIELD_INPUT} text-right`} />
                      <span className="text-xs text-slate-400 ml-1">%</span>
                    </div>}
                    <button onClick={() => setEditing(prev => prev && prev.filter((_, idx) => idx !== i))} aria-label="삭제"
                      className="w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:text-rose-500 text-lg">×</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-white dark:bg-dark-bg rounded-lg p-1">
                    {(['MANUAL', 'CASH', 'INVEST', 'SAVINGS'] as const).map(k => (
                      <button key={k} onClick={() => patch(i, { kind: k })}
                        className={`h-9 rounded-md text-xs font-medium ${b.kind === k ? 'bg-primary-600 text-white' : 'text-slate-500'}`}>{KIND_LABEL[k]}</button>
                    ))}
                  </div>
                  {b.kind === 'MANUAL' && (
                    <div className={`${FIELD} bg-white`}>
                      <span className="text-xs text-slate-400 mr-2 shrink-0">금액</span>
                      <input inputMode="numeric" placeholder="0" value={b.manualAmount != null ? fmtNum(String(b.manualAmount)) : ''}
                        onChange={e => patch(i, { manualAmount: e.target.value.trim() === '' ? null : parseNum(e.target.value) })}
                        className={`${FIELD_INPUT} text-right`} />
                      <span className="text-xs text-slate-400 ml-1">원</span>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => setEditing(prev => prev && [...prev, { name: '', kind: 'MANUAL', targetPct: Math.max(0, 100 - editSum), manualAmount: null }])}
                className="w-full h-11 rounded-xl border border-dashed border-slate-300 dark:border-dark-border text-sm font-medium text-slate-500">+ 칸 추가</button>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border/60 flex items-center gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <p className={`flex-1 text-xs ${editErr ? 'text-rose-500' : 'text-slate-400'}`}>{editErr ?? (rebalance ? `목표 합계 ${editSum.toFixed(1)}%` : '칸 이름과 직접 입력 금액만 바꿔요')}</p>
              <button onClick={save} disabled={!!editErr || saving}
                className="h-12 px-6 rounded-xl bg-primary-600 text-white text-sm font-bold disabled:opacity-40">{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
};
