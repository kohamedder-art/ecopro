import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  initPixels,
  loadPlatformPixelConfig,
  loadStorePixelConfig,
  trackPageView,
} from '../lib/pixel';
import { getResolvedStoreSlug } from '../lib/resolvedStore';

/**
 * Global pixel manager. Mounted once in App.
 *
 * Responsibilities (the ONLY place that triggers init + PageView):
 *  - resolve scope: storefront (subdomain or /store/:slug) vs platform
 *  - load the right pixel config endpoint
 *  - initialise the client SDKs once
 *  - fire a de-duplicated PageView on every route change
 *
 * Storefront event tracking (AddToCart / Purchase / session analytics) stays in
 * PixelScripts; it no longer initialises pixels or fires PageView.
 */
export default function PixelManager() {
  const location = useLocation();
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const subdomainSlug = getResolvedStoreSlug();
      const pathSlug = location.pathname.match(/^\/store\/([^/]+)/)?.[1];

      const config = subdomainSlug
        ? await loadStorePixelConfig(subdomainSlug)
        : pathSlug
          ? await loadStorePixelConfig(pathSlug)
          : await loadPlatformPixelConfig();

      if (cancelled) return;

      await initPixels(config);
      if (cancelled) return;
      trackPageView(location.pathname + location.search);
      loadedRef.current = true;
    }

    run();
    return () => {
      cancelled = true;
    };
    // Re-run on every route change so storefront PageViews register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return null;
}
