import React, { useEffect } from 'react';

/**
 * 현금 자산 월 누르면 — 그 달 잔액이 왜 이만큼 바뀌었는지
 * breakdown = 서버 CashFlow.monthItems (auto 달만). 전월 잔액 + 항목 합계와 이번 달 잔액의 차이는 '잔액 맞추기·기타'
 */

export const CASH_ITEM_LABEL: Record<string, string> = {
  SALARY: '월급 (실수령)',
  INCOME: '기타 수입',
  MATURITY: '적금 만기 수령',
  FIXED: '고정비',
  CARD: '카드값',
  SPEND: '현금·이체 지출',
  SAVINGS: '적금·청약 납입',
};

const won = (v: number) => `${v.toLocaleString()}원`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString()}원`;
const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

export const CashChangeSheet = ({
  month, balance, prevMonth, prevBalance, breakdown, isLatest, onClose,
}: {
  month: string;
  balance: number;
  prevMonth: string | null;
  prevBalance: number | null;
  breakdown: Record<string, number>;
  isLatest: boolean;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = Object.entries(breakdown).filter(([, v]) => v !== 0);
  const itemSum = items.reduce((s, [, v]) => s + v, 0);
  const diff = prevBalance != null ? balance - prevBalance : null;
  // 기준 잔액을 다시 맞춘 달, 기록이 없는 달을 건너뛴 경우 등
  const other = diff != null ? diff - itemSum : 0;
  const maxAbs = Math.max(1, ...items.map(([, v]) => Math.abs(v)), Math.abs(other));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${monthLabel(month)} 잔액 변화`}
        className="bg-white dark:bg-dark-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto overscroll-contain p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 animate-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{monthLabel(month)} 정산</p>
            <h3 className="text-lg font-bold dark:text-dark-text">왜 이만큼 바뀌었을까</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-slate-400 hover:text-slate-600 text-2xl leading-none shrink-0"
          >×</button>
        </div>

        {/* 결과 요약 */}
        <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-4">
          <div className="flex justify-between items-baseline gap-2 text-sm">
            <span className="text-slate-500 dark:text-dark-muted min-w-0 truncate">
              {prevMonth ? `${monthLabel(prevMonth)} 말` : '이전 기록 없음'}
            </span>
            <span className="tabular-nums text-slate-600 dark:text-slate-300 shrink-0">{prevBalance != null ? won(prevBalance) : '-'}</span>
          </div>
          <div className="flex justify-between items-baseline gap-2 mt-1">
            <span className="text-sm font-medium dark:text-dark-text">{isLatest ? '이번 달 말 예상' : `${monthLabel(month)} 말`}</span>
            <span className="text-xl font-bold tabular-nums text-amber-500 shrink-0">{won(balance)}</span>
          </div>
          {diff != null && (
            <p className={`text-right text-sm font-semibold tabular-nums ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
              {signed(diff)}
            </p>
          )}
        </div>

        {/* 항목 */}
        {items.length === 0 && other === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">이 달에 잔액을 바꾼 기록이 없어요.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map(([k, v]) => <ItemBar key={k} label={CASH_ITEM_LABEL[k] ?? k} value={v} maxAbs={maxAbs} />)}
            {other !== 0 && <ItemBar label="잔액 맞추기·기타" value={other} maxAbs={maxAbs} muted />}
          </ul>
        )}

        <div className="mt-5 space-y-1 text-xs text-slate-400">
          <p>현금 계좌 기준 잔액에 그 달 기록을 더하고 뺀 값이에요. 카드값은 정산월이 끝날 때 한 번에 빠져요.</p>
          {other !== 0 && <p>'잔액 맞추기·기타'는 내 계좌에서 잔액을 직접 맞췄거나, 자동 계산 전 달과의 차이예요.</p>}
          {isLatest && <p>이번 달은 아직 진행 중이라 앞으로 적는 지출·수입에 따라 바뀌어요.</p>}
        </div>
      </div>
    </div>
  );
};

const ItemBar = ({ label, value, maxAbs, muted }: { label: string; value: number; maxAbs: number; muted?: boolean }) => {
  const up = value > 0;
  return (
    <li>
      <div className="flex justify-between items-baseline gap-2 text-sm">
        <span className={`min-w-0 truncate ${muted ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>{label}</span>
        <span className={`shrink-0 font-semibold tabular-nums ${muted ? 'text-slate-400' : up ? 'text-emerald-500' : 'text-red-500'}`}>
          {signed(value)}
        </span>
      </div>
      <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${muted ? 'bg-slate-300 dark:bg-slate-500' : up ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ width: `${(Math.abs(value) / maxAbs) * 100}%` }}
        />
      </div>
    </li>
  );
};
