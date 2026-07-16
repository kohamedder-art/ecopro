import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  initPixels,
  trackFacebookEvent as coreFbTrack,
  trackTikTokEvent as coreTtTrack,
} from '../../lib/pixel';

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

// Store resolved pixel IDs globally so event helpers can fire proxy beacons
let fbPixelIds: string[] = [];
let ttPixelIds: string[] = [];

let currentStoreSlug = '';
let backendPixelTypePreference: 'facebook' | 'tiktok' | '' = '';
let currentCurrency = 'DZD';

/**
 * PixelScripts - Fetches store pixel config and initialises the SDKs via the
 * shared core engine, plus our first-party session/event analytics.
 *
 * NOTE: the actual init + PageView is owned by the global <PixelManager />.
 * This component still loads config (for currency/session/backend context) and
 * initialises pixels defensively, but never fires a second PageView.
 */
export default function PixelScripts({ storeSlug }: PixelScriptsProps) {
  const location = useLocation();
  const [config, setConfig] = useState<PixelConfig | null>(null);
  const pageEnterAtRef = useRef<number>(Date.now());
  const maxScrollDepthRef = useRef<number>(0);
  const lastFlushRef = useRef<string>('');

  useEffect(() => {
    if (storeSlug) setCurrentStoreSlug(storeSlug);
  }, [storeSlug]);

  useEffect(() => {
    if (!storeSlug) return;
    fetch(`/api/pixels/config/${storeSlug}`)
      .then((res) => res.json())
      .then((data: PixelConfig) => {
        setConfig(data);
        setBackendPixelPreferenceFromConfig(data);

        const fb = data?.is_facebook_enabled && data?.facebook_pixel_id
          ? String(data.facebook_pixel_id).split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        const tt = data?.is_tiktok_enabled && data?.tiktok_pixel_id
          ? String(data.tiktok_pixel_id).split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        fbPixelIds = Array.from(new Set(fb));
        ttPixelIds = Array.from(new Set(tt));
        initPixels({ facebook: fbPixelIds, tiktok: ttPixelIds });
      })
      .catch((err) => console.error('Failed to load pixel config:', err));
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

  // Auto-track Purchase events by intercepting order creation API calls.
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
            const cloned = response.clone();
            cloned.json().then((data: any) => {
              const orderId = data?.order?.id || data?.orderId || data?.order_id || '';
              const value = body.total_price || body.offer_bundle_price || body.unit_price || 0;
              trackAllPixels(PixelEvents.PURCHASE, {
                content_ids: [body.product_id],
                content_name: body.product_name || '',
                value,
                currency: 'DZD',
                order_id: String(orderId),
              });
            }).catch(() => {});
          }
        }
      } catch {
        // Non-critical
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [storeSlug]);

  return null;
}

export function trackFacebookEvent(eventName: string, params?: Record<string, any>) {
  coreFbTrack(eventName, params);
}

export function trackTikTokEvent(eventName: string, params?: Record<string, any>) {
  coreTtTrack(eventName, params);
}

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
      visitor_id: getVisitorId(),
    }),
  }).catch((err) => console.error('[Pixel] Backend tracking failed:', err));
}

export function trackAllPixels(eventName: string, params?: Record<string, any>) {
  trackFacebookEvent(eventName, params);
  trackTikTokEvent(eventName, params);

  const storeSlug = currentStoreSlug || safeLocalGet('currentStoreSlug') || '';
  if (storeSlug && eventName !== 'PageView') {
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

export function setStoreCurrency(currency: string) {
  currentCurrency = currency;
}
export function getStoreCurrency() {
  return currentCurrency;
}
