// 로그인 세션 — 1시간 동안 아무것도 안 하면 로그아웃
// 서버 토큰도 1시간(JwtUtil.EXPIRATION_MS)이라, 사용 중에는 useSessionTimeout이 /auth/refresh로 토큰을 계속 연장한다.
// 마지막 활동 시각은 localStorage에 둬서 여러 탭이 같은 시계를 본다 (한 탭에서 쓰는 중이면 다른 탭도 안 끊김).

export const IDLE_LIMIT_MS = 60 * 60 * 1000;
export const WARN_BEFORE_MS = 5 * 60 * 1000;        // 만료 5분 전 안내
export const REFRESH_WHEN_LEFT_MS = 30 * 60 * 1000;  // 토큰 남은 시간이 30분 아래면 연장

const ACTIVITY_KEY = 'lastActivity';
const REASON_KEY = 'logoutReason';

export type LogoutReason = 'timeout' | 'expired' | 'withdrawn';

export const markActivity = (now = Date.now()) => {
  try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch {}
};

export const lastActivity = (): number => {
  const v = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(v) && v > 0 ? v : Date.now();
};

// JWT payload의 exp(초) → ms. 형식이 이상하면 null
export const tokenExpiresAt = (token: string | null): number | null => {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(payload)).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
};

// 토큰이 있고, 만료 전이고, 마지막 활동이 1시간 안
export const isSessionAlive = (now = Date.now()): boolean => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  const exp = tokenExpiresAt(token);
  if (exp !== null && exp <= now) return false;
  const last = Number(localStorage.getItem(ACTIVITY_KEY));
  if (last > 0 && now - last >= IDLE_LIMIT_MS) return false;
  return true;
};

export const clearSession = () => {
  ['token', 'memberId', 'memberName', ACTIVITY_KEY].forEach(k => localStorage.removeItem(k));
};

export const endSession = (reason?: LogoutReason) => {
  // 이미 다른 탭/요청이 정리했으면 사유만 남기고 이동
  if (reason) {
    try { sessionStorage.setItem(REASON_KEY, reason); } catch {}
  }
  clearSession();
  if (window.location.pathname !== '/login') window.location.href = '/login';
};

// 토큰은 남았는데 만료·무활동 1시간 지난 상태(오래 닫아뒀다 연 경우) → 사유 남기고 정리. 이동은 호출부(<Navigate>)가
export const expireStaleSession = () => {
  if (!localStorage.getItem('token') || isSessionAlive()) return;
  try { sessionStorage.setItem(REASON_KEY, 'timeout'); } catch {}
  clearSession();
};

// 로그인 화면에서 한 번 읽고 지움
export const takeLogoutReason = (): LogoutReason | null => {
  try {
    const r = sessionStorage.getItem(REASON_KEY) as LogoutReason | null;
    sessionStorage.removeItem(REASON_KEY);
    return r;
  } catch {
    return null;
  }
};
