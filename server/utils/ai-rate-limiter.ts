/**
 * Unified AI Rate Limiter
 * 
 * Provides rate limiting for all AI interactions:
 * - Customers: 3 requests/minute (prevents spam, controls costs)
 * - Store Owners: 10 requests/minute (higher limit for business needs)
 * - Staff: 15 requests/minute
 * - Admin: 30 requests/minute
 * - Per-IP: 10 requests/minute (for unauthenticated endpoints)
 * - Global: 200 requests/minute across the entire platform
 * 
 * SECURITY: All rate limits are purely in-memory. They reset on server restart.
 * This is acceptable because the purpose is to prevent burst abuse,
 * not to enforce long-term quotas (which are handled by ai_usage_quotas in DB).
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimiter = new Map<string, RateLimitRecord>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  customer: { maxRequests: 30, windowMs: 60 * 60 * 1000 },    // 30/hour
  store_owner: { maxRequests: 10, windowMs: 60 * 1000 },    // 10/min
  staff: { maxRequests: 15, windowMs: 60 * 1000 },        // 15/min
  admin: { maxRequests: 30, windowMs: 60 * 1000 },        // 30/min
  ip: { maxRequests: 10, windowMs: 60 * 1000 },           // 10/min per IP
  global: { maxRequests: 200, windowMs: 60 * 1000 },      // 200/min platform-wide
} as const;

export type UserRole = keyof typeof RATE_LIMITS;

/**
 * Check if request is allowed under rate limit
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const record = rateLimiter.get(key);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimiter.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }
  
  if (record.count >= config.maxRequests) {
    // Limit exceeded
    return false;
  }
  
  // Increment and allow
  record.count++;
  return true;
}

/**
 * Check global rate limit (across ALL clients)
 * This prevents platform-wide resource exhaustion even if individual keys are fine.
 */
export function checkGlobalRateLimit(): boolean {
  return checkRateLimit('__global__', RATE_LIMITS.global);
}

/**
 * Check IP-based rate limit for unauthenticated endpoints.
 */
export function checkIpRateLimit(ip: string): boolean {
  return checkRateLimit(`ip:${ip}`, RATE_LIMITS.ip);
}

/**
 * Get remaining time until rate limit resets
 */
export function getRateLimitResetTime(key: string): number {
  return rateLimiter.get(key)?.resetTime || Date.now();
}

/**
 * Get current count for a key
 */
export function getCurrentCount(key: string): number {
  const record = rateLimiter.get(key);
  if (!record) return 0;
  if (Date.now() > record.resetTime) return 0;
  return record.count;
}

/**
 * Get remaining requests for a key
 */
export function getRemainingRequests(key: string, config: RateLimitConfig): number {
  const current = getCurrentCount(key);
  return Math.max(0, config.maxRequests - current);
}

/**
 * Format time remaining in human-readable format
 */
export function formatTimeRemaining(resetTime: number, locale: 'ar' | 'fr' | 'en' = 'ar'): string {
  const seconds = Math.ceil((resetTime - Date.now()) / 1000);
  
  if (locale === 'ar') {
    if (seconds < 60) return `${seconds} ثانية`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} دقيقة`;
  }
  
  if (locale === 'fr') {
    if (seconds < 60) return `${seconds} secondes`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minutes`;
  }
  
  // English default
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minutes`;
}

/**
 * Get rate limit error message
 */
export function getRateLimitMessage(
  resetTime: number, 
  role: UserRole,
  locale: 'ar' | 'fr' | 'en' = 'ar'
): string {
  const timeStr = formatTimeRemaining(resetTime, locale);
  
  if (locale === 'ar') {
    return `⏱️ عذراً، وصلت للحد الأقصى (${RATE_LIMITS[role].maxRequests} رسائل/دقيقة). يرجى الانتظار ${timeStr}.`;
  }
  
  if (locale === 'fr') {
    return `⏱️ Limite atteinte (${RATE_LIMITS[role].maxRequests} messages/min). Veuillez attendre ${timeStr}.`;
  }
  
  return `⏱️ Rate limit reached (${RATE_LIMITS[role].maxRequests} messages/min). Please wait ${timeStr}.`;
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, record] of rateLimiter) {
    if (now > record.resetTime) {
      rateLimiter.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
