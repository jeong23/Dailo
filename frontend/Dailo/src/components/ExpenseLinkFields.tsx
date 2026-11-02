import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { CashAccount } from '../types';

// 지출 폼 공통 칸 — 지출 / 수입 화면과 대시보드 지출 등록이 같이 씀
//  현금 계좌: 지출이 어느 통장 잔액에서 빠질지 ('' = 기본 계좌, 계좌가 없으면 숨김)
//  적금·청약 납입: 고르면 그 정산월 납입 기록 — 현금 잔액에선 예상 납입 대신 이 지출이 빠짐

export interface SavingsOption { id: number; name: string; monthlyAmount: number }

export const useExpenseLinks = () => {
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [savingsList, setSavingsList] = useState<SavingsOption[]>([]);
  useEffect(() => {
    api.get('/cash-accounts').then(res => setCashAccounts(res.data.data || [])).catch(() => setCashAccounts([]));
    api.get('/savings').then(res => setSavingsList(res.data.data || [])).catch(() => setSavingsList([]));
  }, []);
  return { cashAccounts, savingsList };
};

const SELECT = 'w-full p-2.5 min-h-[44px] rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500';

// 꺼진 계좌도 고를 수 있게 남겨 두되 표시 (수정 중인 기록이 꺼진 계좌일 수 있음)
export const CashAccountSelect = ({ accounts, value, onChange, label, hint }: {
  accounts: CashAccount[]; value: string; onChange: (v: string) => void; label: string; hint: string;
}) => {
  const def = accounts.find(a => a.active) ?? accounts[0];
  return (
    <div>
      <label className="block text-sm font-medium mb-1 dark:text-dark-muted">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={SELECT}>
        <option value="">기본 계좌{def ? ` (${def.name})` : ''}</option>
        {accounts.map(a => (
          <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''}{a.active ? '' : ' (꺼짐)'}</option>
        ))}
      </select>
      <p className="text-xs text-slate-400 mt-1">{hint}</p>
    </div>
  );
};

// 지출 결제 수단에 맞춘 현금 계좌 칸 (계좌 없으면 null)
export const ExpenseAccountField = ({ accounts, value, onChange, paymentMethod }: {
  accounts: CashAccount[]; value: string; onChange: (v: string) => void; paymentMethod: string;
}) => accounts.length === 0 ? null : (
  <CashAccountSelect accounts={accounts} value={value} onChange={onChange}
    label={paymentMethod === '카드' ? '카드값 나가는 계좌' : '돈 나간 계좌'}
    hint={paymentMethod === '카드' ? '카드는 정산월이 끝날 때 현금 잔액에서 한 번에 빠져요' : '저장하면 현금 자산·자산 현황 잔액에 바로 반영돼요'} />
);

// 고르면 onPick(적금)으로 빈 이름·금액 채우기 등을 페이지가 처리
export const SavingsSelect = ({ list, value, onChange }: {
  list: SavingsOption[]; value: string; onChange: (v: string, picked?: SavingsOption) => void;
}) => list.length === 0 ? null : (
  <div>
    <label className="block text-sm font-medium mb-1 dark:text-dark-muted">적금·청약 납입</label>
    <select value={value} onChange={e => onChange(e.target.value, list.find(x => String(x.id) === e.target.value))} className={SELECT}>
      <option value="">해당 없음</option>
      {list.map(s => (
        <option key={s.id} value={s.id}>{s.name} · 월 {s.monthlyAmount.toLocaleString()}원</option>
      ))}
    </select>
    {value && <p className="text-xs text-slate-400 mt-1">이 달 납입 기록으로 남고, 현금 잔액에선 예상 납입 대신 이 금액이 빠져요</p>}
  </div>
);

export const SavingsBadge = ({ name }: { name: string | null }) => (
  <span className="ml-1.5 inline-block max-w-[10rem] truncate align-middle px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
    적금 · {name}
  </span>
);
