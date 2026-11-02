import axios from 'axios';
import { endSession, isSessionAlive } from '../utils/session';

const instance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

instance.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  res => res,
  error => {
    // 토큰 만료·없음 → 로그인으로 (로그인 요청 자체의 실패는 화면에서 안내)
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      endSession('expired');
    }
    return Promise.reject(error);
  }
);

export const getStoredMemberId = (): number =>
  parseInt(localStorage.getItem('memberId') || '1', 10);

// 토큰 있음 + 만료 전 + 1시간 안에 활동 (utils/session.ts)
export const isAuthenticated = (): boolean => isSessionAlive();

export const logout = (): void => endSession();

export default instance;