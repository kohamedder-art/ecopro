import { pool, findUserById } from "../utils/database";
import { jsonError } from '../utils/httpHelpers';
import { RequestHandler } from "express";
import { requireAdmin } from "../middleware/auth";
import { findUserByEmail, updateUser } from "../utils/database";
import { clearSecurityBlockCache } from '../utils/security';
import { clearBruteForceMemory } from '../utils/brute-force';
import crypto from 'crypto';
import { comparePassword, generateRefreshToken, generateToken } from '../utils/auth';
import { clearAuthCookies, getCookieOptions, cookieNames } from '../utils/auth-cookies';
import { checkLoginAllowed, recordFailedLogin, recordSuccessfulLogin } from '../utils/brute-force';
import { decryptData, hashData } from '../utils/encryption';
import { verifyTotp } from '../utils/totp';
import { hashKernelPassword } from '../utils/security';
import os from 'os';
import fs from 'fs';
import { performance } from 'perf_hooks';
import v8 from 'v8';
import path from 'path';

// Generic Render API fetch helper
const renderApiGet = async (path: string): Promise<any | null> => {
  const key = process.env.RENDER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://api.render.com/v1${path}`, {
      headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' }
    });
    if (!res.ok) { console.error(`Render API ${path}: ${res.status}`); return null; }
    return res.json();
  } catch (e) { console.error(`Render API fetch error ${path}:`, e); return null; }
};

// ─── Render API cache (metrics don't change faster than every 30s) ─────────
const RENDER_METRICS_TTL_MS = 30_000;
let cachedRenderDb: { data: Awaited<ReturnType<typeof getRenderDbMetrics>>; ts: number } | null = null;
let cachedRenderService: { data: Awaited<ReturnType<typeof getRenderServiceMetrics>>; ts: number } | null = null;

// Comprehensive Render DB metrics — fetches ALL available Postgres endpoints
const getRenderDbMetrics = async (): Promise<{
  connectionsActive: number | null; connectionsMax: number | null;
  cpuPercentage: number | null; memoryMB: number | null; memoryPct: number | null;
  readIOPS: number | null; writeIOPS: number | null;
  pgVersion: string | null; pgPlan: string | null; pgRegion: string | null;
  latencyMs50: number | null; latencyMs95: number | null;
  diskUsedMb: number | null; diskCapacityMb: number | null; diskUsedPct: number | null;
  txVolume: number | null; replicationLag: number | null;
  latestBackupAt: string | null;
} | null> => {
  const dbId = process.env.RENDER_DATABASE_ID;
  if (!process.env.RENDER_API_KEY || !dbId) return null;

  // Return cached result if fresh (avoids rate-limiting: Render API caps ~5 req/min)
  if (cachedRenderDb && Date.now() - cachedRenderDb.ts < RENDER_METRICS_TTL_MS) {
    return cachedRenderDb.data;
  }

  const now2 = new Date().toISOString();
  const from2 = new Date(Date.now() - 300_000).toISOString();

  const [info, cpuSeries, memSeries, cpuLimit, memLimit] = await Promise.all([
    renderApiGet(`/postgres/${dbId}`),
    renderApiGet(`/metrics/cpu?resource=${dbId}&startTime=${from2}&endTime=${now2}`),
    renderApiGet(`/metrics/memory?resource=${dbId}&startTime=${from2}&endTime=${now2}`),
    renderApiGet(`/metrics/cpu-limit?resource=${dbId}`),
    renderApiGet(`/metrics/memory-limit?resource=${dbId}`),
  ]);
  const dbCpuValues = Array.isArray(cpuSeries) ? cpuSeries[0]?.values ?? [] : [];
  const dbMemValues = Array.isArray(memSeries) ? memSeries[0]?.values ?? [] : [];
  const dbCpuPoint = dbCpuValues.length > 0 ? dbCpuValues[dbCpuValues.length - 1] : null;
  const dbMemPoint = dbMemValues.length > 0 ? dbMemValues[dbMemValues.length - 1] : null;

  const dbCpuLimitVal = Array.isArray(cpuLimit) ? cpuLimit[0]?.values?.[0]?.value ?? null : null;
  const dbMemLimitBytes = Array.isArray(memLimit) ? memLimit[0]?.values?.[0]?.value ?? null : null;

  const dbCpuRaw = dbCpuPoint?.value ?? null;
  const dbMemBytes = dbMemPoint?.value ?? null;
  const memoryMB = dbMemBytes != null ? Math.round(dbMemBytes / 1024 / 1024) : null;
  const memoryPct = dbMemBytes != null && dbMemLimitBytes ? (dbMemBytes / dbMemLimitBytes) * 100 : null;
  const cpuPercentage = dbCpuRaw != null && dbCpuLimitVal ? (dbCpuRaw / dbCpuLimitVal) * 100 : dbCpuRaw;

  const dbResult = {
    connectionsActive: info?.connectionLimit ?? null,
    connectionsMax: info?.connectionLimit ?? null,
    cpuPercentage: cpuPercentage ?? null,
    memoryMB,
    memoryPct,
    readIOPS: null,
    writeIOPS: null,
    pgVersion: info?.postgresVersion ?? info?.version ?? null,
    pgPlan: info?.plan ?? null,
    pgRegion: info?.region ?? null,
    latencyMs50: null,
    latencyMs95: null,
    diskUsedMb: null,
    diskCapacityMb: null,
    diskUsedPct: null,
    txVolume: null,
    replicationLag: null,
    latestBackupAt: info?.latestBackupAt ?? null,
  };

  cachedRenderDb = { data: dbResult, ts: Date.now() };
  return dbResult;
};

// Render web service metrics
const getRenderServiceMetrics = async (): Promise<{
  serviceId: string | null; serviceName: string | null;
  serviceType: string | null; serviceRegion: string | null;
  cpuPct: number | null; memoryMb: number | null; memoryPct: number | null;
  bandwidthBps: number | null;
  latestDeployDuration: number | null; latestDeployAt: string | null; latestDeployStatus: string | null;
  instanceCount: number | null;
} | null> => {
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!process.env.RENDER_API_KEY || !serviceId) return null;

  const now = new Date().toISOString();
  const from = new Date(Date.now() - 300_000).toISOString();

  const [info, cpuSeries, memSeries, cpuLimit, memLimit, deploys] = await Promise.all([
    renderApiGet(`/services/${serviceId}`),
    renderApiGet(`/metrics/cpu?resource=${serviceId}&startTime=${from}&endTime=${now}`),
    renderApiGet(`/metrics/memory?resource=${serviceId}&startTime=${from}&endTime=${now}`),
    renderApiGet(`/metrics/cpu-limit?resource=${serviceId}`),
    renderApiGet(`/metrics/memory-limit?resource=${serviceId}`),
    renderApiGet(`/services/${serviceId}/deploys?limit=1`),
  ]);

  const cpuValues = Array.isArray(cpuSeries) ? cpuSeries[0]?.values ?? [] : [];
  const memValues = Array.isArray(memSeries) ? memSeries[0]?.values ?? [] : [];
  const cpuPoint = cpuValues.length > 0 ? cpuValues[cpuValues.length - 1] : null;
  const memPoint = memValues.length > 0 ? memValues[memValues.length - 1] : null;

  const cpuLimitVal = Array.isArray(cpuLimit) ? cpuLimit[0]?.values?.[0]?.value ?? null : null;
  const memLimitBytes = Array.isArray(memLimit) ? memLimit[0]?.values?.[0]?.value ?? null : null;

  const cpuRaw = cpuPoint?.value ?? null;
  const memBytes = memPoint?.value ?? null;
  const memMb = memBytes != null ? Math.round(memBytes / 1024 / 1024) : null;
  const memPct = memBytes != null && memLimitBytes ? (memBytes / memLimitBytes) * 100 : null;
  const cpuPct = cpuRaw != null && cpuLimitVal ? (cpuRaw / cpuLimitVal) * 100 : cpuRaw;

  const deploy = Array.isArray(deploys) ? deploys[0] : null;

  return {
    serviceId: info?.id ?? serviceId,
    serviceName: info?.name ?? null,
    serviceType: info?.type ?? null,
    serviceRegion: info?.region ?? null,
    cpuPct: cpuPct ?? null,
    memoryMb: memMb,
    memoryPct: memPct,
    bandwidthBps: null,
    latestDeployDuration: deploy?.finishedAt && deploy?.createdAt
      ? (new Date(deploy.finishedAt).getTime() - new Date(deploy.createdAt).getTime()) / 1000
      : null,
    latestDeployAt: deploy?.finishedAt ?? null,
    latestDeployStatus: deploy?.status ?? null,
    instanceCount: info?.instanceCount ?? null,
  };
};

const isProduction = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE = cookieNames.ACCESS_COOKIE;
const REFRESH_COOKIE = cookieNames.REFRESH_COOKIE;
const CSRF_COOKIE = cookieNames.CSRF_COOKIE;

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  const { secure, sameSite, domain } = getCookieOptions();

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // Ensure CSRF cookie exists (readable by JS)
  if (!res.req?.cookies?.[CSRF_COOKIE]) {
    const csrf = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure,
      sameSite,
      domain,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

/**
 * Admin-only login endpoint
 * POST /api/admin/login
 */
export const adminLogin: RequestHandler = async (req, res) => {
  try {
    const { email: rawEmail, password, totp_code, backup_code } = req.body as any;
    const email = String(rawEmail || '').trim().toLowerCase();
    const ip = (req as any).clientIp || (req.headers['cf-connecting-ip'] as string | undefined) || null;

    if (!email || !password) {
      return jsonError(res, 400, 'Email and password required');
    }

    const bruteCheck = checkLoginAllowed(String(ip || ''), String(email));
    if (!bruteCheck.allowed) {
      const waitTime = bruteCheck.blockedUntil
        ? Math.ceil((bruteCheck.blockedUntil - Date.now()) / 1000 / 60)
        : 30;
      return jsonError(res, 429, `Too many login attempts. Please try again in ${waitTime} minutes.`);
    }

    const user = await findUserByEmail(String(email));
    const isAdminAccount = user && (((user as any).role === 'admin') || ((user as any).user_type === 'admin'));
    if (!user || !isAdminAccount) {
      await recordFailedLogin(req, String(email), 'user_not_found', 'platform_admin');
      return jsonError(res, 401, 'Invalid email or password');
    }

    const okPassword = await comparePassword(String(password), (user as any).password);
    if (!okPassword) {
      await recordFailedLogin(req, String(email), 'bad_password', 'platform_admin');
      return jsonError(res, 401, 'Invalid email or password');
    }

    if ((user as any).is_blocked) {
      await recordFailedLogin(req, String(email), 'account_blocked', 'platform_admin');
      const reason = (user as any).blocked_reason || 'Account blocked by administrator';
      clearAuthCookies(res as any);
      return res.status(403).json({
        error: `Account blocked: ${reason}`,
        blocked: true,
        blocked_reason: reason,
      });
    }

    // Admin 2FA gate (TOTP or backup code)
    const totpEnabled = Boolean((user as any).totp_enabled);
    if (totpEnabled) {
      const secretEnc = (user as any).totp_secret_encrypted as string | null | undefined;
      if (!secretEnc) {
        return jsonError(res, 500, 'Two-factor authentication misconfigured');
      }

      let twoFaOk = false;

      if (typeof totp_code === 'string' && totp_code.trim()) {
        twoFaOk = verifyTotp(decryptData(secretEnc), totp_code.trim());
      }

      if (!twoFaOk && typeof backup_code === 'string' && backup_code.trim()) {
        try {
          const hashes: string[] = Array.isArray((user as any).totp_backup_codes_hashes)
            ? (user as any).totp_backup_codes_hashes
            : [];
          const providedHash = hashData(backup_code.trim());
          if (hashes.includes(providedHash)) {
            const remaining = hashes.filter((h) => h !== providedHash);
            await pool.query(
              'UPDATE admins SET totp_backup_codes_hashes = $2, updated_at = NOW() WHERE id = $1',
              [user.id, remaining]
            );
            twoFaOk = true;
          }
        } catch {
          // fail closed below
        }
      }

      if (!twoFaOk) {
        return res.status(401).json({ error: 'Two-factor authentication required', twoFactorRequired: true });
      }
    }

    const accessToken = generateToken({
      id: String(user.id),
      email: String(user.email),
      role: 'admin',
      user_type: 'admin',
    } as any);

    const refreshToken = generateRefreshToken({
      id: String(user.id),
      email: String(user.email),
      role: 'admin',
      user_type: 'admin',
    } as any);

    setAuthCookies(res as any, accessToken, refreshToken);
    recordSuccessfulLogin(String(ip || ''), String(email));

    return res.json({
      message: 'Login successful',
      token: accessToken,
      user: {
        id: String(user.id),
        email: String(user.email),
        name: (user as any).name || null,
        role: 'admin',
        user_type: 'admin',
      },
    });
  } catch (error) {
    console.error('[ADMIN LOGIN] error:', error);
    const isProduction = process.env.NODE_ENV === 'production';
    const msg = error instanceof Error ? error.message : String(error);
    const looksLikeDb = /DATABASE_URL|postgres|pg_hba|Failed to establish database connection|connect attempt|ECONN|ETIMEDOUT|timeout/i.test(msg);
    if (looksLikeDb) {
      return jsonError(res, 503, isProduction ? 'Service temporarily unavailable' : msg);
    }
    return jsonError(res, 500, isProduction ? 'Login failed' : msg);
  }
};

// Promote a user to admin
export const promoteUserToAdmin: RequestHandler = async (req, res) => {
  try {
    // Only platform admins may call this endpoint
    // Middleware requireAdmin will enforce this

    const { email } = req.body;
    if (!email) {
      return jsonError(res, 400, "Email is required");
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return jsonError(res, 404, "User not found");
    }

    const updated = await updateUser(user.id, { role: "admin" });
    res.json({ message: "User promoted to admin", user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (err) {
    console.error(err);
    return jsonError(res, 500, "Failed to promote user");
  }
};

// List all users (platform admin only)
export const listUsers: RequestHandler = async (_req, res) => {
  try {
    const { pool } = await import("../utils/database");
    
    // Get from both admins and clients tables with is_blocked, is_locked, and is_super status
    const result = await pool.query(`
      SELECT 
        id, 
        email, 
        full_name as name, 
        role, 
        'admin' as user_type, 
        created_at,
        COALESCE(is_blocked, false) as is_blocked,
        blocked_reason,
        COALESCE(is_locked, false) as is_locked,
        locked_reason,
        COALESCE(is_super, false) as is_super
      FROM admins
      UNION ALL
      SELECT 
        id, 
        email, 
        name, 
        role, 
        'client' as user_type, 
        created_at,
        COALESCE(is_blocked, false) as is_blocked,
        blocked_reason,
        COALESCE(is_locked, false) as is_locked,
        locked_reason,
        false as is_super
      FROM clients
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('listUsers error:', err);
    return jsonError(res, 500, `Failed to list users: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};

// Get platform statistics (fast aggregated query)
export const getPlatformStats: RequestHandler = async (_req, res) => {
  try {
    const { pool } = await import("../utils/database");
    
    // Run all count queries in parallel for speed
    const [usersResult, subscriptionsResult, codesResult, newSignupsResult] = await Promise.all([
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM admins) + (SELECT COUNT(*) FROM clients) as total_users,
          (SELECT COUNT(*) FROM clients) as total_clients,
          (SELECT COUNT(*) FROM admins WHERE role = 'admin') as total_admins,
          (SELECT COUNT(*) FROM clients WHERE is_locked = true) as locked_accounts
      `),
      pool.query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
          COUNT(*) FILTER (WHERE status = 'trial') as trial_subscriptions,
          COUNT(*) FILTER (WHERE status = 'expired' OR status = 'cancelled') as expired_subscriptions
        FROM subscriptions s
        WHERE EXISTS (SELECT 1 FROM clients WHERE id = s.user_id)
           OR EXISTS (SELECT 1 FROM admins WHERE id = s.user_id)
      `).catch(() => ({ rows: [{ total_subscriptions: 0, active_subscriptions: 0, trial_subscriptions: 0, expired_subscriptions: 0 }] })),
      pool.query(`
        SELECT 
          COUNT(*) as total_codes,
          COUNT(*) FILTER (WHERE status = 'used') as redeemed_codes,
          COUNT(*) FILTER (WHERE status = 'pending' OR status = 'issued') as pending_codes,
          COUNT(*) FILTER (WHERE status = 'expired') as expired_codes
        FROM code_requests
      `).catch(() => ({ rows: [{ total_codes: 0, redeemed_codes: 0, pending_codes: 0, expired_codes: 0 }] })),
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_signups_week,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_signups_month
        FROM clients
      `).catch(() => ({ rows: [{ new_signups_week: 0, new_signups_month: 0 }] })),
    ]);

    res.json({
      totalUsers: parseInt(usersResult.rows[0].total_users),
      totalClients: parseInt(usersResult.rows[0].total_clients),
      totalAdmins: parseInt(usersResult.rows[0].total_admins),
      lockedAccounts: parseInt(usersResult.rows[0].locked_accounts),
      activeSubscriptions: parseInt(subscriptionsResult.rows[0].active_subscriptions),
      trialSubscriptions: parseInt(subscriptionsResult.rows[0].trial_subscriptions),
      expiredSubscriptions: parseInt(subscriptionsResult.rows[0].expired_subscriptions),
      totalCodes: parseInt(codesResult.rows[0].total_codes),
      redeemedCodes: parseInt(codesResult.rows[0].redeemed_codes),
      pendingCodes: parseInt(codesResult.rows[0].pending_codes),
      expiredCodes: parseInt(codesResult.rows[0].expired_codes),
      newSignupsWeek: parseInt(newSignupsResult.rows[0].new_signups_week),
      newSignupsMonth: parseInt(newSignupsResult.rows[0].new_signups_month),
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return jsonError(res, 500, "Failed to get platform stats");
  }
};

const safeReadFileTrim = (filePath: string): string | null => {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
};

const getCgroupMemoryLimitBytes = (): number | null => {
  // cgroup v2 (common on modern Linux/container hosts)
  const v2 = safeReadFileTrim('/sys/fs/cgroup/memory.max');
  if (v2 && v2 !== 'max') {
    const parsed = Number(v2);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  // cgroup v1 (older)
  const v1 = safeReadFileTrim('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  if (!v1) return null;
  const parsed = Number(v1);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  // Some hosts return a huge sentinel value when “unlimited”
  if (parsed > Number.MAX_SAFE_INTEGER) return null;
  return parsed;
};

const getCgroupCpuLimit = (): { quota: number | null; period: number | null; cpus: number | null } => {
  // cgroup v2 cpu.max => "max 100000" or "200000 100000"
  const v2 = safeReadFileTrim('/sys/fs/cgroup/cpu.max');
  if (v2) {
    const [quotaStr, periodStr] = v2.split(/\s+/);
    const period = periodStr ? Number(periodStr) : null;
    if (quotaStr === 'max') {
      return { quota: null, period, cpus: null };
    }
    const quota = Number(quotaStr);
    const cpus = quota && period ? quota / period : null;
    return {
      quota: Number.isFinite(quota) ? quota : null,
      period: Number.isFinite(period as number) ? (period as number) : null,
      cpus: cpus != null && Number.isFinite(cpus) ? cpus : null,
    };
  }

  // cgroup v1: cpu.cfs_quota_us + cpu.cfs_period_us
  const quotaStr = safeReadFileTrim('/sys/fs/cgroup/cpu/cpu.cfs_quota_us');
  const periodStr = safeReadFileTrim('/sys/fs/cgroup/cpu/cpu.cfs_period_us');
  const quota = quotaStr ? Number(quotaStr) : null;
  const period = periodStr ? Number(periodStr) : null;
  if (quota == null || period == null) return { quota: null, period: null, cpus: null };
  if (!Number.isFinite(quota) || !Number.isFinite(period) || period <= 0) return { quota: null, period: null, cpus: null };
  if (quota < 0) return { quota, period, cpus: null };
  return { quota, period, cpus: quota / period };
};

const getDiskStats = (pathToCheck: string): { path: string; total: number | null; free: number | null; available: number | null } => {
  try {
    // Node 18+: fs.statfsSync
    const statfs = (fs as any).statfsSync?.(pathToCheck);
    if (!statfs) return { path: pathToCheck, total: null, free: null, available: null };
    const total = Number(statfs.blocks) * Number(statfs.bsize);
    const free = Number(statfs.bfree) * Number(statfs.bsize);
    const available = Number(statfs.bavail) * Number(statfs.bsize);
    return {
      path: pathToCheck,
      total: Number.isFinite(total) ? total : null,
      free: Number.isFinite(free) ? free : null,
      available: Number.isFinite(available) ? available : null,
    };
  } catch {
    return { path: pathToCheck, total: null, free: null, available: null };
  }
};

type NetDevCounters = { rxBytes: number; txBytes: number };

const readProcNetDev = (): Record<string, NetDevCounters> | null => {
  // Linux only. Format: https://man7.org/linux/man-pages/man5/proc.5.html
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    // Skip headers (first 2 lines)
    const dataLines = lines.slice(2);
    const result: Record<string, NetDevCounters> = {};
    for (const line of dataLines) {
      // Example: "eth0: 123 0 0 0 0 0 0 0 456 0 0 0 0 0 0 0"
      const [ifPart, rest] = line.split(':');
      if (!ifPart || !rest) continue;
      const name = ifPart.trim();
      const cols = rest.trim().split(/\s+/);
      // Receive bytes is col 0, transmit bytes is col 8
      const rxBytes = Number(cols[0]);
      const txBytes = Number(cols[8]);
      if (!Number.isFinite(rxBytes) || !Number.isFinite(txBytes)) continue;
      result[name] = { rxBytes, txBytes };
    }
    return result;
  } catch {
    return null;
  }
};

let lastNetDevSnapshot: { ts: number; counters: Record<string, NetDevCounters> } | null = null;

type ProcMeminfo = {
  memTotalBytes: number;
  memFreeBytes: number;
  memAvailableBytes: number | null;
  swapTotalBytes: number;
  swapFreeBytes: number;
};

const readProcMeminfo = (): ProcMeminfo | null => {
  try {
    const raw = fs.readFileSync('/proc/meminfo', 'utf8');
    const map: Record<string, number> = {};
    for (const line of raw.split('\n')) {
      // Example: "MemTotal:       16277080 kB"
      const m = line.match(/^([A-Za-z0-9_()]+):\s+(\d+)\s+kB\s*$/);
      if (!m) continue;
      map[m[1]] = Number(m[2]);
    }
    const toBytes = (kib: number | undefined) => (typeof kib === 'number' && Number.isFinite(kib) ? kib * 1024 : 0);
    const memTotalBytes = toBytes(map.MemTotal);
    const memFreeBytes = toBytes(map.MemFree);
    const memAvailableBytes = map.MemAvailable != null ? toBytes(map.MemAvailable) : null;
    const swapTotalBytes = toBytes(map.SwapTotal);
    const swapFreeBytes = toBytes(map.SwapFree);

    if (!Number.isFinite(memTotalBytes) || memTotalBytes <= 0) return null;

    return {
      memTotalBytes,
      memFreeBytes,
      memAvailableBytes,
      swapTotalBytes,
      swapFreeBytes,
    };
  } catch {
    return null;
  }
};

type CpuSnapshot = { ts: number; perCore: Array<{ idle: number; total: number }>; cgroupUsage?: number };
let lastCpuSnapshot: CpuSnapshot | null = null;

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

// Read container CPU usage from cgroups (more accurate in Docker/Render)
const getCgroupCpuUsage = (): number | null => {
  // cgroup v2: cpu.stat => usage_usec
  const v2Stat = safeReadFileTrim('/sys/fs/cgroup/cpu.stat');
  if (v2Stat) {
    const match = v2Stat.match(/usage_usec\s+(\d+)/);
    if (match) {
      const usec = Number(match[1]);
      if (Number.isFinite(usec)) return usec * 1000; // Convert to nanoseconds
    }
  }
  
  // cgroup v1: cpuacct.usage (nanoseconds)
  const v1Usage = safeReadFileTrim('/sys/fs/cgroup/cpuacct/cpuacct.usage') 
    || safeReadFileTrim('/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage');
  if (v1Usage) {
    const ns = Number(v1Usage);
    if (Number.isFinite(ns)) return ns;
  }
  
  return null;
};

// Read container memory usage from cgroups (more accurate in Docker/Render)
const getCgroupMemoryUsage = (): number | null => {
  // cgroup v2: memory.current
  const v2 = safeReadFileTrim('/sys/fs/cgroup/memory.current');
  if (v2) {
    const bytes = Number(v2);
    if (Number.isFinite(bytes) && bytes > 0) return bytes;
  }
  
  // cgroup v1: memory.usage_in_bytes
  const v1 = safeReadFileTrim('/sys/fs/cgroup/memory/memory.usage_in_bytes');
  if (v1) {
    const bytes = Number(v1);
    if (Number.isFinite(bytes) && bytes > 0) return bytes;
  }
  
  return null;
};

const sampleCpuPercents = (): { perCorePct: number[]; totalPct: number; intervalMs: number | null; mode: 'delta' | 'avg' | 'cgroup' } | null => {
  const cpuInfo = os.cpus();
  if (!cpuInfo || cpuInfo.length === 0) return null;

  const now = Date.now();
  const cgroupUsage = getCgroupCpuUsage();
  const cgroupCpu = getCgroupCpuLimit();
  
  const perCore = cpuInfo.map((c) => {
    const t = c.times;
    const total = t.user + t.nice + t.sys + t.idle + t.irq;
    return { idle: t.idle, total };
  });

  const prev = lastCpuSnapshot;
  lastCpuSnapshot = { ts: now, perCore, cgroupUsage: cgroupUsage ?? undefined };

  // If we have cgroup CPU usage data (container environment), use that for totalPct
  if (cgroupUsage != null && prev?.cgroupUsage != null && cgroupCpu?.cpus) {
    const intervalMs = Math.max(1, now - prev.ts);
    const cpuDeltaNs = cgroupUsage - prev.cgroupUsage;
    const elapsedNs = intervalMs * 1_000_000; // ms to ns
    
    // Calculate CPU % based on container's CPU limit
    // cpuDeltaNs / elapsedNs gives total CPU time used
    // Divide by number of CPUs allocated to get percentage
    const totalPct = clampPct((cpuDeltaNs / elapsedNs / cgroupCpu.cpus) * 100);
    
    // For per-core, we don't have accurate data in containers, use even distribution
    const perCorePct = Array(cpuInfo.length).fill(totalPct);
    
    return { perCorePct, totalPct, intervalMs, mode: 'cgroup' };
  }

  // First sample: return average since boot (still useful), interval null.
  if (!prev || prev.perCore.length !== perCore.length) {
    const perCorePct = perCore.map((c) => (c.total > 0 ? clampPct((1 - c.idle / c.total) * 100) : 0));
    const totalIdle = perCore.reduce((s, c) => s + c.idle, 0);
    const totalAll = perCore.reduce((s, c) => s + c.total, 0);
    const totalPct = totalAll > 0 ? clampPct((1 - totalIdle / totalAll) * 100) : 0;
    return { perCorePct, totalPct, intervalMs: null, mode: 'avg' };
  }

  const intervalMs = Math.max(1, now - prev.ts);
  const perCorePct: number[] = perCore.map((curr, i) => {
    const prevCore = prev.perCore[i];
    const totalDelta = curr.total - prevCore.total;
    const idleDelta = curr.idle - prevCore.idle;
    if (totalDelta <= 0) return 0;
    return clampPct((1 - idleDelta / totalDelta) * 100);
  });

  const totalDeltaAll = perCore.reduce((s, c, i) => s + (c.total - prev.perCore[i].total), 0);
  const idleDeltaAll = perCore.reduce((s, c, i) => s + (c.idle - prev.perCore[i].idle), 0);
  const totalPct = totalDeltaAll > 0 ? clampPct((1 - idleDeltaAll / totalDeltaAll) * 100) : 0;

  return { perCorePct, totalPct, intervalMs, mode: 'delta' };
};

type HealthSample = {
  ts: number; // epoch ms
  rssPct: number | null;
  heapPct: number | null;
  elu: number; // 0..1
  dbLatencyMs: number | null;
  load1PerCpu: number | null;
  dbPoolWaiting: number | null;
};

const HEALTH_TREND_WINDOW_MS = 15 * 60 * 1000;
const HEALTH_TREND_MAX_SAMPLES = 180; // safety cap
const healthSamples: HealthSample[] = [];

const pruneHealthSamples = (now: number) => {
  const cutoff = now - HEALTH_TREND_WINDOW_MS;
  while (healthSamples.length > 0 && healthSamples[0].ts < cutoff) {
    healthSamples.shift();
  }
  if (healthSamples.length > HEALTH_TREND_MAX_SAMPLES) {
    healthSamples.splice(0, healthSamples.length - HEALTH_TREND_MAX_SAMPLES);
  }
};

const summarizeNumbers = (values: Array<number | null | undefined>) => {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return { min: null as number | null, avg: null as number | null, max: null as number | null };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { min, avg, max };
};

// System Capacity Analysis - Estimates how many users the system can handle
export const getSystemCapacity: RequestHandler = async (_req, res) => {
  try {
    const mem = process.memoryUsage();
    const loadavg = os.loadavg();
    const cpuCount = os.cpus()?.length ?? 1;
    const cgroupMemoryLimitBytes = getCgroupMemoryLimitBytes();
    const memoryLimitBytes = cgroupMemoryLimitBytes ?? os.totalmem();
    const cgroupCpu = getCgroupCpuLimit();
    const effectiveCpuCount = cgroupCpu?.cpus ?? cpuCount;
    
    // Get current user count and activity
    let currentUsers = 0;
    let activeUsers15m = 0;
    let activeUsersToday = 0;
    let totalProducts = 0;
    let totalOrders = 0;
    let dbLatencyMs: number | null = null;
    let renderDbMetrics: Awaited<ReturnType<typeof getRenderDbMetrics>> = null;
    
    try {
      const start = process.hrtime.bigint();
      const [usersResult, productsResult, ordersResult] = await Promise.all([
        pool.query(`
          SELECT 
            COUNT(*)::int as total,
            (SELECT COUNT(*)::int FROM admins) + (SELECT COUNT(*)::int FROM clients) as total_users,
            0::int as active15m,
            0::int as activeToday
          FROM clients
        `),
        pool.query(`SELECT COUNT(*)::int as count FROM client_store_products WHERE status = 'active'`),
        pool.query(`SELECT COUNT(*)::int as count FROM store_orders WHERE created_at > NOW() - INTERVAL '30 days'`),
      ]);
      const end = process.hrtime.bigint();
      dbLatencyMs = Number(end - start) / 1e6;
      
      // Get real Render DB metrics if configured
      renderDbMetrics = await getRenderDbMetrics();
      
      currentUsers = usersResult.rows[0]?.total || 0;
      activeUsers15m = usersResult.rows[0]?.active15m || 0;
      activeUsersToday = usersResult.rows[0]?.activeToday || 0;
      totalProducts = productsResult.rows[0]?.count || 0;
      totalOrders = ordersResult.rows[0]?.count || 0;
    } catch (e) {
      console.error('getSystemCapacity db error:', e);
    }
    
    // Current resource usage
    const memUsedPct = (mem.rss / memoryLimitBytes) * 100;
    const heapUsedPct = (mem.heapUsed / mem.heapTotal) * 100;
    const load1PerCpu = loadavg[0] / effectiveCpuCount;
    const eventLoopUtil = performance.eventLoopUtilization();
    const poolWaiting = (pool as any).waitingCount ?? 0;
    const poolTotal = (pool as any).totalCount ?? 10;
    
    // Capacity estimation formulas (based on current usage per user)
    // Memory: ~5MB per active user (rough estimate)
    const memPerUserMB = 5;
    const availableMemMB = (memoryLimitBytes - mem.rss) / (1024 * 1024);
    const memCapacity = Math.floor(availableMemMB / memPerUserMB);
    
    // CPU: Estimate based on current load and active users
    const cpuCapacity = activeUsers15m > 0 
      ? Math.floor((activeUsers15m / Math.max(0.1, load1PerCpu)) * 0.8) // 80% target
      : Math.floor(effectiveCpuCount * 50); // ~50 concurrent per CPU core default
      
    // DB: Connection pool based (each active user uses ~0.2 connections on average)
    const dbCapacity = Math.floor(poolTotal * 5);
    
    // Event loop: High utilization reduces capacity
    const eluFactor = Math.max(0.2, 1 - eventLoopUtil.utilization);
    
    // Overall estimated capacity (minimum of all bottlenecks)
    const rawCapacity = Math.min(memCapacity, cpuCapacity, dbCapacity);
    const estimatedCapacity = Math.floor(rawCapacity * eluFactor);
    
    // Bottleneck analysis
    type Bottleneck = {
      resource: string;
      current: number;
      threshold: number;
      unit: string;
      severity: 'ok' | 'warning' | 'critical';
      recommendation: string;
      upgradeSpec: string;
    };
    
    const bottlenecks: Bottleneck[] = [];
    
    // RAM Analysis
    const ramSeverity = memUsedPct > 85 ? 'critical' : memUsedPct > 70 ? 'warning' : 'ok';
    bottlenecks.push({
      resource: 'RAM',
      current: Math.round(memUsedPct),
      threshold: 70,
      unit: '%',
      severity: ramSeverity,
      recommendation: ramSeverity === 'ok' 
        ? 'Memory usage is healthy'
        : ramSeverity === 'warning'
          ? 'Consider upgrading RAM soon to handle more users'
          : 'Upgrade RAM immediately - risk of crashes under load',
      upgradeSpec: ramSeverity !== 'ok' 
        ? `Upgrade to ${Math.ceil(memoryLimitBytes / (1024 * 1024 * 1024) * 2)}GB RAM`
        : 'No upgrade needed',
    });
    
    // CPU Analysis
    const cpuSeverity = load1PerCpu > 1.5 ? 'critical' : load1PerCpu > 0.8 ? 'warning' : 'ok';
    bottlenecks.push({
      resource: 'CPU',
      current: Math.round(load1PerCpu * 100),
      threshold: 80,
      unit: '% load/core',
      severity: cpuSeverity,
      recommendation: cpuSeverity === 'ok'
        ? 'CPU load is healthy'
        : cpuSeverity === 'warning'
          ? 'CPU is under moderate load - consider upgrading for growth'
          : 'CPU is overloaded - upgrade immediately',
      upgradeSpec: cpuSeverity !== 'ok'
        ? `Upgrade to ${Math.ceil(effectiveCpuCount * 2)} CPU cores`
        : 'No upgrade needed',
    });
    
    // Database Analysis
    const dbPoolUsedPct = poolTotal > 0 ? ((poolTotal - ((pool as any).idleCount ?? 0)) / poolTotal) * 100 : 0;
    const dbSeverity = (poolWaiting > 0 || dbPoolUsedPct > 90) ? 'critical' 
      : dbPoolUsedPct > 70 ? 'warning' : 'ok';
    bottlenecks.push({
      resource: 'Database',
      current: Math.round(dbPoolUsedPct),
      threshold: 70,
      unit: '% pool used',
      severity: dbSeverity,
      recommendation: dbSeverity === 'ok'
        ? 'Database connections are healthy'
        : dbSeverity === 'warning'
          ? 'Database pool is filling up - consider upgrading DB plan'
          : 'Database is bottleneck - upgrade DB plan or add read replicas',
      upgradeSpec: dbSeverity !== 'ok'
        ? 'Upgrade to next Render DB tier (more connections + CPU)'
        : 'No upgrade needed',
    });
    
    // Event Loop Analysis
    const eluPct = eventLoopUtil.utilization * 100;
    const eluSeverity = eluPct > 80 ? 'critical' : eluPct > 50 ? 'warning' : 'ok';
    bottlenecks.push({
      resource: 'Event Loop',
      current: Math.round(eluPct),
      threshold: 50,
      unit: '%',
      severity: eluSeverity,
      recommendation: eluSeverity === 'ok'
        ? 'Event loop is responsive'
        : eluSeverity === 'warning'
          ? 'Event loop showing some blocking - review async code'
          : 'Event loop blocked - possible memory leak or sync operations',
      upgradeSpec: eluSeverity !== 'ok'
        ? 'Review code for blocking operations; consider worker threads'
        : 'No action needed',
    });
    
    // Disk Analysis (if available)
    const diskCwd = getDiskStats(process.cwd());
    const diskUsedPct = diskCwd.total && diskCwd.available 
      ? ((diskCwd.total - diskCwd.available) / diskCwd.total) * 100 : 0;
    const diskSeverity = diskUsedPct > 90 ? 'critical' : diskUsedPct > 75 ? 'warning' : 'ok';
    bottlenecks.push({
      resource: 'Storage',
      current: Math.round(diskUsedPct),
      threshold: 75,
      unit: '%',
      severity: diskSeverity,
      recommendation: diskSeverity === 'ok'
        ? 'Storage space is adequate'
        : diskSeverity === 'warning'
          ? 'Storage filling up - clean old files or upgrade'
          : 'Storage nearly full - immediate action required',
      upgradeSpec: diskSeverity !== 'ok'
        ? 'Increase disk allocation or clean up uploads'
        : 'No upgrade needed',
    });
    
    // DB Latency Analysis
    const dbLatencySeverity = (dbLatencyMs ?? 0) > 500 ? 'critical' 
      : (dbLatencyMs ?? 0) > 200 ? 'warning' : 'ok';
    bottlenecks.push({
      resource: 'DB Latency',
      current: Math.round(dbLatencyMs ?? 0),
      threshold: 200,
      unit: 'ms',
      severity: dbLatencySeverity,
      recommendation: dbLatencySeverity === 'ok'
        ? 'Database response time is good'
        : dbLatencySeverity === 'warning'
          ? 'Database queries are slow - check indexes and query optimization'
          : 'Database is very slow - upgrade DB or optimize queries',
      upgradeSpec: dbLatencySeverity !== 'ok'
        ? 'Upgrade DB plan or add indexes'
        : 'No upgrade needed',
    });
    
    // Overall system health score (0-100)
    const severityScore = (s: 'ok' | 'warning' | 'critical') => s === 'ok' ? 100 : s === 'warning' ? 60 : 20;
    const healthScore = Math.round(
      bottlenecks.reduce((sum, b) => sum + severityScore(b.severity), 0) / bottlenecks.length
    );
    
    // Primary bottleneck
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    const warningBottlenecks = bottlenecks.filter(b => b.severity === 'warning');
    const primaryBottleneck = criticalBottlenecks[0] || warningBottlenecks[0] || null;
    
    // Scaling recommendations
    const scalingTier = currentUsers < 100 ? 'starter' 
      : currentUsers < 500 ? 'growth'
      : currentUsers < 2000 ? 'business'
      : 'enterprise';
      
    const recommendedSpecs = {
      starter: { ram: '512MB', cpu: '0.5 cores', db: 'Render Starter', users: '< 100' },
      growth: { ram: '2GB', cpu: '1 core', db: 'Render Basic', users: '100-500' },
      business: { ram: '4GB', cpu: '2 cores', db: 'Render Standard', users: '500-2000' },
      enterprise: { ram: '8GB+', cpu: '4+ cores', db: 'Render Pro', users: '2000+' },
    };
    
    res.json({
      timestamp: new Date().toISOString(),
      
      // Current stats
      current: {
        users: currentUsers,
        activeUsers15m,
        activeUsersToday,
        totalProducts,
        totalOrders,
      },
      
      // Resources
      resources: {
        ram: {
          total: memoryLimitBytes,
          used: mem.rss,
          usedPct: memUsedPct,
        },
        cpu: {
          cores: effectiveCpuCount,
          load1m: loadavg[0],
          load5m: loadavg[1],
          load15m: loadavg[2],
          loadPerCpu: load1PerCpu,
        },
        db: {
          latencyMs: dbLatencyMs,
          poolTotal,
          poolIdle: (pool as any).idleCount ?? 0,
          poolWaiting,
          // Real Render DB metrics
          render: renderDbMetrics || undefined,
        },
        eventLoop: {
          utilization: eventLoopUtil.utilization,
        },
        disk: {
          total: diskCwd.total,
          available: diskCwd.available,
          usedPct: diskUsedPct,
        },
      },
      
      // Capacity estimates
      capacity: {
        estimated: estimatedCapacity,
        byResource: {
          ram: memCapacity,
          cpu: cpuCapacity,
          db: dbCapacity,
        },
        utilizationPct: currentUsers > 0 && estimatedCapacity > 0 
          ? Math.round((currentUsers / (currentUsers + estimatedCapacity)) * 100)
          : 0,
      },
      
      // Health analysis
      health: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical',
        bottlenecks,
        primaryBottleneck: primaryBottleneck ? {
          resource: primaryBottleneck.resource,
          severity: primaryBottleneck.severity,
          recommendation: primaryBottleneck.recommendation,
          upgradeSpec: primaryBottleneck.upgradeSpec,
        } : null,
      },
      
      // Recommendations
      scaling: {
        currentTier: scalingTier,
        recommended: recommendedSpecs[scalingTier],
        nextTier: scalingTier === 'starter' ? 'growth'
          : scalingTier === 'growth' ? 'business'
          : scalingTier === 'business' ? 'enterprise'
          : null,
        nextTierSpecs: scalingTier === 'starter' ? recommendedSpecs.growth
          : scalingTier === 'growth' ? recommendedSpecs.business
          : scalingTier === 'business' ? recommendedSpecs.enterprise
          : null,
        upgradeAt: Math.floor(estimatedCapacity * 0.7), // Suggest upgrade at 70% capacity
      },
    });
  } catch (err) {
    console.error('getSystemCapacity error:', err);
    return jsonError(res, 500, 'Failed to get system capacity');
  }
};

// Real-time active users tracking
export const getActiveUsers: RequestHandler = async (req, res) => {
  try {
    const { getActiveUsersStats, getActiveVisitorsList } = await import('../utils/traffic');
    
    const windowSeconds = Math.max(10, Math.min(300, parseInt(String(req.query.window || '30'), 10)));
    const includeDetails = req.query.details === 'true';
    
    const stats = getActiveUsersStats(windowSeconds);
    
    const response: any = {
      ...stats,
      serverTime: new Date().toISOString(),
    };
    
    if (includeDetails) {
      response.visitors = getActiveVisitorsList(windowSeconds, 30);
    }
    
    res.json(response);
  } catch (err) {
    console.error('getActiveUsers error:', err);
    return jsonError(res, 500, 'Failed to get active users');
  }
};

// Admin-only: server health snapshot (no secrets)
export const getServerHealth: RequestHandler = async (_req, res) => {
  try {
    const mem = process.memoryUsage();
    const loadavg = os.loadavg();
    const cpuCount = os.cpus()?.length ?? null;
    const cgroupMemoryLimitBytes = getCgroupMemoryLimitBytes();
    const memoryLimitBytes = cgroupMemoryLimitBytes ?? os.totalmem();

    const cgroupCpu = getCgroupCpuLimit();
    const cpuInfo = os.cpus();
    const cpuModel = cpuInfo?.[0]?.model ?? null;
    const cpuSpeedMhz = cpuInfo?.[0]?.speed ?? null;

    const rssPctOfLimit = memoryLimitBytes > 0 ? (mem.rss / memoryLimitBytes) * 100 : null;
    const heapPctOfHeapTotal = mem.heapTotal > 0 ? (mem.heapUsed / mem.heapTotal) * 100 : null;

    const eventLoopUtil = performance.eventLoopUtilization();
    const resourceUsage = process.resourceUsage();
    const heapStats = v8.getHeapStatistics();
    const heapSpaces = v8.getHeapSpaceStatistics();

    // htop-like sampling: CPU per-core %, memory + swap
    const cpuSample = sampleCpuPercents();
    const meminfo = readProcMeminfo();
    // For containers, prefer cgroup memory limit over host's /proc/meminfo
    const memTotalBytes = cgroupMemoryLimitBytes ?? meminfo?.memTotalBytes ?? os.totalmem();
    const memAvailableBytes = meminfo?.memAvailableBytes ?? os.freemem();
    // In containers, use cgroup memory usage for accurate container memory
    const cgroupMemUsage = getCgroupMemoryUsage();
    const processRss = process.memoryUsage().rss;
    const memUsedBytes = cgroupMemoryLimitBytes 
      ? (cgroupMemUsage ?? processRss)  // In container, prefer cgroup usage, fallback to RSS
      : Math.max(0, memTotalBytes - memAvailableBytes);
    const memPctUsed = memTotalBytes > 0 ? (memUsedBytes / memTotalBytes) * 100 : 0;

    const swapTotalBytes = meminfo?.swapTotalBytes ?? 0;
    const swapFreeBytes = meminfo?.swapFreeBytes ?? 0;
    const swapUsedBytes = Math.max(0, swapTotalBytes - swapFreeBytes);
    const swapPctUsed = swapTotalBytes > 0 ? (swapUsedBytes / swapTotalBytes) * 100 : 0;

    const network = os.networkInterfaces();

    const netDev = readProcNetDev();
    const nowForNet = Date.now();
    const prevNet = lastNetDevSnapshot;
    const dtSec = prevNet ? Math.max(0.001, (nowForNet - prevNet.ts) / 1000) : null;

    const networkSummary = Object.entries(network).map(([name, addrs]) => {
      const internal = (addrs ?? []).every((a) => a.internal);
      const counters = netDev?.[name] ?? null;
      const prevCounters = prevNet?.counters?.[name] ?? null;
      const rxBps =
        dtSec != null && counters && prevCounters ? Math.max(0, (counters.rxBytes - prevCounters.rxBytes) / dtSec) : null;
      const txBps =
        dtSec != null && counters && prevCounters ? Math.max(0, (counters.txBytes - prevCounters.txBytes) / dtSec) : null;
      return {
        name,
        addresses: (addrs ?? []).length,
        internal,
        rxBytes: counters?.rxBytes ?? null,
        txBytes: counters?.txBytes ?? null,
        rxBps,
        txBps,
      };
    });

    if (netDev) {
      lastNetDevSnapshot = { ts: nowForNet, counters: netDev };
    }

    const diskCwd = getDiskStats(process.cwd());
    const diskUploads = getDiskStats(path.resolve(process.cwd(), 'uploads'));

    let dbOk = false;
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    let activeUsers = { total: 0, recent15m: 0 };

    const renderDbMetrics = getRenderDbMetrics();
    const renderServiceMetrics = getRenderServiceMetrics();

    try {
      const start = process.hrtime.bigint();
      await pool.query('SELECT 1');
      const end = process.hrtime.bigint();
      dbLatencyMs = Number(end - start) / 1e6;
      dbOk = true;

      // Get active users stats (clients + admins)
      const userCountResult = await pool.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '15 minutes')::int as recent15m
        FROM (
          SELECT updated_at FROM clients
          UNION ALL
          SELECT updated_at FROM admins
        ) all_users
      `);
      if (userCountResult.rows[0]) {
        activeUsers = {
          total: userCountResult.rows[0].total || 0,
          recent15m: userCountResult.rows[0].recent15m || 0,
        };
      }
    } catch (err) {
      dbOk = false;
      dbError = err instanceof Error ? err.message : 'DB ping failed';
    }

    const [resolvedRenderDb, resolvedRenderService] = await Promise.all([renderDbMetrics, renderServiceMetrics]);

    const thresholds = {
      dbSlowMs: 500,
      memoryHighPct: 80,
      eventLoopHighUtil: 0.8,
      cpuPressureLoadPerCpu: 1.0,
    };

    const poolWaiting = (pool as any).waitingCount;
    const load1PerCpu = cpuCount && cpuCount > 0 ? loadavg[0] / cpuCount : null;

    const recommendations: Array<{ severity: 'info' | 'warn' | 'critical'; code: string; message: string }> = [];
    if (!dbOk) {
      recommendations.push({
        severity: 'critical',
        code: 'DB_DISCONNECTED',
        message: 'Database is not reachable. Check Render DB status, connection limits, and DATABASE_URL.',
      });
    } else if (dbLatencyMs != null && dbLatencyMs > thresholds.dbSlowMs) {
      recommendations.push({
        severity: 'warn',
        code: 'DB_SLOW',
        message: 'Database ping is high. Consider upgrading DB, adding indexes, or reducing peak load.',
      });
    }

    if (typeof poolWaiting === 'number' && poolWaiting > 0) {
      recommendations.push({
        severity: 'warn',
        code: 'DB_POOL_WAITING',
        message: 'DB pool has waiting requests. Consider increasing pool size, optimizing queries, or upgrading DB concurrency.',
      });
    }

    if (eventLoopUtil.utilization > thresholds.eventLoopHighUtil) {
      recommendations.push({
        severity: 'warn',
        code: 'EVENT_LOOP_HIGH',
        message: 'Event loop utilization is high. Consider upgrading CPU or reducing synchronous/blocking work.',
      });
    }

    if (rssPctOfLimit != null && rssPctOfLimit > thresholds.memoryHighPct) {
      recommendations.push({
        severity: 'warn',
        code: 'MEMORY_HIGH',
        message: 'Memory usage is high. Consider upgrading RAM or investigating memory leaks / large payloads.',
      });
    }

    if (load1PerCpu != null && load1PerCpu > thresholds.cpuPressureLoadPerCpu) {
      recommendations.push({
        severity: 'warn',
        code: 'CPU_PRESSURE',
        message: 'CPU pressure is high (load per CPU > 1). Consider upgrading CPU or scaling horizontally.',
      });
    }

    // Provide a positive signal when everything is calm
    if (recommendations.length === 0) {
      recommendations.push({
        severity: 'info',
        code: 'OK',
        message: 'No issues detected by current thresholds.',
      });
    }

    // Store a sample for 15-minute trends (in-memory; resets on deploy/restart)
    const now = Date.now();
    pruneHealthSamples(now);
    healthSamples.push({
      ts: now,
      rssPct: rssPctOfLimit,
      heapPct: heapPctOfHeapTotal,
      elu: eventLoopUtil.utilization,
      dbLatencyMs,
      load1PerCpu,
      dbPoolWaiting: typeof poolWaiting === 'number' ? poolWaiting : null,
    });
    pruneHealthSamples(now);

    const trendSeries = healthSamples.map((s) => ({
      ts: s.ts,
      rssPct: s.rssPct,
      heapPct: s.heapPct,
      elu: s.elu,
      dbLatencyMs: s.dbLatencyMs,
      load1PerCpu: s.load1PerCpu,
      dbPoolWaiting: s.dbPoolWaiting,
    }));

    const first = healthSamples[0] ?? null;
    const last = healthSamples[healthSamples.length - 1] ?? null;
    const trend = {
      windowSec: Math.floor(HEALTH_TREND_WINDOW_MS / 1000),
      points: healthSamples.length,
      fromTs: first?.ts ?? null,
      toTs: last?.ts ?? null,
      series: trendSeries,
      summary: {
        rssPct: summarizeNumbers(healthSamples.map((s) => s.rssPct)),
        heapPct: summarizeNumbers(healthSamples.map((s) => s.heapPct)),
        elu: summarizeNumbers(healthSamples.map((s) => s.elu)),
        dbLatencyMs: summarizeNumbers(healthSamples.map((s) => s.dbLatencyMs)),
        load1PerCpu: summarizeNumbers(healthSamples.map((s) => s.load1PerCpu)),
        dbPoolWaiting: summarizeNumbers(healthSamples.map((s) => s.dbPoolWaiting)),
      },
      delta: {
        rssPct: first && last && first.rssPct != null && last.rssPct != null ? last.rssPct - first.rssPct : null,
        heapPct: first && last && first.heapPct != null && last.heapPct != null ? last.heapPct - first.heapPct : null,
        elu: first && last ? last.elu - first.elu : null,
        dbLatencyMs:
          first && last && first.dbLatencyMs != null && last.dbLatencyMs != null ? last.dbLatencyMs - first.dbLatencyMs : null,
        load1PerCpu:
          first && last && first.load1PerCpu != null && last.load1PerCpu != null ? last.load1PerCpu - first.load1PerCpu : null,
        dbPoolWaiting:
          first && last && first.dbPoolWaiting != null && last.dbPoolWaiting != null ? last.dbPoolWaiting - first.dbPoolWaiting : null,
      },
    };

    res.json({
      ok: dbOk,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      htop: {
        cpu: {
          totalPct: cpuSample?.totalPct ?? null,
          perCorePct: cpuSample?.perCorePct ?? null,
          intervalMs: cpuSample?.intervalMs ?? null,
          mode: cpuSample?.mode ?? null,
        },
        memory: {
          totalBytes: memTotalBytes,
          usedBytes: memUsedBytes,
          availableBytes: memAvailableBytes,
          pctUsed: memPctUsed,
        },
        swap:
          meminfo
            ? {
                totalBytes: swapTotalBytes,
                usedBytes: swapUsedBytes,
                freeBytes: swapFreeBytes,
                pctUsed: swapPctUsed,
              }
            : null,
      },
      node: {
        version: process.version,
        env: process.env.NODE_ENV ?? null,
        pid: process.pid,
        ppid: process.ppid,
        versions: process.versions,
      },
      process: {
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external,
          arrayBuffers: (mem as any).arrayBuffers ?? undefined,
        },
        cpuUsage: process.cpuUsage(),
        resourceUsage,
        heap: {
          statistics: heapStats,
          spaces: heapSpaces,
        },
      },
      os: {
        platform: os.platform(),
        arch: os.arch(),
        loadavg,
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        uptime: Math.floor(os.uptime()),
        cpuCount,
        hostname: os.hostname(),
        cpuModel,
        cpuSpeedMhz,
      },
      cgroup: {
        memoryLimitBytes: cgroupMemoryLimitBytes,
        cpu: cgroupCpu,
      },
      derived: {
        memoryLimitBytes,
        rssPctOfLimit,
        heapPctOfHeapTotal,
        loadPerCpu: cpuCount && cpuCount > 0 ? loadavg.map((v) => v / cpuCount) : null,
      },
      eventLoop: {
        utilization: eventLoopUtil.utilization,
        active: eventLoopUtil.active,
        idle: eventLoopUtil.idle,
      },
      disk: {
        cwd: diskCwd,
        uploads: diskUploads,
      },
      network: {
        interfaces: networkSummary,
        totals: (() => {
          const ext = networkSummary.filter((i) => !i.internal);
          const rxBpsTotal = ext.reduce((sum, i) => sum + (typeof i.rxBps === 'number' ? i.rxBps : 0), 0);
          const txBpsTotal = ext.reduce((sum, i) => sum + (typeof i.txBps === 'number' ? i.txBps : 0), 0);
          return {
            rxBps: Number.isFinite(rxBpsTotal) ? rxBpsTotal : null,
            txBps: Number.isFinite(txBpsTotal) ? txBpsTotal : null,
            intervalSec: dtSec,
          };
        })(),
      },
      db: {
        ok: dbOk,
        latencyMs: dbLatencyMs,
        error: dbError,
        pool: {
          totalCount: (pool as any).totalCount ?? null,
          idleCount: (pool as any).idleCount ?? null,
          waitingCount: poolWaiting ?? null,
        },
        render: resolvedRenderDb,
      },
      service: resolvedRenderService,
      users: activeUsers,
      alerts: (() => {
        const list: string[] = [];
        if (!dbOk) list.push('DB_DISCONNECTED');
        if (dbLatencyMs != null && dbLatencyMs > thresholds.dbSlowMs) list.push('DB_SLOW');
        if (typeof poolWaiting === 'number' && poolWaiting > 0) list.push('DB_POOL_WAITING');
        if (eventLoopUtil.utilization > thresholds.eventLoopHighUtil) list.push('EVENT_LOOP_HIGH');
        if (rssPctOfLimit != null && rssPctOfLimit > thresholds.memoryHighPct) list.push('MEMORY_HIGH');
        if (load1PerCpu != null && load1PerCpu > thresholds.cpuPressureLoadPerCpu) list.push('CPU_PRESSURE');
        return list;
      })(),
      thresholds,
      recommendations,
      trend,
    });
  } catch (err) {
    console.error('getServerHealth error:', err);
    return jsonError(res, 500, 'Failed to get server health');
  }
};

// Delete a user account (admin only)
export const deleteUser: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { email, user_type } = req.body;
    
    if (!id) {
      return jsonError(res, 400, "User id is required");
    }

    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return jsonError(res, 400, "Invalid user id");
    }

    // Prevent deleting the last admin
    // If user_type is provided, use it to determine the table
    let userRes: any;
    let tableToDelete = 'admins';
    let isAdmin = false;
    let userEmail = '';
    
    if (user_type === 'client') {
      // If explicitly told it's a client, look in clients table only
      userRes = await pool.query('SELECT id, role, user_type, email FROM clients WHERE id = $1', [userId]);
      tableToDelete = 'clients';
    } else if (user_type === 'admin') {
      // If explicitly told it's an admin, look in admins table only
      userRes = await pool.query('SELECT id, role, user_type, email, is_super FROM admins WHERE id = $1', [userId]);
      tableToDelete = 'admins';
      isAdmin = true;
    } else {
      // Fallback: check both tables (admins first, then clients)
      userRes = await pool.query('SELECT id, role, user_type, email, is_super FROM admins WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        userRes = await pool.query('SELECT id, role, user_type, email FROM clients WHERE id = $1', [userId]);
        tableToDelete = 'clients';
      } else {
        isAdmin = true;
      }
    }
    
    if (userRes.rows.length === 0) {
      return jsonError(res, 404, "User not found");
    }

    // Get the user's email for protection check
    userEmail = userRes.rows[0].email || '';
    const isSuper = userRes.rows[0].is_super === true;

    // Protect super admin accounts - cannot be deleted
    if (isSuper) {
      console.log(`Attempt to delete protected super admin account: ${userEmail}`);
      return jsonError(res, 400, 'Cannot delete a super admin account');
    }
    
    // Only check admin count if actually deleting from admins table
    if (isAdmin) {
      const adminsCountRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM admins WHERE role='admin'");
      const adminsCount = adminsCountRes.rows[0].cnt;
      if (adminsCount <= 1) {
        return jsonError(res, 400, 'Cannot delete the last admin');
      }
    }

    // Delete from appropriate table (avoid dynamic SQL)
    if (tableToDelete === 'admins') {
      await pool.query('DELETE FROM admins WHERE id = $1', [userId]);
    } else if (tableToDelete === 'clients') {
      await pool.query('DELETE FROM clients WHERE id = $1', [userId]);
    } else {
      return jsonError(res, 400, 'Invalid user type');
    }

    // Audit log
    const actorId = (req as any).user?.id ? parseInt((req as any).user.id, 10) : null;
    const targetRole = userRes.rows[0].role;
    if (actorId) {
      await pool.query(
        'INSERT INTO audit_logs(actor_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
        [actorId, 'delete_user', 'user', userId, JSON.stringify({ role: targetRole, table: tableToDelete })]
      );
    }

    res.json({ message: 'User deleted successfully', id: userId });
  } catch (err) {
    console.error('Delete user error:', err);
    return jsonError(res, 500, 'Failed to delete user');
  }
};

// Delete a client store product (admin only)
export const deleteClientStoreProduct: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    if (!id) return jsonError(res, 400, 'Product id is required');
    const productId = parseInt(id, 10);
    if (Number.isNaN(productId)) return jsonError(res, 400, 'Invalid product id');

    const exists = await pool.query('SELECT id FROM client_store_products WHERE id = $1', [productId]);
    if (!exists.rows.length) return jsonError(res, 404, 'Product not found');

    await pool.query('DELETE FROM client_store_products WHERE id = $1', [productId]);

    const actorId = (req as any).user?.id ? parseInt((req as any).user.id, 10) : null;
    if (actorId) {
      await pool.query(
        'INSERT INTO audit_logs(actor_id, action, target_type, target_id) VALUES ($1, $2, $3, $4)',
        [actorId, 'delete_product', 'client_store_product', productId]
      );
    }
    res.json({ message: 'Client store product deleted', id: productId });
  } catch (err) {
    console.error('Delete client store product error:', err);
    return jsonError(res, 500, 'Failed to delete product');
  }
};

// List all staff members across all stores (admin only)
export const listAllStaff: RequestHandler = async (_req, res) => {
  try {
    const { pool } = await import("../utils/database");
    const result = await pool.query(
      `SELECT 
        s.id, s.client_id, s.email, s.role, s.status, s.created_at,
        COALESCE(css.store_name, c.company_name, c.email) as store_name, 
        c.email as owner_email
      FROM staff s
      JOIN clients c ON s.client_id = c.id
      LEFT JOIN client_store_settings css ON s.client_id = css.client_id
      ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list staff:', err);
    return jsonError(res, 500, "Failed to list staff members");
  }
};

// Delete a staff member (admin only)
export const deleteStaffMember: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    if (!id) {
      return jsonError(res, 400, "Staff id is required");
    }

    const staffId = parseInt(id, 10);
    if (Number.isNaN(staffId)) {
      return jsonError(res, 400, "Invalid staff id");
    }

    const result = await pool.query('DELETE FROM staff WHERE id = $1 RETURNING id', [staffId]);
    if (result.rows.length === 0) {
      return jsonError(res, 404, "Staff member not found");
    }

    res.json({ message: "Staff member deleted successfully" });
  } catch (err) {
    console.error('Failed to delete staff:', err);
    return jsonError(res, 500, "Failed to delete staff member");
  }
};

// List all stores (admin only)
export const listAllStores: RequestHandler = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        c.id, c.email, c.name as store_name,
        COALESCE(css.store_slug, '') as store_slug,
        'active' as subscription_status,
        c.created_at
      FROM clients c
      LEFT JOIN client_store_settings css ON c.id = css.client_id
      ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list stores:', err);
    return jsonError(res, 500, "Failed to list stores");
  }
};

// List all activity logs (admin only)
export const listActivityLogs: RequestHandler = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, client_id, staff_id, action, resource_type, resource_id,
        before_value, after_value, timestamp
      FROM staff_activity_log
      ORDER BY timestamp DESC
      LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list activity logs:', err);
    return jsonError(res, 500, "Failed to list activity logs");
  }
};

// List admin audit logs (admin only)
// These are platform/admin actions recorded in audit_logs.
export const listAdminAuditLogs: RequestHandler = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        actor_id,
        action,
        COALESCE(target_type, '') as target_type,
        target_id,
        details,
        created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list admin audit logs:', err);
    return jsonError(res, 500, 'Failed to list admin audit logs');
  }
};

// Clear server caches (admin only)
// - In-memory: security block list cache + brute-force attempt cache
// - DB cache: ip_intelligence table (if present)
export const clearCache: RequestHandler = async (_req, res) => {
  try {
    clearSecurityBlockCache();
    const bf = clearBruteForceMemory();

    let ipIntelDeleted: number | null = null;
    try {
      const r = await pool.query('DELETE FROM ip_intelligence');
      ipIntelDeleted = r.rowCount ?? 0;
    } catch (e: any) {
      const msg = String(e?.message || '');
      // Table may not exist in some environments; treat as non-fatal
      if (msg.includes('ip_intelligence') && msg.includes('does not exist')) {
        ipIntelDeleted = null;
      } else {
        throw e;
      }
    }

    return res.json({
      ok: true,
      cleared: {
        securityBlockCache: true,
        bruteForce: bf,
        ipIntelligenceRowsDeleted: ipIntelDeleted,
      },
    });
  } catch (err) {
    console.error('Failed to clear cache:', err);
    return jsonError(res, 500, 'Failed to clear cache');
  }
};

// Reset Kernel Portal credentials (admin only)
// Generates a new password and upserts kernel_users.
export const resetKernelCredentials: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || adminUser.role !== 'admin') {
      return jsonError(res, 403, 'Admin access required');
    }

    const username = String((req.body as any)?.username || 'root').trim() || 'root';
    const password =
      'K-' + crypto.randomBytes(12).toString('hex') + '-' + crypto.randomBytes(4).toString('hex');

    const passwordHash = hashKernelPassword(password);

    await pool.query(
      `INSERT INTO kernel_users (username, password_hash, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (username)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                    is_active = true,
                    updated_at = NOW()`,
      [username, passwordHash]
    );

    return res.json({ ok: true, username, password });
  } catch (err) {
    console.error('Failed to reset kernel credentials:', err);
    return jsonError(res, 500, 'Failed to reset kernel credentials');
  }
};

// Export a safe DB snapshot (admin only)
// NOTE: This is NOT a full pg_dump. It intentionally excludes secrets/password hashes.
export const exportDbSnapshot: RequestHandler = async (req, res) => {
  try {
    const limit = Math.min(5000, Math.max(1, parseInt(String(req.query.limit || '1000'), 10) || 1000));
    const nowIso = new Date().toISOString();

    const queries: Array<Promise<{ key: string; rows: any[] }>> = [
      pool.query(
        `SELECT setting_key, setting_value, data_type, description, editable, updated_at, updated_by
         FROM platform_settings
         ORDER BY setting_key ASC`
      ).then(r => ({ key: 'platform_settings', rows: r.rows })),

      pool.query(
        `SELECT id, email, full_name, role, created_at
         FROM admins
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'admins', rows: r.rows })),

      pool.query(
        `SELECT id, email, name, role, user_type, created_at, updated_at,
                is_blocked, blocked_reason, blocked_at,
                is_locked, locked_reason, locked_at, lock_type
         FROM clients
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'clients', rows: r.rows })),

      pool.query(
        `SELECT client_id, store_slug, store_name, created_at, updated_at
         FROM client_store_settings
         ORDER BY updated_at DESC NULLS LAST
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'client_store_settings', rows: r.rows })),

      pool.query(
        `SELECT id, user_id, tier, status, trial_started_at, trial_ends_at,
                current_period_start, current_period_end, created_at
         FROM subscriptions
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'subscriptions', rows: r.rows })),

      pool.query(
        `SELECT id, subscription_id, amount, currency, status, provider, provider_transaction_id,
                created_at
         FROM payments
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'payments', rows: r.rows })),

      pool.query(
        `SELECT id, client_id, email, full_name, role, status, permissions,
                last_login, last_ip_address, invited_at, activated_at, created_by,
                created_at, updated_at
         FROM staff
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'staff', rows: r.rows })),

      pool.query(
        `SELECT id, client_id, staff_id, action, resource_type, resource_id, resource_name,
                before_value, after_value, ip_address, user_agent, timestamp
         FROM staff_activity_log
         ORDER BY timestamp DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'staff_activity_log', rows: r.rows })),

      pool.query(
        `SELECT id, actor_id, action, target_type, target_id, details, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'audit_logs', rows: r.rows })),

      pool.query(
        `SELECT id, client_id, title, price, status, created_at
         FROM client_store_products
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'client_store_products', rows: r.rows })),

      pool.query(
        `SELECT id, client_id, status, total_price, customer_name, customer_phone, created_at
         FROM store_orders
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      ).then(r => ({ key: 'store_orders', rows: r.rows })),
    ];

    // Some installs may not have certain tables; allow partial export.
    const settled = await Promise.allSettled(queries);
    const data: Record<string, any> = {};
    const errors: Array<{ table: string; error: string }> = [];

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        data[item.value.key] = item.value.rows;
      } else {
        // best-effort: infer table name from message
        const msg = String((item.reason as any)?.message || item.reason || 'Unknown error');
        errors.push({ table: 'unknown', error: msg });
      }
    }

    const payload = {
      exported_at: nowIso,
      limit,
      tables: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { rows: v, count: Array.isArray(v) ? v.length : 0 }])),
      errors,
    };

    const safeDate = nowIso.replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sahla4eco-export-${safeDate}.json"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Failed to export DB snapshot:', err);
    return jsonError(res, 500, 'Failed to export DB snapshot');
  }
};

// List all products with owner details (admin only)
export const listAllProducts: RequestHandler = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.id, p.title, p.price, p.status,
        COALESCE(c.name, c.email) as seller_name,
        c.email as seller_email,
        COALESCE(p.views, 0) as views, p.created_at,
        p.images
      FROM client_store_products p
      JOIN clients c ON p.client_id = c.id
      ORDER BY p.created_at DESC
      LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list products:', err);
    return jsonError(res, 500, "Failed to list products");
  }
};

// Flag a product for review/moderation (admin only)
export const flagProduct: RequestHandler = async (req, res) => {
  try {
    const { productId, reason, description } = req.body;
    const adminId = (req.user as any)?.id;

    if (!adminId) {
      return jsonError(res, 401, "Not authenticated");
    }

    if (!productId || !reason) {
      return jsonError(res, 400, "Product ID and reason are required");
    }

    // Get product info first
    const productResult = await pool.query(
      'SELECT client_id FROM client_store_products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return jsonError(res, 404, "Product not found");
    }

    const clientId = productResult.rows[0].client_id;

    // Insert flag record
    await pool.query(
      `INSERT INTO flagged_products (product_id, client_id, flagged_by, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [productId, clientId, adminId, reason, description]
    );

    // Update product to mark as flagged
    await pool.query(
      'UPDATE client_store_products SET is_flagged = true, flag_reason = $1 WHERE id = $2',
      [reason, productId]
    );

    res.json({ message: "Product flagged for review" });
  } catch (err) {
    console.error('Failed to flag product:', err);
    return jsonError(res, 500, "Failed to flag product");
  }
};

// Unflag a product (admin only)
export const unflagProduct: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return jsonError(res, 400, "Product ID is required");
    }

    // Update flag records
    await pool.query(
      'UPDATE flagged_products SET status = $1, resolved_at = NOW() WHERE product_id = $2 AND status = $3',
      ['dismissed', productId, 'pending']
    );

    // Update product to unmark as flagged
    await pool.query(
      'UPDATE client_store_products SET is_flagged = false, flag_reason = NULL WHERE id = $1',
      [productId]
    );

    res.json({ message: "Product unflagged" });
  } catch (err) {
    console.error('Failed to unflag product:', err);
    return jsonError(res, 500, "Failed to unflag product");
  }
};
// Block a user account (prevent login entirely - admin action)
// Uses is_blocked field - different from is_locked (subscription)
export const lockUser: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body;

    if (!id) {
      return jsonError(res, 400, "User ID is required");
    }

    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return jsonError(res, 400, "Invalid user ID");
    }

    // Check if user exists and get their email + is_super status
    let userRes = await pool.query('SELECT id, email, is_super FROM admins WHERE id = $1', [userId]);
    
    if (userRes.rows.length === 0) {
      userRes = await pool.query('SELECT id, email FROM clients WHERE id = $1', [userId]);
    }

    if (userRes.rows.length === 0) {
      return jsonError(res, 404, "User not found");
    }

    // Protect super admin accounts - cannot be blocked
    const userEmail = userRes.rows[0].email;
    const isSuper = userRes.rows[0].is_super === true;
    if (isSuper) {
      return jsonError(res, 400, 'Cannot block a super admin account');
    }

    const adminId = (req as any).user?.id ? parseInt((req as any).user.id, 10) : null;
    const blockReason = reason || 'Account blocked by admin';

    // Try blocking in admins table first, then clients
    // Uses is_blocked (admin block) NOT is_locked (subscription lock)
    let result = await pool.query(
      `UPDATE admins SET is_blocked = true, blocked_reason = $1, blocked_at = NOW(), blocked_by_admin_id = $2 WHERE id = $3`,
      [blockReason, adminId, userId]
    ).catch(() => ({ rowCount: 0 }));

    if (result.rowCount === 0) {
      result = await pool.query(
        `UPDATE clients SET is_blocked = true, blocked_reason = $1, blocked_at = NOW(), blocked_by_admin_id = $2 WHERE id = $3`,
        [blockReason, adminId, userId]
      );
    }

    if (result.rowCount === 0) {
      return jsonError(res, 404, "User not found");
    }

    res.json({ message: "User account blocked successfully" });
  } catch (err) {
    console.error('Block user error:', err);
    return jsonError(res, 500, "Failed to block user account");
  }
};

// Unblock a user account (allow login again)
// Clears is_blocked field - different from is_locked (subscription)
export const unlockUser: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    if (!id) {
      return jsonError(res, 400, "User ID is required");
    }

    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return jsonError(res, 400, "Invalid user ID");
    }

    // Try unblocking in admins table first, then clients
    // Clears is_blocked (admin block) NOT is_locked (subscription lock)
    let result = await pool.query(
      `UPDATE admins SET is_blocked = false, blocked_reason = NULL, blocked_at = NULL, blocked_by_admin_id = NULL WHERE id = $1`,
      [userId]
    ).catch(() => ({ rowCount: 0 }));

    if (result.rowCount === 0) {
      result = await pool.query(
        `UPDATE clients SET is_blocked = false, blocked_reason = NULL, blocked_at = NULL, blocked_by_admin_id = NULL WHERE id = $1`,
        [userId]
      );
    }

    if (result.rowCount === 0) {
      return jsonError(res, 404, "User not found");
    }

    res.json({ message: "User account unblocked successfully" });
  } catch (err) {
    console.error('Unblock user error:', err);
    return jsonError(res, 500, "Failed to unblock user account");
  }
};

/**
 * Get all locked accounts (for admin Tools page)
 */
export const getLockedAccounts: RequestHandler = async (_req, res) => {
  try {
    // Get ALL clients with their lock status and subscription info
    // JOIN with subscriptions table to get trial/subscription end dates
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.email, 
        c.name,
        c.is_locked,
        c.locked_reason,
        c.locked_at,
        c.locked_by_admin_id,
        c.unlock_reason,
        c.unlocked_at,
        c.unlocked_by_admin_id,
        COALESCE(c.subscription_extended_until, s.current_period_end, s.trial_ends_at, c.subscription_ends_at) as subscription_ends_at,
        c.is_paid_temporarily,
        c.subscription_extended_until,
        COALESCE(c.lock_type, 'critical') as lock_type,
        c.created_at,
        s.status as subscription_status,
        s.trial_ends_at,
        s.current_period_end
      FROM clients c
      LEFT JOIN subscriptions s ON s.user_id = c.id
      ORDER BY c.is_locked DESC, c.locked_at DESC, c.created_at DESC
    `).catch(async (err) => {
      // If lock_type column doesn't exist yet, query without it
      console.warn('Query with lock_type failed, trying fallback:', err.message);
      return pool.query(`
        SELECT 
          c.id, 
          c.email, 
          c.name,
          c.is_locked,
          c.locked_reason,
          c.locked_at,
          c.locked_by_admin_id,
          c.unlock_reason,
          c.unlocked_at,
          c.unlocked_by_admin_id,
          COALESCE(c.subscription_extended_until, s.current_period_end, s.trial_ends_at, c.subscription_ends_at) as subscription_ends_at,
          c.is_paid_temporarily,
          c.subscription_extended_until,
          'critical' as lock_type,
          c.created_at,
          s.status as subscription_status,
          s.trial_ends_at,
          s.current_period_end
        FROM clients c
        LEFT JOIN subscriptions s ON s.user_id = c.id
        ORDER BY c.is_locked DESC, c.locked_at DESC, c.created_at DESC
      `);
    });

    res.json({ accounts: result.rows });
  } catch (err) {
    console.error('Get locked accounts error:', err);
    return jsonError(res, 500, "Failed to fetch locked accounts");
  }
};

/**
 * Unlock account with options: extend subscription or mark as paid temporarily
 * POST /api/admin/unlock-account
 * Body: { client_id, unlock_reason, action: 'extend' | 'mark_paid', days?: number }
 */
export const unlockAccountWithOptions: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || adminUser.role !== 'admin') {
      return jsonError(res, 403, "Only admins can unlock accounts");
    }

    const { client_id, unlock_reason, action, days } = req.body;

    if (!client_id || !unlock_reason || !action) {
      return jsonError(res, 400, "client_id, unlock_reason, and action are required");
    }

    if (action !== 'extend' && action !== 'mark_paid') {
      return jsonError(res, 400, "action must be 'extend' or 'mark_paid'");
    }

    if (action === 'extend' && (!days || days < 1 || days > 365)) {
      return jsonError(res, 400, "days must be between 1 and 365 for extend action");
    }

    const clientId = parseInt(client_id, 10);
    if (Number.isNaN(clientId)) {
      return jsonError(res, 400, "Invalid client_id");
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current client with subscription info
      const clientResult = await client.query(
        `SELECT c.*, 
          COALESCE(c.subscription_extended_until, s.current_period_end, s.trial_ends_at) as current_end_date
         FROM clients c
         LEFT JOIN subscriptions s ON s.user_id = c.id
         WHERE c.id = $1`,
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return jsonError(res, 404, "Client not found");
      }

      const currentClient = clientResult.rows[0];

      // Prepare update fields - reset lock status while preserving lock_type
      let updateFields = `
        is_locked = false,
        locked_reason = NULL,
        locked_at = NULL,
        locked_by_admin_id = NULL,
        unlocked_by_admin_id = $2,
        unlock_reason = $3,
        unlocked_at = NOW()
      `;
      let params: any[] = [clientId, adminUser.id, unlock_reason];

      // Handle action-specific updates
      if (action === 'extend') {
        // Extend from the CURRENT end date (trial_ends_at or current_period_end), not from today
        // This way extending adds days to existing subscription, not replaces it
        const currentEndDate = currentClient.current_end_date ? new Date(currentClient.current_end_date) : new Date();
        const extendUntil = new Date(Math.max(currentEndDate.getTime(), Date.now()));
        extendUntil.setDate(extendUntil.getDate() + days);
        updateFields += `, subscription_extended_until = $4, is_paid_temporarily = false`;
        params.push(extendUntil);
      } else if (action === 'mark_paid') {
        updateFields += `, is_paid_temporarily = true`;
        // Set paid temporarily until some future date (e.g., 30 days)
        const paidUntil = new Date();
        paidUntil.setDate(paidUntil.getDate() + 30);
        updateFields += `, subscription_extended_until = $4`;
        params.push(paidUntil);
      }

      // Update client
      await client.query(
        `UPDATE clients SET ${updateFields} WHERE id = $1`,
        params
      );

      await client.query('COMMIT');

      res.json({
        message: "Account unlocked successfully",
        action,
        unlock_reason,
        extended_days: action === 'extend' ? days : null,
        marked_paid_temporarily: action === 'mark_paid'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Unlock account with options error:', err);
    return jsonError(res, 500, "Failed to unlock account");
  }
};

/**
 * Lock an account manually for subscription issues or critical reasons
 * POST /api/admin/lock-account
 * Body: { client_id, reason, lock_type: 'payment' | 'critical' }
 */
export const lockAccountManually: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!isProduction) {
      console.log('[LOCK ACCOUNT] Admin user:', adminUser?.email, 'Role:', adminUser?.role);
    }
    
    if (!adminUser || adminUser.role !== 'admin') {
      if (!isProduction) {
        console.log('[LOCK ACCOUNT] ❌ Not authorized: admin user:', !!adminUser, 'is admin:', adminUser?.role === 'admin');
      }
      return jsonError(res, 403, "Only admins can lock accounts");
    }

    const { client_id, reason, lock_type = 'critical' } = req.body;
    if (!isProduction) console.log('[LOCK ACCOUNT] Request body:', { client_id, reason, lock_type });

    // Validate lock_type
    if (!['payment', 'critical'].includes(lock_type)) {
      if (!isProduction) console.log('[LOCK ACCOUNT] ❌ Invalid lock_type:', lock_type);
      return jsonError(res, 400, "lock_type must be 'payment' or 'critical'");
    }

    if (!client_id || !reason) {
      if (!isProduction) console.log('[LOCK ACCOUNT] ❌ Missing fields');
      return jsonError(res, 400, "client_id and reason are required");
    }

    const clientId = parseInt(client_id, 10);
    if (Number.isNaN(clientId)) {
      if (!isProduction) console.log('[LOCK ACCOUNT] ❌ Invalid client_id:', client_id);
      return jsonError(res, 400, "Invalid client_id");
    }

    if (!isProduction) {
      console.log('[LOCK ACCOUNT] Locking client:', clientId, 'by admin:', adminUser.id, 'type:', lock_type);
    }
    
    // Try to update with lock_type (if column exists)
    let result = await pool.query(
      `UPDATE clients 
       SET is_locked = true, locked_reason = $1, locked_at = NOW(), locked_by_admin_id = $2, lock_type = $3
       WHERE id = $4
       RETURNING id, email, name, lock_type`,
      [reason, adminUser.id, lock_type, clientId]
    ).catch(async (err) => {
      // If lock_type column doesn't exist, update without it
      console.warn('[LOCK ACCOUNT] lock_type column not found, updating without it:', err.message);
      return pool.query(
        `UPDATE clients 
         SET is_locked = true, locked_reason = $1, locked_at = NOW(), locked_by_admin_id = $2
         WHERE id = $3
         RETURNING id, email, name, 'critical' as lock_type`,
        [reason, adminUser.id, clientId]
      );
    });

    if (!isProduction) console.log('[LOCK ACCOUNT] Query result rowCount:', result.rowCount);
    if (result.rowCount === 0) {
      if (!isProduction) console.log('[LOCK ACCOUNT] ❌ Client not found:', clientId);
      return jsonError(res, 404, "Client not found");
    }

    if (!isProduction) {
      console.log('[LOCK ACCOUNT] ✅ Account locked successfully:', result.rows[0].email, 'as', lock_type);
    }
    res.json({
      message: "Account locked successfully",
      account: result.rows[0],
      reason,
      lock_type
    });
  } catch (err) {
    console.error('[LOCK ACCOUNT] ❌ Error:', isProduction ? (err as any)?.message : err);
    return jsonError(res, 500, "Failed to lock account");
  }
};

/**
 * Get all admin notes
 * GET /api/admin/notes
 */
export const getAdminNotes: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, "Only admins can access notes");
    }

    const result = await pool.query(
      `SELECT id, admin_id, title, content, color, is_pinned, created_at, updated_at
       FROM admin_notes
       ORDER BY is_pinned DESC, updated_at DESC`
    );

    res.json({ notes: result.rows });
  } catch (err) {
    console.error('[ADMIN NOTES] Error fetching notes:', err);
    return jsonError(res, 500, "Failed to fetch notes");
  }
};

/**
 * Create a new admin note
 * POST /api/admin/notes
 */
export const createAdminNote: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, "Only admins can create notes");
    }

    const { title = '', content, color = 'yellow', is_pinned = false } = req.body;

    if (!content || !content.trim()) {
      return jsonError(res, 400, "Note content is required");
    }

    const result = await pool.query(
      `INSERT INTO admin_notes (admin_id, title, content, color, is_pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, admin_id, title, content, color, is_pinned, created_at, updated_at`,
      [adminUser.id, title.trim(), content.trim(), color, is_pinned]
    );

    res.json({ note: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN NOTES] Error creating note:', err);
    return jsonError(res, 500, "Failed to create note");
  }
};

/**
 * Update an admin note
 * PUT /api/admin/notes/:id
 */
export const updateAdminNote: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, "Only admins can update notes");
    }

    const noteId = parseInt(req.params.id, 10);
    if (isNaN(noteId)) {
      return jsonError(res, 400, "Invalid note ID");
    }

    const { title, content, color, is_pinned } = req.body;

    const result = await pool.query(
      `UPDATE admin_notes
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           color = COALESCE($3, color),
           is_pinned = COALESCE($4, is_pinned),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, admin_id, title, content, color, is_pinned, created_at, updated_at`,
      [title, content, color, is_pinned, noteId]
    );

    if (result.rowCount === 0) {
      return jsonError(res, 404, "Note not found");
    }

    res.json({ note: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN NOTES] Error updating note:', err);
    return jsonError(res, 500, "Failed to update note");
  }
};

/**
 * Delete an admin note
 * DELETE /api/admin/notes/:id
 */
export const deleteAdminNote: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, "Only admins can delete notes");
    }

    const noteId = parseInt(req.params.id, 10);
    if (isNaN(noteId)) {
      return jsonError(res, 400, "Invalid note ID");
    }

    const result = await pool.query(
      `DELETE FROM admin_notes WHERE id = $1 RETURNING id`,
      [noteId]
    );

    if (result.rowCount === 0) {
      return jsonError(res, 404, "Note not found");
    }

    res.json({ message: "Note deleted successfully", id: noteId });
  } catch (err) {
    console.error('[ADMIN NOTES] Error deleting note:', err);
    return jsonError(res, 500, "Failed to delete note");
  }
};

/**
 * GET /api/admin/growth-metrics
 * Returns time-series growth data: signups, orders, revenue by week for the last 12 weeks,
 * plus store health scores and top/worst performing stores.
 */
export const getGrowthMetrics: RequestHandler = async (_req, res) => {
  try {
    // Weekly signups for last 12 weeks
    const signupsR = await pool.query(`
      SELECT date_trunc('week', created_at)::date AS week,
             COUNT(*)::int AS signups
      FROM clients
      WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `);

    // Weekly subscription payments (platform revenue) for last 12 weeks
    const paymentsR = await pool.query(`
      SELECT date_trunc('week', created_at)::date AS week,
             COUNT(*)::int AS payments,
             COALESCE(SUM(amount::numeric), 0)::numeric AS revenue
      FROM payments
      WHERE status = 'completed'
        AND created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `);

    // Weekly new paid subscribers (trial->active conversions + new actives)
    const paidSubsR = await pool.query(`
      SELECT date_trunc('week', current_period_start)::date AS week,
             COUNT(*)::int AS new_paid
      FROM subscriptions
      WHERE status = 'active'
        AND current_period_start >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `);

    // Current MRR snapshot
    const mrrR = await pool.query(`
      SELECT
        COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'active')::int AS active_subs,
        COUNT(DISTINCT c.id) FILTER (WHERE c.is_paid_temporarily = true AND c.subscription_extended_until > NOW())::int AS temp_paid,
        COALESCE((SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'subscription_price'), 3500) AS sub_price
      FROM subscriptions s
      LEFT JOIN clients c ON c.id = s.user_id
    `);

    const mrrRow = mrrR.rows[0] || { active_subs: 0, temp_paid: 0, sub_price: 7 };
    const mrr = (Number(mrrRow.active_subs) + Number(mrrRow.temp_paid)) * Number(mrrRow.sub_price);

    // Store health scores: orders last 30d, product count, last activity
    const storeHealthR = await pool.query(`
      SELECT css.client_id,
             css.store_name,
             css.store_slug,
             c.email,
             c.subscription_status,
             COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days')::int AS orders_30d,
             COUNT(DISTINCT o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '7 days')::int AS orders_7d,
             COUNT(DISTINCT p.id)::int AS product_count,
             MAX(o.created_at) AS last_order_at
      FROM client_store_settings css
      JOIN clients c ON c.id = css.client_id
      LEFT JOIN store_orders o ON o.client_id = css.client_id
      LEFT JOIN client_store_products p ON p.client_id = css.client_id
      GROUP BY css.client_id, css.store_name, css.store_slug, c.email, c.subscription_status
      ORDER BY orders_30d DESC
      LIMIT 50
    `);

    // Calculate store health score: 0-100
    const storeHealth = storeHealthR.rows.map((s: any) => {
      let score = 0;
      score += Math.min(s.orders_30d * 5, 40); // up to 40 pts from orders
      score += Math.min(s.product_count * 3, 30); // up to 30 pts from products
      if (s.last_order_at) {
        const daysSince = (Date.now() - new Date(s.last_order_at).getTime()) / 86400000;
        score += Math.max(0, 30 - daysSince); // up to 30 pts from recency
      }
      return {
        clientId: s.client_id,
        storeName: s.store_name,
        storeSlug: s.store_slug,
        email: s.email,
        subscriptionStatus: s.subscription_status,
        orders30d: s.orders_30d,
        orders7d: s.orders_7d,
        productCount: s.product_count,
        lastOrderAt: s.last_order_at,
        healthScore: Math.min(100, Math.round(score)),
      };
    });

    // Recent activity: last 20 significant events
    const activityR = await pool.query(`
      (SELECT 'order' AS type, id, client_id, status AS detail, created_at
       FROM store_orders ORDER BY created_at DESC LIMIT 10)
      UNION ALL
      (SELECT 'signup' AS type, id, id AS client_id, email AS detail, created_at
       FROM clients ORDER BY created_at DESC LIMIT 10)
      ORDER BY created_at DESC LIMIT 20
    `);

    res.json({
      weeklySignups: signupsR.rows,
      weeklyPayments: paymentsR.rows,
      weeklyPaidSubs: paidSubsR.rows,
      mrr,
      activeSubs: Number(mrrRow.active_subs),
      tempPaid: Number(mrrRow.temp_paid),
      subscriptionPrice: Number(mrrRow.sub_price),
      storeHealth,
      recentActivity: activityR.rows,
    });
  } catch (err) {
    console.error('[ADMIN] Error fetching growth metrics:', err);
    return jsonError(res, 500, "Failed to fetch growth metrics");
  }
};

export const getVisitorAnalytics: RequestHandler = async (_req, res) => {
  try {
    const { getVisitorAnalytics: getAnalytics } = await import('../utils/pageViews');
    const data = await getAnalytics();
    res.json(data);
  } catch (err) {
    console.error('[ADMIN] Error fetching visitor analytics:', err);
    res.json({
      today: { total: 0, platform: 0, stores: 0 },
      week: { total: 0, platform: 0, stores: 0 },
      month: { total: 0, platform: 0, stores: 0 },
      year: { total: 0, platform: 0, stores: 0 },
      topStores: [],
    });
  }
};
