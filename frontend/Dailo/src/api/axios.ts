import axios from 'axios';

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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('memberId');
      localStorage.removeItem('memberName');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getStoredMemberId = (): number =>
  parseInt(localStorage.getItem('memberId') || '1', 10);

export const isAuthenticated = (): boolean =>
  !!localStorage.getItem('token');

export const logout = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('memberId');
  localStorage.removeItem('memberName');
  window.location.href = '/login';
};

export default instance;