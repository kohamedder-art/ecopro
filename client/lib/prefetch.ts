/**
 * Prefetch API data when user hovers over navigation links
 * This makes page transitions feel instant
 */

// Cache to track what we've already prefetched
const prefetchedUrls = new Set<string>();

// API endpoints to prefetch for each dashboard route
const routePrefetchMap: Record<string, string[]> = {
  '/dashboard': ['/api/dashboard/stats', '/api/dashboard/analytics'],
  '/dashboard/orders': ['/api/client/orders?limit=100', '/api/client/order-statuses'],
  '/dashboard/stock': ['/api/client/stock', '/api/client/stock/categories'],
  '/dashboard/preview': ['/api/client/store/settings', '/api/client/store/products'],
  '/dashboard/profile': ['/api/auth/me'],
  '/dashboard/delivery/companies': ['/api/delivery/companies'],
  '/dashboard/bot-settings': ['/api/bot/settings', '/api/client/store/settings'],
  '/dashboard/staff': ['/api/client/staff'],
  '/template-editor': ['/api/client/store/settings'],
};

/**
 * Prefetch API data for a route
 * Call this on mouseenter/focus of navigation links
 */
export function prefetchRouteData(path: string) {
  // Remote Render Postgres + many concurrent prefetches can make the whole platform feel slow.
  // Keep prefetch OFF by default; power users can opt-in.
  try {
    if (typeof window !== 'undefined') {
      const enabled = window.localStorage.getItem('ecopro_prefetch') === '1';
      if (!enabled) return;
    }
  } catch {
    return;
  }

  const urls = routePrefetchMap[path];
  if (!urls) return;

  urls.forEach(url => {
    if (prefetchedUrls.has(url)) return;
    prefetchedUrls.add(url);

    // Use low priority fetch to not block main thread
    fetch(url, {
      method: 'GET',
      credentials: 'include',
      priority: 'low' as any,
    }).catch(() => {
      // Remove from cache so it can be retried
      prefetchedUrls.delete(url);
    });
  });
}

/**
 * Clear prefetch cache (call on logout or major state change)
 */
export function clearPrefetchCache() {
  prefetchedUrls.clear();
}
