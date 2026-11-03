import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { markActivity, takeLogoutReason } from '../utils/session';

// "2026-12-03T11:20:00" → "2026년 12월 3일"
const formatPurgeDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // 탈퇴 유예 중 계정 — 서버가 비밀번호 확인 후 409로 알려줌. 복구하면 restore:true로 다시 로그인
  const [withdrawnUntil, setWithdrawnUntil] = useState<string | null>(null);
  // 자동 로그아웃으로 왔으면 이유 안내 (한 번 읽고 지움)
  const [notice] = useState(() => {
    const reason = takeLogoutReason();
    if (reason === 'timeout') return '1시간 동안 사용하지 않아 자동 로그아웃됐어요. 다시 로그인해 주세요.';
    if (reason === 'expired') return '로그인이 만료됐어요. 다시 로그인해 주세요.';
    if (reason === 'withdrawn') return '탈퇴 처리됐어요. 30일 안에 다시 로그인하면 계정을 복구할 수 있어요.';
    return '';
  });

  const login = async (restore = false) => {
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username: username.trim(), password, restore });
      const { token, memberId, name, salaryDay } = res.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('memberId', String(memberId));
      localStorage.setItem('memberName', name);
      localStorage.setItem('salaryDay', String(salaryDay ?? 25));
      markActivity();

      navigate('/', { replace: true });
    } catch (err: any) {
      const status = err?.response?.status;
      const withdrawn = err?.response?.data?.data;
      if (status === 409 && withdrawn?.code === 'WITHDRAWN') setWithdrawnUntil(withdrawn.purgeAt);
      else if (!err?.response) setError('서버에 연결할 수 없습니다. 네트워크(Tailscale) 연결을 확인하세요.');
      // 백엔드가 인증 실패(BadCredentialsException)를 500으로 반환하므로 500도 계정 오류로 안내
      else if (status === 401 || status === 400 || status === 500) setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      else setError(`서버 오류가 발생했습니다. (${status})`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawnUntil(null);
    login();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <img
            src="/dailo_logo_nobg.png"
            alt="Dailo"
            className="h-10 w-auto object-contain mx-auto mb-2 dark:brightness-200"
          />
          <p className="text-sm text-slate-400 dark:text-slate-500">나만의 생활 관리 대시보드</p>
        </div>

        {/* 카드 */}
        <div className="bg-white dark:bg-dark-card rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-none p-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-6">로그인</h1>

          {notice && !error && !withdrawnUntil && (
            <p role="status" className="mb-5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-300">
              {notice}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-dark-muted mb-1.5">
                아이디
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                placeholder="아이디를 입력하세요"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-dark-muted mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                  placeholder="비밀번호를 입력하세요"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 font-medium">{error}</p>
            )}

            {withdrawnUntil && (
              <div role="alert" className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">탈퇴 처리된 계정이에요</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {formatPurgeDate(withdrawnUntil)}에 모든 기록이 삭제돼요. 그 전에는 지금 바로 복구할 수 있어요.
                </p>
                <button type="button" onClick={() => login(true)} disabled={loading}
                  className="w-full min-h-[44px] rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors">
                  계정 복구하고 로그인
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            계정이 없나요?{' '}
            <Link to="/signup" className="inline-flex items-center min-h-[44px] font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};