import type { Request } from 'express';

const SUSPICIOUS_UA_PATTERNS = [
  /headless/i, /curl/i, /python/i, /wget/i, /go-http/i,
  /ruby/i, /java\//i, /perl/i, /libwww/i, /scrapy/i,
  /axios/i, /node-fetch/i, /httpie/i,
];

function getClientIp(req: Request): string | null {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() || null;
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && xri.trim()) return xri.trim();
  return (req as any).ip || null;
}

function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/android/i.test(ua)) return 'Android';
    return 'Mobile';
  }
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  if (/bot|crawl|spider/i.test(ua)) return 'Bot';
  return 'Unknown';
}

function isSuspiciousUA(ua: string | null): boolean {
  if (!ua) return false;
  return SUSPICIOUS_UA_PATTERNS.some(p => p.test(ua));
}

function isAdminPath(path: string): boolean {
  return path.startsWith('/api/admin/') || path.startsWith('/admin/');
}

export async function trackAccountRequest(req: Request): Promise<void> {
  const user = (req as any).user;
  if (!user?.id) return;

  const userId = String(user.id);
  const email = user.email || '';
  const userType = user.user_type || 'client';
  const name = user.name || email;
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] as string) || null;
  const path = (req.originalUrl || req.url || '').split('?')[0] || '';
  const geo = (req as any).geo as { country_code?: string; region?: string; city?: string } | undefined;
  const device = parseDevice(ua);

  try {
    const { pool } = await import('./database');
    if (!pool) return;

    // Upsert account tracking
    await pool.query(
      `INSERT INTO account_tracking (user_id, email, name, user_type, last_ip, last_user_agent, device_info, last_country, last_region, last_city, last_path, last_seen_at, first_seen_at, total_requests, is_suspicious, suspicious_flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), 1, false, '[]'::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         user_type = EXCLUDED.user_type,
         last_ip = EXCLUDED.last_ip,
         last_user_agent = EXCLUDED.last_user_agent,
         device_info = EXCLUDED.device_info,
         last_country = COALESCE(EXCLUDED.last_country, account_tracking.last_country),
         last_region = COALESCE(EXCLUDED.last_region, account_tracking.last_region),
         last_city = COALESCE(EXCLUDED.last_city, account_tracking.last_city),
         last_path = EXCLUDED.last_path,
         last_seen_at = NOW(),
         total_requests = account_tracking.total_requests + 1`,
      [userId, email, name, userType, ip, ua, device, geo?.country_code || null, geo?.region || null, geo?.city || null, path]
    );

    // --- Suspicious checks ---
    const flags: string[] = [];

    // 1. Check User-Agent
    let uaFlag = false;
    if (isSuspiciousUA(ua)) {
      flags.push('suspicious_ua');
      uaFlag = true;
    }

    // 2. Check VPN/Proxy/TOR via ip_intelligence
    let vpnFlag = false;
    if (ip) {
      const intel = await pool.query(
        `SELECT is_vpn, is_proxy, is_tor, is_datacenter, fraud_score, risk_level FROM ip_intelligence WHERE ip = $1`,
        [ip]
      );
      if (intel.rows.length > 0) {
        const r = intel.rows[0];
        if (r.is_vpn || r.is_proxy || r.is_tor || (r.risk_level === 'high' || r.risk_level === 'critical')) {
          flags.push('vpn_proxy_tor');
          vpnFlag = true;
        }
      }
    }

    // 3. New account hitting admin paths
    if (isAdminPath(path)) {
      const acct = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (NOW() - first_seen_at)) / 3600 < 24 AS is_new FROM account_tracking WHERE user_id = $1`,
        [userId]
      );
      if (acct.rows.length > 0 && acct.rows[0].is_new) {
        flags.push('new_account_admin_hit');
      }
    }

    // 4. Check if this IP is shared by multiple other accounts
    if (ip) {
      const ipShare = await pool.query(
        `SELECT COUNT(*) AS cnt FROM account_tracking WHERE last_ip = $1 AND user_id != $2 AND last_seen_at > NOW() - INTERVAL '24 hours'`,
        [ip, userId]
      );
      if (parseInt(ipShare.rows[0].cnt) >= 3) {
        flags.push('shared_ip');
      }
    }

    // 5. Check multiple IPs for same account
    const ipCount = await pool.query(
      `SELECT COUNT(DISTINCT last_ip) AS cnt FROM account_tracking WHERE last_ip IS NOT NULL AND user_id = $1 AND last_seen_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    // This needs a broader check — we can't see historical IPs from just account_tracking.
    // We'll check if the current IP is different from a recent IP.
    // For now, skip this check since we only store one IP.

    if (flags.length > 0) {
      // Update suspicious flags on account
      const { logSecurityEvent } = await import('./security');
      
      // Get existing flags
      const existing = await pool.query(
        `SELECT suspicious_flags FROM account_tracking WHERE user_id = $1`,
        [userId]
      );
      let existingFlags: string[] = [];
      if (existing.rows.length > 0 && existing.rows[0].suspicious_flags) {
        existingFlags = existing.rows[0].suspicious_flags;
      }
      
      const allFlags = [...new Set([...existingFlags, ...flags])];
      
      await pool.query(
        `UPDATE account_tracking SET is_suspicious = true, suspicious_flags = $2::jsonb, last_suspicious_at = NOW() WHERE user_id = $1`,
        [userId, JSON.stringify(allFlags)]
      );

      // Log to security_events
      for (const flag of flags) {
        await logSecurityEvent({
          event_type: 'account_suspicious',
          severity: flag === 'suspicious_ua' ? 'warn' : 'error',
          method: req.method,
          path,
          ip,
          user_agent: ua,
          user_id: userId,
          user_type: userType,
          role: user.role,
          country_code: geo?.country_code || null,
          region: geo?.region || null,
          city: geo?.city || null,
          metadata: { flag, device },
        });
      }
    }
  } catch (err) {
    // Non-critical — silently ignore tracking errors
  }
}
