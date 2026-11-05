import React, { useState } from 'react';
import api, { getStoredMemberId } from '../api/axios';
import { endSession } from '../utils/session';

// 회원 탈퇴 — 서버는 바로 지우지 않고 30일 유예 (그 안에 로그인하면 복구, 지나면 모든 기록 삭제)
export const WithdrawSection = ({ className }: { className: string }) => {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => { setOpen(false); setConfirmText(''); setError(''); };

  const withdraw = async () => {
    setSaving(true);
    setError('');
    try {
      await api.delete(`/members/${getStoredMemberId()}`);
      endSession('withdrawn');
    } catch {
      setError('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  return (
    <section className={className}>
      <h2 className="font-semibold text-slate-800 dark:text-dark-text">계정</h2>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400 min-w-0">
          탈퇴하면 30일 뒤 모든 기록이 삭제돼요.
        </p>
        <button onClick={() => setOpen(true)}
          className="shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium text-red-500 ring-1 ring-red-200 dark:ring-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          회원 탈퇴
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={close}>
          <div role="dialog" aria-modal="true" aria-labelledby="withdraw-title"
            className="w-full sm:max-w-md bg-white dark:bg-dark-card rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 animate-sheet-up"
            onClick={e => e.stopPropagation()}>
            <h3 id="withdraw-title" className="text-lg font-bold text-slate-900 dark:text-dark-text">정말 탈퇴할까요?</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>지금 바로 로그아웃되고, 다른 기기의 로그인도 끊겨요.</li>
              <li><b>30일 안에</b> 다시 로그인하면 그대로 복구할 수 있어요.</li>
              <li>30일이 지나면 지출·자산·투자·플래너·운동 기록이 <b>모두 삭제</b>되고 되돌릴 수 없어요.</li>
              <li>기록을 남겨 두려면 먼저 위 <b>내 데이터 내보내기</b>에서 받아 두세요.</li>
            </ul>
            <label className="block mt-5 text-sm text-slate-500 dark:text-slate-400">
              확인을 위해 <b className="text-slate-800 dark:text-slate-100">탈퇴</b>를 입력하세요
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text outline-none focus:ring-2 focus:ring-red-400" />
            </label>
            {error && <p className="mt-3 text-sm text-red-500 font-medium">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={close} className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200">
                취소
              </button>
              <button onClick={withdraw} disabled={confirmText.trim() !== '탈퇴' || saving}
                className="min-h-[44px] rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {saving ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
