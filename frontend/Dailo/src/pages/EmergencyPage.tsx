import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import api, { getStoredMemberId } from '../api/axios';
import { EmergencyHistory } from '../types';

export const EmergencyPage = () => {
  const [history, setHistory] = useState<EmergencyHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/dashboard/emergency-history?memberId=${getStoredMemberId()}`)
      .then(res => setHistory(res.data.data || []))
      .catch(err => console.error('비상금 히스토리 로드 실패:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>;
  }

  if (history.length === 0) {
    return <div className="flex items-center justify-center h-64 text-slate-400">등록된 월별 예산이 없습니다.</div>;
  }

  const latest = history[history.length - 1];
  const totalBudget = history.reduce((s, h) => s + h.emergencyBudget, 0);
  const totalExpense = history.reduce((s, h) => s + h.emergencyExpense, 0);

  const chartData = history.map(h => ({
    month: h.settleMonth.slice(5),   // MM
    cumulative: h.cumulativeAmount,
    net: h.emergencyNet,
  }));

  const fmt = (v: number) => v.toLocaleString();
  const sign = (v: number) => (v > 0 ? '+' : '');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">비상금 적립 현황</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">비상금 누적 흐름</h1>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="현재 누적액" value={`${fmt(latest.cumulativeAmount)}원`} color="text-amber-500" />
        <SummaryCard label="총 배분액" value={`${fmt(totalBudget)}원`} color="text-emerald-500" />
        <SummaryCard label="총 지출액" value={`${fmt(totalExpense)}원`} color="text-red-400" />
        <SummaryCard label="총 기간" value={`${history.length}개월`} color="text-primary-500" />
      </div>

      {/* 누적 추이 차트 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-dark-text">누적액 추이</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="emerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}월`} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString()}원`, '누적액']}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                labelFormatter={v => `${v}월`}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#emerGrad)"
                dot={{ fill: '#f59e0b', r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 월별 상세 테이블 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 dark:border-dark-border/50">
          <h3 className="text-lg font-semibold dark:text-dark-text">월별 상세</h3>
        </div>
        {/* 모바일 카드 */}
        <div className="divide-y divide-slate-50 dark:divide-dark-border/50 md:hidden">
          {[...history].reverse().map(h => {
            const isOver = h.emergencyNet < 0;
            return (
              <div key={h.settleMonth} className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium dark:text-dark-text">{h.settleMonth.replace('-', '년 ')}월</span>
                  <span className="text-sm font-bold text-amber-500">{fmt(h.cumulativeAmount)}원</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                  <span>배분 <span className="text-emerald-500 font-medium">{fmt(h.emergencyBudget)}원</span></span>
                  {h.emergencyExpense > 0 && <span>지출 <span className="text-red-400">{fmt(h.emergencyExpense)}원</span></span>}
                  <span className={`font-semibold ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                    {sign(h.emergencyNet)}{fmt(h.emergencyNet)}원
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 데스크탑 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                <th className="px-6 py-3">정산월</th>
                <th className="px-6 py-3 text-right">배분액</th>
                <th className="px-6 py-3 text-right">지출액</th>
                <th className="px-6 py-3 text-right">순증감</th>
                <th className="px-6 py-3 text-right">누적액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
              {[...history].reverse().map(h => {
                const isOver = h.emergencyNet < 0;
                return (
                  <tr key={h.settleMonth} className="hover:bg-primary-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium dark:text-dark-text">
                      {h.settleMonth.replace('-', '년 ')}월
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-500 font-medium">
                      {fmt(h.emergencyBudget)}원
                    </td>
                    <td className="px-6 py-4 text-right text-red-400">
                      {h.emergencyExpense > 0 ? `${fmt(h.emergencyExpense)}원` : '-'}
                    </td>
                    <td className={`px-6 py-4 text-right font-semibold ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                      {sign(h.emergencyNet)}{fmt(h.emergencyNet)}원
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-amber-500">
                      {fmt(h.cumulativeAmount)}원
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none p-5">
    <p className="text-xs text-slate-500 dark:text-dark-muted">{label}</p>
    <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
  </div>
);
