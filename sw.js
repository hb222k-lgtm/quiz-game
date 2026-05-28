/* 탐험 퀴즈 게임 – Service Worker v3 */
const CACHE_NAME = 'quiz-game-v4';

// ── install: 즉시 활성화 ───────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── activate: 이전 캐시 전부 삭제 ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── fetch: Firebase/외부 API 제외하고 Network-first ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 외부 리소스는 그냥 네트워크
  if (url.hostname !== location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 같은 도메인 요청: Network-first, 실패 시 캐시
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
