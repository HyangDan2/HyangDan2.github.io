/**
 * PKPilot0001 · HD2Lab | Photos
 * sw.js — 오프라인 셸 캐시
 *
 * 전략
 *  · 앱 셸(HTML/CSS/JS/아이콘): stale-while-revalidate
 *  · 원격 사진(images.unsplash.com): cache-first + 백그라운드 갱신 (실패 시 SVG 폴백이 담당)
 *  · 문서 요청: network-first, 실패 시 캐시된 index.html
 */

const CACHE_PREFIX = 'hd2lab-photos-';
const LEGACY_CACHE_PREFIXES = ['pkpilot0001-v1.0.0'];
const VERSION = `${CACHE_PREFIX}v1.1.0-brand`;
const SHELL_CACHE = `${VERSION}-shell`;
const IMAGE_CACHE = `${VERSION}-images`;
const ACTIVE_CACHES = [SHELL_CACHE, IMAGE_CACHE];

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/mockData.js',
  './js/store.js',
  './js/auth.js',
  './js/viewer.js',
  './manifest.json',
  './favicon.ico',
  './favicon.svg',
  './favicon-32x32.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './og-image.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // 같은 오리진의 다른 앱(AGPilot0002 등) 캐시는 절대 지우지 않는다.
            .filter(
              (key) =>
                (key.startsWith(CACHE_PREFIX) ||
                  LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) &&
                !ACTIVE_CACHES.includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
      })
      .catch(() => undefined);
    return cached;
  }
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  if (request.destination === 'image' || /images\.unsplash\.com$/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE).catch(() => Response.error()));
  }
});
