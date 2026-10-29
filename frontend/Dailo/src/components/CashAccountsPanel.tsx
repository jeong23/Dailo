import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Toast, useToast } from './Toast';
import { getCurrentSettleMonth } from '../utils/format';
import { CashAccount, CashAssetEntry } from '../types';

// 내 계좌 > 현금 — 입출금·CMA·파킹통장을 계좌별로 등록
//  켜진 계좌 잔액 합계가 이번 정산월 현금 자산(cash_asset)으로 자동 기록됨 → 현금 자산 추이·자산 현황은 그 값을 그대로 씀
//  계좌가 하나도 없으면 예전처럼 현금 자산 화면에서 직접 입력 — 그 최신 잔액을 '기본 현금' 계좌로 가져올 수 있음

const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const FIELD = 'flex items-center min-w-0 h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500';
const FIELD_INPUT = 'flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-900 dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-slate-600';
const fmt = (n: number) => Math.round(n).toLocaleString();
const fmtNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v: string) => parseInt(v.replace(/,/g, ''), 10) || 0;

interface Form { id?: number; name: string; bank: string; balance: string; memo: string }

export const CashAccountsPanel = () => {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [latestAsset, setLatestAsset] = useState<CashAssetEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  useEscapeKey(form !== null, () => setForm(null));
  const settleMonth = getCurrentSettleMonth();
  const q = `?settleMonth=${settleMonth}`;

  const load = async () => {
    const [aRes, hRes] = await Promise.allSettled([api.get('/cash-accounts'), api.get('/cash-assets')]);
    if (aRes.status === 'fulfilled') setAccounts(aRes.value.data.data || []);
    else show('현금 계좌를 불러오지 못했어요', 'error');
    if (hRes.status === 'fulfilled') {
      const list: CashAssetEntry[] = hRes.value.data.data || [];
      setLatestAsset(list.length > 0 ? list[list.length - 1] : null);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 꺼진 계좌는 아래로 (투자 계좌와 같은 규칙)
  const sorted = [...accounts].sort((a, b) => Number(!a.active) - Number(!b.active));
  const total = accounts.filter(a => a.active).reduce((t, a) => t + a.balance, 0);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { show('계좌 이름을 입력해주세요', 'error'); return; }
    const body = { name: form.name.trim(), bank: form.bank.trim() || null, balance: parseNum(form.balance), memo: form.memo.trim() || null };
    setBusy(true);
    try {
      if (form.id) await api.put(`/cash-accounts/${form.id}${q}`, body);
      else await api.post(`/cash-accounts${q}`, body);
      setForm(null);
      await load();
      show('저장했어요 — 이번 달 현금 자산에도 반영됐어요');
    } catch (e: any) {
      show(e?.response?.data?.message || '저장에 실패했어요', 'error');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!form?.id || !window.confirm(`'${form.name}' 계좌를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await api.delete(`/cash-accounts/${form.id}${q}`);
      setForm(null);
      await load();
      show('삭제했어요');
    } catch (e: any) {
      show(e?.response?.data?.message || '삭제에 실패했어요', 'error');
    } finally { setBusy(false); }
  };

  // 켜기/끄기는 바로 저장 (투자 계좌 스위치와 같은 방식), 실패 시 되돌림
  const toggle = async (acc: CashAccount) => {
    const next = !acc.active;
    setAccounts(prev => prev.map(a => (a.id === acc.id ? { ...a, active: next } : a)));
    try {
      await api.patch(`/cash-accounts/${acc.id}/active${q}`, { active: next });
      show(next ? `'${acc.name}'을 켰어요 — 합계에 들어가요` : `'${acc.name}'을 껐어요 — 합계에서 빠지고 맨 아래로 옮겼어요`);
    } catch (e: any) {
      setAccounts(prev => prev.map(a => (a.id === acc.id ? { ...a, active: !next } : a)));
      show(e?.response?.data?.message || '계좌 상태를 바꾸지 못했어요', 'error');
    }
  };

  // 예전 방식(현금 자산 직접 입력) 잔액을 계좌 하나로 가져오기 — 계좌가 하나도 없을 때만
  const importLatest = async () => {
    if (!latestAsset) return;
    setBusy(true);
    try {
      await api.post(`/cash-accounts${q}`, { name: '기본 현금', bank: null, balance: Math.max(latestAsset.balance, 0), memo: `${latestAsset.settleMonth} 현금 자산에서 가져옴` });
      await load();
      show("'기본 현금' 계좌를 만들었어요 — 은행별로 나누려면 금액을 고치고 계좌를 추가하세요");
    } catch (e: any) {
      show(e?.response?.data?.message || '가져오지 못했어요', 'error');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-slate-400">로딩 중...</div>;

  return (
    <div className="space-y-4">
      {/* 합계 */}
      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">현금 합계 (켜진 계좌)</p>
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-dark-text truncate">{fmt(total)}<span className="text-lg font-semibold ml-0.5">원</span></p>
          </div>
          <button onClick={() => setForm({ name: '', bank: '', balance: '', memo: '' })}
            className="shrink-0 h-11 sm:h-9 rounded-full px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">+ 계좌 추가</button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {accounts.length > 0
            ? <>합계가 이번 달({settleMonth}) <Link to="/cash" className="underline">현금 자산</Link>으로 자동 기록돼요 — 자산 현황의 현금 칸도 이 값이에요</>
            : <>계좌를 추가하면 합계가 이번 달 <Link to="/cash" className="underline">현금 자산</Link>으로 자동 기록돼요</>}
        </p>
      </section>

      {accounts.length === 0 && latestAsset && (
        <section className={`${CARD} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3`}>
          <p className="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-300">
            현금 자산에 직접 입력한 잔액 <span className="font-semibold tabular-nums">{fmt(latestAsset.balance)}원</span>({latestAsset.settleMonth})이 있어요. '기본 현금' 계좌로 가져올까요?
          </p>
          <button onClick={importLatest} disabled={busy}
            className="shrink-0 h-11 sm:h-9 px-4 rounded-full bg-primary-50 dark:bg-primary-900/20 text-sm font-semibold text-primary-600 dark:text-primary-400 disabled:opacity-50">가져오기</button>
        </section>
      )}

      {accounts.length === 0 && !latestAsset && (
        <div className={`${CARD} p-8 text-center`}>
          <p className="text-3xl mb-2">💰</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">아직 현금 계좌가 없어요</p>
          <p className="text-xs text-slate-400 mt-1">월급 통장·CMA·파킹통장을 추가해 보세요</p>
        </div>
      )}

      {sorted.length > 0 && (
        <ul className={`${CARD} divide-y divide-slate-50 dark:divide-dark-border/50 overflow-hidden`}>
          {sorted.map(a => (
            <li key={a.id} className="flex items-center gap-2 pl-4 sm:pl-5 pr-2">
              <button onClick={() => setForm({ id: a.id, name: a.name, bank: a.bank ?? '', balance: fmt(a.balance), memo: a.memo ?? '' })}
                className={`flex-1 min-w-0 flex items-center gap-3 py-3 text-left ${a.active ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">{a.name}</p>
                  <p className="text-xs text-slate-400 truncate">{[a.bank, a.memo].filter(Boolean).join(' · ') || ' '}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-dark-text">{fmt(a.balance)}원</p>
              </button>
              <button type="button" role="switch" aria-checked={a.active} aria-label={`${a.name} 사용`} onClick={() => toggle(a)}
                className="h-11 shrink-0 flex items-center gap-1.5 px-1">
                <span className={`text-xs font-medium ${a.active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>{a.active ? '사용' : '꺼짐'}</span>
                <span className={`relative w-11 h-6 rounded-full transition-colors ${a.active ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${a.active ? 'translate-x-5' : ''}`} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text">현금 계좌 {form.id ? '수정' : '추가'}</h3>
              <button onClick={() => setForm(null)} aria-label="닫기" className="w-11 h-11 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
            </div>
            <div className="px-6 pb-4 space-y-3 overflow-y-auto themed-scrollbar">
              <label className={FIELD}>
                <span className="text-xs text-slate-400 mr-2 shrink-0 w-12">이름</span>
                <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 월급 통장" maxLength={50} className={FIELD_INPUT} />
              </label>
              <label className={FIELD}>
                <span className="text-xs text-slate-400 mr-2 shrink-0 w-12">은행</span>
                <input value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="예: 토스뱅크 (선택)" maxLength={30} className={FIELD_INPUT} />
              </label>
              <label className={FIELD}>
                <span className="text-xs text-slate-400 mr-2 shrink-0 w-12">잔액</span>
                <input inputMode="numeric" value={form.balance} onChange={e => setForm({ ...form, balance: fmtNum(e.target.value) })} placeholder="0" className={`${FIELD_INPUT} text-right tabular-nums`} />
                <span className="text-xs text-slate-400 ml-1">원</span>
              </label>
              <label className={FIELD}>
                <span className="text-xs text-slate-400 mr-2 shrink-0 w-12">메모</span>
                <input value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} placeholder="예: 비상금 (선택)" maxLength={200} className={FIELD_INPUT} />
              </label>
            </div>
            <div className="px-6 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex gap-2">
              {form.id && (
                <button onClick={remove} disabled={busy} className="h-12 px-4 rounded-2xl text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50">삭제</button>
              )}
              <button onClick={save} disabled={busy} className="flex-1 h-12 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">
                {busy ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
};
