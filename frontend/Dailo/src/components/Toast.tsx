import React, { useState, useCallback, useRef, useEffect } from 'react';

// alert() 대신 쓰는 하단 토스트 — useToast()가 반환한 show로 띄우고 <Toast {...toast} />로 렌더
export type ToastTone = 'success' | 'error';

export function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show };
}

export const Toast = ({ toast }: { toast: { message: string; tone: ToastTone } | null }) => {
  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        className={`pointer-events-auto max-w-sm w-full sm:w-auto rounded-2xl px-5 py-3 text-sm font-medium shadow-2xl text-white ${
          toast.tone === 'error' ? 'bg-rose-500' : 'bg-slate-900 dark:bg-slate-700'
        }`}
      >
        {toast.tone === 'success' ? '✓ ' : '⚠ '}{toast.message}
      </div>
    </div>
  );
};
