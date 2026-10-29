import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initTheme } from './utils/theme';

// 렌더 전에 화면 모드·색 테마 적용 (깜빡임 방지)
initTheme();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// PWA 설치 가능 조건(서비스 워커) — 운영 빌드에서만 등록
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
