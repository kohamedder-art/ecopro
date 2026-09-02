export function optimizeCloudinaryUrl(url: string, maxWidth?: number): string {
  if (!url || !url.includes('cloudinary.com')) return url;
  if (url.includes('?tr=')) return url;
  const params = ['w_auto', 'q_auto', 'f_auto', 'c_limit'];
  if (maxWidth) params.push(`w_${maxWidth}`);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}tr=${params.join(',')}`;
}

export function getBlurPlaceholderUrl(url: string): string {
  if (!url || !url.includes('cloudinary.com')) return '';
  if (url.includes('?tr=')) return url;
  return `${url}?tr=w_20,e_blur:1000,q_auto,f_auto`;
}
