import React, { useState, useEffect } from 'react';
import api, { getStoredMemberId } from '../api/axios';
import { formatNumber, parseNumber } from '../utils/format';

interface FixedCost {
  id: number;
  name: string;
  amount: number;
  isActive: boolean;
  sortOrder: number;
}

export const FixedCostPage = () => {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FixedCost | null>(null);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const fetchData = async () => {
    try {
      const res = await api.get(`/fixed-costs/member/${getStoredMemberId()}`);
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
    setEditingItem(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (item: FixedCost) => {
    setEditingItem(item);
    setName(item.name);
    setAmount(formatNumber(item.amount));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      memberId: getStoredMemberId(),
      name,
      amount: parseNumber(amount),
      isActive: true,
      sortOrder: fixedCosts.length + 1,
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
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 실패');
    }
  };

  const handleToggleActive = async (item: FixedCost) => {
    try {
      await api.put(`/fixed-costs/${item.id}`, {
        memberId: getStoredMemberId(),
        name: item.name,
        amount: item.amount,
        isActive: !item.isActive,
        sortOrder: item.sortOrder,
      });
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

  const totalActive = fixedCosts
    .filter(f => f.isActive)
    .reduce((sum, f) => sum + f.amount, 0);

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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">매월 고정 지출</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-dark-text">고정비 관리</h1>
          <p className="text-sm text-slate-400 dark:text-dark-muted mt-1">
            활성 합계 <span className="font-semibold text-rose-500 tabular-nums">{totalActive.toLocaleString()}원</span>
          </p>
        </div>
        <button onClick={openCreateModal} className="px-4 py-1.5 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 transition-colors">
          + 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden">
        {fixedCosts.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">등록된 고정비가 없습니다.</p>
        ) : (
          <>
            {/* 모바일 카드 목록 */}
            <div className="divide-y divide-slate-50 dark:divide-dark-border/50 md:hidden">
              {fixedCosts.map(item => (
                <div key={item.id} className={`px-4 py-3.5 flex items-center gap-3 ${!item.isActive ? 'opacity-40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-dark-text truncate">{item.name}</p>
                    <p className="text-sm font-semibold text-rose-500 tabular-nums mt-0.5">{item.amount.toLocaleString()}원</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggleActive(item)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        item.isActive
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                      }`}>
                      {item.isActive ? '활성' : '비활성'}
                    </button>
                    <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-300 hover:text-primary-500 transition-colors"><EditIcon /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><DeleteIcon /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* 데스크탑 테이블 */}
            <table className="hidden md:table w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/30 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <th className="px-6 py-3">항목명</th>
                  <th className="px-6 py-3 text-right">금액</th>
                  <th className="px-6 py-3 text-center">상태</th>
                  <th className="px-6 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-dark-border/50">
                {fixedCosts.map((item) => (
                  <tr key={item.id} className={`transition-colors hover:bg-primary-50/30 dark:hover:bg-slate-800/30 ${!item.isActive ? 'opacity-40' : ''}`}>
                    <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-dark-text">{item.name}</td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-rose-500">{item.amount.toLocaleString()}원</td>
                    <td className="px-6 py-3.5 text-center">
                      <button onClick={() => handleToggleActive(item)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                        }`}>
                        {item.isActive ? '활성' : '비활성'}
                      </button>
                    </td>
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

      {/* 모달 — 모바일 바텀시트 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-dark-text">
                {editingItem ? '고정비 수정' : '고정비 추가'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">항목명</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="예: 보험_삼성, 통신비"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-dark-muted">금액</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(formatNumber(e.target.value))}
                  className="w-full p-2.5 rounded-lg border dark:bg-dark-bg dark:border-dark-border dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                  required
                />
              </div>
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
                  className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors"
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