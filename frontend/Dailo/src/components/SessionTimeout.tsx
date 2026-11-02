import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import {
  IDLE_LIMIT_MS, WARN_BEFORE_MS, REFRESH_WHEN_LEFT_MS,
  markActivity, lastActivity, tokenExpiresAt, isSessionAlive, endSession,
} from '../utils/session';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
const WRITE_THROTTLE_MS = 15 * 1000;

// 1시간 무활동 자동 로그아웃 — Layout(로그인한 화면)에 한 번만 렌더
// 활동 → lastActivity 기록 + 토큰 남은 시간이 30분 아래면 연장 / 55분부터 경고 시트 / 60분이면 로그아웃
export const SessionTimeout = () => {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const refreshing = useRef(false);
  const warningOpen = useRef(false);   // 경고 중엔 마우스 움직임으로 닫히지 않게 — 버튼으로만

  const refreshTokenIfNeeded = useCallback(async () => {
    const exp = tokenExpiresAt(localStorage.getItem('token'));
    const left = exp === null ? null : exp - Date.now();
    // 30분 미만 남음 → 연장 / 1시간보다 많이 남음 = 예전 30일 토큰 → 1시간 토큰으로 교체
    if (refreshing.current || left === null || (left > REFRESH_WHEN_LEFT_MS && left <= IDLE_LIMIT_MS + 60 * 1000)) return;
    refreshing.current = true;
    try {
      const res = await api.post('/auth/refresh');
      const token = res.data?.data?.token;
      if (token) localStorage.setItem('token', token);
    } catch {
      // 401이면 axios 인터셉터가 로그아웃 처리
    } finally {
      refreshing.current = false;
    }
  }, []);

  const onActivity = useCallback(() => {
    const now = Date.now();
    if (warningOpen.current || now - lastWrite.current < WRITE_THROTTLE_MS) return;
    lastWrite.current = now;
    markActivity(now);
    setRemainingMs(null);
    refreshTokenIfNeeded();
  }, [refreshTokenIfNeeded]);

  useEffect(() => {
    // 오래 닫아뒀다 다시 연 경우 — 화면 그리기 전에 바로 로그인으로
    if (!isSessionAlive()) {
      endSession('timeout');
      return;
    }
    markActivity();
    lastWrite.current = Date.now();

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    const tick = () => {
      if (!localStorage.getItem('token')) {   // 다른 탭에서 로그아웃
        endSession();
        return;
      }
      const idle = Date.now() - lastActivity();
      if (idle >= IDLE_LIMIT_MS) {
        endSession('timeout');
      } else {
        const warn = idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS;
        warningOpen.current = warn;
        setRemainingMs(warn ? IDLE_LIMIT_MS - idle : null);
      }
    };
    const timer = setInterval(tick, 1000);
    // 백그라운드 탭은 타이머가 늦게 돌아서 돌아오는 순간 바로 확인
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onActivity]);

  if (remainingMs === null) return null;

  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mmss = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const keepGoing = () => {
    warningOpen.current = false;
    lastWrite.current = 0;
    onActivity();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="session-timeout-title">
      <div className="bg-white dark:bg-dark-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 text-center">
        <p className="text-4xl mb-3" aria-hidden>⏰</p>
        <h3 id="session-timeout-title" className="text-lg font-bold text-slate-900 dark:text-dark-text">곧 자동 로그아웃돼요</h3>
        <p className="text-sm text-slate-500 dark:text-dark-muted mt-1.5">
          1시간 동안 사용하지 않으면 로그아웃돼요.
        </p>
        <p className="text-3xl font-bold tabular-nums text-rose-500 my-4">{mmss}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => endSession()}
            className="flex-1 min-h-[44px] py-3 border border-slate-200 dark:border-dark-border rounded-xl font-medium text-slate-600 dark:text-dark-text hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            로그아웃
          </button>
          <button
            type="button"
            onClick={keepGoing}
            autoFocus
            className="flex-1 min-h-[44px] py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
          >
            계속 사용하기
          </button>
        </div>
      </div>
    </div>
  );
};
