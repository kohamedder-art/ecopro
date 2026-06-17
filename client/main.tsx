import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { reportClientError } from "./utils/telemetry";

function getBuildIdFromImportMetaUrl(): string | null {
  try {
    // In production we append ?v=<git-sha> to the asset URL.
    // If multiple different builds get loaded on the same page, reusing a
    // React root across builds can cause invalid hook calls.
    const u = new URL(import.meta.url);
    const v = u.searchParams.get('v');
    return v ? String(v).slice(0, 80) : null;
  } catch {
    return null;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${encodeURIComponent(name)}=`));
  if (!raw) return null;
  const value = raw.slice(raw.indexOf('=') + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Global fetch hardening for cookie-based auth
// - Always send credentials (cookies)
// - Add X-CSRF-Token for unsafe methods
// - Remove useless Authorization: Bearer null/undefined
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const nextInit: RequestInit = { ...(init || {}) };

    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const resolvedUrl = new URL(rawUrl, window.location.origin);
    const isSameOrigin = resolvedUrl.origin === window.location.origin;
    const isApi = isSameOrigin && resolvedUrl.pathname.startsWith('/api/');

    // Cookie-based auth requires credentials for same-origin requests.
    // Avoid forcing credentials for third-party URLs.
    if (isSameOrigin) nextInit.credentials = 'include';

    const headers = new Headers(nextInit.headers || undefined);
    const method = (nextInit.method || 'GET').toUpperCase();

    const csrf = getCookie('ecopro_csrf');
    if (csrf && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrf);
    }

    const auth = headers.get('Authorization') || headers.get('authorization');
    if (auth) {
      // Always prefer HttpOnly cookies for our own API requests.
      if (isApi && /^Bearer\s+/i.test(auth)) {
        headers.delete('Authorization');
        headers.delete('authorization');
      } else if (/^Bearer\s+(null|undefined)?\s*$/i.test(auth.trim())) {
        headers.delete('Authorization');
        headers.delete('authorization');
      }
    }

    nextInit.headers = headers;
    return originalFetch(input, nextInit);
  };
}

// Register service worker for asset caching (production only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const container = document.getElementById("root");
if (container) {
  const buildId = getBuildIdFromImportMetaUrl();

  // Global error telemetry (production only)
  if (import.meta.env.PROD) {
    window.addEventListener('error', (event) => {
      try {
        const err = (event as any).error as any;
        reportClientError({
          message: err?.message || (event as any).message || 'Unhandled error',
          name: err?.name,
          stack: err?.stack,
        });
      } catch {
        // ignore
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason: any = (event as any).reason;
        const msg: string = reason?.message || String(reason || '');
        const name: string = reason?.name || '';

        // Auto-reload on chunk load failures after deploy
        const isChunkError =
          msg.includes('Loading chunk') ||
          msg.includes('import of') ||
          name === 'ChunkLoadError' ||
          (name === 'TypeError' && msg.includes('Failed to fetch dynamically imported module'));

        if (isChunkError) {
          window.location.reload();
          event.preventDefault();
          return;
        }

        reportClientError({
          message: msg,
          name,
          stack: reason?.stack,
        });
      } catch {
        // ignore
      }
    });
  }

  // Guard against accidental double-mount (e.g. duplicate script execution / cached HTML)
  // which can cause duplicated UI and React runtime errors.
  const w = window as any;
  if (w.__ECOPRO_REACT_ROOT__ && import.meta.env.PROD) {
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="module"][src]'))
        .map((s) => (s as HTMLScriptElement).src)
        .filter(Boolean)
        .slice(0, 20);
      const assets = scripts.filter((s) => s.includes('/assets/'));
      const buildMatch = assets.map((s) => {
        try {
          const u = new URL(s);
          return u.searchParams.get('v');
        } catch {
          return null;
        }
      }).find((v) => v && v.length > 0);

      reportClientError({
        message: `Double-mount detected: existing React root reused. scripts=${scripts.length} assets=${assets.length}`,
        name: 'EcoproMountGuard',
        stack: new Error('Double-mount detected').stack,
        url: window.location.href,
        route: window.location.pathname,
        build: buildId || (buildMatch ? String(buildMatch).slice(0, 80) : undefined),
      });
    } catch {
      // ignore
    }
  }

  // If a different bundle already mounted a React root, do NOT reuse it.
  // Reusing a root across different React module graphs can trigger invalid hook calls.
  const priorBuildId: string | null | undefined = w.__ECOPRO_BUILD_ID__;
  const priorReactRef: unknown = w.__ECOPRO_REACT_REF__;
  const reactRefMismatch = !!priorReactRef && priorReactRef !== React;
  const buildIdMismatch = !!priorBuildId && !!buildId && priorBuildId !== buildId;

  if (w.__ECOPRO_REACT_ROOT__ && import.meta.env.PROD && (reactRefMismatch || buildIdMismatch)) {
    try {
      reportClientError({
        message: `React root mismatch: priorBuild=${priorBuildId ?? 'null'} currentBuild=${buildId ?? 'null'} reactRefMismatch=${reactRefMismatch}. Unmounting prior root to avoid hook mismatch.`,
        name: 'EcoproMountGuardMismatch',
        stack: new Error('React root mismatch').stack,
        url: window.location.href,
        route: window.location.pathname,
        build: buildId || priorBuildId || undefined,
      });
    } catch {
      // ignore
    }

    try {
      w.__ECOPRO_REACT_ROOT__.unmount?.();
    } catch {
      // ignore
    }
    w.__ECOPRO_REACT_ROOT__ = undefined;
    w.__ECOPRO_BUILD_ID__ = undefined;
    w.__ECOPRO_REACT_REF__ = undefined;
  }

  if (!w.__ECOPRO_REACT_ROOT__) {
    w.__ECOPRO_REACT_ROOT__ = createRoot(container);
    w.__ECOPRO_BUILD_ID__ = buildId;
    w.__ECOPRO_REACT_REF__ = React;
  }

  w.__ECOPRO_REACT_ROOT__.render(<App />);
}
