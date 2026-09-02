/**
 * Check if a URL is a Cloudflare R2 URL.
 */
export function isR2Url(url: string): boolean {
  return !!url && (url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com'));
}

/**
 * Check if a URL is a Cloudinary URL.
 */
export function isCloudinaryUrl(url: string): boolean {
  return !!url && url.includes('cloudinary.com');
}

/**
 * Get a tiny blurred placeholder for any image URL.
 * For R2/Cloudinary: uses CSS blur (no server-side transform needed).
 * Returns empty string for non-image URLs.
 */
export function getBlurPlaceholderUrl(_url: string): string {
  // Blur is handled via CSS filter, not URL transform
  // This function exists for API compatibility
  return '';
}
