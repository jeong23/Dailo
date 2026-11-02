import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { CashAssetEntry } from '../types';
import { formatSignedNumber, parseSignedNumber, getCurrentSettleMonth } from '../utils/format';
import { Toast, useToast } from '../components/Toast';

const currentSettleMonth = getCurrentSettleMonth();

export const EmergencyPage = () => {
  const { toast, show } = useToast();
  const [history, setHistory] = useState<CashAssetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [livingBalance, setLivingBalance] = useState<number | null>(null);
  // 내 계좌 > 현금 계좌가 있으면 이번 달 잔액은 계좌 합계로 자동 기록 → 직접 입력 폼 대신 안내
  const [cashAccountCount, setCashAccountCount] = useState(0);

  // 입력폼 상태 (현재 정산월 기록)
  const [formBalance, setFormBalance] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [surplusApplied, setSurplusApplied] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    return Promise.allSettled([
      api.get(`/cash-assets?settleMonth=${getCurrentSettleMonth()}`),
      api.get(`/dashboard/summary?month=${currentSettleMonth}`),
      api.get(`/cash-accounts?settleMonth=${getCurrentSettleMonth()}`),
    ]).then(([historyRes, summaryRes, accountsRes]) => {
      setCashAccountCount(accountsRes.status === 'fulfilled' ? (accountsRes.value.data.data || []).length : 0);
      if (historyRes.status === 'fulfilled') {
        const list: CashAssetEntry[] = historyRes.value.data.data || [];
        setHistory(list);
        const existing = list.find(h => h.settleMonth === currentSettleMonth);
        if (existing) {
          setFormBalance(formatSignedNumber(existing.balance));
          setFormMemo(existing.memo || '');
        }
      } else {
        console.error('현금 자산 히스토리 로드 실패:', historyRes.reason);
      }
      if (summaryRes.status === 'fulfilled') {
        setLivingBalance(summaryRes.value.data.data?.livingBalance ?? null);
      } else {
        setLivingBalance(null);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>;
  }

  const fmt = (v: number) => v.toLocaleString();
  const sign = (v: number) => (v > 0 ? '+' : '');

  // 전월 대비 증감 계산 (프론트에서 히스토리 순회) — 첫 기록은 비교 대상 없음
  const rows = history.map((h, i) => ({
    ...h,
    diff: i > 0 ? h.balance - history[i - 1].balance : null as number | null,
  }));
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const latestDiff = latest ? latest.diff : null;

  // 직전월(현재 정산월보다 이전) 잔액 — 잉여금 반영 프리필용
  const prevEntryForCurrent = [...history]
    .filter(h => h.settleMonth < currentSettleMonth)
    .sort((a, b) => b.settleMonth.localeCompare(a.settleMonth))[0];
  const prevBalance = prevEntryForCurrent ? prevEntryForCurrent.balance : 0;

  const chartData = history.map(h => ({
    month: h.settleMonth.slice(5),   // MM
    balance: h.balance,
  }));

  const handleApplySurplus = () => {
    if (livingBalance === null) return;
    const newBalance = prevBalance + livingBalance;
    setFormBalance(formatSignedNumber(newBalance));
    setSurplusApplied(newBalance);
  };

  const handleSave = async () => {
    if (!formBalance) return;
    const balanceNum = parseSignedNumber(formBalance);
    setSaving(true);
    try {
      const body: { settleMonth: string; balance: number; memo?: string; livingSurplusApplied?: number } = {
        settleMonth: currentSettleMonth,
        balance: balanceNum,
        memo: formMemo || undefined,
      };
      if (surplusApplied !== null) body.livingSurplusApplied = surplusApplied;
      await api.post('/cash-assets', body);
      show('저장되었습니다!');
      setSurplusApplied(null);
      await fetchAll();
    } catch (error) {
      console.error('현금 자산 저장 실패:', error);
      show('저장 실패', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">통장에 있는 돈 · 달마다 추이</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">현금 자산</h1>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard
          label={latest?.auto ? '이번 달 말 예상 잔액' : '현재 잔액'}
          value={latest ? `${fmt(latest.balance)}원` : '—'}
          color="text-amber-500"
        />
        <SummaryCard
          label="전월 대비 증감"
          value={latestDiff !== null ? `${sign(latestDiff)}${fmt(latestDiff)}원` : '—'}
          color={latestDiff !== null ? (latestDiff < 0 ? 'text-red-500' : 'text-emerald-500') : 'text-slate-400'}
        />
        <SummaryCard label="총 기록 개월수" value={`${history.length}개월`} color="text-primary-500" />
      </div>

      {/* 잔액 추이 차트 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-dark-text">잔액 추이</h3>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}월`} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString()}원`, '잔액']}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  labelFormatter={v => `${v}월`}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#cashGrad)"
                  dot={{ fill: '#f59e0b', r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400 text-sm">
              기록을 등록하면 차트가 나타납니다.
            </div>
          )}
        </div>
      </div>

      {/* 현금 계좌가 있으면: 잔액 = 계좌 기준 잔액 + 지출·수입·월급·고정비 자동 반영 (내 계좌에서 잔액 맞추기) */}
      {cashAccountCount > 0 && (
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold mb-1 dark:text-dark-text">지출·수입이 잔액에 자동 반영돼요</h3>
            <p className="text-sm text-slate-500 dark:text-dark-muted">
              현금 계좌 {cashAccountCount}개 기준 잔액 + 그 뒤 현금·이체 지출과 수입(그날), 카드값(정산월 끝), 적금·청약 납입(납입일), 적금 만기 수령액(만기일), 다음 달 월급 − 고정비
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {currentSettleMonth}은 이번 달 카드값까지 뺀 예상 잔액이에요. 은행 잔액과 다르면 내 계좌에서 실제 잔액으로 맞춰 주세요
            </p>
          </div>
          <Link to="/accounts?tab=cash" className="shrink-0 h-11 px-5 inline-flex items-center justify-center rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">현금 계좌 관리 →</Link>
        </div>
      )}

      {/* 이번 달 생활비 잉여금 반영 + 현금 자산 입력 (현금 계좌가 없을 때 — 예전 방식) */}
      {cashAccountCount === 0 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 잉여금 반영 카드 */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
          <h3 className="text-lg font-semibold mb-1 dark:text-dark-text">이번 달 생활비 잉여금 반영</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{currentSettleMonth} 기준</p>

          {livingBalance !== null ? (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-500 dark:text-dark-muted">이번 달 생활비 잉여금</span>
                <span className={`font-bold tabular-nums ${livingBalance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {sign(livingBalance)}{fmt(livingBalance)}원
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                직전월 잔액 {fmt(prevBalance)}원 + 잉여금 {fmt(livingBalance)}원 = {fmt(prevBalance + livingBalance)}원
              </p>
              <button
                type="button"
                onClick={handleApplySurplus}
                className="w-full py-3 min-h-[44px] bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors"
              >
                반영하기
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-400 py-4">이번 달 예산이 설정되지 않아 잉여금을 계산할 수 없습니다.</p>
          )}
        </div>

        {/* 현금 자산 입력 폼 */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
          <h3 className="text-lg font-semibold mb-1 dark:text-dark-text">현금 자산 기록</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{currentSettleMonth} 잔액을 확인하고 저장하세요</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-dark-muted">잔액</label>
              <input
                type="text"
                value={formBalance}
                onChange={e => setFormBalance(formatSignedNumber(e.target.value))}
                placeholder="예: 5,000,000"
                className="w-full p-2.5 min-h-[44px] rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
              />
              {surplusApplied !== null && (
                <p className="text-xs text-amber-500 mt-1">잉여금 반영값: {fmt(surplusApplied)}원 (저장 시 감사기록으로 함께 전송)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-dark-muted">메모 (선택)</label>
              <input
                type="text"
                value={formMemo}
                onChange={e => setFormMemo(e.target.value)}
                placeholder="메모"
                className="w-full p-2.5 min-h-[44px] rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formBalance}
              className="w-full py-3 min-h-[44px] bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>}

      {/* 월별 상세 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 dark:border-dark-border/50">
          <h3 className="text-lg font-semibold dark:text-dark-text">월별 상세</h3>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">등록된 기록이 없습니다.</div>
        ) : (
          <>
            {/* 모바일 카드 */}
            <div className="divide-y divide-slate-50 dark:divide-dark-border/50 lg:hidden">
              {[...rows].reverse().map(h => {
                const isOver = h.diff !== null && h.diff < 0;
                return (
                  <div key={h.settleMonth} className="px-4 py-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm font-medium dark:text-dark-text min-w-0 truncate">{h.settleMonth.replace('-', '년 ')}월{h.auto && <AutoBadge />}</span>
                      <span className="text-sm font-bold text-amber-500 tabular-nums shrink-0">{fmt(h.balance)}원</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-slate-400 items-center">
                      <span className={`font-semibold ${h.diff === null ? 'text-slate-400' : isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                        {h.diff === null ? '-' : `${sign(h.diff)}${fmt(h.diff)}원`}
                      </span>
                      {h.memo && <span className="min-w-0 truncate">{h.memo}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크탑 테이블 */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                    <th className="px-6 py-3">정산월</th>
                    <th className="px-6 py-3 text-right">잔액</th>
                    <th className="px-6 py-3 text-right">전월대비증감</th>
                    <th className="px-6 py-3">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
                  {[...rows].reverse().map(h => {
                    const isOver = h.diff !== null && h.diff < 0;
                    return (
                      <tr key={h.settleMonth} className="hover:bg-primary-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium dark:text-dark-text">
                          {h.settleMonth.replace('-', '년 ')}월{h.auto && <AutoBadge />}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-amber-500 tabular-nums">
                          {fmt(h.balance)}원
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold tabular-nums ${h.diff === null ? 'text-slate-400' : isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                          {h.diff === null ? '-' : `${sign(h.diff)}${fmt(h.diff)}원`}
                        </td>
                        <td className="px-6 py-4 text-slate-400 dark:text-dark-muted max-w-xs truncate">
                          {h.memo || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
    <p className="text-xs text-slate-500 dark:text-dark-muted">{label}</p>
    <p className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
  </div>
);

// 현금 계좌 기준으로 계산한 달 — 지출·수입을 고치면 같이 바뀜
const AutoBadge = () => (
  <span className="ml-2 align-middle rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">자동</span>
);
