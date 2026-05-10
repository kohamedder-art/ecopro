// Service Worker — Cache-first strategy for static assets
// Customers on slow connections get instant loads on repeat visits

const CACHE_NAME = 'sahla4eco-v1';
const ASSET_CACHE = 'sahla4eco-assets-v1';

// Assets to precache on install (shell only — not data)
const PRECACHE_URLS = ['/'];

// Cache-first: serve from cache, update in background
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Serve from cache immediately, refresh in background
    fetch(request).then(res => {
      if (res && res.status === 200) cache.put(request, res.clone());
    }).catch(() => {});
    return cached;
  }
  // Not in cache — fetch and cache
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first: try network, fall back to cache (for HTML/API)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== ASSET_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.hostname.includes('cloudinary.com') && !url.hostname.includes('res.cloudinary.com')) return;

  // API calls — always network, no caching
  if (url.pathname.startsWith('/api/')) return;

  // Hashed JS/CSS assets — cache forever (immutable)
  if (url.pathname.startsWith('/assets/') && /\.[a-f0-9]{8}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Cloudinary images — cache aggressively
  if (url.hostname.includes('cloudinary.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Static files (icons, fonts, images in /public)
  if (/\.(png|jpg|jpeg|webp|svg|ico|woff2|woff|ttf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML navigation — network first, cache as fallback
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
});
