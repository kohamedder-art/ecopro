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

// Module-level guards to prevent duplicate initialization across multiple instances
let facebookPixelInitialized = false;
let pageViewFiredByInit = false;
let currentStoreCurrency = 'DZD';

// Facebook only supports specific ISO 4217 currency codes.
// Map unsupported currencies to a supported fallback.
const FB_SUPPORTED_CURRENCIES = new Set([
  'AED','ARS','AUD','BDT','BOB','BRL','BZD','CAD','CHF','CLP','CNY','COP','CRC','CZK',
  'DKK','DOP','EGP','EUR','GBP','GTQ','HKD','HNL','HUF','IDR','ILS','INR','ISK','JPY',
  'KES','KRW','KWD','MXN','MYR','NGN','NIO','NOK','NZD','PEN','PHP','PKR','PLN','PYG',
  'QAR','RON','SAR','SEK','SGD','THB','TRY','TWD','UAH','USD','UYU','VND','XAF','ZAR'
]);
export function fbCurrency(code: string): string {
  const upper = (code || 'USD').toUpperCase();
  return FB_SUPPORTED_CURRENCIES.has(upper) ? upper : 'USD';
}

export function setStoreCurrency(code: string) {
  currentStoreCurrency = code;
}

// Deduplication cache for ViewContent events (prevents rapid-fire duplicates)
const lastViewContentTimestamps = new Map<string, number>();

// Queue for events that fire before fbq('init') — replayed after init
// (fbq stub queue only works for events fired AFTER the stub is created,
//  but events BEFORE init are still ignored by the Facebook SDK)
let pendingEvents: [string, Record<string, any> | undefined][] = [];

// Module-level Facebook Pixel stub — created immediately so events fired
// before async config loads are properly queued (not silently dropped)
if (typeof window !== 'undefined' && !window.fbq) {
  const n = window.fbq = function() {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  } as any;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
}

// Module-level TikTok Pixel stub — created immediately so ttq.track() calls
// fired before the async config loads are properly deferred (not silently dropped).
// Mirrors the Facebook stub pattern above.
if (typeof window !== 'undefined' && !(window as any).ttq) {
  (window as any).TiktokAnalyticsObject = 'ttq';
  const ttq: any = (window as any).ttq = [];
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
    if (!document.getElementById('tiktok-pixel-script')) {
      const o = document.createElement("script");
      o.id = 'tiktok-pixel-script';
      o.type = "text/javascript";
      o.async = true;
      o.src = i + "?sdkid=" + e + "&lib=ttq";
      const a = document.getElementsByTagName("script")[0];
      a?.parentNode?.insertBefore(o, a);
    }
  };
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

    const lastPageViewKey = sessionStorage.getItem('last_pageview_key');
    const currentKey = `${storeSlug}|${location.pathname}`;
    if (lastPageViewKey !== currentKey) {
      sessionStorage.setItem('last_pageview_key', currentKey);
      trackPageView(storeSlug);
    }
  }, [location.pathname, storeSlug]);

  // Inject Facebook Pixel (supports multiple comma-separated IDs)
  useEffect(() => {
    if (!config?.facebook_pixel_id || !config.is_facebook_enabled) return;

    // Module-level guard: only the first instance initializes
    // Also checks DOM to survive HMR (which resets module state)
    if (facebookPixelInitialized || document.getElementById('facebook-pixel-script')) return;

    // Support storing multiple pixel IDs as comma-separated values
    const ids = String(config.facebook_pixel_id).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    // Deduplicate IDs
    const uniqueIds = [...new Set(ids)];

    facebookPixelInitialized = true;

    // Queue init events (PageView auto-fired by SDK on init)
    uniqueIds.forEach(id => {
      try { window.fbq('init', id); } catch (e) { /* ignore */ }
    });

    // Replay events that were queued before pixel was initialized.
    // These land in fbq's stub queue AFTER init, so the SDK processes
    // them after the pixel is initialized (not ignored like pre-init events).
    const replay = pendingEvents;
    pendingEvents = [];
    replay.forEach(([name, params]) => {
      try { window.fbq('track', name, params); } catch (e) { /* ignore */ }
    });

    // Load the Facebook SDK via external script
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

    // Add noscript fallbacks for each id
    const noscript = document.createElement('noscript');
    uniqueIds.forEach(id => {
      const img = document.createElement('img');
      img.height = 1;
      img.width = 1;
      img.style.display = 'none';
      img.src = `https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`;
      noscript.appendChild(img);
    });
    document.body.appendChild(noscript);

    console.log('[Pixel] Facebook Pixel initialized:', uniqueIds.join(','));

    return () => {
      // Cleanup not required in most SPA flows
    };
  }, [config?.facebook_pixel_id, config?.is_facebook_enabled]);

  // Inject TikTok Pixel (supports multiple comma-separated IDs)
  // The ttq stub is already created at module level, so ttq.track() calls
  // fired before this effect runs are properly deferred until load() is called.
  useEffect(() => {
    if (!config?.tiktok_pixel_id || !config.is_tiktok_enabled) return;
    if (typeof window === 'undefined' || !window.ttq) return;

    const ids = String(config.tiktok_pixel_id).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;

    // Deduplicate IDs
    const uniqueIds = [...new Set(ids)];

    // Load/instantiate each id, then fire a page event
    uniqueIds.forEach(id => {
      try { window.ttq.load(id); } catch (e) { /* ignore */ }
    });
    try { window.ttq.page(); } catch (e) { /* ignore */ }

    console.log('[Pixel] TikTok Pixel initialized:', uniqueIds.join(','));

    return () => {
      // Cleanup not required
    };
  }, [config?.tiktok_pixel_id, config?.is_tiktok_enabled]);

  // This component doesn't render anything visible
  return null;
}

/**
 * Helper functions to track events from other components
 */
export function trackFacebookEvent(eventName: string, params?: Record<string, any>) {
  const p = params ? { ...params } : {};
  if (p.value != null) p.value = Number(p.value);
  // Facebook only accepts specific currencies; map unsupported ones
  if (p.currency) p.currency = fbCurrency(p.currency);

  if (typeof window !== 'undefined' && window.fbq) {
    if (facebookPixelInitialized) {
      if (eventName === 'PageView' && !pageViewFiredByInit) {
        pageViewFiredByInit = true;
        return;
      }
      window.fbq('track', eventName, p);
    } else if (eventName !== 'PageView') {
      pendingEvents.push([eventName, p]);
    }
  }
}

export function trackTikTokEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.ttq && typeof window.ttq.track === 'function') {
    try {
      window.ttq.track(eventName, params);
    } catch (e) { /* ignore */ }
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

// Get or create session ID (per browser session)
function getSessionId(): string {
  let sessionId = '';
  for (const key of LEGACY_SESSION_KEYS) {
    const existing = sessionStorage.getItem(key);
    if (existing) {
      sessionId = existing;
      break;
    }
  }
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
  }
  for (const key of LEGACY_SESSION_KEYS) {
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

// Get or create visitor ID (persistent across sessions)
function getVisitorId(): string {
  let visitorId = '';
  for (const key of LEGACY_VISITOR_KEYS) {
    const existing = localStorage.getItem(key);
    if (existing) {
      visitorId = existing;
      break;
    }
  }
  if (!visitorId) {
    visitorId = 'vis_' + Math.random().toString(36).substring(2, 15);
  }
  for (const key of LEGACY_VISITOR_KEYS) {
    localStorage.setItem(key, visitorId);
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
  // Also save to localStorage for other pages
  if (slug) localStorage.setItem('currentStoreSlug', slug);
}

export function trackAllPixels(eventName: string, params?: Record<string, any>) {
  // Normalize value to number if present
  const normalizedParams = params ? { ...params } : {};
  if (normalizedParams.value != null) {
    const numValue = Number(normalizedParams.value);
    if (!Number.isNaN(numValue)) {
      normalizedParams.value = numValue;
    }
  }

  // Deduplicate rapid-fire ViewContent events (same product within 2s)
  if (eventName === 'ViewContent') {
    const dedupKey = `vc:${normalizedParams.content_ids?.[0]}`;
    const last = lastViewContentTimestamps.get(dedupKey);
    const now = Date.now();
    if (last && now - last < 2000) {
      // Skip Facebook/TikTok but still track to backend
      trackToBackend(currentStoreSlug || localStorage.getItem('currentStoreSlug') || '', eventName, normalizedParams);
      return;
    }
    lastViewContentTimestamps.set(dedupKey, now);
  }

  // Track to Facebook and TikTok SDKs (client-side)
  trackFacebookEvent(eventName, normalizedParams);
  trackTikTokEvent(eventName, normalizedParams);
  
  // Track to our backend for statistics (only ONE event, not duplicated)
  const storeSlug = currentStoreSlug || localStorage.getItem('currentStoreSlug') || '';
  if (storeSlug && eventName !== 'PageView') {
    // PageView is handled separately with deduplication
    trackToBackend(storeSlug, eventName, normalizedParams);
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
