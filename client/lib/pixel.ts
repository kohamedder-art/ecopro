type PixelConfig = { facebook: string[]; tiktok: string[] };

const FB_IDS = new Set<string>();
const TT_IDS = new Set<string>();
let lastPath = "";
let lastTs = 0;

const FB_URL = "https://connect.facebook.net/en_US/fbevents.js";
const TT_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";

declare global {
  interface Window { fbq?: any; _fbq?: any; ttq?: any; TiktokAnalyticsObject?: string }
}

function loadScript(src: string): Promise<void> {
  return new Promise((r) => {
    if (document.querySelector(`script[src="${src}"]`)) return r();
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = () => r(); s.onerror = () => r();
    document.head.appendChild(s);
  });
}

export async function initFacebook(ids: string[]) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return;
  await loadScript(FB_URL);
  if (!window.fbq) {
    if (!window._fbq) window._fbq = [];
    window.fbq = (...a: any[]) => window._fbq.push(a);
    window.fbq._fbq = window._fbq; window.fbq.loaded = true;
  }
  for (const id of list) {
    if (FB_IDS.has(id)) continue;
    window.fbq("init", id);
    FB_IDS.add(id);
  }
}

export async function initTiktok(ids: string[]) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return;
  const w = window as any;
  if (!w.ttq) {
    w.TiktokAnalyticsObject = "ttq";
    const q: any = [];
    const m = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    for (const x of m) q[x] = (...a: any[]) => q.push([x, ...a]);
    q.instance = (id: string) => { const p: any = q._i?.[id] ?? []; for (const x of m) p[x] = (...a: any[]) => p.push([x, ...a]); return p; };
    q.load = (id: string, o?: any) => {
      q._i = q._i || {}; q._i[id] = []; q._i[id]._u = TT_URL; q._t = q._t || {}; q._t[id] = Date.now(); q._o = q._o || {}; q._o[id] = o || {};
      const s = document.createElement("script"); s.async = true; s.src = `${TT_URL}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
      document.getElementsByTagName("script")[0]?.parentNode?.insertBefore(s, document.getElementsByTagName("script")[0]);
    };
    w.ttq = q;
  }
  for (const id of list) { if (TT_IDS.has(id)) continue; w.ttq.load(id); TT_IDS.add(id); }
}

export async function init(config: PixelConfig) {
  await Promise.all([initFacebook(config.facebook), initTiktok(config.tiktok)]);
}
export const initPixels = init;
export const loadPlatformPixelConfig = loadPlatform;
export const loadStorePixelConfig = loadStore;
export const initFacebookPixels = initFacebook;
export const initTikTokPixels = initTiktok;

export function track(event: string, params: Record<string, any> = {}) {
  if (window.fbq) window.fbq("track", event, params);
  if (window.ttq) window.ttq.track(event === "PageView" ? "Pageview" : event, params);
}
export const trackFacebookEvent = track;
export const trackPixelEvent = track;
export const trackTikTokEvent = (e: string, p: Record<string, any> = {}) => { if (window.ttq) window.ttq.track(e === "PageView" ? "Pageview" : e, p); };

export function trackPageView(path = location.pathname) {
  const now = Date.now();
  if (path === lastPath && now - lastTs < 3000) return;
  lastPath = path; lastTs = now;
  track("PageView");
}

export async function loadPlatform(): Promise<PixelConfig> {
  try {
    const r = await fetch("/api/platform/pixel-config", { credentials: "include" });
    if (!r.ok) return { facebook: [], tiktok: [] };
    const d = await r.json();
    const out: PixelConfig = { facebook: [], tiktok: [] };
    const arr = Array.isArray(d) ? d : d.pixels ?? [];
    for (const p of arr) {
      if (!p?.enabled || !p?.pixel_id) continue;
      const id = String(p.pixel_id).trim(); if (!id) continue;
      if ((p.platform === "facebook" || p.platform === "meta") && !out.facebook.includes(id)) out.facebook.push(id);
      if (p.platform === "tiktok" && !out.tiktok.includes(id)) out.tiktok.push(id);
    }
    return out;
  } catch { return { facebook: [], tiktok: [] }; }
}

export async function loadStore(slug: string): Promise<PixelConfig> {
  try {
    const r = await fetch(`/api/pixels/config/${encodeURIComponent(slug)}`, { credentials: "include" });
    if (!r.ok) return { facebook: [], tiktok: [] };
    const d = await r.json();
    const out: PixelConfig = { facebook: [], tiktok: [] };
    if (d.is_facebook_enabled && d.facebook_pixel_id) out.facebook.push(d.facebook_pixel_id);
    if (d.is_tiktok_enabled && d.tiktok_pixel_id) out.tiktok.push(d.tiktok_pixel_id);
    return out;
  } catch { return { facebook: [], tiktok: [] }; }
}
