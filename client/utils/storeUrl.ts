export function storeNameToSlug(storeName: string): string {
  return storeName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    || 'store';
}

export function generateStoreUrl(storeName: string, isPublic: boolean = false): string {
  const cleanName = storeNameToSlug(storeName);
  if (isPublic) {
    return `${cleanName}-ecopro.com`;
  }
  return `/store/${cleanName}`;
}

export function getFullStoreUrl(settings: { subdomain?: string | null; store_slug?: string }): string {
  if (settings.subdomain) {
    return `https://${settings.subdomain}.sahla4eco.com`;
  }
  const slug = settings.store_slug || '';
  return slug ? `${window.location.origin}/store/${encodeURIComponent(slug)}` : '/store';
}

export function getProductShareUrl(settings: { subdomain?: string | null; store_slug?: string }, productSlug: string): string {
  if (settings.subdomain) {
    return `https://${settings.subdomain}.sahla4eco.com/${encodeURIComponent(productSlug)}`;
  }
  const slug = settings.store_slug || '';
  return `${window.location.origin}/store/${encodeURIComponent(slug)}/${encodeURIComponent(productSlug)}`;
}
