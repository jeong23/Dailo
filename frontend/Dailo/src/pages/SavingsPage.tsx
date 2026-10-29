import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { Toast, useToast } from '../components/Toast';
import {
  AREA_LABELS, FIRST_RANK, HousingRegion, RECOGNIZE_CAP, REGION_LABEL, housingSummary, savingsSummary, toYmd,
} from '../utils/savings';

// 적금 — 매달 붓는 정기적금. 고정비(사라지는 돈)와 달리 쌓이는 자산이라 따로 관리하고,
// 현재 원금 합계는 자산 현황의 '적금' 칸에 자동으로 들어감.
// 주택청약종합저축(kind=HOUSING)은 만기 없이 계속 넣는 통장 — 잔액·청약 인정 금액·예치금·1순위·소득공제를 보여줌.

interface Savings {
  id: number; name: string; bank: string | null; monthlyAmount: number; startDate: string;
  months: number; ratePct: number; taxFree: boolean; paidOverride: number | null; memo: string | null;
  kind: 'SAVINGS' | 'HOUSING'; balanceOverride: number | null; region: HousingRegion | null; householdHead: boolean;
  monthlyBonus: number | null; bonusBalance: number | null;
}
interface Form {
  id?: number; name: string; bank: string; monthlyAmount: string; startDate: string;
  months: string; ratePct: string; taxFree: boolean; paidOverride: string; memo: string;
  kind: 'SAVINGS' | 'HOUSING'; balance: string; region: HousingRegion; householdHead: boolean;
  monthlyBonus: string; bonusBalance: string;
}

const CARD = 'bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none';
const FIELD = 'flex items-center min-w-0 h-11 rounded-xl bg-slate-50 dark:bg-dark-bg px-3 focus-within:ring-2 focus-within:ring-primary-500';
const FIELD_INPUT = 'w-full min-w-0 flex-1 bg-transparent outline-none text-sm tabular-nums text-slate-900 dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-slate-600';
const fmt = (n: number) => Math.round(n).toLocaleString();
const fmtNum = (v: string) => v.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const parseNum = (v: string) => parseInt(v.replace(/,/g, ''), 10) || 0;
const STATUS = {
  ACTIVE:  { label: '납입 중',   cls: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' },
  DONE:    { label: '납입 완료', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
  MATURED: { label: '만기',      cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
};

const emptyForm = (kind: Form['kind'] = 'SAVINGS'): Form => ({
  name: kind === 'HOUSING' ? '주택청약종합저축' : '', bank: '', monthlyAmount: '', startDate: toYmd(new Date()), months: '12',
  ratePct: '', taxFree: false, paidOverride: '', memo: '', kind, balance: '', region: 'SEOUL_BUSAN', householdHead: false,
  monthlyBonus: '', bonusBalance: '',
});
const optNum = (v: string) => (v.trim() === '' ? null : parseInt(v.replace(/,/g, ''), 10));
const housingInput = (s: Savings) => ({ ...s, ratePct: s.ratePct ?? 0 });

// embedded = '내 계좌 > 적금·청약' 탭 — 등록·수정은 여기서만. /savings 단독 화면은 보기 전용 (누르면 내 계좌로)
export const SavingsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const MANAGE = '/accounts?tab=savings';
  const [list, setList] = useState<Savings[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();
  useEscapeKey(form !== null, () => setForm(null));
  const today = toYmd(new Date());

  const load = async () => {
    try {
      const r = await api.get('/savings');
      setList(r.data.data || []);
    } catch {
      show('적금 목록을 불러오지 못했어요', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const housings = list.filter(s => s.kind === 'HOUSING').map(s => ({ s, h: housingSummary(housingInput(s), today) }));
  const rows = list.filter(s => s.kind !== 'HOUSING').map(s => ({ s, sum: savingsSummary({ ...s, ratePct: s.ratePct ?? 0 }, today) }))
    .sort((a, b) => (a.sum.status === 'ACTIVE' ? 0 : 1) - (b.sum.status === 'ACTIVE' ? 0 : 1) || a.sum.daysLeft - b.sum.daysLeft);
  const principalTotal = rows.reduce((t, r) => t + r.sum.current, 0) + housings.reduce((t, r) => t + r.h.principal, 0);
  const monthlyTotal = rows.filter(r => r.sum.status === 'ACTIVE').reduce((t, r) => t + r.s.monthlyAmount, 0)
    + housings.reduce((t, r) => t + r.s.monthlyAmount, 0);
  const maturityTotal = rows.filter(r => r.sum.status !== 'MATURED').reduce((t, r) => t + r.sum.maturityAmount, 0);

  const openEdit = (s: Savings) => setForm({
    id: s.id, name: s.name, bank: s.bank ?? '', monthlyAmount: fmt(s.monthlyAmount), startDate: s.startDate,
    months: String(s.months), ratePct: String(s.ratePct ?? ''), taxFree: s.taxFree,
    paidOverride: s.paidOverride != null ? String(s.paidOverride) : '', memo: s.memo ?? '',
    kind: s.kind ?? 'SAVINGS', balance: s.balanceOverride != null ? fmt(s.balanceOverride) : '',
    region: s.region ?? 'SEOUL_BUSAN', householdHead: !!s.householdHead,
    monthlyBonus: s.monthlyBonus != null ? fmt(s.monthlyBonus) : '', bonusBalance: s.bonusBalance != null ? fmt(s.bonusBalance) : '',
  });
  const isHousing = form?.kind === 'HOUSING';

  const formErr = form && (!form.name.trim() ? '이름을 입력해주세요'
    : parseNum(form.monthlyAmount) <= 0 ? '월 납입액을 입력해주세요'
    : !form.startDate ? '시작일을 입력해주세요'
    : !isHousing && !(parseInt(form.months, 10) >= 1 && parseInt(form.months, 10) <= 120) ? '기간은 1~120개월이에요'
    : null);
  const housingPreview = form && isHousing && !formErr ? housingSummary({
    monthlyAmount: parseNum(form.monthlyAmount), startDate: form.startDate, ratePct: parseFloat(form.ratePct) || 0,
    paidOverride: optNum(form.paidOverride), balanceOverride: optNum(form.balance),
    region: form.region, householdHead: form.householdHead,
  }, today) : null;
  const preview = form && !isHousing && !formErr ? savingsSummary({
    monthlyAmount: parseNum(form.monthlyAmount), startDate: form.startDate, months: parseInt(form.months, 10),
    ratePct: parseFloat(form.ratePct) || 0, taxFree: form.taxFree,
    paidOverride: form.paidOverride.trim() === '' ? null : parseInt(form.paidOverride, 10),
    monthlyBonus: optNum(form.monthlyBonus), bonusBalance: optNum(form.bonusBalance),
  }, today) : null;

  const save = async () => {
    if (!form || formErr) return;
    setSaving(true);
    const body = {
      name: form.name.trim(), bank: form.bank.trim() || null, monthlyAmount: parseNum(form.monthlyAmount),
      startDate: form.startDate, months: parseInt(form.months, 10), ratePct: parseFloat(form.ratePct) || 0,
      taxFree: form.taxFree, paidOverride: form.paidOverride.trim() === '' ? null : parseInt(form.paidOverride, 10),
      memo: form.memo.trim() || null, kind: form.kind,
      balanceOverride: isHousing ? optNum(form.balance) : null, region: isHousing ? form.region : null,
      householdHead: isHousing && form.householdHead,
      monthlyBonus: isHousing ? null : optNum(form.monthlyBonus), bonusBalance: isHousing ? null : optNum(form.bonusBalance),
    };
    try {
      if (form.id) await api.put(`/savings/${form.id}`, body);
      else await api.post('/savings', body);
      show(form.id ? '수정했어요' : isHousing ? '청약통장을 추가했어요' : '적금을 추가했어요');
      setForm(null);
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || '저장에 실패했어요', 'error');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form?.id || !window.confirm(`"${form.name}"을(를) 삭제할까요? ${isHousing ? '해지했거나 당첨 후 정리할 때 쓰세요.' : '만기 수령 후 정리할 때 쓰세요.'}`)) return;
    try {
      await api.delete(`/savings/${form.id}`);
      show('삭제했어요');
      setForm(null);
      await load();
    } catch { show('삭제에 실패했어요', 'error'); }
  };

  const set = (p: Partial<Form>) => setForm(f => f && { ...f, ...p });
  const startAdd = (kind?: 'HOUSING') => (embedded ? setForm(emptyForm(kind)) : navigate(MANAGE));
  const openCard = (sv: Savings) => (embedded ? openEdit(sv) : navigate(MANAGE));

  return (
    <div className="space-y-5 max-w-3xl">
      <div className={`flex items-end gap-3 flex-wrap ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded && <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">매달 쌓이는 돈 · 자산 현황 '적금'에 자동 반영</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">적금 · 청약</h1>
        </div>}
        {embedded ? (
          <div className="flex gap-2">
            {housings.length === 0 && (
              <button onClick={() => startAdd('HOUSING')}
                className="rounded-full px-4 py-1.5 min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">+ 청약</button>
            )}
            <button onClick={() => startAdd()}
              className="rounded-full px-4 py-1.5 min-h-[44px] bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold">+ 적금 추가</button>
          </div>
        ) : (
          <Link to={MANAGE} className="rounded-full px-4 py-1.5 min-h-[44px] inline-flex items-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold">내 계좌에서 관리 →</Link>
        )}
      </div>

      {/* 요약 */}
      <section className={`${CARD} p-5 sm:p-6`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">지금까지 모은 돈 <span className="text-xs text-slate-400">(정부기여금 포함)</span></p>
        <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-dark-text mt-1">{fmt(principalTotal)}<span className="text-lg font-semibold ml-0.5">원</span></p>
        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-dark-border/60">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">매달 납입</p>
            <p className="text-base font-bold tabular-nums text-slate-800 dark:text-dark-text truncate mt-0.5">{fmt(monthlyTotal)}원</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">만기 때 받을 돈 (세후)</p>
            <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 truncate mt-0.5">{fmt(maturityTotal)}원</p>
          </div>
        </div>
        <Link to="/assets" className="mt-3 inline-block text-xs font-medium text-primary-500 min-h-[32px] leading-8">자산 현황에서 보기 →</Link>
      </section>

      {/* 목록 */}
      {loading ? (
        <div className={`${CARD} h-40 animate-pulse`} />
      ) : rows.length === 0 && housings.length === 0 ? (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-4xl mb-3">🏦</p>
          <p className="font-semibold text-slate-700 dark:text-slate-200">등록된 적금이 없어요</p>
          <p className="text-sm text-slate-400 mt-1">월 납입액·시작일·기간·이율만 넣으면 회차와 만기 금액을 계산해요</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => startAdd('HOUSING')} className="h-11 px-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium">+ 주택청약</button>
            <button onClick={() => startAdd()} className="h-11 px-5 rounded-full bg-primary-600 text-white text-sm font-medium">+ 적금 추가</button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {housings.map(({ s, h }) => (
            <li key={s.id}>
              <button onClick={() => openCard(s)} className={`${CARD} w-full text-left p-4 sm:p-5 hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-900/40 transition`}>
                <HousingCard s={s} h={h} />
              </button>
            </li>
          ))}
          {rows.map(({ s, sum }) => {
            const st = STATUS[sum.status];
            const pct = (sum.paid / s.months) * 100;
            return (
              <li key={s.id}>
                <button onClick={() => openCard(s)} className={`${CARD} w-full text-left p-4 sm:p-5 hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-900/40 transition`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-dark-text truncate min-w-0 flex-1">
                      {s.name}{s.bank && <span className="text-xs font-normal text-slate-400 ml-1.5">{s.bank}</span>}
                    </p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-dark-text">{fmt(sum.principal)}원</p>
                      <p className="text-xs text-slate-400 tabular-nums">월 {fmt(s.monthlyAmount)}원 · 연 {s.ratePct}%{s.taxFree ? ' · 비과세' : ''}</p>
                      {sum.bonusNow > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">+ 정부기여금 {fmt(sum.bonusNow)}원</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">만기 {sum.maturityDate.replace(/-/g, '.')}</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(sum.maturityAmount)}원</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-400 tabular-nums">
                    <span>{sum.paid} / {s.months}회 납입{s.paidOverride != null ? ' (직접 입력)' : ''}</span>
                    <span>
                      {sum.status === 'MATURED' ? '만기 지남 — 수령 후 삭제' : sum.nextPayment ? `다음 납입 ${sum.nextPayment.slice(5).replace('-', '/')}` : ''}
                      {sum.status !== 'MATURED' && ` · D-${sum.daysLeft}`}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 추가·수정 시트 */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text">{isHousing ? '주택청약' : '적금'} {form.id ? '수정' : '추가'}</h3>
              <button onClick={() => setForm(null)} aria-label="닫기" className="w-11 h-11 -mr-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">×</button>
            </div>
            <div className="px-6 overflow-y-auto flex-1 space-y-3 pb-4">
              {/* 수정 중에도 종류 변경 가능 — 청약을 적금으로 잘못 넣은 경우 */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-dark-bg">
                {(['SAVINGS', 'HOUSING'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setForm(f => f && { ...f, kind: k, name: f.name.trim() ? f.name : emptyForm(k).name })}
                    className={`h-10 rounded-lg text-sm font-medium ${form.kind === k ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm' : 'text-slate-500'}`}>
                    {k === 'SAVINGS' ? '적금 (만기 있음)' : '주택청약 (계속 납입)'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">이름</span>
                  <input value={form.name} maxLength={100} placeholder={isHousing ? '주택청약종합저축' : '청년도약계좌'} onChange={e => set({ name: e.target.value })} className={`${FIELD_INPUT} text-right`} />
                </label>
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">은행</span>
                  <input value={form.bank} maxLength={50} placeholder="선택" onChange={e => set({ bank: e.target.value })} className={`${FIELD_INPUT} text-right`} />
                </label>
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">월 납입액</span>
                  <input inputMode="numeric" value={form.monthlyAmount} placeholder={isHousing ? '250,000' : '300,000'} onChange={e => set({ monthlyAmount: fmtNum(e.target.value) })} className={`${FIELD_INPUT} text-right`} />
                  <span className="text-xs text-slate-400 ml-1">원</span>
                </label>
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">{isHousing ? '가입일' : '첫 납입일'}</span>
                  <input type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} className={`${FIELD_INPUT} text-right`} />
                </label>
              </div>
              {isHousing ? (
                <HousingFields form={form} set={set} />
              ) : (<>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">기간</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {['6', '12', '24', '36', '60'].map(m => (
                    <button key={m} type="button" onClick={() => set({ months: m })}
                      className={`h-11 px-3.5 rounded-xl text-sm font-medium ${form.months === m ? 'bg-primary-600 text-white' : 'bg-slate-50 dark:bg-dark-bg text-slate-500'}`}>{m}개월</button>
                  ))}
                  <div className={`${FIELD} w-24`}>
                    <input inputMode="numeric" value={form.months} onChange={e => set({ months: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} className={`${FIELD_INPUT} text-right`} />
                    <span className="text-xs text-slate-400 ml-1">개월</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">연 이율</span>
                  <input inputMode="decimal" value={form.ratePct} placeholder="4.5" onChange={e => set({ ratePct: e.target.value.replace(/[^0-9.]/g, '') })} className={`${FIELD_INPUT} text-right`} />
                  <span className="text-xs text-slate-400 ml-1">%</span>
                </label>
                <button type="button" onClick={() => set({ taxFree: !form.taxFree })} aria-pressed={form.taxFree}
                  className={`h-11 rounded-xl text-sm font-medium ${form.taxFree ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-dark-bg text-slate-500'}`}>
                  {form.taxFree ? '✓ 비과세' : '일반과세 (15.4%)'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">정부기여금 월</span>
                  <input inputMode="numeric" value={form.monthlyBonus} placeholder="없으면 비움" onChange={e => set({ monthlyBonus: fmtNum(e.target.value) })} className={`${FIELD_INPUT} text-right`} />
                  <span className="text-xs text-slate-400 ml-1">원</span>
                </label>
                <label className={FIELD}>
                  <span className="text-xs text-slate-400 mr-2 shrink-0">적립된 기여금</span>
                  <input inputMode="numeric" value={form.bonusBalance} placeholder="앱 금액 (비우면 자동)" onChange={e => set({ bonusBalance: fmtNum(e.target.value) })} className={`${FIELD_INPUT} text-right`} />
                  <span className="text-xs text-slate-400 ml-1">원</span>
                </label>
              </div>
              </>)}
              <label className={FIELD}>
                <span className="text-xs text-slate-400 mr-2 shrink-0">납입 회차 직접</span>
                <input inputMode="numeric" value={form.paidOverride}  placeholder={isHousing ? '빠뜨린 달이 있으면 직접' : '비우면 날짜로 자동 계산'} onChange={e => set({ paidOverride: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} className={`${FIELD_INPUT} text-right`} />
                <span className="text-xs text-slate-400 ml-1">회</span>
              </label>
              <label className={FIELD}>
                <span className="text-xs text-slate-400 mr-2 shrink-0">메모</span>
                <input value={form.memo} maxLength={200} placeholder="선택" onChange={e => set({ memo: e.target.value })} className={FIELD_INPUT} />
              </label>

              {preview && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm tabular-nums space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">지금까지 납입</span><span className="font-semibold text-slate-800 dark:text-dark-text">{preview.paid}회 · {fmt(preview.principal)}원</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">만기일</span><span className="font-semibold text-slate-800 dark:text-dark-text">{preview.maturityDate.replace(/-/g, '.')}</span></div>
                  {preview.bonusTotal > 0 && (
                    <div className="flex justify-between"><span className="text-slate-500">정부기여금 (지금 / 만기)</span><span className="font-semibold text-slate-800 dark:text-dark-text">{fmt(preview.bonusNow)} / {fmt(preview.bonusTotal)}원</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-slate-500">이자 (세후)</span><span className="font-semibold text-slate-800 dark:text-dark-text">{fmt(preview.netInterest)}원</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">만기 수령액</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(preview.maturityAmount)}원</span></div>
                </div>
              )}
              {housingPreview && <HousingPreview h={housingPreview} region={form.region} householdHead={form.householdHead} />}
              <p className="text-[11px] text-slate-400">{isHousing
                ? '청약 기준은 2026년 기준 일반 규칙이에요. 단지·지역별 공고가 우선이니 청약홈에서 꼭 확인하세요.'
                : '정기적금 단리 기준 예상값이에요. 우대금리는 연 이율에 더해서 넣고, 기여금 이자·중도해지는 반영하지 않아요.'}</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-dark-border/60 flex items-center gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {form.id && (
                <button onClick={remove} className="h-12 px-4 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">삭제</button>
              )}
              <p className="flex-1 text-xs text-rose-500 min-w-0 truncate">{formErr}</p>
              <button onClick={save} disabled={!!formErr || saving}
                className="h-12 px-6 rounded-xl bg-primary-600 text-white text-sm font-bold disabled:opacity-40">{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
};

// ── 주택청약 ──
type HousingSum = ReturnType<typeof housingSummary>;
const Row = ({ k, v, accent }: { k: React.ReactNode; v: React.ReactNode; accent?: boolean }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500 min-w-0">{k}</span>
    <span className={`font-semibold text-right ${accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-dark-text'}`}>{v}</span>
  </div>
);
const man = (won: number) => `${(won / 10_000).toLocaleString()}만`;

const HousingCard = ({ s, h }: { s: Savings; h: HousingSum }) => {
  const region = s.region ?? 'SEOUL_BUSAN';
  const goal = h.nextTier ?? h.tiers[h.tiers.length - 1];
  const pct = goal > 0 ? Math.min((h.principal / goal) * 100, 100) : 0;
  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <p className="font-semibold text-slate-900 dark:text-dark-text truncate min-w-0 flex-1">
          🏠 {s.name}{s.bank && <span className="text-xs font-normal text-slate-400 ml-1.5">{s.bank}</span>}
        </p>
        <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">계속 납입</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-dark-text">{fmt(h.principal)}원</p>
          <p className="text-xs text-slate-400 tabular-nums">월 {fmt(s.monthlyAmount)}원 · 연 {s.ratePct}%{s.balanceOverride != null ? ' · 은행 잔액' : ''}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">청약 인정 금액</p>
          <p className="text-sm font-semibold tabular-nums text-violet-600 dark:text-violet-400">{fmt(h.recognized)}원</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11px] text-slate-400 tabular-nums">
        <span className="min-w-0 truncate">
          {h.tierIdx >= 0 ? `민영 ${AREA_LABELS[h.tierIdx]} 예치금 충족` : `민영 85㎡ 예치금까지 ${fmt(h.tiers[0] - h.principal)}원`}
          {h.nextTier && h.tierIdx >= 0 && ` · 다음 ${man(h.nextTier)}`} ({REGION_LABEL[region]})
        </span>
        <span className="shrink-0">{h.paid}회 · 가입 {h.joinedMonths}개월</span>
      </div>
      {s.householdHead && (
        <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">올해 소득공제 예상 {fmt(h.deductionExpected)}원</p>
      )}
    </>
  );
};

const HousingFields = ({ form, set }: { form: Form; set: (p: Partial<Form>) => void }) => (
  <>
    <label className={FIELD}>
      <span className="text-xs text-slate-400 mr-2 shrink-0">현재 잔액</span>
      <input inputMode="numeric" value={form.balance} placeholder="은행 앱 잔액 (비우면 월 납입액 × 회차)" onChange={e => set({ balance: fmtNum(e.target.value) })} className={`${FIELD_INPUT} text-right`} />
      <span className="text-xs text-slate-400 ml-1">원</span>
    </label>
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">청약할 지역 (민영주택 예치금 기준)</p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(REGION_LABEL) as HousingRegion[]).map(r => (
          <button key={r} type="button" onClick={() => set({ region: r })}
            className={`h-11 rounded-xl text-sm font-medium ${form.region === r ? 'bg-primary-600 text-white' : 'bg-slate-50 dark:bg-dark-bg text-slate-500'}`}>{REGION_LABEL[r]}</button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-1">인천은 기타 광역시, 경기는 기타 시·군이에요</p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className={FIELD}>
        <span className="text-xs text-slate-400 mr-2 shrink-0">연 이율</span>
        <input inputMode="decimal" value={form.ratePct} placeholder="0.5" onChange={e => set({ ratePct: e.target.value.replace(/[^0-9.]/g, '') })} className={`${FIELD_INPUT} text-right`} />
        <span className="text-xs text-slate-400 ml-1">%</span>
      </label>
      <button type="button" onClick={() => set({ householdHead: !form.householdHead })} aria-pressed={form.householdHead}
        className={`h-11 rounded-xl text-sm font-medium ${form.householdHead ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-dark-bg text-slate-500'}`}>
        {form.householdHead ? '✓ 무주택 세대주' : '무주택 세대주 아님'}
      </button>
    </div>
  </>
);

const HousingPreview = ({ h, region, householdHead }: { h: HousingSum; region: HousingRegion; householdHead: boolean }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm tabular-nums space-y-3">
    <div className="space-y-1">
      <Row k="지금까지 납입" v={`${h.paid}회 · ${fmt(h.principal)}원`} />
      <Row k="청약 인정 금액" v={`${fmt(h.recognized)}원`} />
      {h.overCap && <p className="text-[11px] text-amber-600 dark:text-amber-400">월 {fmt(RECOGNIZE_CAP)}원을 넘는 금액은 청약 인정이 안 돼요 (국민주택 선정 기준)</p>}
      <Row k="연 이자 (대략)" v={`${fmt(h.yearlyInterest)}원`} />
    </div>
    <div>
      <p className="text-xs text-slate-500 mb-1">민영주택 예치금 · {REGION_LABEL[region]}</p>
      <div className="grid grid-cols-4 gap-1">
        {h.tiers.map((t, i) => (
          <div key={i} className={`rounded-lg px-1.5 py-1.5 text-center ${i <= h.tierIdx ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-white dark:bg-dark-bg text-slate-400'}`}>
            <p className="text-[10px] leading-tight">{AREA_LABELS[i]}</p>
            <p className="text-xs font-semibold">{i <= h.tierIdx ? '✓ ' : ''}{man(t)}</p>
          </div>
        ))}
      </div>
    </div>
    <div>
      <p className="text-xs text-slate-500 mb-1">1순위 가입기간 · 지금 {h.joinedMonths}개월</p>
      <div className="flex flex-wrap gap-1">
        {FIRST_RANK.map(r => {
          const ok = h.joinedMonths >= r.months && h.paid >= r.months;
          return (
            <span key={r.label} className={`rounded-full px-3 py-1 text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-white dark:bg-dark-bg text-slate-400'}`}>
              {ok ? '✓ ' : ''}{r.label} {r.months}개월
            </span>
          );
        })}
      </div>
    </div>
    <div className="space-y-1">
      {householdHead ? (<>
        <Row k={`올해 납입 (${fmt(h.paidThisYear)}원)`} v={`공제 ${fmt(h.deductionNow)}원`} />
        <Row k={`연말까지 (${fmt(h.expectedThisYear)}원)`} v={`공제 ${fmt(h.deductionExpected)}원`} accent />
        <p className="text-[11px] text-slate-400">연 300만 원까지 40% 소득공제 · 총급여 7천만 원 이하, 연말정산 때 은행 무주택 확인서 제출</p>
      </>) : (
        <p className="text-[11px] text-slate-400">무주택 세대주면 연 300만 원 한도로 40% 소득공제를 받을 수 있어요</p>
      )}
    </div>
  </div>
);
