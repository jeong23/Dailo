// PWA 설치 가능 조건용 최소 서비스 워커 — 캐시/오프라인 처리 없음 (항상 네트워크 사용)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
