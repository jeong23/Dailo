import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'installPromptDismissed';

// Chrome이 설치 가능하다고 판단하면(beforeinstallprompt) 하단에 "앱 설치" 배너를 띄운다.
// 이미 설치돼 standalone으로 실행 중이거나, 사용자가 닫았으면 표시하지 않는다.
export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* localStorage 접근 불가 시 그대로 표시 */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-[60] flex justify-center px-4">
      <div className="flex items-center gap-3 w-full max-w-sm rounded-2xl bg-white dark:bg-dark-card shadow-2xl px-4 py-3">
        <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-dark-text truncate">Dailo 앱 설치</p>
          <p className="text-xs text-slate-400 truncate">홈 화면에 추가해서 앱처럼 사용하세요</p>
        </div>
        <button
          onClick={install}
          className="min-h-[44px] rounded-full bg-primary-500 px-4 text-sm font-medium text-white shrink-0"
        >
          설치
        </button>
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="min-h-[44px] min-w-[44px] text-slate-400 shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
