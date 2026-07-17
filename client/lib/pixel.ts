/**
 * Single source of truth for all Meta (Facebook) and TikTok pixel firing.
 *
 * Design rules:
 *  - Each pixel ID is initialised at most once (idempotent).
 *  - PageView is de-duplicated per route change.
 *  - No server-side double-fire: this module only touches the client SDKs
 *    (and the optional first-party /api/pixels/track recorder).
 *
 * Previously the pixel was fired from four places (static /pixel.js, the
 * landing page, PixelScripts, and several server endpoints) which produced
 * duplicate events. This module replaces all of them.
 */

type PixelConfig = {
  facebook: string[];
  tiktok: string[];
};

const FB_INIT: Set<string> = new Set();
const TT_INIT: Set<string> = new Set();
// Pre-seeded to dedup against the inline fbq('track','PageView') in index.html
let lastPageViewPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
let lastPageViewTs = typeof window !== 'undefined' ? Date.now() : 0;

const FB_LIB =
  'https://connect.facebook.net/en_US/fbevents.js';
const TT_LIB = 'https://analytics.tiktok.com/i18n/pixel/events.js';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    ttq?: any;
    __PIXEL_BACKEND_URL__?: string;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"], script[src*="${src.split('/').pop()}"]`);
    if (existing) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export async function initFacebookPixels(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return;

  await loadScript(FB_LIB);
  if (!window.fbq) {
    if (!window._fbq) window._fbq = [];
    window.fbq = (...args: any[]) => window._fbq?.push(args);
    window.fbq._fbq = window._fbq;
    window.fbq.loaded = true;
  }

  for (const id of unique) {
    if (FB_INIT.has(id)) continue;
    window.fbq('init', id);
    FB_INIT.add(id);
  }
}

export async function initTikTokPixels(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return;

  await loadScript(TT_LIB);
  if (!window.ttq) {
    const q: any[] = [];
    // Bootstrap the official ttq API surface.
    const ttq: any = (...args: any[]) => q.push(args);
    ttq.load = (id: string) => q.push(['load', id]);
    ttq.track = (ev: string, p?: any) => q.push(['track', ev, p]);
    ttq.page = () => q.push(['track', 'PageView']);
    ttq.unload = () => q.push(['unload']);
    ttq.disablePushState = () => q.push(['disablePushState']);
    ttq.instance = () => ttq;
    ttq.pixelId = unique[0];
    window.ttq = ttq;
  }

  for (const id of unique) {
    if (TT_INIT.has(id)) continue;
    window.ttq.load(id);
    TT_INIT.add(id);
  }
}

function fireProxyBeacon(platform: 'fb' | 'tt', event: string, ids: string[], params?: Record<string, any>) {
  if (!ids.length) return;
  try {
    const q = new URLSearchParams();
    q.set('ev', event);
    q.set('noscript', '1');
    if (params && typeof params === 'object') {
      for (const key of ['value', 'currency', 'content_name', 'content_category', 'order_id', 'content_ids']) {
        const v = params[key];
        if (v !== undefined && v !== null) {
          q.set('cd[' + key + ']', Array.isArray(v) ? v.join(',') : String(v));
        }
      }
    }
    for (const id of ids) {
      q.set('id', id);
      new Image().src = `/api/pixels/proxy/${platform}?${q.toString()}`;
    }
  } catch {
    /* never break the page */
  }
}

export function trackFacebookEvent(event: string, params: Record<string, any> = {}): void {
  if (!window.fbq) return;
  window.fbq('track', event, params);
  // Reliable fallback: fire an <img> beacon through our server proxy so events
  // reach Meta even when the client SDK is blocked (mobile carriers, DNS, ad-blockers).
  fireProxyBeacon('fb', event, Array.from(FB_INIT), params);
}

export function trackTikTokEvent(event: string, params: Record<string, any> = {}): void {
  if (!window.ttq) return;
  window.ttq.track(event, params);
  fireProxyBeacon('tt', event, Array.from(TT_INIT), params);
}

export function trackPixelEvent(event: string, params: Record<string, any> = {}): void {
  trackFacebookEvent(event, params);
  trackTikTokEvent(event, params);
}

/**
 * Fire a PageView, but only once per distinct route (with a small time guard
 * so a rapid remount can't double-fire).
 */
export function trackPageView(path: string = window.location.pathname): void {
  const now = Date.now();
  if (path === lastPageViewPath && now - lastPageViewTs < 3000) return;
  lastPageViewPath = path;
  lastPageViewTs = now;

  trackFacebookEvent('PageView');
  trackTikTokEvent('PageView');
}

export async function loadPlatformPixelConfig(): Promise<PixelConfig> {
  try {
    const res = await fetch('/api/platform/pixel-config', { credentials: 'include' });
    if (!res.ok) return { facebook: [], tiktok: [] };
    const data = await res.json();
    const config: PixelConfig = { facebook: [], tiktok: [] };
    const arr = Array.isArray(data) ? data : data?.pixels ?? [];
    for (const p of arr) {
      if (!p?.enabled || !p?.pixel_id) continue;
      const id = String(p.pixel_id).trim();
      if (!id) continue;
      if (p.platform === 'facebook' || p.platform === 'meta') config.facebook.push(id);
      if (p.platform === 'tiktok') config.tiktok.push(id);
    }
    return config;
  } catch {
    return { facebook: [], tiktok: [] };
  }
}

export async function loadStorePixelConfig(slug: string): Promise<PixelConfig> {
  try {
    const res = await fetch(`/api/pixels/config/${encodeURIComponent(slug)}`, {
      credentials: 'include',
    });
    if (!res.ok) return { facebook: [], tiktok: [] };
    const data = await res.json();
    const config: PixelConfig = { facebook: [], tiktok: [] };
    if (data?.is_facebook_enabled && data?.facebook_pixel_id) {
      config.facebook.push(data.facebook_pixel_id);
    }
    if (data?.is_tiktok_enabled && data?.tiktok_pixel_id) {
      config.tiktok.push(data.tiktok_pixel_id);
    }
    return config;
  } catch {
    return { facebook: [], tiktok: [] };
  }
}

export async function initPixels(config: PixelConfig): Promise<void> {
  await Promise.all([
    initFacebookPixels(config.facebook),
    initTikTokPixels(config.tiktok),
  ]);
}
