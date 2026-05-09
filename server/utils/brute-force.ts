/**
 * Brute Force Protection
 * 
 * Tracks failed login attempts and blocks IPs/accounts that exceed thresholds.
 * Uses in-memory store with periodic DB sync for persistence.
 */

import { pool } from './database';
import { logSecurityEvent, getClientIp, getGeo, computeFingerprint, parseCookie } from './security';

// In-memory tracking for fast lookups
const loginAttempts = new Map<string, { count: number; firstAttempt: number; blocked: boolean; blockedUntil: number }>();

// Configuration
const CONFIG = {
  // Per-IP limits
  maxAttemptsPerIp: 10,           // Max failed attempts per IP
  ipWindowMs: 15 * 60 * 1000,    // 15 minute window
  ipBlockDurationMs: 30 * 60 * 1000, // Block for 30 minutes after exceeding
  
  // Per-account limits (by email)
  maxAttemptsPerAccount: 20,     // Max failed attempts per email
  accountWindowMs: 60 * 60 * 1000,  // 1 hour window
  accountBlockDurationMs: 60 * 60 * 1000, // Block account for 1 hour
  
  // Escalation: if same IP hits multiple accounts
  multiAccountThreshold: 3,      // If IP tries 3+ different accounts
  multiAccountBlockMs: 24 * 60 * 60 * 1000, // Block for 24 hours
  
  // Cleanup interval
  cleanupIntervalMs: 5 * 60 * 1000, // Clean old entries every 5 minutes
};

// Track which accounts an IP has tried
const ipToAccounts = new Map<string, Set<string>>();

export function clearBruteForceMemory(): { clearedAttempts: number; clearedIpAccounts: number } {
  const clearedAttempts = loginAttempts.size;
  const clearedIpAccounts = ipToAccounts.size;
  loginAttempts.clear();
  ipToAccounts.clear();
  return { clearedAttempts, clearedIpAccounts };
}

/**
 * Check if a login attempt should be allowed
 */
export function checkLoginAllowed(ip: string, email?: string): { 
  allowed: boolean; 
  reason?: string; 
  blockedUntil?: number;
  attemptsRemaining?: number;
} {
  const now = Date.now();
  const ipKey = `ip:${ip}`;
  const emailKey = email ? `email:${email.toLowerCase()}` : null;
  
  // Check IP block
  const ipData = loginAttempts.get(ipKey);
  if (ipData) {
    if (ipData.blocked && ipData.blockedUntil > now) {
      return { 
        allowed: false, 
        reason: 'too_many_attempts_ip', 
        blockedUntil: ipData.blockedUntil 
      };
    }
    // Reset if window expired
    if (now - ipData.firstAttempt > CONFIG.ipWindowMs) {
      loginAttempts.delete(ipKey);
    }
  }
  
  // Check account block
  if (emailKey) {
    const emailData = loginAttempts.get(emailKey);
    if (emailData) {
      if (emailData.blocked && emailData.blockedUntil > now) {
        return { 
          allowed: false, 
          reason: 'too_many_attempts_account', 
          blockedUntil: emailData.blockedUntil 
        };
      }
      // Reset if window expired
      if (now - emailData.firstAttempt > CONFIG.accountWindowMs) {
        loginAttempts.delete(emailKey);
      }
    }
  }
  
  // Check multi-account attack (same IP trying many accounts)
  const accountsForIp = ipToAccounts.get(ip);
  if (accountsForIp && accountsForIp.size >= CONFIG.multiAccountThreshold) {
    // This IP is credential stuffing - block it hard
    const ipDataNow = loginAttempts.get(ipKey);
    if (ipDataNow && ipDataNow.blocked && ipDataNow.blockedUntil > now) {
      return { 
        allowed: false, 
        reason: 'credential_stuffing_detected', 
        blockedUntil: ipDataNow.blockedUntil 
      };
    }
  }
  
  // Calculate remaining attempts
  const currentIpData = loginAttempts.get(ipKey);
  const attemptsRemaining = currentIpData 
    ? Math.max(0, CONFIG.maxAttemptsPerIp - currentIpData.count) 
    : CONFIG.maxAttemptsPerIp;
  
  return { allowed: true, attemptsRemaining };
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
  req: any,
  email: string,
  reason: 'user_not_found' | 'bad_password' | 'account_locked' | 'account_blocked' | 'admin_portal_required',
  loginContext?: string
): Promise<{ blocked: boolean; blockedUntil?: number }> {
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  const geo = getGeo(req, ip);
  const fpCookie = parseCookie(req, 'ecopro_fp');
  const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });
  const now = Date.now();
  
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${email.toLowerCase()}`;
  
  // Track IP attempts
  let ipData = loginAttempts.get(ipKey);
  if (!ipData || now - ipData.firstAttempt > CONFIG.ipWindowMs) {
    ipData = { count: 0, firstAttempt: now, blocked: false, blockedUntil: 0 };
  }
  ipData.count++;
  
  // Track email attempts
  let emailData = loginAttempts.get(emailKey);
  if (!emailData || now - emailData.firstAttempt > CONFIG.accountWindowMs) {
    emailData = { count: 0, firstAttempt: now, blocked: false, blockedUntil: 0 };
  }
  emailData.count++;
  
  // Track which accounts this IP has tried
  let accountsForIp = ipToAccounts.get(ip);
  if (!accountsForIp) {
    accountsForIp = new Set();
    ipToAccounts.set(ip, accountsForIp);
  }
  accountsForIp.add(email.toLowerCase());
  
  // Check if we need to block
  let shouldBlockIp = false;
  let shouldBlockAccount = false;
  let isCredentialStuffing = false;
  
  // IP exceeded threshold
  if (ipData.count >= CONFIG.maxAttemptsPerIp) {
    ipData.blocked = true;
    ipData.blockedUntil = now + CONFIG.ipBlockDurationMs;
    shouldBlockIp = true;
  }
  
  // Account exceeded threshold
  if (emailData.count >= CONFIG.maxAttemptsPerAccount) {
    emailData.blocked = true;
    emailData.blockedUntil = now + CONFIG.accountBlockDurationMs;
    shouldBlockAccount = true;
  }
  
  // Multi-account attack detection
  if (accountsForIp.size >= CONFIG.multiAccountThreshold) {
    ipData.blocked = true;
    ipData.blockedUntil = now + CONFIG.multiAccountBlockMs;
    isCredentialStuffing = true;
  }
  
  // Save updated data
  loginAttempts.set(ipKey, ipData);
  loginAttempts.set(emailKey, emailData);
  
  // Log security event
  const severity = isCredentialStuffing ? 'error' : (shouldBlockIp || shouldBlockAccount ? 'warn' : 'info');
  
  try {
    const normalizedLoginContext = typeof loginContext === 'string' && loginContext.trim()
      ? loginContext.trim().slice(0, 64)
      : null;

    await logSecurityEvent({
      event_type: isCredentialStuffing ? 'brute_force_attack' : 'auth_login_failed',
      severity,
      request_id: req.requestId || null,
      method: req.method,
      path: req.path,
      status_code: 401,
      ip,
      user_agent: ua,
      fingerprint,
      country_code: geo.country_code,
      region: geo.region,
      city: geo.city,
      user_id: null,
      user_type: null,
      role: null,
      metadata: {
        scope: 'auth',
        action: 'login_failed',
        login_context: normalizedLoginContext,
        reason,
        email_hash: email ? Buffer.from(email.toLowerCase()).toString('base64').substring(0, 16) : null,
        ip_attempts: ipData.count,
        account_attempts: emailData.count,
        accounts_tried_by_ip: accountsForIp.size,
        blocked_ip: shouldBlockIp,
        blocked_account: shouldBlockAccount,
        credential_stuffing: isCredentialStuffing,
      },
    });
    
    // If credential stuffing, also try to auto-block the IP
    if (isCredentialStuffing) {
      try {
        await pool.query(
          `INSERT INTO security_ip_blocks (ip, reason, is_active, created_by, created_at, updated_at)
           VALUES ($1, $2, true, 'system', NOW(), NOW())
           ON CONFLICT (ip) DO UPDATE SET 
             is_active = true, 
             reason = $2, 
             updated_at = NOW()`,
          [ip, 'AUTO:credential_stuffing']
        );
      } catch (e) {
        // Table might not exist
      }
    }
  } catch (e) {
    console.error('Failed to log brute force event:', e);
  }
  
  const blocked = shouldBlockIp || shouldBlockAccount || isCredentialStuffing;
  return { 
    blocked, 
    blockedUntil: blocked ? Math.max(ipData.blockedUntil, emailData.blockedUntil) : undefined 
  };
}

/**
 * Record a successful login (clears failed attempts for that IP/email)
 */
export function recordSuccessfulLogin(ip: string, email: string): void {
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${email.toLowerCase()}`;
  
  // Don't fully clear IP data (might be shared IP) but reduce count
  const ipData = loginAttempts.get(ipKey);
  if (ipData && !ipData.blocked) {
    ipData.count = Math.max(0, ipData.count - 1);
    loginAttempts.set(ipKey, ipData);
  }
  
  // Clear email data on successful login
  loginAttempts.delete(emailKey);
  
  // Remove this email from IP's tried accounts
  const accountsForIp = ipToAccounts.get(ip);
  if (accountsForIp) {
    accountsForIp.delete(email.toLowerCase());
    if (accountsForIp.size === 0) {
      ipToAccounts.delete(ip);
    }
  }
}

/**
 * Cleanup old entries periodically
 */
function cleanup(): void {
  const now = Date.now();
  
  // Cleanup login attempts
  for (const [key, data] of loginAttempts.entries()) {
    const windowMs = key.startsWith('ip:') ? CONFIG.ipWindowMs : CONFIG.accountWindowMs;
    if (!data.blocked && now - data.firstAttempt > windowMs) {
      loginAttempts.delete(key);
    }
    // Unblock if block expired
    if (data.blocked && data.blockedUntil < now) {
      loginAttempts.delete(key);
    }
  }
  
  // Cleanup IP to accounts mapping (older than 1 hour)
  const oneHourAgo = now - 60 * 60 * 1000;
  for (const [ip, accounts] of ipToAccounts.entries()) {
    // If this IP hasn't had any recent activity, clear it
    const ipKey = `ip:${ip}`;
    const ipData = loginAttempts.get(ipKey);
    if (!ipData || ipData.firstAttempt < oneHourAgo) {
      ipToAccounts.delete(ip);
    }
  }
}

// Start cleanup interval
setInterval(cleanup, CONFIG.cleanupIntervalMs);

/**
 * Get current brute force stats (for admin dashboard)
 */
export function getBruteForceStats(): {
  blockedIps: number;
  blockedAccounts: number;
  activeTracking: number;
  suspiciousIps: { ip: string; attempts: number; accountsTried: number }[];
} {
  let blockedIps = 0;
  let blockedAccounts = 0;
  const now = Date.now();
  const suspiciousIps: { ip: string; attempts: number; accountsTried: number }[] = [];
  
  for (const [key, data] of loginAttempts.entries()) {
    if (data.blocked && data.blockedUntil > now) {
      if (key.startsWith('ip:')) {
        blockedIps++;
        const ip = key.replace('ip:', '');
        const accountsTried = ipToAccounts.get(ip)?.size || 0;
        suspiciousIps.push({ ip, attempts: data.count, accountsTried });
      } else {
        blockedAccounts++;
      }
    }
  }
  
  // Also add IPs that are close to being blocked
  for (const [ip, accounts] of ipToAccounts.entries()) {
    if (accounts.size >= 2) {
      const ipKey = `ip:${ip}`;
      const ipData = loginAttempts.get(ipKey);
      if (ipData && !ipData.blocked) {
        suspiciousIps.push({ ip, attempts: ipData.count, accountsTried: accounts.size });
      }
    }
  }
  
  return {
    blockedIps,
    blockedAccounts,
    activeTracking: loginAttempts.size,
    suspiciousIps: suspiciousIps.sort((a, b) => b.accountsTried - a.accountsTried).slice(0, 20),
  };
}
