export function getStoreFullUrl(subdomain: string | null | undefined, storeSlug: string, path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (subdomain) {
    return `https://${subdomain}.sahla4eco.com${cleanPath}`;
  }
  return `https://sahla4eco.com/store/${encodeURIComponent(storeSlug)}${cleanPath}`;
}
