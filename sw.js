/**
 * Service Worker: precache всех ассетов + navigation fallback.
 * Стратегия: cache-first для своих файлов, network-first для навигации.
 */
const VERSION = 'v5';
const CACHE = `offline-arcade-${VERSION}`;

/** Список precache. При изменении — подними VERSION. */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/nav.js',
  './js/icons.js',
  './js/storage.js',
  './js/utils.js',
  './js/games/index.js',
  './js/games/game2048.js',
  './js/games/snake.js',
  './js/games/minesweeper.js',
  './js/games/tetris.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // стороннее не трогаем

  // Навигация: сначала сеть (обновление), при ошибке — кеш/домашняя страница
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('./index.html'))),
    );
    return;
  }

  // Статика: cache-first, обновляем кеш в фоне
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
