/* 탐험 퀴즈 게임 – Service Worker */
const CACHE_NAME = 'quiz-game-v1';

// 오프라인에서도 열리도록 캐시할 정적 파일
const STATIC_ASSETS = [
  '/index.html',
  '/map.html',
  '/quiz.html',
  '/qr-scan.html',
  '/shop.html',
  '/css/style.css',
  '/js/config.js',
  '/manifest.json',
  '/icons/icon.svg'
];

// ── install: 정적 파일 사전 캐시 ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 일부 파일이 없어도 설치 실패하지 않도록
      });
    })
  );
  self.skipWaiting();
});

// ── activate: 오래된 캐시 정리 ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── fetch: Network-first (Firebase API), Cache-first (static) ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase / 외부 API는 항상 네트워크 우선
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('leafletjs.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 정적 파일: Cache-first → 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 정상 응답이면 캐시에 저장
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
