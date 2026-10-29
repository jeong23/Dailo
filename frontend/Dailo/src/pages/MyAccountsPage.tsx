import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { InvestSettingsPage } from './InvestSettingsPage';
import { SavingsPage } from './SavingsPage';
import { CashAccountsPanel } from '../components/CashAccountsPanel';

// 내 계좌 — 돈이 들어 있는 곳(현금·적금/청약·투자)을 한곳에서 등록·관리. 다른 화면(현금 자산·적금·투자 현황·자산 현황)은 보여주기만
// 탭은 ?tab= 으로 — 투자 현황 ⚙️ 등에서 바로 투자 탭으로 들어옴
const TABS = [
  { key: 'cash', label: '현금', icon: '💰' },
  { key: 'savings', label: '적금·청약', icon: '🏦' },
  { key: 'invest', label: '투자', icon: '💹' },
] as const;
type TabKey = typeof TABS[number]['key'];

export const MyAccountsPage = () => {
  const [params, setParams] = useSearchParams();
  const tab: TabKey = (TABS.find(t => t.key === params.get('tab'))?.key) ?? 'cash';

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">현금 · 적금 · 투자 계좌를 한곳에서</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">내 계좌</h1>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            onClick={() => setParams({ tab: t.key }, { replace: true })}
            className={`flex-1 h-11 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <span className="mr-1" aria-hidden>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'cash' && <CashAccountsPanel />}
      {tab === 'savings' && <SavingsPage embedded />}
      {tab === 'invest' && <InvestSettingsPage embedded />}
    </div>
  );
};
