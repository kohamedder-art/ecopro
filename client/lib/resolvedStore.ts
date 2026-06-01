export function getResolvedStoreSlug(): string | null {
  const slug = (window as any).__STORE_SLUG;
  return typeof slug === 'string' && slug.length > 0 ? slug : null;
}

export function isSubdomainStore(): boolean {
  return getResolvedStoreSlug() !== null;
}

/**
 * Build a store-relative URL. On a subdomain, returns a clean path
 * (e.g. "/product-slug"). On the main platform domain, returns a
 * /store/:storeSlug-prefixed path for backwards compatibility.
 *
 * Pass an empty path or "/" for the store home.
 */
export function buildStoreUrl(storeSlug: string, path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (isSubdomainStore()) {
    return cleanPath;
  }
  return `/store/${encodeURIComponent(storeSlug)}${cleanPath === '/' ? '' : cleanPath}`;
}
