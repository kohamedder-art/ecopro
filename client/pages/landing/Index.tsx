import { useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Chapter1 } from './sections/Chapter1';
import { Chapter2 } from './sections/Chapter2';
import { Chapter3 } from './sections/Chapter3';
import { Chapter4 } from './sections/Chapter4';
import { FinalCTA } from './sections/FinalCTA';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    ttq: any;
    TiktokAnalyticsObject: string;
  }
}

const injectedFbScripts: HTMLScriptElement[] = [];

function injectFacebookPixel(pixelId: string) {
  const eventId = `pv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  new Image().src = `/api/pixels/proxy/fb?id=${pixelId}&ev=PageView&noscript=1&eid=${eventId}`;

  // Detect any existing fbevents.js script (from either this component or PixelScripts)
  if (document.getElementById('fb-pixel-script') || document.getElementById('facebook-pixel-script')) {
    if (window.fbq && typeof window.fbq.callMethod !== 'undefined') {
      try { window.fbq('init', pixelId); } catch {}
      try { window.fbq('track', 'PageView'); } catch {}
    }
    return;
  }

  const n = window.fbq = function() {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  } as any;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  try { window.fbq('init', pixelId); } catch {}
  try { window.fbq('track', 'PageView'); } catch {}

  const script = document.createElement('script');
  script.id = 'fb-pixel-script';
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  injectedFbScripts.push(script);
}

const injectedTtScripts: HTMLScriptElement[] = [];

function injectTikTokPixel(pixelId: string) {
  new Image().src = `/api/pixels/proxy/tt?id=${pixelId}&ev=PageView`;

  // Detect any existing TikTok script (from either this component or PixelScripts)
  if (document.getElementById('tt-pixel-script') || document.getElementById('tiktok-pixel-script')) return;

  window.TiktokAnalyticsObject = 'ttq';
  const ttq = window.ttq = window.ttq || [] as any;
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
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
    const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[e] = [];
    ttq._i[e]._u = i;
    ttq._t = ttq._t || {};
    ttq._t[e] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[e] = n || {};
    const o = document.createElement('script');
    o.id = 'tt-pixel-script';
    o.type = 'text/javascript';
    o.async = true;
    o.src = i + '?sdkid=' + e + '&lib=ttq';
    injectedTtScripts.push(o);
    const a = document.getElementsByTagName('script')[0];
    a?.parentNode?.insertBefore(o, a);
  };
  try { window.ttq.load(pixelId); } catch {}
  try { window.ttq.page(); } catch {}
}

export default function Index() {
  const { locale } = useTranslation();
  const isRTL = locale === 'ar';

  useEffect(() => {
    const preconnects = [
      { rel: 'dns-prefetch', href: 'https://connect.facebook.net' },
      { rel: 'dns-prefetch', href: 'https://www.facebook.com' },
      { rel: 'dns-prefetch', href: 'https://analytics.tiktok.com' },
      { rel: 'preconnect', href: 'https://connect.facebook.net' },
      { rel: 'preconnect', href: 'https://www.facebook.com' },
      { rel: 'preconnect', href: 'https://analytics.tiktok.com' },
    ];
    const links: HTMLLinkElement[] = [];
    for (const link of preconnects) {
      const el = document.createElement('link');
      el.rel = link.rel;
      el.href = link.href;
      document.head.appendChild(el);
      links.push(el);
    }

    fetch('/api/platform/pixel-config')
      .then(r => r.json())
      .then((pixels: any[]) => {
        if (!Array.isArray(pixels)) return;
        pixels.forEach(p => {
          if (!p.pixel_id || !p.enabled) return;
          if (p.platform === 'facebook') injectFacebookPixel(p.pixel_id);
          else if (p.platform === 'tiktok') injectTikTokPixel(p.pixel_id);
        });
      })
      .catch(() => {});

    return () => {
      // Cleanup: remove injected scripts and links when leaving landing page
      links.forEach(el => el.remove());
      injectedFbScripts.forEach(el => el.remove());
      injectedTtScripts.forEach(el => el.remove());
      // Clear arrays for next mount
      injectedFbScripts.length = 0;
      injectedTtScripts.length = 0;
    };
  }, []);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <Chapter1 />
      <Chapter2 />
      <Chapter3 />
      <Chapter4 />
      <FinalCTA />
    </div>
  );
}
