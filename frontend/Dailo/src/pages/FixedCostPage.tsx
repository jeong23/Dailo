import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { formatNumber, parseNumber } from '../utils/format';
import { useEscapeKey } from '../hooks/useEscapeKey';

type CostType = 'RECURRING' | 'INSTALLMENT';
type InstallmentStatus = 'UPCOMING' | 'ONGOING' | 'DONE';

interface FixedCost {
  id: number;
  name: string;
  amount: number;
  isActive: boolean;
  sortOrder: number;
  costType: CostType;
  installmentStart?: string;   // 첫 결제일 YYYY-MM-DD
  installmentMonths?: number;
  installmentEnd?: string;     // 마지막 결제일
  paidMonths?: number;
  remainingMonths?: number;
  installmentStatus?: InstallmentStatus;
  countedThisMonth: boolean;   // 이번 달 합계 포함 여부 (백엔드 합계 쿼리와 같은 기준)
}

const MONTH_PRESETS = [3, 6, 10, 12, 24];

// 로컬 기준 오늘 (toISOString은 UTC라 KST 오전 9시 전엔 어제가 됨)
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatYm = (ymd?: string) => {
  if (!ymd) return '';
  const [y, m] = ymd.split('-');
  return `${y}.${m}`;
};

const byAmountDesc = (a: FixedCost, b: FixedCost) => b.amount - a.amount;

// 할부 진행 문구
const installmentLabel = (item: FixedCost) => {
  const total = item.installmentMonths ?? 0;
  const paid = item.paidMonths ?? 0;
  const remaining = item.remainingMonths ?? 0;
  if (item.installmentStatus === 'UPCOMING') return `${formatYm(item.installmentStart)} 시작 · ${total}개월`;
  if (item.installmentStatus === 'DONE') return `${total}개월 완납`;
  if (remaining === 0) return `${paid}/${total}회차 · 이번 달 마지막`;
  return `${paid}/${total}회차 · ${remaining}개월 남음`;
};

export const FixedCostPage = () => {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FixedCost | null>(null);
  useEscapeKey(isModalOpen, () => setIsModalOpen(false));

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [costType, setCostType] = useState<CostType>('RECURRING');
  const [installmentStart, setInstallmentStart] = useState(todayYmd());
  const [installmentMonths, setInstallmentMonths] = useState('12');

  const fetchData = async () => {
    try {
      const res = await api.get('/fixed-costs/mine');
      setFixedCosts(res.data.data || []);
    } catch (error) {
      console.error('고정비 로드 실패:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setName('');
    setAmount('');
    setCostType('RECURRING');
    setInstallmentStart(todayYmd());
    setInstallmentMonths('12');
    setEditingItem(null);
  };

  const openCreateModal = (type: CostType = 'RECURRING') => {
    resetForm();
    setCostType(type);
    setIsModalOpen(true);
  };

  const openEditModal = (item: FixedCost) => {
    setEditingItem(item);
    setName(item.name);
    setAmount(formatNumber(item.amount));
    setCostType(item.costType);
    setInstallmentStart(item.installmentStart || todayYmd());
    setInstallmentMonths(String(item.installmentMonths || 12));
    setIsModalOpen(true);
  };

  const toBody = (item: FixedCost, isActive: boolean) => ({
    name: item.name,
    amount: item.amount,
    isActive,
    sortOrder: item.sortOrder,
    costType: item.costType,
    installmentStart: item.installmentStart ?? null,
    installmentMonths: item.installmentMonths ?? null,
  });

  const months = parseInt(installmentMonths, 10);
  const monthsValid = costType === 'RECURRING' || (months >= 1 && months <= 120 && !!installmentStart);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthsValid) return;
    const isInstallment = costType === 'INSTALLMENT';
    const body = {
        name,
      amount: parseNumber(amount),
      isActive: editingItem ? editingItem.isActive : true,
      sortOrder: editingItem ? editingItem.sortOrder : fixedCosts.length + 1,
      costType,
      installmentStart: isInstallment ? installmentStart : null,
      installmentMonths: isInstallment ? months : null,
    };

    try {
      if (editingItem) {
        await api.put(`/fixed-costs/${editingItem.id}`, body);
      } else {
        await api.post('/fixed-costs', body);
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('저장 실패:', error);
      alert(error?.response?.data?.message || '저장 실패');
    }
  };

  const handleToggleActive = async (item: FixedCost) => {
    try {
      await api.put(`/fixed-costs/${item.id}`, toBody(item, !item.isActive));
      fetchData();
    } catch (error) {
      console.error('수정 실패:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await api.delete(`/fixed-costs/${id}`);
      fetchData();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const recurring = fixedCosts.filter(f => f.costType !== 'INSTALLMENT').sort(byAmountDesc);
  // 할부: 진행 중·시작 전 먼저(금액 DESC), 완납은 맨 아래
  const installments = fixedCosts.filter(f => f.costType === 'INSTALLMENT').sort((a, b) => {
    const aDone = a.installmentStatus === 'DONE' ? 1 : 0;
    const bDone = b.installmentStatus === 'DONE' ? 1 : 0;
    return aDone - bDone || byAmountDesc(a, b);
  });

  const sumCounted = (list: FixedCost[]) => list.filter(f => f.countedThisMonth).reduce((sum, f) => sum + f.amount, 0);
  const recurringTotal = sumCounted(recurring);
  const installmentTotal = sumCounted(installments);
  const totalThisMonth = recurringTotal + installmentTotal;

  const EditIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
  const DeleteIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const ActiveBadge = ({ item, size = 'sm' }: { item: FixedCost; size?: 'sm' | 'md' }) => (
    <button onClick={() => handleToggleActive(item)}
      className={`${size === 'md' ? 'px-3' : 'px-2.5'} py-1 rounded-full text-xs font-medium transition-colors ${
        item.isActive
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
      }`}>
      {item.isActive ? '활성' : '비활성'}
    </button>
  );

  const InstallmentProgress = ({ item }: { item: FixedCost }) => {
    const total = item.installmentMonths ?? 0;
    const pct = total > 0 ? Math.min(100, ((item.paidMonths ?? 0) / total) * 100) : 0;
    const done = item.installmentStatus === 'DONE';
    return (
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
        <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const dimmed = (item: FixedCost) => !item.isActive || item.installmentStatus === 'DONE';

  const Section = ({ title, desc, items, total, type }: {
    title: string; desc: string; items: FixedCost[]; total: number; type: CostType;
  }) => {
    const isInstallment = type === 'INSTALLMENT';
    return (
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-dark-text">{title}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isInstallment
                  ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300'
                  : 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
              }`}>{items.length}건</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-dark-muted mt-0.5 truncate">
              {desc} · 이번 달 <span className="font-semibold text-rose-500 tabular-nums">{total.toLocaleString()}원</span>
            </p>
          </div>
          <button onClick={() => openCreateModal(type)}
            className="shrink-0 min-h-[44px] px-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            + 추가
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-6 pb-10 pt-4 text-center text-sm text-slate-400">
            {isInstallment ? '등록된 할부가 없습니다.' : '등록된 고정비가 없습니다.'}
          </p>
        ) : (
          <>
            {/* 모바일 카드 목록 */}
            <div className="divide-y divide-slate-50 dark:divide-dark-border/50 border-t border-slate-50 dark:border-dark-border/50 lg:hidden">
              {items.map(item => (
                <div key={item.id} className={`px-4 py-3.5 ${dimmed(item) ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-dark-text truncate">{item.name}</p>
                      <p className="text-sm font-semibold text-rose-500 tabular-nums mt-0.5">
                        {item.amount.toLocaleString()}원{isInstallment && <span className="text-xs font-normal text-slate-400"> /월</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ActiveBadge item={item} />
                      <button onClick={() => openEditModal(item)} className="w-11 h-11 flex items-center justify-center text-slate-300 hover:text-primary-500 transition-colors"><EditIcon /></button>
                      <button onClick={() => handleDelete(item.id)} className="w-11 h-11 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                    </div>
                  </div>
                  {isInstallment && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="font-medium text-violet-600 dark:text-violet-300 truncate">{installmentLabel(item)}</span>
                        <span className="text-slate-400 tabular-nums shrink-0">{formatYm(item.installmentStart)} ~ {formatYm(item.installmentEnd)}</span>
                      </div>
                      <InstallmentProgress item={item} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 데스크탑 테이블 */}
            <table className="hidden lg:table w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <th className="px-6 py-3">항목명</th>
                  <th className="px-6 py-3 text-right">{isInstallment ? '월 납부액' : '금액'}</th>
                  {isInstallment && <th className="px-6 py-3">기간</th>}
                  {isInstallment && <th className="px-6 py-3 w-64">진행</th>}
                  <th className="px-6 py-3 text-center">상태</th>
                  <th className="px-6 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
                {items.map((item) => (
                  <tr key={item.id} className={`transition-colors hover:bg-primary-50/30 dark:hover:bg-slate-800/30 ${dimmed(item) ? 'opacity-40' : ''}`}>
                    <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-dark-text">{item.name}</td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-rose-500">{item.amount.toLocaleString()}원</td>
                    {isInstallment && (
                      <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-dark-muted tabular-nums whitespace-nowrap">
                        {formatYm(item.installmentStart)} ~ {formatYm(item.installmentEnd)}
                      </td>
                    )}
                    {isInstallment && (
                      <td className="px-6 py-3.5">
                        <p className="text-xs font-medium text-violet-600 dark:text-violet-300 mb-1.5">{installmentLabel(item)}</p>
                        <InstallmentProgress item={item} />
                      </td>
                    )}
                    <td className="px-6 py-3.5 text-center"><ActiveBadge item={item} size="md" /></td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(item)} className="text-slate-300 hover:text-primary-500 transition-colors"><EditIcon /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  };

  const inputClass = 'w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500';

  // 모달 미리보기: 마지막 결제월
  const previewEnd = (() => {
    if (costType !== 'INSTALLMENT' || !monthsValid) return '';
    const [y, m] = installmentStart.split('-').map(Number);
    const end = new Date(y, m - 1 + months - 1, 1);
    return `${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, '0')}`;
  })();

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-end gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">매월 고정 지출</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">고정비 관리</h1>
          <p className="text-sm text-slate-400 dark:text-dark-muted mt-1">
            이번 달 합계 <span className="font-semibold text-rose-500 tabular-nums">{totalThisMonth.toLocaleString()}원</span>
          </p>
        </div>
        <button onClick={() => openCreateModal()} className="shrink-0 px-4 py-1.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition-colors">
          + 추가
        </button>
      </div>

      <Section title="매달 고정" desc="끝나는 날 없이 계속" items={recurring} total={recurringTotal} type="RECURRING" />
      <Section title="할부" desc="정해진 개월만" items={installments} total={installmentTotal} type="INSTALLMENT" />

      {/* 모달 — 모바일 바텀시트 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[90dvh] overflow-y-auto themed-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-dark-text">
                {editingItem ? '고정비 수정' : '고정비 추가'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-11 h-11 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* 종류 세그먼트 */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                {([['RECURRING', '매달 고정'], ['INSTALLMENT', '할부']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setCostType(value)}
                    className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                      costType === value
                        ? 'bg-white dark:bg-dark-card text-slate-900 dark:text-dark-text shadow-sm'
                        : 'text-slate-500 dark:text-dark-muted'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">항목명</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder={costType === 'INSTALLMENT' ? '예: 노트북 할부, 휴대폰' : '예: 보험_삼성, 통신비'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">
                  {costType === 'INSTALLMENT' ? '월 납부액' : '금액'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(formatNumber(e.target.value))}
                  className={inputClass}
                  placeholder="0"
                  required
                />
              </div>

              {costType === 'INSTALLMENT' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-dark-muted">첫 결제일</label>
                    <input
                      type="date"
                      value={installmentStart}
                      onChange={(e) => setInstallmentStart(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-dark-muted">할부 개월</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {MONTH_PRESETS.map(n => (
                        <button key={n} type="button" onClick={() => setInstallmentMonths(String(n))}
                          className={`min-h-[36px] px-3 rounded-full text-xs font-medium transition-colors ${
                            months === n
                              ? 'bg-violet-600 text-white'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-dark-muted'
                          }`}>
                          {n}개월
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={120}
                      step={1}
                      value={installmentMonths}
                      onChange={(e) => setInstallmentMonths(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      className={inputClass}
                      required
                    />
                    {previewEnd && (
                      <p className="text-xs text-slate-400 dark:text-dark-muted mt-1.5">
                        {formatYm(installmentStart)} ~ {previewEnd} · 총 {(parseNumber(amount) * months).toLocaleString()}원
                      </p>
                    )}
                    {!monthsValid && <p className="text-xs text-rose-500 mt-1.5">1~120개월 사이로 입력해주세요.</p>}
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2 pb-safe">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-dark-border rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-dark-text"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!monthsValid}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors disabled:opacity-40"
                >
                  {editingItem ? '수정하기' : '추가하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
