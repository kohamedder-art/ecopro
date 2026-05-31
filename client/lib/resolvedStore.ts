export function getResolvedStoreSlug(): string | null {
  const slug = (window as any).__STORE_SLUG;
  return typeof slug === 'string' && slug.length > 0 ? slug : null;
}

export function isSubdomainStore(): boolean {
  return getResolvedStoreSlug() !== null;
}
