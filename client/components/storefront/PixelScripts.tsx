import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PixelConfig {
  facebook_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  is_facebook_enabled: boolean;
  is_tiktok_enabled: boolean;
}

interface PixelScriptsProps {
  storeSlug: string;
}

const CANONICAL_SESSION_KEY = 'ecopro_session_id';
const CANONICAL_VISITOR_KEY = 'ecopro_visitor_id';
const LEGACY_SESSION_KEYS = [CANONICAL_SESSION_KEY, 'pixel_session_id'];
const LEGACY_VISITOR_KEYS = [CANONICAL_VISITOR_KEY, 'pixel_visitor_id'];

// Declare global types for pixel SDKs
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    ttq: any;
    TiktokAnalyticsObject: string;
  }
}

// Global singleton flags — ensure pixels are only initialized ONCE across all mounts/unmounts
let facebookPixelGloballyInit = false;
let tiktokPixelGloballyInit = false;

/**
 * PixelScripts - Injects Facebook and TikTok pixel scripts based on store settings
 * This component should be included in the storefront layout
 */
export default function PixelScripts({ storeSlug }: PixelScriptsProps) {
  const location = useLocation();
  const [config, setConfig] = useState<PixelConfig | null>(null);
  const pageEnterAtRef = useRef<number>(Date.now());
  const maxScrollDepthRef = useRef<number>(0);
  const lastFlushRef = useRef<string>('');

  // Set current store slug for backend tracking
  useEffect(() => {
    if (storeSlug) {
      setCurrentStoreSlug(storeSlug);
    }
  }, [storeSlug]);

  // Fetch pixel config on mount
  useEffect(() => {
    if (!storeSlug) return;

    const preconnects = [
      { rel: 'dns-prefetch', href: 'https://connect.facebook.net' },
      { rel: 'dns-prefetch', href: 'https://www.facebook.com' },
      { rel: 'dns-prefetch', href: 'https://analytics.tiktok.com' },
      { rel: 'preconnect', href: 'https://connect.facebook.net' },
      { rel: 'preconnect', href: 'https://www.facebook.com' },
      { rel: 'preconnect', href: 'https://analytics.tiktok.com' },
    ];
    for (const link of preconnects) {
      const el = document.createElement('link');
      el.rel = link.rel;
      el.href = link.href;
      document.head.appendChild(el);
    }

    fetch(`/api/pixels/config/${storeSlug}`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setBackendPixelPreferenceFromConfig(data);
      })
      .catch(err => console.error('Failed to load pixel config:', err));
  }, [storeSlug]);

  useEffect(() => {
    pageEnterAtRef.current = Date.now();
    maxScrollDepthRef.current = 0;
    lastFlushRef.current = '';

    const updateScrollDepth = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        maxScrollDepthRef.current = 100;
        return;
      }
      const percent = Math.max(0, Math.min(100, Math.round((scrollTop / docHeight) * 100)));
      maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, percent);
    };

    const flushSessionSummary = (ended: boolean) => {
      if (!storeSlug) return;

      const flushKey = `${location.pathname}|${pageEnterAtRef.current}`;
      if (lastFlushRef.current === flushKey) return;
      lastFlushRef.current = flushKey;

      const now = Date.now();
      const url = new URL(window.location.href);
      const payload = {
        store_slug: storeSlug,
        session_id: getSessionId(),
        visitor_id: getVisitorId(),
        page_url: window.location.href,
        page_path: location.pathname,
        max_scroll_depth: Math.max(maxScrollDepthRef.current, 0),
        active_time_seconds: Math.max(1, Math.round((now - pageEnterAtRef.current) / 1000)),
        locale: document.documentElement.lang || navigator.language || 'en',
        referrer: document.referrer || '',
        source: url.searchParams.get('utm_source') || '',
        medium: url.searchParams.get('utm_medium') || '',
        campaign_name: url.searchParams.get('utm_campaign') || '',
        ended,
      };

      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/pixels/session', blob);
        return;
      }

      fetch('/api/pixels/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const onPageHide = () => flushSessionSummary(true);

    updateScrollDepth();
    window.addEventListener('scroll', updateScrollDepth, { passive: true });
    window.addEventListener('pagehide', onPageHide);

    return () => {
      flushSessionSummary(false);
      window.removeEventListener('scroll', updateScrollDepth);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [location.pathname, location.search, storeSlug]);

  // Always track PageView to backend (independent of pixel config)
  useEffect(() => {
    if (!storeSlug) return;

    const lastPageViewKey = safeSessionGet('last_pageview_key');
    const currentKey = `${storeSlug}|${location.pathname}`;
    if (lastPageViewKey !== currentKey) {
      safeSessionSet('last_pageview_key', currentKey);
      trackPageView(storeSlug);
    }
  }, [location.pathname, storeSlug]);

  // Auto-track Purchase events by intercepting order creation API calls.
  // This runs globally so ALL templates get tracking without individual changes.
  useEffect(() => {
    if (!storeSlug) return;

    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const response = await originalFetch.call(window, input, init);

      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
        if (url.includes('/api/orders/create') && init?.method?.toUpperCase() === 'POST' && response.ok) {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
          if (body) {
            // Clone to read response without consuming it
            const cloned = response.clone();
            cloned.json().then((data: any) => {
              const orderId = data?.order?.id || data?.orderId || data?.order_id || '';
              const value = body.total_price || body.offer_bundle_price || body.unit_price || 0;
              console.log('[Pixel] Purchase detected:', { orderId, value, product_id: body.product_id });
              trackAllPixels(PixelEvents.PURCHASE, {
                content_ids: [body.product_id],
                content_name: body.product_name || '',
                value: value,
                currency: 'DZD',
                order_id: String(orderId),
              });
            }).catch(() => {});
          }
        }
      } catch {
        // Non-critical: don't break order flow if tracking fails
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [storeSlug]);

  // Inject Facebook Pixel (supports multiple comma-separated IDs)
  useEffect(() => {
    if (!config?.facebook_pixel_id || !config.is_facebook_enabled) return;

    const ids = String(config.facebook_pixel_id).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    const uniqueIds = [...new Set(ids)];

    // Always fire img pixels first (works even with ad blockers on mobile)
    uniqueIds.forEach(id => {
      new Image().src = `https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`;
    });

    // Global singleton: only inject the SDK once across all mount/unmount cycles
    if (facebookPixelGloballyInit) {
      // SDK already injected — just fire PageView
      uniqueIds.forEach(id => {
        try { window.fbq?.('init', id); } catch (e) { /* ignore */ }
      });
      try { window.fbq?.('track', 'PageView'); } catch (e) { /* ignore */ }
      return;
    }
    facebookPixelGloballyInit = true;

    // Prevent duplicate script loading — detect any existing fbevents.js script
    const existingFbScript = document.getElementById('facebook-pixel-script') || document.getElementById('fb-pixel-script');
    if (existingFbScript) {
      if (window.fbq && typeof window.fbq.callMethod !== 'undefined') {
        uniqueIds.forEach(id => {
          try { window.fbq('init', id); } catch (e) { /* ignore */ }
        });
        try { window.fbq('track', 'PageView'); } catch (e) { /* ignore */ }
      }
      return;
    }

    const existingQueue = (window as any).fbq?.queue || [];

    const n = window.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    } as any;
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    existingQueue.forEach((args: any[]) => {
      try { window.fbq.apply(null, args); } catch (e) { /* ignore */ }
    });

    uniqueIds.forEach(id => {
      try { window.fbq('init', id); } catch (e) { /* ignore */ }
    });
    try { window.fbq('track', 'PageView'); } catch (e) { /* ignore */ }

    const script = document.createElement('script');
    script.id = 'facebook-pixel-script';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => {
      console.log('[Pixel] Facebook SDK loaded, fbq.callMethod:', typeof window.fbq?.callMethod);
      console.log('[Pixel] Facebook queue length:', window.fbq?.queue?.length);
    };
    script.onerror = () => {
      console.error('[Pixel] Facebook SDK failed to load');
    };
    document.head.appendChild(script);

    console.log('[Pixel] Facebook Pixel initialized:', uniqueIds.join(','));
  }, [config?.facebook_pixel_id, config?.is_facebook_enabled]);

  // Inject TikTok Pixel (supports multiple comma-separated IDs)
  useEffect(() => {
    if (!config?.tiktok_pixel_id || !config.is_tiktok_enabled) return;

    const ids = String(config.tiktok_pixel_id).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    const uniqueIds = [...new Set(ids)];

    // Always fire img pixels first (works even with ad blockers on mobile)
    uniqueIds.forEach(id => {
      new Image().src = `https://analytics.tiktok.com/i18n/pixel/static?id=${id}&ev=PageView`;
    });

    // Global singleton: only inject the SDK once across all mount/unmount cycles
    if (tiktokPixelGloballyInit) {
      uniqueIds.forEach(id => {
        try { window.ttq?.load(id); } catch (e) { /* ignore */ }
      });
      try { window.ttq?.page(); } catch (e) { /* ignore */ }
      return;
    }
    tiktokPixelGloballyInit = true;

    // If ttq exists, load/instantiate each id
    if (window.ttq) {
      uniqueIds.forEach(id => {
        try { window.ttq.load(id); } catch (e) { /* ignore */ }
      });
      try { window.ttq.page(); } catch (e) { /* ignore */ }
      return;
    }

    // Detect any existing TikTok script (from either this component or landing page)
    if (document.getElementById('tiktok-pixel-script') || document.getElementById('tt-pixel-script')) {
      return;
    }

    window.TiktokAnalyticsObject = 'ttq';
    const ttq = window.ttq = window.ttq || [] as any;
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = function(t: any, e: string) {
      t[e] = function() {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) {
      ttq.setAndDefer(ttq, ttq.methods[i]);
    }
    ttq.instance = function(t: string) {
      const e = ttq._i[t] || [];
      for (let n = 0; n < ttq.methods.length; n++) {
        ttq.setAndDefer(e, ttq.methods[n]);
      }
      return e;
    };
    ttq.load = function(e: string, n?: any) {
      const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      const o = document.createElement("script");
      o.id = 'tiktok-pixel-script';
      o.type = "text/javascript";
      o.async = true;
      o.src = i + "?sdkid=" + e + "&lib=ttq";
      const a = document.getElementsByTagName("script")[0];
      a?.parentNode?.insertBefore(o, a);
    };

    uniqueIds.forEach(id => {
      try { window.ttq.load(id); } catch (e) { /* ignore */ }
    });
    try { window.ttq.page(); } catch (e) { /* ignore */ }

    console.log('[Pixel] TikTok Pixel initialized:', uniqueIds.join(','));
  }, [config?.tiktok_pixel_id, config?.is_tiktok_enabled]);

  // This component doesn't render anything visible
  return null;
}

/**
 * Helper functions to track events from other components
 */
export function trackFacebookEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
}

export function trackTikTokEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track(eventName, params);
  }
}

/**
 * Send event to our backend for statistics tracking
 * Only sends ONE event per call (not duplicated per pixel type)
 */
function trackToBackend(storeSlug: string, eventName: string, params?: Record<string, any>) {
  if (!storeSlug) return;

  const pixelType = backendPixelTypePreference || 'platform';

  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const utm_source = url?.searchParams.get('utm_source') || '';
  const utm_medium = url?.searchParams.get('utm_medium') || '';
  const utm_campaign = url?.searchParams.get('utm_campaign') || '';
  const fbclid = url?.searchParams.get('fbclid') || '';
  const ttclid = url?.searchParams.get('ttclid') || '';
  const gclid = url?.searchParams.get('gclid') || '';

  const referrer = typeof document !== 'undefined' ? document.referrer || '' : '';
  const refLower = (referrer || '').toLowerCase();
  const derivedSource =
    utm_source ||
    (fbclid || refLower.includes('facebook.com') || refLower.includes('fb.com') ? 'facebook' : '') ||
    (ttclid || refLower.includes('tiktok.com') ? 'tiktok' : '') ||
    (gclid ? 'google' : '') ||
    'direct';
  
  fetch('/api/pixels/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_slug: storeSlug,
      pixel_type: pixelType,
      event_name: eventName,
      event_data: {
        ...(params || {}),
        page_path: typeof window !== 'undefined' ? window.location.pathname : '',
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        fbclid,
        ttclid,
        gclid,
        source: derivedSource,
        locale: document.documentElement.lang || navigator.language || 'en',
      },
      page_url: window.location.href,
      product_id: params?.content_ids?.[0],
      order_id: params?.order_id,
      revenue: params?.value,
      currency: params?.currency || 'DZD',
      session_id: getSessionId(),
      visitor_id: getVisitorId()
    })
  }).catch(err => console.error('[Pixel] Backend tracking failed:', err));
}

/**
 * Track PageView - only one event per page navigation
 */
function trackPageView(storeSlug: string) {
  trackFacebookEvent('PageView');
  trackToBackend(storeSlug, 'PageView', { page_url: window.location.href });
}

function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function safeSessionSet(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { /* storage blocked */ }
}
function safeLocalGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

// Get or create session ID (per browser session)
function getSessionId(): string {
  let sessionId = '';
  for (const key of LEGACY_SESSION_KEYS) {
    const existing = safeSessionGet(key);
    if (existing) {
      sessionId = existing;
      break;
    }
  }
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
  }
  for (const key of LEGACY_SESSION_KEYS) {
    safeSessionSet(key, sessionId);
  }
  return sessionId;
}

// Get or create visitor ID (persistent across sessions)
function getVisitorId(): string {
  let visitorId = '';
  for (const key of LEGACY_VISITOR_KEYS) {
    const existing = safeLocalGet(key);
    if (existing) {
      visitorId = existing;
      break;
    }
  }
  if (!visitorId) {
    visitorId = 'vis_' + Math.random().toString(36).substring(2, 15);
  }
  for (const key of LEGACY_VISITOR_KEYS) {
    safeLocalSet(key, visitorId);
  }
  return visitorId;
}

// Store the current store slug for backend tracking
let currentStoreSlug = '';

// Used to choose the backend pixel_type for analytics buckets.
// We intentionally keep ONE backend record per event.
let backendPixelTypePreference: 'facebook' | 'tiktok' | '' = '';

function setBackendPixelPreferenceFromConfig(data: PixelConfig) {
  if (data?.is_facebook_enabled && data?.facebook_pixel_id) {
    backendPixelTypePreference = 'facebook';
    return;
  }
  if (data?.is_tiktok_enabled && data?.tiktok_pixel_id) {
    backendPixelTypePreference = 'tiktok';
    return;
  }
  backendPixelTypePreference = '';
}

export function setCurrentStoreSlug(slug: string) {
  currentStoreSlug = slug;
  if (slug) safeLocalSet('currentStoreSlug', slug);
}

let currentCurrency = 'DZD';
export function setStoreCurrency(currency: string) {
  currentCurrency = currency;
}
export function getStoreCurrency() {
  return currentCurrency;
}

export function trackAllPixels(eventName: string, params?: Record<string, any>) {
  // Track to Facebook and TikTok SDKs (client-side)
  trackFacebookEvent(eventName, params);
  trackTikTokEvent(eventName, params);
  
  // Track to our backend for statistics (only ONE event, not duplicated)
  const storeSlug = currentStoreSlug || safeLocalGet('currentStoreSlug') || '';
  if (storeSlug && eventName !== 'PageView') {
    // PageView is handled separately with deduplication
    trackToBackend(storeSlug, eventName, params);
  }
}

// Event name mappings for common events
export const PixelEvents = {
  PAGE_VIEW: 'PageView',
  VIEW_CONTENT: 'ViewContent',
  ADD_TO_CART: 'AddToCart',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  PURCHASE: 'Purchase',
  SEARCH: 'Search',
  ADD_TO_WISHLIST: 'AddToWishlist',
  COMPLETE_REGISTRATION: 'CompleteRegistration',
  LEAD: 'Lead',
};
