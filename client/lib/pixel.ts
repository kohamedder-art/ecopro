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
// Empty so the first trackPageView() call always fires the relay.
// Subsequent calls within 3s on the same path are still deduped.
let lastPageViewPath = '';
let lastPageViewTs = 0;

const FB_LIB =
  'https://connect.facebook.net/en_US/fbevents.js';
const TT_LIB = 'https://analytics.tiktok.com/i18n/pixel/events.js';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    ttq?: any;
    TiktokAnalyticsObject?: string;
    __PIXEL_BACKEND_URL__?: string;
    __META_PIXEL_IDS__?: string[];
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`);
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

  const w = window as any;

  // TikTok's official bootstrap (verbatim from analytics.tiktok.com sdk.js).
  // The critical part is ttq.load(): it seeds ttq._i[pixelId] AND injects
  // events.js?sdkid=<pixelId>&lib=ttq. The server only returns events.js with
  // the pixel code embedded ("pixelCode":"...", _li["..."]) when sdkid is
  // present; loading bare events.js yields pixelCode:"" so ttq._i stays empty
  // and the SDK never initialises the pixel (no beacons fire, token or not).
  if (!w.ttq) {
    w.TiktokAnalyticsObject = 'ttq';
    const q: any[] = [];
    const queue: any = q;
    const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    for (const m of methods) queue[m] = (...args: any[]) => q.push([m, ...args]);
    queue.instance = (id: string) => {
      const perPixel: any = queue._i?.[id] ?? [];
      for (const m of methods) perPixel[m] = (...args: any[]) => perPixel.push([m, ...args]);
      return perPixel;
    };
    queue.load = (id: string, opts?: any) => {
      queue._i = queue._i || {};
      queue._i[id] = [];
      queue._i[id]._u = TT_LIB;
      queue._i[id]._partner = opts?.partner || '';
      queue._t = queue._t || {};
      queue._t[id] = +new Date();
      queue._o = queue._o || {};
      queue._o[id] = opts || {};
      queue._partner = queue._partner || '';
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.async = true;
      s.src = `${TT_LIB}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
      (document.getElementsByTagName('script')[0])?.parentNode?.insertBefore(
        s,
        document.getElementsByTagName('script')[0],
      );
    };
    w.ttq = queue;
  }

  for (const id of unique) {
    if (TT_INIT.has(id)) continue;
    w.ttq.load(id);
    TT_INIT.add(id);
  }
}



export function trackFacebookEvent(event: string, params: Record<string, any> = {}): void {
  if (window.fbq) {
    window.fbq('track', event, params);
  }
}

export function trackTikTokEvent(event: string, params: Record<string, any> = {}): void {
  if (!window.ttq) return;
  // TikTok's standard event name is "Pageview" (Meta uses "PageView").
  const name = event === 'PageView' ? 'Pageview' : event;
  window.ttq.track(name, params);
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
    const seenFb = new Set<string>();
    const seenTt = new Set<string>();
    for (const p of arr) {
      if (!p?.enabled || !p?.pixel_id) continue;
      const id = String(p.pixel_id).trim();
      if (!id) continue;
      if ((p.platform === 'facebook' || p.platform === 'meta') && !seenFb.has(id)) {
        seenFb.add(id);
        config.facebook.push(id);
      }
      if (p.platform === 'tiktok' && !seenTt.has(id)) {
        seenTt.add(id);
        config.tiktok.push(id);
      }
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
