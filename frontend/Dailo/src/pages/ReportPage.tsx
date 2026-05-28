import React, { useState, useEffect } from 'react';
import api, { getStoredMemberId } from '../api/axios';
import { MonthlyReport } from '../types';
import { getAllocationLabels } from '../utils/allocationLabels';

export const ReportPage = () => {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const labels = getAllocationLabels();

  useEffect(() => {
    api.get(`/dashboard/monthly-report?memberId=${getStoredMemberId()}`)
      .then(res => setReports(res.data.data || []))
      .catch(err => console.error('리포트 로드 실패:', err))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (v: number) => v?.toLocaleString() ?? '-';
  const sign = (v: number) => v >= 0 ? '+' : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        로딩 중...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        등록된 월별 예산이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">누적 정산 내역</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">월별 정산 리포트</h1>
      </div>

      <div className="space-y-4">
        {reports.map(r => {
          const livingOver = r.livingBalance < 0;
          const cardDone = r.cardAchievementRate >= 100;

          return (
            <div
              key={r.settleMonth}
              className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden"
            >
              {/* 월 헤더 */}
              <div className="px-4 sm:px-6 py-4 bg-slate-50/80 dark:bg-slate-800/30 flex flex-wrap justify-between items-center gap-2 border-b border-slate-50 dark:border-dark-border/50">
                <h3 className="text-base sm:text-lg font-bold dark:text-dark-text">
                  {r.settleMonth.replace('-', '년 ')}월
                </h3>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    livingOver
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    이월 {sign(r.livingBalance)}{fmt(r.livingBalance)}원
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    cardDone
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  }`}>
                    카드 {r.cardAchievementRate}%{cardDone ? ' ✓' : ''}
                  </span>
                </div>
              </div>

              {/* 본문 그리드 */}
              <div className="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 수입/예산 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">수입 / 예산</p>
                  <Row label="실수령액" value={fmt(r.netSalary)} />
                  {r.extraIncomeTotal > 0 && (
                    <Row label="기타수입" value={fmt(r.extraIncomeTotal)} color="text-emerald-500" />
                  )}
                  <Row label="고정비" value={fmt(r.fixedCostTotal)} color="text-red-400" />
                  <Row label="가용금액" value={fmt(r.availableAmount)} bold />
                </div>

                {/* 생활비 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{labels.living}</p>
                  <Row label="예산" value={fmt(r.livingBudget)} />
                  {r.livingCarryover !== 0 && (
                    <Row label="이월" value={`${sign(r.livingCarryover)}${fmt(r.livingCarryover)}`} />
                  )}
                  <Row label="지출" value={fmt(r.livingExpenseTotal)} color="text-red-400" />
                  <Row
                    label="잔액"
                    value={`${sign(r.livingBalance)}${fmt(r.livingBalance)}`}
                    color={livingOver ? 'text-red-500' : 'text-green-500'}
                    bold
                  />
                </div>

                {/* 비상금 / 투자 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{labels.emergency} / 투자</p>
                  <Row label={`${labels.emergency} 예산`} value={fmt(r.emergencyBudget)} />
                  <Row label={`${labels.emergency} 지출`} value={fmt(r.emergencyExpenseTotal)} color="text-red-400" />
                  <Row label={labels.isa} value={fmt(r.isaAmount)} color="text-emerald-500" />
                  <Row label={labels.pension} value={fmt(r.pensionAmount)} color="text-violet-500" />
                </div>

                {/* 카드 실적 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">카드 실적</p>
                  <Row label="목표" value={fmt(r.cardGoal)} />
                  <Row label="실적" value={fmt(r.cardExpenseTotal)} />
                  <div className="mt-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">달성률</span>
                      <span className={cardDone ? 'text-blue-500 font-bold' : 'text-slate-500'}>
                        {r.cardAchievementRate}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cardDone ? 'bg-blue-500' : 'bg-slate-400'}`}
                        style={{ width: `${Math.min(r.cardAchievementRate, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Row = ({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-slate-500 dark:text-dark-muted">{label}</span>
    <span className={`${bold ? 'font-bold' : ''} ${color ?? 'dark:text-dark-text'}`}>{value}원</span>
  </div>
);
