import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { markActivity } from '../utils/session';

// 입력 규칙 — 백엔드 MemberService.create와 같은 기준
const USERNAME_RE = /^[a-z0-9_]{4,20}$/;
const passwordOk = (pw: string) => pw.length >= 8 && pw.length <= 64 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text outline-none focus:ring-2 focus:ring-primary-500 transition-shadow';

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-slate-600 dark:text-dark-muted mb-1.5">{label}</label>
    {children}
    {error ? (
      <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400">{error}</p>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    ) : null}
  </div>
);

export const SignupPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [salaryDay, setSalaryDay] = useState(25);
  const [showPassword, setShowPassword] = useState(false);
  // 칸을 한 번 벗어난 뒤부터 오류 표시 — 입력 중에 빨간 글씨가 먼저 뜨지 않게
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const errors = {
    username: !username ? '아이디를 입력하세요.' : !USERNAME_RE.test(username) ? '영문 소문자·숫자·밑줄(_) 4~20자로 만들어 주세요.' : '',
    name: !name.trim() ? '이름을 입력하세요.' : name.trim().length > 30 ? '30자까지 입력할 수 있어요.' : '',
    password: !password ? '비밀번호를 입력하세요.' : !passwordOk(password) ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : '',
    password2: password2 !== password ? '비밀번호가 서로 달라요.' : '',
  };
  const valid = Object.values(errors).every(e => !e);
  const show = (key: keyof typeof errors) => (touched[key] ? errors[key] : '');
  const touch = (key: string) => () => setTouched(t => ({ ...t, [key]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, name: true, password: true, password2: true });
    if (!valid) return;
    setServerError('');
    setLoading(true);
    try {
      await api.post('/members', { username, name: name.trim(), password, salaryDay });
      // 가입 직후 바로 로그인
      const res = await api.post('/auth/login', { username, password });
      const { token, memberId, name: memberName, salaryDay: day } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('memberId', String(memberId));
      localStorage.setItem('memberName', memberName);
      localStorage.setItem('salaryDay', String(day ?? 25));
      markActivity();
      navigate('/', { replace: true });
    } catch (err: any) {
      if (!err?.response) setServerError('서버에 연결할 수 없어요. 네트워크 연결을 확인하세요.');
      else setServerError(err.response.data?.message || `가입에 실패했어요. (${err.response.status})`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-dark-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/dailo_logo_nobg.png" alt="Dailo" className="h-10 w-auto object-contain mx-auto mb-2 dark:brightness-200" />
          <p className="text-sm text-slate-400 dark:text-slate-500">나만의 생활 관리 대시보드</p>
        </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-none p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-6">회원가입</h1>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field label="아이디" hint="영문 소문자·숫자·밑줄(_) 4~20자" error={show('username')}>
              <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                onBlur={touch('username')} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
                maxLength={20} className={inputClass} placeholder="dailo_user" autoFocus />
            </Field>

            <Field label="이름" hint="화면에 표시돼요" error={show('name')}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} onBlur={touch('name')}
                autoComplete="nickname" maxLength={30} className={inputClass} placeholder="홍길동" />
            </Field>

            <Field label="비밀번호" hint="영문과 숫자를 섞어 8자 이상" error={show('password')}>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  onBlur={touch('password')} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  autoComplete="new-password" maxLength={64} className={`${inputClass} pr-16`} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] px-3 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </Field>

            <Field label="비밀번호 확인" error={show('password2')}>
              <input type={showPassword ? 'text' : 'password'} value={password2} onChange={e => setPassword2(e.target.value)}
                onBlur={touch('password2')} autoComplete="new-password" maxLength={64} className={inputClass} />
            </Field>

            <Field label="월급일" hint="이 날부터 다음 월급 전날까지를 한 달(정산월)로 묶어요. 나중에 예산 설정에서 바꿀 수 있어요.">
              <select value={salaryDay} onChange={e => setSalaryDay(Number(e.target.value))} className={inputClass}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>매달 {d}일</option>
                ))}
              </select>
            </Field>

            {serverError && <p role="alert" className="text-sm text-red-500 dark:text-red-400 font-medium">{serverError}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2">
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            이미 계정이 있나요?{' '}
            <Link to="/login" className="inline-flex items-center min-h-[44px] font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
