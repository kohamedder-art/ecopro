import type { RequestHandler } from 'express';
import { Router } from 'express';
import { ensureConnection } from '../utils/database';
import { generateToken, verifyToken } from '../utils/auth';
import { hashKernelPassword, verifyKernelPassword, logSecurityEvent, getClientIp, getGeo, computeFingerprint, parseCookie } from '../utils/security';
import { randomBytes } from 'crypto';
import os from 'os';
import { getTrafficRecent, getTrafficSummary } from '../utils/traffic';
import { onSecurityEvent } from '../utils/eventBus';

const router = Router();

const KERNEL_ACCESS_COOKIE = 'ecopro_kernel_at';

function getKernelCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTunnel = !!process.env.TUNNEL_MODE;
  const sameSite = (process.env.COOKIE_SAMESITE as any) || (isProduction || isTunnel ? 'none' : 'lax');
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const secure = isProduction || isTunnel;
  return { secure, sameSite, domain };
}

function setKernelAuthCookie(res: any, token: string) {
  const { secure, sameSite, domain } = getKernelCookieOptions();
  res.cookie(KERNEL_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/api/kernel',
    maxAge: 15 * 60 * 1000,
  });
}

function clearKernelAuthCookie(res: any) {
  const { secure, sameSite, domain } = getKernelCookieOptions();
  res.clearCookie(KERNEL_ACCESS_COOKIE, {
    secure,
    sameSite,
    domain,
    path: '/api/kernel',
  });
}

/** Read ecopro_kernel_at cookie and populate req.user */
function kernelAuth(req: any, res: any, next: any) {
  const token = parseCookie(req, KERNEL_ACCESS_COOKIE) || req.cookies?.[KERNEL_ACCESS_COOKIE];
  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = { ...decoded, role: decoded.role || 'root' };
    } catch {
      // invalid or expired — leave req.user as-is
    }
  }
  next();
}

function requireRoot(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // Allow access when either the `role` or the `user_type` is `root`.
  if (req.user.role !== 'root' && req.user.user_type !== 'root') return res.status(403).json({ error: 'Forbidden' });
  return next();
}

async function ensureKernelUserExists(): Promise<void> {
  const pool = await ensureConnection();
  const existing = await pool.query('SELECT id FROM kernel_users LIMIT 1');
  if (existing.rowCount && existing.rowCount > 0) return;

  const envUser = (process.env.KERNEL_USERNAME || '').trim();
  const envPass = (process.env.KERNEL_PASSWORD || '').trim();

  if (envUser && envPass) {
    await pool.query(
      `INSERT INTO kernel_users (username, password_hash, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (username) DO NOTHING`,
      [envUser, hashKernelPassword(envPass)]
    );
    console.log('✅ Kernel user created from env (KERNEL_USERNAME)');
    return;
  }

  // Dev fallback: create a one-time kernel user if none exists.
  // Do NOT do this in production.
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ No kernel user exists and env creds not set. Set KERNEL_USERNAME and KERNEL_PASSWORD.');
    return;
  }

  const username = 'root';
  const password = 'root-' + randomBytes(24).toString('base64url');
  await pool.query(
    `INSERT INTO kernel_users (username, password_hash, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (username) DO NOTHING`,
    [username, hashKernelPassword(password)]
  );
  console.log('🔑 DEV kernel credentials created:');
  console.log('   username:', username);
  console.log('   password: [REDACTED]');
}

// Called from server startup
export async function initKernel(): Promise<void> {
  await ensureKernelUserExists();
}

export const kernelLogin: RequestHandler = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const pool = await ensureConnection();
  const row = await pool.query(
    'SELECT id, username, password_hash, is_active FROM kernel_users WHERE username = $1',
    [String(username)]
  );

  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  const geo = getGeo(req, ip);
  const fpCookie = parseCookie(req, 'ecopro_fp');
  const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });

  if (!row.rows[0] || !row.rows[0].is_active) {
    await logSecurityEvent({
      event_type: 'auth_login_failed',
      severity: 'warn',
      method: req.method,
      path: req.path,
      status_code: 401,
      ip,
      user_agent: ua,
      fingerprint,
      country_code: geo.country_code,
      region: geo.region,
      city: geo.city,
      metadata: { scope: 'kernel', reason: 'no_user_or_inactive', username: String(username) },
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = verifyKernelPassword(String(password), row.rows[0].password_hash);
  if (!ok) {
    await logSecurityEvent({
      event_type: 'auth_login_failed',
      severity: 'warn',
      method: req.method,
      path: req.path,
      status_code: 401,
      ip,
      user_agent: ua,
      fingerprint,
      country_code: geo.country_code,
      region: geo.region,
      city: geo.city,
      metadata: { scope: 'kernel', reason: 'bad_password', username: String(username) },
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await pool.query('UPDATE kernel_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [row.rows[0].id]);

  const token = generateToken({
    id: `kernel:${row.rows[0].id}`,
    email: `${row.rows[0].username}@kernel`,
    role: 'root',
    user_type: 'root',
  });

  setKernelAuthCookie(res, token);

  return res.json({
    token,
    user: { username: row.rows[0].username, role: 'root', user_type: 'root' },
  });
};

export const getSecuritySummary: RequestHandler = async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt(String(req.query.days || '7'), 10) || 7));
  const pool = await ensureConnection();

  const since = `${days} days`;

  const [blockedByCountry, topIps, repeatFingerprints] = await Promise.all([
    pool.query(
      `SELECT COALESCE(country_code, '??') as country_code, COUNT(*)::int as count
       FROM security_events
       WHERE event_type = 'geo_block'
         AND created_at > NOW() - $1::interval
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 20`,
      [since]
    ),
    pool.query(
      `SELECT COALESCE(ip, 'unknown') as ip, COUNT(*)::int as count
       FROM security_events
       WHERE created_at > NOW() - $1::interval
         AND ip NOT IN ('127.0.0.1', '::1', 'localhost', '')
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 20`,
      [since]
    ),
    pool.query(
      `SELECT
         COALESCE(fingerprint, 'unknown') as fingerprint,
         MAX(ip) as ip,
         MAX(user_agent) as user_agent,
         COUNT(*)::int as count,
         MAX(created_at) as last_seen
       FROM security_events
       WHERE created_at > NOW() - $1::interval
         AND ip NOT IN ('127.0.0.1', '::1', 'localhost', '')
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 20`,
      [since]
    ),
  ]);

  res.json({
    days,
    blockedByCountry: blockedByCountry.rows,
    topIps: topIps.rows,
    repeatFingerprints: repeatFingerprints.rows,
  });
};

export const listSecurityEvents: RequestHandler = async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit || '200'), 10) || 200));
  const includeLocalhost = req.query.includeLocalhost === 'true';
  const pool = await ensureConnection();

  const localhostFilter = includeLocalhost ? '' : "AND ip NOT IN ('127.0.0.1', '::1', 'localhost', '')";
  
  const result = await pool.query(
    `SELECT id, created_at, event_type, severity, request_id, method, path, status_code,
            ip, user_agent, fingerprint, country_code, region, city,
            user_id, user_type, role, metadata
     FROM security_events
     WHERE 1=1 ${localhostFilter}
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  const events = result.rows || [];

  // Collect fingerprints and user_ids to enrich the events
  const fingerprintSet = new Set<string>();
  const userIdSet = new Set<number>();
  for (const ev of events) {
    if (ev.fingerprint) fingerprintSet.add(String(ev.fingerprint));
    if (ev.user_id && /^\d+$/.test(String(ev.user_id))) userIdSet.add(Number(ev.user_id));
  }

  const fingerprints = fingerprintSet.size > 0 ? Array.from(fingerprintSet) : [];
  const userIds = userIdSet.size > 0 ? Array.from(userIdSet) : [];

  const fingerprintMap: Record<string, any[]> = {};
  if (fingerprints.length > 0) {
    try {
      const fpRes = await pool.query(
        `SELECT * FROM client_fingerprints WHERE server_fingerprint = ANY($1::text[]) ORDER BY created_at DESC LIMIT 500`,
        [fingerprints]
      );
      for (const r of fpRes.rows || []) {
        const k = String(r.server_fingerprint || '');
        fingerprintMap[k] = fingerprintMap[k] || [];
        fingerprintMap[k].push(r);
      }
    } catch (e) {
      // ignore fingerprint enrichment failures
    }
  }

  const userMap: Record<string, any> = {};
  if (userIds.length > 0) {
    try {
      const ures = await pool.query(`SELECT id, email, name FROM users WHERE id = ANY($1::int[])`, [userIds]);
      for (const u of ures.rows || []) userMap[String(u.id)] = u;
    } catch (e) {
      // ignore
    }
  }

  const mapped = events.map((ev: any) => ({
    ...ev,
    user: ev.user_id && userMap[ev.user_id] ? userMap[ev.user_id] : null,
    fingerprint_details: ev.fingerprint && fingerprintMap[ev.fingerprint] ? fingerprintMap[ev.fingerprint] : [],
  }));

  res.json({ events: mapped });
};

router.post('/login', kernelLogin);
router.post('/logout', (_req, res) => {
  clearKernelAuthCookie(res);
  return res.json({ ok: true });
});

// Kernel auth middleware — reads ecopro_kernel_at cookie before requireRoot checks req.user
router.use(kernelAuth);

router.get('/security/summary', requireRoot, getSecuritySummary);
router.get('/security/events', requireRoot, listSecurityEvents);

// Server-Sent Events stream for live security events
router.get('/events/stream', requireRoot, async (req: any, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send an initial comment to establish the stream
  res.write(': connected\n\n');

  // Heartbeat to keep connections alive
  const hb = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);

  // Subscribe to event bus
  const unsubscribe = onSecurityEvent((ev) => {
    try {
      const payload = JSON.stringify(ev || {});
      res.write(`data: ${payload}\n\n`);
    } catch (e) {
      // ignore send errors
    }
  });

  // Cleanup when client disconnects
  req.on('close', () => {
    clearInterval(hb);
    try { unsubscribe(); } catch {}
  });
});

router.get('/security/me', requireRoot, async (req: any, res) => {
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  const geo = getGeo(req, ip);
  const fpCookie = parseCookie(req, 'ecopro_fp');
  const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });

  let trusted: any = null;
  try {
    const pool = await ensureConnection();
    if (fingerprint) {
      const t = await pool.query(
        `SELECT id, label, is_active, updated_at FROM security_trusted_actors WHERE fingerprint = $1 AND is_active = true LIMIT 1`,
        [fingerprint]
      );
      trusted = t.rows?.[0] || null;
    }
  } catch {
    trusted = null;
  }

  res.json({ ip, user_agent: ua, fingerprint, geo, trusted });
});

router.get('/security/trusted', requireRoot, async (_req, res) => {
  try {
    const pool = await ensureConnection();
    const r = await pool.query(
      `SELECT id, fingerprint, ip, label, is_active, created_at, updated_at
       FROM security_trusted_actors
       ORDER BY is_active DESC, updated_at DESC
       LIMIT 500`
    );
    res.json({ trusted: r.rows, migrationNeeded: false });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('security_trusted_actors') && msg.includes('does not exist')) {
      return res.json({ trusted: [], migrationNeeded: true });
    }
    throw e;
  }
});

router.post('/security/trusted', requireRoot, async (req: any, res) => {
  const fingerprint = (req.body?.fingerprint ? String(req.body.fingerprint) : '').trim() || null;
  const ip = (req.body?.ip ? String(req.body.ip) : '').trim() || null;
  const label = (req.body?.label ? String(req.body.label) : '').trim() || null;
  if (!fingerprint && !ip) return res.status(400).json({ error: 'fingerprint or ip is required' });

  try {
    const pool = await ensureConnection();
    await pool.query(
      `INSERT INTO security_trusted_actors (fingerprint, ip, label, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,true,NOW(),NOW())
       ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
       DO UPDATE SET ip = COALESCE(EXCLUDED.ip, security_trusted_actors.ip), label = COALESCE(EXCLUDED.label, security_trusted_actors.label), is_active = true, updated_at = NOW()`,
      [fingerprint, ip, label]
    );
    if (!fingerprint && ip) {
      await pool.query(
        `INSERT INTO security_trusted_actors (fingerprint, ip, label, is_active, created_at, updated_at)
         VALUES (NULL,$1,$2,true,NOW(),NOW())
         ON CONFLICT (ip) WHERE ip IS NOT NULL
         DO UPDATE SET label = COALESCE(EXCLUDED.label, security_trusted_actors.label), is_active = true, updated_at = NOW()`,
        [ip, label]
      );
    }
    res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('security_trusted_actors') && msg.includes('does not exist')) {
      return res.status(409).json({ error: 'security_trusted_actors table missing (run migrations)' });
    }
    throw e;
  }
});

router.delete('/security/trusted/:id', requireRoot, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    const pool = await ensureConnection();
    await pool.query(`UPDATE security_trusted_actors SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('security_trusted_actors') && msg.includes('does not exist')) {
      return res.status(409).json({ error: 'security_trusted_actors table missing (run migrations)' });
    }
    throw e;
  }
});

router.get('/security/linux/watchlist', requireRoot, async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt(String(req.query.days || '7'), 10) || 7));
  const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit || '50'), 10) || 50));
  const pool = await ensureConnection();
  const since = `${days} days`;

  // Never show the current kernel operator (this device) in the watchlist.
  const requesterFingerprint = (req as any).fingerprint ? String((req as any).fingerprint) : null;
  const requesterIp = (req as any).clientIp ? String((req as any).clientIp) : null;

  // Watchlist is ONLY for suspicious actors.
  // - Linux UA (excluding Android)
  // - UA missing scanners
  // But both are included ONLY when they hit high-risk event types.
  const rows = await pool.query(
    `WITH filtered AS (
      SELECT
        created_at,
        event_type,
        severity,
        method,
        path,
        status_code,
        ip,
        country_code,
        fingerprint,
        user_agent,
        user_id,
        user_type,
        role
      FROM security_events
      WHERE created_at > NOW() - $1::interval
        AND event_type IN ('trap_hit','admin_forbidden','admin_unauthorized','suspicious_path','rate_limited','ip_block')
        AND ($3::text IS NULL OR fingerprint IS DISTINCT FROM $3::text)
        AND ($4::text IS NULL OR ip IS DISTINCT FROM $4::text)
        AND (
          (user_agent ILIKE '%Linux%' AND user_agent NOT ILIKE '%Android%')
          OR (COALESCE(NULLIF(TRIM(user_agent), ''), '') = '')
        )
    ), agg AS (
      SELECT
        COALESCE(fingerprint, ip, 'unknown') as actor_key,
        CASE
          WHEN MAX(CASE WHEN user_agent ILIKE '%Linux%' AND user_agent NOT ILIKE '%Android%' THEN 1 ELSE 0 END) = 1 THEN 'linux'
          ELSE 'unknown_ua'
        END as ua_class,
        MAX(fingerprint) as fingerprint,
        MAX(ip) as ip,
        MAX(country_code) as country_code,
        MAX(user_agent) as user_agent,
        MAX(user_id) as user_id,
        MAX(user_type) as user_type,
        MAX(role) as role,
        COUNT(*)::int as total_events,
        COUNT(*) FILTER (WHERE event_type IN ('trap_hit','admin_forbidden','admin_unauthorized','suspicious_path','rate_limited','ip_block'))::int as suspicious_events,
        COUNT(*) FILTER (WHERE event_type = 'trap_hit')::int as trap_hits,
        COUNT(*) FILTER (WHERE event_type = 'admin_forbidden')::int as admin_forbidden,
        COUNT(*) FILTER (WHERE event_type = 'suspicious_path')::int as suspicious_path,
        MAX(created_at) as last_seen,
        MIN(created_at) as first_seen
      FROM filtered
      GROUP BY 1
    ), trusted AS (
      SELECT fingerprint, ip, label
      FROM security_trusted_actors
      WHERE is_active = true
    )
    SELECT
      a.*,
      t.label as trusted_label,
      CASE WHEN t.fingerprint IS NOT NULL OR t.ip IS NOT NULL THEN true ELSE false END as is_trusted
    FROM agg a
    LEFT JOIN trusted t
      ON (t.fingerprint IS NOT NULL AND t.fingerprint = a.fingerprint)
      OR (t.ip IS NOT NULL AND t.ip = a.ip)
    ORDER BY trap_hits DESC, admin_forbidden DESC, suspicious_events DESC, total_events DESC, last_seen DESC
    LIMIT $2`,
    [since, limit, requesterFingerprint, requesterIp]
  );

  res.json({
    days,
    actors: await Promise.all(rows.rows.map(async (r) => {
      // Try to get IP intelligence for this actor
      let intel: any = null;
      if (r.ip) {
        try {
          const intelResult = await pool.query(
            `SELECT country_code, isp, org, asn, is_vpn, is_proxy, is_tor, is_datacenter, 
                    is_blacklisted, fraud_score, abuse_score, risk_level
             FROM ip_intelligence WHERE ip = $1 LIMIT 1`,
            [r.ip]
          );
          if (intelResult.rows.length > 0) {
            intel = intelResult.rows[0];
          }
        } catch (e) {
          // ip_intelligence table might not exist
        }
      }
      
      // If this actor has an associated user_id, try to fetch basic account info
      let account: any = null;
      if (r.user_id && /^\d+$/.test(String(r.user_id))) {
        try {
          const ures = await pool.query(`SELECT id, email, full_name FROM users WHERE id = $1 LIMIT 1`, [Number(r.user_id)]);
          if (ures.rows.length > 0) account = ures.rows[0];
        } catch (e) {
          // ignore
        }
      }

      return {
        actor_key: r.actor_key,
        ua_class: r.ua_class,
        fingerprint: r.fingerprint,
        ip: r.ip,
        country_code: intel?.country_code || r.country_code,
        user_agent: r.user_agent,
        user_id: r.user_id,
        user: account,
        user_type: r.user_type,
        role: r.role,
        total_events: r.total_events,
        suspicious_events: r.suspicious_events,
        trap_hits: r.trap_hits,
        admin_forbidden: r.admin_forbidden,
        suspicious_path: r.suspicious_path,
        first_seen: r.first_seen,
        last_seen: r.last_seen,
        is_trusted: !!r.is_trusted,
        trusted_label: r.trusted_label || null,
        emergency: !r.is_trusted && (Number(r.trap_hits || 0) > 0 || Number(r.admin_forbidden || 0) > 0),
        // IP Intelligence data
        intel: intel ? {
          isp: intel.isp,
          org: intel.org,
          asn: intel.asn,
          is_vpn: intel.is_vpn,
          is_proxy: intel.is_proxy,
          is_tor: intel.is_tor,
          is_datacenter: intel.is_datacenter,
          is_blacklisted: intel.is_blacklisted,
          fraud_score: intel.fraud_score,
          abuse_score: intel.abuse_score,
          risk_level: intel.risk_level,
        } : null,
      };
    })),
  });
});

router.get('/security/actor/events', requireRoot, async (req, res) => {
  const fingerprint = (req.query.fingerprint ? String(req.query.fingerprint) : '').trim();
  const ip = (req.query.ip ? String(req.query.ip) : '').trim();
  const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit || '200'), 10) || 200));

  if (!fingerprint && !ip) {
    return res.status(400).json({ error: 'fingerprint or ip is required' });
  }

  const pool = await ensureConnection();

  const where = fingerprint ? 'fingerprint = $1' : 'ip = $1';
  const value = fingerprint || ip;

  const events = await pool.query(
    `SELECT id, created_at, event_type, severity, request_id, method, path, status_code,
            ip, user_agent, fingerprint, country_code, region, city,
            user_id, user_type, role, metadata
     FROM security_events
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $2`,
    [value, limit]
  );

  const paths = await pool.query(
    `SELECT COALESCE(path, 'unknown') as path, COUNT(*)::int as count
     FROM security_events
     WHERE ${where}
     GROUP BY 1
     ORDER BY count DESC
     LIMIT 20`,
    [value]
  );

  const types = await pool.query(
    `SELECT event_type, COUNT(*)::int as count
     FROM security_events
     WHERE ${where}
     GROUP BY 1
     ORDER BY count DESC
     LIMIT 30`,
    [value]
  );

  // If any events include a numeric user_id, fetch basic account info
  const userIds = new Set<number>();
  for (const ev of events.rows || []) {
    const uid = ev.user_id;
    if (uid && /^\d+$/.test(String(uid))) userIds.add(Number(uid));
  }

  const accounts: any[] = [];
  const userMap: Record<string, any> = {};
  if (userIds.size > 0) {
    const ids = Array.from(userIds);
    try {
      const ures = await pool.query(`SELECT id, email, full_name FROM users WHERE id = ANY($1::int[])`, [ids]);
      for (const u of ures.rows || []) {
        userMap[String(u.id)] = u;
        accounts.push(u);
      }
    } catch (e) {
      // ignore
    }
  }

  const mappedEvents = (events.rows || []).map((ev: any) => ({
    ...ev,
    user: ev.user_id && userMap[ev.user_id] ? userMap[ev.user_id] : null,
  }));

  res.json({
    fingerprint: fingerprint || null,
    ip: ip || null,
    topPaths: paths.rows,
    eventTypes: types.rows,
    events: mappedEvents,
    accounts,
  });
});

router.get('/status', requireRoot, async (_req, res) => {
  const isRender = Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_EXTERNAL_URL ||
      process.env.RENDER_INTERNAL_HOSTNAME
  );
  const now = new Date();

  let db: any = null;
  try {
    const pool = await ensureConnection();
    const r = await pool.query(
      `SELECT
        current_database() as database,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port,
        version() as server_version`
    );
    db = r.rows?.[0] || null;
  } catch {
    db = { error: 'db_unavailable' };
  }

  // Non-sensitive status only.
  res.json({
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      isRender,
      renderServiceId: process.env.RENDER_SERVICE_ID || null,
      renderServiceName: process.env.RENDER_SERVICE_NAME || null,
      renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null,
    },
    server: {
      now: now.toISOString(),
      hostname: os.hostname(),
      pid: process.pid,
      node: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    db,
  });
});

router.get('/traffic/summary', requireRoot, async (req, res) => {
  const minutes = Math.max(1, Math.min(180, parseInt(String(req.query.minutes || '15'), 10) || 15));
  const days = Math.max(1, Math.min(30, parseInt(String(req.query.days || '7'), 10) || 7));
  const pool = await ensureConnection().catch(() => null);

  // If DB is unavailable, return empty suspicious-only view.
  if (!pool) {
    return res.json({ minutes, total: 0, byStatus: [], topPaths: [], topIps: [], suspiciousOnly: true });
  }

  const requesterFingerprint = (req as any).fingerprint ? String((req as any).fingerprint) : null;
  const requesterIp = (req as any).clientIp ? String((req as any).clientIp) : null;
  const since = `${days} days`;

  const suspicious = await pool.query(
    `WITH agg AS (
      SELECT
        COALESCE(fingerprint, ip, 'unknown') as actor_key,
        MAX(fingerprint) as fingerprint,
        MAX(ip) as ip,
        COUNT(*) FILTER (WHERE event_type = 'trap_hit')::int as trap_hits,
        COUNT(*) FILTER (WHERE event_type = 'auth_login_failed')::int as login_failed
      FROM security_events
      WHERE created_at > NOW() - $1::interval
        AND ($2::text IS NULL OR fingerprint IS DISTINCT FROM $2::text)
        AND ($3::text IS NULL OR ip IS DISTINCT FROM $3::text)
      GROUP BY 1
    )
    SELECT fingerprint, ip
    FROM agg
    WHERE trap_hits > 0 OR login_failed > 5`,
    [since, requesterFingerprint, requesterIp]
  );

  const fpSet = new Set<string>();
  const ipSet = new Set<string>();
  for (const r of suspicious.rows || []) {
    if (r.fingerprint) fpSet.add(String(r.fingerprint));
    if (r.ip) ipSet.add(String(r.ip));
  }

  const raw = getTrafficSummary(minutes);
  const filteredRows = getTrafficRecent(1000).filter((row) => {
    if (row.fingerprint && fpSet.has(row.fingerprint)) return true;
    if (row.ip && ipSet.has(row.ip)) return true;
    return false;
  });

  // If in-memory traffic has no matching suspicious rows, fall back to DB events
  let window = filteredRows;
  if (window.length === 0) {
    try {
      const q = await pool.query(
        `SELECT created_at, method, path, status_code, ip, user_agent, fingerprint, user_id, user_type, role, NULL::int as ms, country_code
         FROM security_events
         WHERE created_at > NOW() - $1::interval
           AND (fingerprint = ANY($2::text[]) OR ip = ANY($3::text[]) OR event_type IN ('trap_hit','suspicious_path','ip_block'))
         ORDER BY created_at DESC
         LIMIT 1000`,
        [since, Array.from(fpSet), Array.from(ipSet)]
      );
      window = (q.rows || []).map((r: any) => ({
        ts: new Date(r.created_at).getTime(),
        method: r.method || 'GET',
        path: r.path || '/',
        status: r.status_code || 0,
        ip: r.ip || null,
        user_agent: r.user_agent || null,
        fingerprint: r.fingerprint || null,
        user_id: r.user_id != null ? String(r.user_id) : null,
        user_type: r.user_type || null,
        role: r.role || null,
        ms: 0,
        country_code: r.country_code || null,
      }));
    } catch (e) {
      // ignore DB fallback errors, keep window as empty
      window = [];
    }
  }

  // Recompute summary from filtered rows within window.
  const sinceMs = Date.now() - minutes * 60 * 1000;
  const filteredWindow = window.filter((r) => r.ts >= sinceMs);
  const byStatusMap = new Map<number, number>();
  const topPathsMap = new Map<string, number>();
  const topIpsMap = new Map<string, number>();
  for (const r of filteredWindow) {
    byStatusMap.set(r.status, (byStatusMap.get(r.status) || 0) + 1);
    topPathsMap.set(r.path, (topPathsMap.get(r.path) || 0) + 1);
    if (r.ip) topIpsMap.set(r.ip, (topIpsMap.get(r.ip) || 0) + 1);
  }
  const byStatus = Array.from(byStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const topPaths = Array.from(topPathsMap.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  const topIps = Array.from(topIpsMap.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  res.json({ minutes: raw.minutes, total: filteredWindow.length, byStatus, topPaths, topIps, suspiciousOnly: true });
});

router.get('/traffic/recent', requireRoot, async (req, res) => {
  const limit = Math.max(1, Math.min(1000, parseInt(String(req.query.limit || '200'), 10) || 200));
  const days = Math.max(1, Math.min(30, parseInt(String(req.query.days || '7'), 10) || 7));
  const pool = await ensureConnection().catch(() => null);

  if (!pool) {
    return res.json({ events: [], suspiciousOnly: true });
  }

  const requesterFingerprint = (req as any).fingerprint ? String((req as any).fingerprint) : null;
  const requesterIp = (req as any).clientIp ? String((req as any).clientIp) : null;
  const since = `${days} days`;

  const suspicious = await pool.query(
    `WITH agg AS (
      SELECT
        COALESCE(fingerprint, ip, 'unknown') as actor_key,
        MAX(fingerprint) as fingerprint,
        MAX(ip) as ip,
        COUNT(*) FILTER (WHERE event_type = 'trap_hit')::int as trap_hits,
        COUNT(*) FILTER (WHERE event_type = 'auth_login_failed')::int as login_failed
      FROM security_events
      WHERE created_at > NOW() - $1::interval
        AND ($2::text IS NULL OR fingerprint IS DISTINCT FROM $2::text)
        AND ($3::text IS NULL OR ip IS DISTINCT FROM $3::text)
      GROUP BY 1
    )
    SELECT fingerprint, ip
    FROM agg
    WHERE trap_hits > 0 OR login_failed > 5`,
    [since, requesterFingerprint, requesterIp]
  );

  const fpSet = new Set<string>();
  const ipSet = new Set<string>();
  for (const r of suspicious.rows || []) {
    if (r.fingerprint) fpSet.add(String(r.fingerprint));
    if (r.ip) ipSet.add(String(r.ip));
  }

  const filtered = getTrafficRecent(1000).filter((row) => {
    if (row.fingerprint && fpSet.has(row.fingerprint)) return true;
    if (row.ip && ipSet.has(row.ip)) return true;
    return false;
  });

  // DB fallback: if in-memory filtered is empty, return matching security_events
  let outEvents = filtered;
  if (outEvents.length === 0) {
    try {
      const q = await pool.query(
        `SELECT id, created_at, event_type, method, path, status_code, ip, user_agent, fingerprint, user_id, user_type, role, country_code, metadata
         FROM security_events
         WHERE created_at > NOW() - $1::interval
           AND (fingerprint = ANY($2::text[]) OR ip = ANY($3::text[]) OR event_type IN ('trap_hit','suspicious_path','ip_block'))
         ORDER BY created_at DESC
         LIMIT $4`,
        [since, Array.from(fpSet), Array.from(ipSet), limit]
      );
      outEvents = (q.rows || []).map((r: any) => ({
        ts: new Date(r.created_at).getTime(),
        id: r.id,
        event_type: r.event_type,
        method: r.method || 'GET',
        path: r.path || '/',
        status: r.status_code || 0,
        ip: r.ip || null,
        user_agent: r.user_agent || null,
        fingerprint: r.fingerprint || null,
        user_id: r.user_id != null ? String(r.user_id) : null,
        user_type: r.user_type || null,
        role: r.role || null,
        country_code: r.country_code || null,
        metadata: r.metadata || {},
      }));
    } catch (e) {
      // ignore fallback errors
      outEvents = [];
    }
  }

  res.json({ events: outEvents.slice(0, limit), suspiciousOnly: true });
});

router.get('/blocks', requireRoot, async (_req, res) => {
  try {
    const pool = await ensureConnection();
    const r = await pool.query(
      `SELECT ip, reason, is_active, created_by, created_at, updated_at
       FROM security_ip_blocks
       ORDER BY is_active DESC, updated_at DESC
       LIMIT 500`
    );
    res.json({ blocks: r.rows, migrationNeeded: false });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('security_ip_blocks') && msg.includes('does not exist')) {
      return res.json({ blocks: [], migrationNeeded: true });
    }
    throw e;
  }
});

router.post('/blocks', requireRoot, async (req: any, res) => {
  const ip = String(req.body?.ip || '').trim();
  const reason = String(req.body?.reason || '').trim() || null;
  if (!ip) return res.status(400).json({ error: 'ip is required' });

  // Prevent self-block from Kernel portal request source IP.
  const requesterIp = getClientIp(req);
  if (requesterIp && ip === requesterIp) {
    return res.status(400).json({ error: 'Refusing to block your current IP (self-block prevention)' });
  }

  try {
    const pool = await ensureConnection();
    // Prevent blocking a trusted IP
    const t = await pool.query(
      `SELECT 1 FROM security_trusted_actors WHERE is_active = true AND ip = $1 LIMIT 1`,
      [ip]
    );
    if (t.rowCount) {
      return res.status(409).json({ error: 'Refusing to block a trusted IP' });
    }
    const createdBy = req.user?.id ? String(req.user.id) : 'kernel';
    await pool.query(
      `INSERT INTO security_ip_blocks (ip, reason, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, true, $3, NOW(), NOW())
       ON CONFLICT (ip)
       DO UPDATE SET reason = EXCLUDED.reason, is_active = true, updated_at = NOW(), created_by = EXCLUDED.created_by`,
      [ip, reason, createdBy]
    );
    // Log manual block action for audit + SSE
    try {
      await logSecurityEvent({
        event_type: 'ip_block',
        severity: 'warn',
        method: req.method,
        path: '/api/kernel/blocks',
        status_code: 200,
        ip,
        user_agent: req.get('user-agent') || null,
        fingerprint: null,
        country_code: null,
        region: null,
        city: null,
        user_id: req.user?.id ? String(req.user.id) : null,
        user_type: req.user?.user_type || null,
        role: req.user?.role || null,
        metadata: { reason: reason || 'manual', action: 'manual_block', created_by: createdBy },
      });
    } catch {
      // ignore logging errors
    }

    res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('security_ip_blocks') && msg.includes('does not exist')) {
      return res.status(409).json({ error: 'security_ip_blocks table missing (run migrations)' });
    }
    throw e;
  }
});

router.delete('/blocks/:ip', requireRoot, async (req, res) => {
  const ip = String(req.params.ip || '').trim();
  if (!ip) return res.status(400).json({ error: 'ip is required' });
  try {
    const pool = await ensureConnection();
    await pool.query(
      `UPDATE security_ip_blocks SET is_active = false, updated_at = NOW() WHERE ip = $1`,
      [ip]
    );
    // Log manual unblock action for audit + SSE
    try {
      await logSecurityEvent({
        event_type: 'ip_block',
        severity: 'info',
        method: req.method,
        path: '/api/kernel/blocks',
        status_code: 200,
        ip,
        user_agent: req.get('user-agent') || null,
        fingerprint: null,
        country_code: null,
        region: null,
        city: null,
        user_id: req.user?.id ? String(req.user.id) : null,
        user_type: req.user?.user_type || null,
        role: req.user?.role || null,
        metadata: { action: 'manual_unblock', updated_by: req.user?.id ? String(req.user.id) : 'kernel' },
      });
    } catch {
      // ignore logging errors
    }

    res.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('security_ip_blocks') && msg.includes('does not exist')) {
      return res.status(409).json({ error: 'security_ip_blocks table missing (run migrations)' });
    }
    throw e;
  }
});

// ==================== SECURITY EVENTS MANAGEMENT ====================

// Clear all security events
router.delete('/security/events', requireRoot, async (req, res) => {
  const { confirm } = req.query;
  if (confirm !== 'yes') {
    return res.status(400).json({ error: 'Add ?confirm=yes to delete all events' });
  }
  try {
    const pool = await ensureConnection();
    const result = await pool.query('DELETE FROM security_events');
    res.json({ ok: true, deleted: result.rowCount });
  } catch (e: any) {
    console.error('Error clearing security events:', e);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

// Clear security events by IP
router.delete('/security/events/ip/:ip', requireRoot, async (req, res) => {
  const ip = decodeURIComponent(String(req.params.ip || '').trim());
  if (!ip) return res.status(400).json({ error: 'ip is required' });
  try {
    const pool = await ensureConnection();
    const result = await pool.query('DELETE FROM security_events WHERE ip = $1', [ip]);
    res.json({ ok: true, deleted: result.rowCount });
  } catch (e: any) {
    console.error('Error clearing security events by IP:', e);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

// Clear security events by fingerprint
router.delete('/security/events/fingerprint/:fp', requireRoot, async (req, res) => {
  const fingerprint = decodeURIComponent(String(req.params.fp || '').trim());
  if (!fingerprint) return res.status(400).json({ error: 'fingerprint is required' });
  try {
    const pool = await ensureConnection();
    const result = await pool.query('DELETE FROM security_events WHERE fingerprint = $1', [fingerprint]);
    res.json({ ok: true, deleted: result.rowCount });
  } catch (e: any) {
    console.error('Error clearing security events by fingerprint:', e);
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

// Clear localhost/development events
router.delete('/security/events/localhost', requireRoot, async (_req, res) => {
  try {
    const pool = await ensureConnection();
    const result = await pool.query(
      `DELETE FROM security_events WHERE ip IN ('127.0.0.1', '::1', 'localhost', '')`
    );
    res.json({ ok: true, deleted: result.rowCount });
  } catch (e: any) {
    console.error('Error clearing localhost events:', e);
    res.status(500).json({ error: 'Failed to clear localhost events' });
  }
});

// DEV: Unauthenticated helper to emit a test security event and exercise SSE.
// Only enabled in non-production to avoid accidental exposure.
if (process.env.NODE_ENV !== 'production') {
  router.post('/debug/emit-event', async (req: any, res) => {
    const payload = req.body || {};
    try {
      await logSecurityEvent({
        event_type: String(payload.event_type || 'dev_test'),
        severity: String(payload.severity || 'info') as any,
        method: 'POST',
        path: '/api/kernel/debug/emit-event',
        status_code: 200,
        ip: payload.ip || '127.0.0.1',
        user_agent: payload.user_agent || 'dev-agent',
        fingerprint: payload.fingerprint || null,
        country_code: null,
        region: null,
        city: null,
        metadata: payload.metadata || { note: 'dev emit' },
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });
}

export default router;
