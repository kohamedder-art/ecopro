import jwt from "jsonwebtoken";
import { JWTPayload } from "@shared/api";
import { jsonError } from "../utils/httpHelpers";
import { RequestHandler } from "express";
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyToken, extractToken } from "../utils/auth";
import crypto from 'crypto';
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  initializeDatabase,
  createDefaultAdmin,
  ensureConnection,
} from "../utils/database";
import { sendPasswordResetEmail } from "../utils/email";
import { getPublicBaseUrl } from '../utils/public-url';
import { logSecurityEvent, getClientIp, getGeo, computeFingerprint, parseCookie } from "../utils/security";
import { checkLoginAllowed, recordFailedLogin, recordSuccessfulLogin } from "../utils/brute-force";
import { checkPasswordPolicy } from '../utils/password-policy';
import { checkPwnedPassword } from '../utils/pwned-passwords';
import { encryptData, decryptData, hashData } from '../utils/encryption';
import { buildOtpAuthUrl, generateTotpSecretBase32, verifyTotp } from '../utils/totp';
import { clearAuthCookies, getCookieOptions, cookieNames } from '../utils/auth-cookies';
import { createTrialSubscription } from './billing';
import { ensureBotSettingsRow, ensureSystemOrderStatuses, ensureSampleProducts } from '../utils/client-provisioning';

// JWT authentication middleware
export const requireAuth: RequestHandler = (req, res, next) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return jsonError(res, 401, "No token");
  try {
    const decoded = verifyToken(token);
    req.user = decoded as JWTPayload;
    next();
  } catch {
    return jsonError(res, 401, "Invalid token");
  }
};

// Database initialization moved to server startup (dev.ts / index.ts)
// Removed immediate init to prevent crashes when DB is unavailable

import { Router } from "express";
import { getUserFromRequest } from "../utils/auth";

const router = Router();

const ACCESS_COOKIE = cookieNames.ACCESS_COOKIE;
const REFRESH_COOKIE = cookieNames.REFRESH_COOKIE;
const CSRF_COOKIE = cookieNames.CSRF_COOKIE;
const STAFF_ACCESS_COOKIE = cookieNames.STAFF_ACCESS_COOKIE;

function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').toLowerCase().trim();
}

function isAllowedSignupEmail(email: string): boolean {
  // For now: only allow gmail.com signups.
  return email.endsWith('@gmail.com');
}

function inferLockType(dbLockType: unknown, lockedReason: unknown): 'payment' | 'critical' {
  if (dbLockType === 'payment' || dbLockType === 'critical') return dbLockType;
  const reason = typeof lockedReason === 'string' ? lockedReason : '';
  // If lock_type is missing (common when column hasn't existed / wasn't selected),
  // infer payment lock from subscription-related reasons.
  if (/(subscription|expired|payment|trial|billing)/i.test(reason)) return 'payment';
  return 'critical';
}

// getCookieOptions is provided by utils/auth-cookies

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

// clearAuthCookies is provided by utils/auth-cookies

// POST /api/auth/register
export const register: RequestHandler = async (req, res) => {
  try {
    const { email, password, name, role, voucher_code } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!isAllowedSignupEmail(normalizedEmail)) {
      return jsonError(res, 400, 'Only @gmail.com email addresses are allowed for signup');
    }

    // Password policy check
    const policy = checkPasswordPolicy(password, normalizedEmail);
    if (policy.ok === false) {
      return jsonError(res, 400, policy.reason);
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return jsonError(res, 400, "Email already registered");
    }

    // Check platform user limit (count from clients table only)
    const pool = await ensureConnection();
    const userCountResult = await pool.query("SELECT COUNT(*) as count FROM clients");
    const currentUserCount = parseInt(userCountResult.rows[0].count);
    
    const maxUsersResult = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'max_users'"
    );
    const maxUsers = maxUsersResult.rows.length > 0 
      ? parseInt(maxUsersResult.rows[0].setting_value) 
      : 1000; // Default to 1000 if not set
    
    if (currentUserCount >= maxUsers) {
      return jsonError(res, 429, `Platform is at capacity. Maximum users: ${maxUsers}`);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Validate voucher code if provided and get affiliate info
    let affiliateId: number | null = null;
    let affiliateDiscount = 0;
    let validatedVoucherCode: string | null = null;
    
    if (voucher_code) {
      const voucherCode = String(voucher_code).toUpperCase().trim();
      const affiliateResult = await pool.query(
        `SELECT id, voucher_code, discount_percent FROM affiliates WHERE voucher_code = $1 AND status = 'active'`,
        [voucherCode]
      );
      if (affiliateResult.rows.length > 0) {
        affiliateId = affiliateResult.rows[0].id;
        affiliateDiscount = parseFloat(affiliateResult.rows[0].discount_percent);
        validatedVoucherCode = affiliateResult.rows[0].voucher_code;
        console.log(`[REGISTER] Valid voucher code ${voucherCode} from affiliate ${affiliateId}, discount: ${affiliateDiscount}%`);
      } else {
        console.log(`[REGISTER] Invalid or inactive voucher code: ${voucherCode}`);
        // Don't fail registration, just ignore invalid code
      }
    }

    // Create user
    // Map role to valid values: 'admin' stays admin, everything else becomes 'client'
    // Public signup should never create admins.
    if (role && role !== 'client') {
      return jsonError(res, 403, 'Invalid role');
    }
    const normalizedRole = 'client';
    const user = await createUser({
      email: normalizedEmail,
      password: hashedPassword,
      name,
      role: normalizedRole,
      user_type: 'client',
      referred_by_affiliate_id: affiliateId || undefined,
      referral_voucher_code: validatedVoucherCode || undefined,
    });

    // Fingerprint + security log (do not log secrets)
    try {
      const ip = getClientIp(req as any);
      const ua = (req.headers['user-agent'] as string | undefined) || null;
      const geo = getGeo(req as any, ip);
      const fpCookie = parseCookie(req as any, 'ecopro_fp');
      const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });

      await logSecurityEvent({
        event_type: 'auth_register_success',
        severity: 'info',
        request_id: (req as any).requestId || null,
        method: req.method,
        path: req.path,
        status_code: 201,
        ip,
        user_agent: ua,
        fingerprint,
        country_code: geo.country_code,
        region: geo.region,
        city: geo.city,
        user_id: String(user.id),
        user_type: user.user_type || (user.role === 'admin' ? 'admin' : 'client'),
        role: user.role || null,
        metadata: {
          scope: 'auth',
          action: 'register',
        },
      });
    } catch (e) {
      console.warn('[REGISTER] Failed to log security event:', (e as any)?.message || e);
    }

    // If user_type is 'client', also create a client record (for store owners)
    if (user.user_type === 'client') {
      try {
        const db = await ensureConnection();
        const colRes = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name IN ('password','password_hash')`);
        const pwCol = colRes.rows.some((r: any) => r.column_name === 'password_hash') ? 'password_hash' : 'password';
        await db.query(
          `INSERT INTO clients (email, ${pwCol}, name, role, referred_by_affiliate_id, referral_voucher_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE SET referred_by_affiliate_id = COALESCE(EXCLUDED.referred_by_affiliate_id, clients.referred_by_affiliate_id), referral_voucher_code = COALESCE(EXCLUDED.referral_voucher_code, clients.referral_voucher_code)`,
          [user.email, user.password, user.name || 'Store Owner', 'client', affiliateId, validatedVoucherCode]
        );
      } catch (clientError) {
        console.warn("[REGISTER] Could not create client record:", clientError);
        // Not critical - continue with registration
      }
      
      // Create affiliate referral record if user came from an affiliate
      if (affiliateId && validatedVoucherCode) {
        try {
          // Create referral record
          await pool.query(
            `INSERT INTO affiliate_referrals (affiliate_id, user_id, voucher_code_used, discount_applied)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO NOTHING`,
            [affiliateId, user.id, validatedVoucherCode, affiliateDiscount]
          );
          
          // Update affiliate referral count
          await pool.query(
            `UPDATE affiliates SET total_referrals = total_referrals + 1, updated_at = NOW() WHERE id = $1`,
            [affiliateId]
          );
          
          console.log(`[REGISTER] Created affiliate referral: user ${user.id} referred by affiliate ${affiliateId} with code ${validatedVoucherCode}`);
        } catch (affiliateError) {
          console.warn('[REGISTER] Could not create affiliate referral record:', affiliateError);
          // Not critical - continue with registration
        }
      }
      
      // Create 30-day trial subscription for new store owners
      await createTrialSubscription(Number(user.id));

      // Provision defaults so bots + statuses + sample products work immediately for new users.
      try {
        await ensureBotSettingsRow(Number(user.id), { enabled: true });
        await ensureSystemOrderStatuses(Number(user.id));
        await ensureSampleProducts(Number(user.id));
      } catch (e) {
        console.warn('[REGISTER] Provisioning defaults failed (non-fatal):', (e as any)?.message || e);
      }
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: (user.role as "user" | "admin") || "user",
      user_type: user.role === "admin" ? "admin" : "client",
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
      role: (user.role as any) || 'user',
      user_type: user.role === 'admin' ? 'admin' : 'client',
    });

    setAuthCookies(res as any, token, refreshToken);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'client',
        user_type: user.user_type || 'client',
      },
    });
  } catch (error) {
    console.error("[REGISTER] Registration error:", error);
    return jsonError(res, 500, "Registration failed");
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login: RequestHandler = async (req, res) => {
  try {
    const { email: rawEmail, password, totp_code, backup_code } = req.body as any;
    const email = String(rawEmail || '').trim().toLowerCase();
    const ip = getClientIp(req as any);
    const loginContext = (req.headers['x-login-context'] as string | undefined) || undefined;

    // BRUTE FORCE CHECK: Block if too many failed attempts
    const bruteCheck = checkLoginAllowed(ip, email);
    if (!bruteCheck.allowed) {
      const waitTime = bruteCheck.blockedUntil 
        ? Math.ceil((bruteCheck.blockedUntil - Date.now()) / 1000 / 60) 
        : 30;
      return jsonError(res, 429, `Too many login attempts. Please try again in ${waitTime} minutes.`);
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      // Record failed login for brute force protection
      await recordFailedLogin(req, email, 'user_not_found', loginContext);
      return jsonError(res, 401, "Invalid email or password");
    }

    // Admin accounts must NOT authenticate via the public /api/auth/login endpoint.
    // They must use the dedicated admin portal endpoint (/api/admin/login).
    // Record as a failed attempt to keep brute-force protections effective.
    const isAdminAccount = (user as any).role === 'admin' || (user as any).user_type === 'admin';
    if (isAdminAccount) {
      await recordFailedLogin(req, email, 'admin_portal_required', loginContext);
      return res.status(403).json({
        error: 'Admin accounts must sign in via /platform-admin/login',
        code: 'ADMIN_PORTAL_REQUIRED',
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    
    if (!isValidPassword) {
      // Record failed login for brute force protection
      await recordFailedLogin(req, email, 'bad_password', loginContext);
      return jsonError(res, 401, "Invalid email or password");
    }

    // Check if account is BLOCKED (admin action - cannot login at all)
    if ((user as any).is_blocked) {
      await recordFailedLogin(req, email, 'account_blocked', loginContext);
      const reason = (user as any).blocked_reason || "Account blocked by administrator";
      clearAuthCookies(res as any);
      return res.status(403).json({ 
        error: `Account blocked: ${reason}`,
        blocked: true,
        blocked_reason: reason
      });
    }

    // LOCKED (subscription) accounts are allowed to login.
    // The UI enforces restrictions (subscription ended page, blurred orders, bots off, etc)
    // using the is_locked / locked_reason / lock_type flags.

    // Admin 2FA gate (TOTP or backup code)
    const isAdmin = (user as any).role === 'admin' || (user as any).user_type === 'admin';

    // Enforce separate admin login entry-point.
    // Admin accounts must use the dedicated platform admin login page.
    if (isAdmin && loginContext !== 'platform_admin') {
      try {
        const ua = (req.headers['user-agent'] as string | undefined) || null;
        const geo = getGeo(req as any, ip);
        const fpCookie = parseCookie(req as any, 'ecopro_fp');
        const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });

        await logSecurityEvent({
          event_type: 'platform_admin_login_wrong_entry',
          severity: 'warn',
          request_id: (req as any).requestId || null,
          method: req.method,
          path: req.path,
          status_code: 403,
          ip,
          user_agent: ua,
          fingerprint,
          country_code: geo.country_code,
          region: geo.region,
          city: geo.city,
          user_id: String((user as any).id || ''),
          user_type: 'admin',
          role: 'admin',
          metadata: {
            scope: 'platform_admin',
            login_context: loginContext || null,
            required_login_context: 'platform_admin',
          },
        });
      } catch {
        // best-effort
      }

      clearAuthCookies(res as any);
      return res.status(403).json({
        error: 'Platform admin accounts must sign in via /platform-admin/login',
        code: 'ADMIN_LOGIN_REQUIRED',
      });
    }

    const totpEnabled = Boolean((user as any).totp_enabled);
    if (isAdmin && totpEnabled) {
      const secretEnc = (user as any).totp_secret_encrypted as string | null | undefined;
      if (!secretEnc) {
        console.error('[2FA] Admin has totp_enabled but missing secret');
        return jsonError(res, 500, 'Two-factor authentication misconfigured');
      }

      let ok = false;

      if (typeof totp_code === 'string' && totp_code.trim()) {
        ok = verifyTotp(decryptData(secretEnc), totp_code.trim());
      }

      if (!ok && typeof backup_code === 'string' && backup_code.trim()) {
        try {
          const pool = await ensureConnection();
          const r = await pool.query('SELECT totp_backup_codes_hashes FROM admins WHERE id = $1', [user.id]);
          const hashes: string[] = Array.isArray(r.rows?.[0]?.totp_backup_codes_hashes)
            ? r.rows[0].totp_backup_codes_hashes
            : [];
          const providedHash = hashData(backup_code.trim());
          if (hashes.includes(providedHash)) {
            const remaining = hashes.filter((h) => h !== providedHash);
            await pool.query(
              'UPDATE admins SET totp_backup_codes_hashes = $2, updated_at = NOW() WHERE id = $1',
              [user.id, remaining]
            );
            ok = true;
          }
        } catch (e) {
          console.error('[2FA] Backup-code verification failed:', (e as any)?.message || e);
        }
      }

      if (!ok) {
        return res.status(401).json({ error: 'Two-factor authentication required', twoFactorRequired: true });
      }
    }

    // Generate token
    const token = generateToken({
      id: user.id.toString(),
      email: user.email,
      role: (user.role as any) || "user",
      user_type: (user.user_type as any) || (user.role === "admin" ? "admin" : "client"),
    });

    const refreshToken = generateRefreshToken({
      id: user.id.toString(),
      email: user.email,
      role: (user.role as any) || 'user',
      user_type: (user.user_type as any) || (user.role === 'admin' ? 'admin' : 'client'),
    });

    setAuthCookies(res as any, token, refreshToken);

    // Record successful login (clears failed attempt counters)
    recordSuccessfulLogin(ip, email);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        user_type: user.user_type || (user.role === "admin" ? "admin" : "client"),
        is_blocked: !!(user as any).is_blocked,
        blocked_reason: (user as any).blocked_reason || null,
        is_locked: !!(user as any).is_locked,
        locked_reason: (user as any).locked_reason || null,
        lock_type: (user as any).lock_type || inferLockType((user as any).lock_type, (user as any).locked_reason),
      },
    });
  } catch (error) {
    console.error("[LOGIN] Login error:", error);
    const isProduction = process.env.NODE_ENV === 'production';
    const msg = error instanceof Error ? error.message : String(error);
    const looksLikeDb = /DATABASE_URL|postgres|pg_hba|Failed to establish database connection|connect attempt|ECONN|ETIMEDOUT|timeout/i.test(msg);
    if (looksLikeDb) {
      return jsonError(res, 503, isProduction ? 'Service temporarily unavailable' : msg);
    }
    return jsonError(res, 500, isProduction ? 'Login failed' : msg);
  }
};

/**
 * Refresh access token using refresh cookie
 * POST /api/auth/refresh
 */
export const refresh: RequestHandler = async (req, res) => {
  try {
    // Accept refresh token from cookie, Authorization header, or x-refresh-token header (for mobile app)
    const rt = (req as any).cookies?.[REFRESH_COOKIE] as string | undefined
      || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined)
      || req.headers['x-refresh-token'] as string | undefined
      || req.body?.refresh_token as string | undefined;
    if (!rt) return jsonError(res, 401, 'No refresh token');

    const decoded = verifyToken(rt) as any;

    // Re-check user status in DB to enforce blocks immediately.
    // (Otherwise a user blocked after login could keep refreshing tokens.)
    const dbUser = await findUserById(String(decoded.id));
    if (!dbUser) {
      clearAuthCookies(res as any);
      return jsonError(res, 401, 'User not found');
    }
    if ((dbUser as any).is_blocked) {
      clearAuthCookies(res as any);
      return jsonError(res, 403, 'Account is blocked');
    }

    const token = generateToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      user_type: decoded.user_type,
      client_id: decoded.client_id,
      staff_id: decoded.staff_id,
      permissions: decoded.permissions,
    });

    const refreshToken = generateRefreshToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      user_type: decoded.user_type,
      client_id: decoded.client_id,
      staff_id: decoded.staff_id,
      permissions: decoded.permissions,
    });

    setAuthCookies(res as any, token, refreshToken);
    // Return tokens for mobile app (cookies are used by web)
    return res.json({ ok: true, token, refresh_token: refreshToken });
  } catch {
    return jsonError(res, 401, 'Invalid refresh token');
  }
};

/**
 * Logout (clear auth cookies)
 * POST /api/auth/logout
 */
export const logout: RequestHandler = async (_req, res) => {
  clearAuthCookies(res as any);
  return res.json({ ok: true });
};

/**
 * Verify token and get current user
 * GET /api/auth/me
 */
export const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      return jsonError(res, 401, "Not authenticated");
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return jsonError(res, 404, "User not found");
    }

    if ((user as any).is_blocked) {
      clearAuthCookies(res as any);
      return jsonError(res, 403, 'Account is blocked');
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "user" | "admin",
      is_blocked: !!(user as any).is_blocked,
      blocked_reason: (user as any).blocked_reason || null,
      is_locked: !!(user as any).is_locked,
      locked_reason: (user as any).locked_reason || null,
      lock_type: (user as any).lock_type || inferLockType((user as any).lock_type, (user as any).locked_reason),
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return jsonError(res, 500, "Failed to get user");
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
export const changePassword: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      return jsonError(res, 401, "Not authenticated");
    }

    const { currentPassword, newPassword } = req.body;

    const user = await findUserById(req.user.id);
    if (!user) {
      return jsonError(res, 404, "User not found");
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      return jsonError(res, 401, "Current password is incorrect");
    }

    // Strong password policy + breach check
    const policy = checkPasswordPolicy(newPassword, user.email);
    if (policy.ok === false) {
      return jsonError(res, 400, policy.reason);
    }
    const pwned = await checkPwnedPassword(newPassword);
    if (pwned.ok && pwned.pwned) {
      return jsonError(res, 400, 'Password has appeared in a data breach; choose a different password');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    await updateUser(user.id, { password: hashedPassword });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return jsonError(res, 500, "Failed to change password");
  }
};

/**
 * Admin 2FA setup (TOTP)
 * POST /api/auth/2fa/setup
 */
export const setupAdmin2FA: RequestHandler = async (req, res) => {
  try {
    const u = req.user as any;
    if (!u || (u.role !== 'admin' && u.user_type !== 'admin')) {
      return jsonError(res, 403, 'Admin access required');
    }

    const user = await findUserById(String(u.id));
    if (!user) return jsonError(res, 404, 'User not found');

    const secretBase32 = generateTotpSecretBase32(20);
    const otpAuthUrl = buildOtpAuthUrl({ issuer: 'EcoPro', accountName: user.email, secretBase32 });

    await updateUser(String(u.id), {
      totp_pending_secret_encrypted: encryptData(secretBase32),
    } as any);

    return res.json({ otpAuthUrl });
  } catch (e) {
    console.error('[2FA] setup failed:', (e as any)?.message || e);
    return jsonError(res, 500, 'Failed to start 2FA setup');
  }
};

/**
 * Admin 2FA enable (verify TOTP)
 * POST /api/auth/2fa/enable
 * Body: { code: string }
 */
export const enableAdmin2FA: RequestHandler = async (req, res) => {
  try {
    const u = req.user as any;
    if (!u || (u.role !== 'admin' && u.user_type !== 'admin')) {
      return jsonError(res, 403, 'Admin access required');
    }

    const code = String((req.body as any)?.code || '').trim();
    if (!code) return jsonError(res, 400, 'Code is required');

    const pool = await ensureConnection();
    const r = await pool.query('SELECT totp_pending_secret_encrypted FROM admins WHERE id = $1', [u.id]);
    const pendingEnc = r.rows?.[0]?.totp_pending_secret_encrypted as string | null | undefined;
    if (!pendingEnc) return jsonError(res, 400, 'No pending 2FA setup found');

    const secret = decryptData(pendingEnc);
    if (!verifyTotp(secret, code)) {
      return jsonError(res, 400, 'Invalid 2FA code');
    }

    const backupCodes: string[] = Array.from({ length: 10 }).map(() => {
      const raw = crypto.randomBytes(8).toString('hex');
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
    });
    const backupHashes = backupCodes.map((c) => hashData(c));

    await pool.query(
      `UPDATE admins
       SET totp_enabled = true,
           totp_secret_encrypted = $2,
           totp_pending_secret_encrypted = NULL,
           totp_backup_codes_hashes = $3,
           totp_enrolled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [u.id, encryptData(secret), backupHashes]
    );

    return res.json({ ok: true, backupCodes });
  } catch (e) {
    console.error('[2FA] enable failed:', (e as any)?.message || e);
    return jsonError(res, 500, 'Failed to enable 2FA');
  }
};

/**
 * Admin 2FA disable
 * POST /api/auth/2fa/disable
 * Body: { code?: string, backup_code?: string }
 */
export const disableAdmin2FA: RequestHandler = async (req, res) => {
  try {
    const u = req.user as any;
    if (!u || (u.role !== 'admin' && u.user_type !== 'admin')) {
      return jsonError(res, 403, 'Admin access required');
    }

    const code = String((req.body as any)?.code || '').trim();
    const backup = String((req.body as any)?.backup_code || '').trim();
    if (!code && !backup) return jsonError(res, 400, '2FA code or backup code required');

    const pool = await ensureConnection();
    const r = await pool.query(
      'SELECT totp_enabled, totp_secret_encrypted, totp_backup_codes_hashes FROM admins WHERE id = $1',
      [u.id]
    );
    if (!r.rows.length) return jsonError(res, 404, 'User not found');

    const row = r.rows[0];
    if (!row.totp_enabled) return jsonError(res, 400, '2FA is not enabled');

    let ok = false;
    if (code && row.totp_secret_encrypted) {
      ok = verifyTotp(decryptData(row.totp_secret_encrypted), code);
    }
    if (!ok && backup) {
      const hashes: string[] = Array.isArray(row.totp_backup_codes_hashes) ? row.totp_backup_codes_hashes : [];
      ok = hashes.includes(hashData(backup));
    }
    if (!ok) return jsonError(res, 400, 'Invalid 2FA proof');

    await pool.query(
      `UPDATE admins
       SET totp_enabled = false,
           totp_secret_encrypted = NULL,
           totp_pending_secret_encrypted = NULL,
           totp_backup_codes_hashes = NULL,
           totp_enrolled_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [u.id]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('[2FA] disable failed:', (e as any)?.message || e);
    return jsonError(res, 500, 'Failed to disable 2FA');
  }
};

/**
 * Search for a user by email (admin only)
 * GET /api/users/search?email=...
 */
export const searchUserByEmail: RequestHandler = async (req, res) => {
  try {
    const adminUser = req.user as any;
    
    // Verify admin access
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, 'Admin access required');
    }

    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return jsonError(res, 400, 'Email query parameter required');
    }

    // Search in clients table
    const { pool } = await import("../utils/database");
    const result = await pool.query(
      'SELECT id, email, name, user_type FROM clients WHERE email = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return jsonError(res, 404, 'User not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error searching user:', error);
    return jsonError(res, 500, 'Failed to search user');
  }
};

// ========================================
// EMAIL VERIFICATION FOR SIGNUP
// ========================================

import { sendVerificationCode, generateVerificationCode } from '../services/email';

/**
 * Send verification code to email
 * POST /api/auth/send-verification
 */
export const sendVerificationCodeHandler: RequestHandler = async (req, res) => {
  try {
    // Email verification via code is disabled for now.
    // Keep endpoint for backwards compatibility with older clients.
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      return jsonError(res, 400, 'Email is required');
    }
    if (!isAllowedSignupEmail(normalizedEmail)) {
      return jsonError(res, 400, 'Only @gmail.com email addresses are allowed for signup');
    }

    return res.json({
      success: true,
      message: 'Signup verification is currently disabled. Continue to create your account.',
      verificationDisabled: true,
    });
  } catch (error) {
    console.error('[AUTH] Send verification error:', error);
    return jsonError(res, 500, 'Failed to send verification code');
  }
};

/**
 * Verify code and complete registration
 * POST /api/auth/verify-and-register
 */
export const verifyAndRegister: RequestHandler = async (req, res) => {
  try {
    // Verification-code registration is disabled; treat this as a normal signup.
    const { email, password, name } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return jsonError(res, 400, 'Email and password are required');
    }
    if (!isAllowedSignupEmail(normalizedEmail)) {
      return jsonError(res, 400, 'Only @gmail.com email addresses are allowed for signup');
    }

    const pool = await ensureConnection();

    // Strong password policy + breach check
    const policy = checkPasswordPolicy(password, normalizedEmail);
    if (policy.ok === false) {
      return jsonError(res, 400, policy.reason);
    }
    const pwned = await checkPwnedPassword(password);
    if (pwned.ok && pwned.pwned) {
      return jsonError(res, 400, 'Password has appeared in a data breach; choose a different password');
    }
    
    // Check if user already exists (double-check)
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return jsonError(res, 400, 'Email already registered');
    }

    // Check platform user limit
    const userCountResult = await pool.query("SELECT COUNT(*) as count FROM clients");
    const currentUserCount = parseInt(userCountResult.rows[0].count);
    
    const maxUsersResult = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'max_users'"
    );
    const maxUsers = maxUsersResult.rows.length > 0 
      ? parseInt(maxUsersResult.rows[0].setting_value) 
      : 1000;
    
    if (currentUserCount >= maxUsers) {
      return jsonError(res, 429, `Platform is at capacity. Maximum users: ${maxUsers}`);
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await createUser({
      email: normalizedEmail,
      password: hashedPassword,
      name: name || normalizedEmail.split('@')[0],
      role: 'client',
      user_type: 'client',
    });

    // Create client record
    try {
      const db2 = await ensureConnection();
      const colRes2 = await db2.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name IN ('password','password_hash')`);
      const pwCol2 = colRes2.rows.some((r: any) => r.column_name === 'password_hash') ? 'password_hash' : 'password';
      await db2.query(
        `INSERT INTO clients (email, ${pwCol2}, name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [user.email, user.password, user.name || 'Store Owner', 'client']
      );
    } catch (clientError) {
      console.warn("[REGISTER] Could not create client record:", clientError);
    }

    // Create 30-day trial subscription for new store owners
    await createTrialSubscription(Number(user.id));

    // Provision defaults so bots + statuses work immediately for new users.
    try {
      await ensureBotSettingsRow(Number(user.id), { enabled: true });
      await ensureSystemOrderStatuses(Number(user.id));
    } catch (e) {
      console.warn('[REGISTER] Provisioning defaults failed (non-fatal):', (e as any)?.message || e);
    }

    // Log security event
    try {
      const ip = getClientIp(req as any);
      const ua = (req.headers['user-agent'] as string | undefined) || null;
      const geo = getGeo(req as any, ip);
      const fpCookie = parseCookie(req as any, 'ecopro_fp');
      const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });

      await logSecurityEvent({
        event_type: 'auth_register_verified',
        severity: 'info',
        request_id: (req as any).requestId || null,
        method: req.method,
        path: req.path,
        status_code: 201,
        ip,
        user_agent: ua,
        fingerprint,
        country_code: geo.country_code,
        region: geo.region,
        city: geo.city,
        user_id: String(user.id),
        user_type: 'client',
        role: 'client',
        metadata: {
          scope: 'auth',
          action: 'register_with_email_verification',
        },
      });
    } catch (e) {
      console.warn('[REGISTER] Failed to log security event:', (e as any)?.message || e);
    }

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'user',
      user_type: 'client',
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
      role: 'user',
      user_type: 'client',
    });

    setAuthCookies(res as any, token, refreshToken);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('[AUTH] Verify and register error:', error);
    return jsonError(res, 500, 'Registration failed');
  }
};

/**
 * Forgot password - sends reset email
 * POST /api/auth/forgot-password
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return jsonError(res, 400, 'Email is required');
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await findUserByEmail(normalizedEmail);
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database (ensure table exists in case migration hasn't run)
    const pool = await ensureConnection();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      INSERT INTO password_resets (email, token_hash, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET token_hash = $2, expires_at = $3, created_at = NOW()
    `, [normalizedEmail, resetTokenHash, expiresAt]);

    // Build reset URL
    const baseUrl = getPublicBaseUrl(req);
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email
    const sent = await sendPasswordResetEmail(normalizedEmail, resetToken, resetUrl);
    if (!sent) {
      // Still return success to the client to avoid account enumeration.
      console.error('[AUTH] Password reset email not sent (email not configured or provider error).');
    }

    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('[AUTH] Forgot password error:', error);
    return jsonError(res, 500, 'Failed to process request');
  }
};

/**
 * Reset password - sets new password using token
 * POST /api/auth/reset-password
 */
export const resetPassword: RequestHandler = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return jsonError(res, 400, 'Email, token, and new password are required');
    }

    if (newPassword.length < 8) {
      return jsonError(res, 400, 'Password must be at least 8 characters');
    }

    const pool = await ensureConnection();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const normalizedEmail = normalizeEmail(email);

    // Find valid reset token
    const result = await pool.query(`
      SELECT * FROM password_resets 
      WHERE email = $1 AND token_hash = $2 AND expires_at > NOW()
    `, [normalizedEmail, tokenHash]);

    if (result.rows.length === 0) {
      return jsonError(res, 400, 'Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in the correct table/column (clients or admins; password or password_hash)
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return jsonError(res, 400, 'Invalid reset request');
    }

    const updated = await updateUser(String((user as any).id), { password: hashedPassword });
    if (!updated) {
      console.error('[AUTH] updateUser returned null for id:', (user as any).id);
      return jsonError(res, 500, 'Failed to update password');
    }

    // Delete used reset token
    await pool.query('DELETE FROM password_resets WHERE email = $1', [normalizedEmail]);

    // Log security event
    try {
      const ip = getClientIp(req as any);
      await logSecurityEvent({
        event_type: 'password_reset_success',
        severity: 'info',
        request_id: (req as any).requestId || null,
        method: req.method,
        path: req.path,
        status_code: 200,
        ip,
        user_agent: req.headers['user-agent'] || null,
        metadata: { email },
      });
    } catch (e) {
      console.warn('[AUTH] Failed to log security event:', e);
    }

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('[AUTH] Reset password error:', error);
    return jsonError(res, 500, 'Failed to reset password');
  }
};

/* ── QR Auth (mobile app) ── */

export const qrRequest: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const clientId = (req as any).user?.id;
    if (!clientId) return jsonError(res, 401, 'Unauthorized');

    const qrToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await pool.query(
      `INSERT INTO qr_auth_tokens (client_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (client_id) DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [clientId, qrToken, expiresAt]
    );

    res.json({ qr_token: qrToken, expires_in: 120 });
  } catch (error) {
    console.error('[qr] request error:', error);
    return jsonError(res, 500, 'Failed to generate QR token');
  }
};

export const qrLogin: RequestHandler = async (req, res) => {
  try {
    const pool = await ensureConnection();
    const { qr_token } = req.body;
    if (!qr_token) return jsonError(res, 400, 'qr_token is required');

    const result = await pool.query(
      'SELECT client_id, expires_at FROM qr_auth_tokens WHERE token = $1',
      [qr_token]
    );

    if (result.rows.length === 0) return jsonError(res, 401, 'Invalid QR token');

    const { client_id: clientId, expires_at } = result.rows[0];
    if (new Date() > new Date(expires_at)) return jsonError(res, 401, 'QR token expired');

    const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { id: clientId, role: 'client', user_type: 'client', clientId },
      secret,
      { expiresIn: '30d' }
    );

    const userRes = await pool.query(
      `SELECT c.id, c.name, c.email, c.phone, c.business_name,
              css.store_slug, css.store_name
       FROM clients c
       LEFT JOIN client_store_settings css ON css.client_id = c.id
       WHERE c.id = $1`,
      [clientId]
    );
    if (userRes.rows.length === 0) return jsonError(res, 404, 'User not found');

    await pool.query('DELETE FROM qr_auth_tokens WHERE token = $1', [qr_token]);

    res.json({ token, refresh_token: null, user: userRes.rows[0] });
  } catch (error) {
    console.error('[qr] login error:', error);
    return jsonError(res, 500, 'QR login failed');
  }
};

/* ── Google (Gmail) Auth (mobile app) ── */

/**
 * POST /api/auth/google
 * Body: { id_token?: string, code?: string }
 *
 * Accepts either:
 *   - id_token: a Google ID token (from implicit flow)
 *   - code: an authorization code (from auth code flow) — exchanged server-side
 *
 * Verifies the Google identity, then either logs in the user (if a client
 * with that email exists) or creates a new client account (auto-register).
 */
export const googleAuth: RequestHandler = async (req, res) => {
  try {
    const { id_token, code, idToken: legacyIdToken } = req.body as { id_token?: string; code?: string; idToken?: string };
    const rawIdToken = id_token || legacyIdToken;

    const expectedClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      console.error('[google-auth] GOOGLE_OAUTH_CLIENT_ID env var is not set');
      return jsonError(res, 500, 'Google login is not configured on this server');
    }

    let payload: any = null;

    if (rawIdToken) {
      // ── Verify the ID token directly via Google's tokeninfo endpoint ──
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawIdToken)}`
      );
      if (!verifyRes.ok) {
        console.error('[google-auth] Google tokeninfo returned', verifyRes.status);
        return jsonError(res, 401, 'Invalid Google ID token');
      }
      payload = await verifyRes.json();
    } else if (code) {
      // ── Exchange authorization code for tokens server-side ──
      console.log('[google-auth] Exchanging authorization code...');
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientSecret) {
        console.error('[google-auth] GOOGLE_CLIENT_SECRET env var is not set');
        return jsonError(res, 500, 'Google login is not configured (missing client secret)');
      }

      const redirectUri = 'https://auth.expo.io/@sahla4eco-organization/ssahla4eco';
      console.log('[google-auth] Code exchange params:', { client_id: expectedClientId, redirect_uri: redirectUri, code_length: code.length });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: expectedClientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error('[google-auth] code exchange failed:', tokenRes.status, errBody);
        return jsonError(res, 401, 'Failed to exchange Google authorization code');
      }

      const tokenData: any = await tokenRes.json();
      const exchangedIdToken = tokenData.id_token;
      console.log('[google-auth] Code exchange success, id_token:', exchangedIdToken ? 'present' : 'missing', 'access_token:', tokenData.access_token ? 'present' : 'missing');

      if (!exchangedIdToken) {
        console.error('[google-auth] no id_token in code exchange response. Keys:', Object.keys(tokenData));
        return jsonError(res, 401, 'Google code exchange did not return an ID token');
      }

      // Verify the exchanged ID token
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(exchangedIdToken)}`
      );
      if (!verifyRes.ok) {
        console.error('[google-auth] tokeninfo failed after code exchange');
        return jsonError(res, 401, 'Invalid Google ID token from code exchange');
      }
      payload = await verifyRes.json();
    } else {
      return jsonError(res, 400, 'id_token or code is required');
    }

    if (payload.aud !== expectedClientId) {
      console.error('[google-auth] audience mismatch. expected:', expectedClientId, 'got:', payload.aud);
      return jsonError(res, 401, 'Google ID token was not issued for this app');
    }
    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
      return jsonError(res, 401, 'Google email is not verified');
    }

    const email = String(payload.email || '').trim().toLowerCase();
    const name = String(payload.name || email.split('@')[0] || 'مستخدم');
    if (!email) return jsonError(res, 400, 'Google account has no email');

    const pool = await ensureConnection();
    let user = await findUserByEmail(email);

    if (!user) {
      // Auto-register a new client account with a random unguessable
      // password. The user can set a real password later from the web.
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await hashPassword(randomPassword);

      try {
        user = await createUser({
          name,
          email,
          password: hashedPassword,
          phone: null,
          business_name: null,
        });
      } catch (e: any) {
        console.error('[google-auth] createUser error:', e?.message || e);
        return jsonError(res, 500, 'Failed to create account from Google sign-in');
      }

      // Provision default rows for the new client (trial subscription, bot settings, …).
      try {
        const u: any = user;
        if (u?.id) {
          await createTrialSubscription(String(u.id));
          await ensureBotSettingsRow(String(u.id));
          await ensureSystemOrderStatuses(String(u.id));
        }
      } catch (e) {
        console.warn('[google-auth] provisioning warning:', e);
      }

      // Log auto-register event
      try {
        const ip = getClientIp(req as any);
        await logSecurityEvent({
          event_type: 'auth_register_google',
          severity: 'info',
          request_id: (req as any).requestId || null,
          method: req.method,
          path: req.path,
          status_code: 200,
          ip,
          user_agent: req.headers['user-agent'] || null,
          metadata: { email, provider: 'google' },
        });
      } catch {}
    } else {
      // Blocked accounts cannot log in.
      if ((user as any).is_blocked) {
        return res.status(403).json({
          error: `Account blocked: ${(user as any).blocked_reason || 'Contact support'}`,
          blocked: true,
          blocked_reason: (user as any).blocked_reason,
        });
      }
    }

    const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'fallback-secret';
    const clientId = String((user as any).id);
    const token = jwt.sign(
      { id: clientId, role: 'client', user_type: 'client', clientId },
      secret,
      { expiresIn: '30d' }
    );

    const userRes = await pool.query(
      `SELECT c.id, c.name, c.email, c.phone, c.business_name,
              css.store_slug, css.store_name
       FROM clients c
       LEFT JOIN client_store_settings css ON css.client_id = c.id
       WHERE c.id = $1`,
      [clientId]
    );

    try {
      const ip = getClientIp(req as any);
      await logSecurityEvent({
        event_type: 'auth_login_google',
        severity: 'info',
        request_id: (req as any).requestId || null,
        method: req.method,
        path: req.path,
        status_code: 200,
        ip,
        user_agent: req.headers['user-agent'] || null,
        user_id: clientId,
        user_type: 'client',
        role: 'client',
        metadata: { email, provider: 'google' },
      });
    } catch {}

    res.json({ token, refresh_token: null, user: userRes.rows[0] || user });
  } catch (error) {
    console.error('[google-auth] error:', error);
    return jsonError(res, 500, 'Google login failed');
  }
};
