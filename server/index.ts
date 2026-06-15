import telemetryRouter from './routes/telemetry';
import dotenv from 'dotenv';
// Load env files for local/dev.
// Important: never let dotenv override real environment variables (e.g. when we export DATABASE_URL).
// We still want .env.local to override .env for *unset* vars.
const preDotenvEnv = { ...process.env };
dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });
for (const [key, value] of Object.entries(preDotenvEnv)) {
  if (typeof value === 'string') process.env[key] = value;
}
import express from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from 'cookie-parser';
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from 'crypto';
import fs from 'fs/promises';
import { handleDemo } from "./routes/demo";
import * as authRoutes from "./routes/auth";
import * as stockRoutes from "./routes/stock";
import * as clientStoreRoutes from "./routes/client-store";
import storeSlugRouter from "./routes/store-slug";
import * as productVariantsRoutes from "./routes/product-variants";
import * as productOffersRoutes from "./routes/product-offers";
import * as publicStoreRoutes from "./routes/public-store";
import * as templateRoutes from "./routes/templates";
import { createProduct as createStorefrontProduct, updateProduct as updateStorefrontProduct, deleteProduct as deleteStorefrontProduct, handleUploadImages as uploadStorefrontImages } from "./routes/storefront";
import * as orderRoutes from "./routes/orders";
import * as orderConfirmationRoutes from "./routes/order-confirmation";
import { upload, uploadImage, serveSignedUpload, listClientImages, deleteClientImage } from "./routes/uploads";
import { authenticate, optionalAuthenticate, requireAdmin, requireClient, requireStoreOwner } from "./middleware/auth";
import { requireActiveSubscription } from "./middleware/subscription-check";
import * as adminRoutes from "./routes/admin";
import * as dashboardRoutes from "./routes/dashboard";
import * as botRoutes from "./routes/bot";
import * as aiSettingsRoutes from "./routes/ai-settings";
import * as telegramRoutes from "./routes/telegram";
import { trafficMiddleware } from './utils/traffic';
import * as staffRoutes from "./routes/staff";
import * as billingRoutes from "./routes/billing";
import { announcementsRouter } from './routes/announcements';
import { adminAnnouncementsRouter } from './routes/admin-announcements';
import kernelRouter, { initKernel } from "./routes/kernel";
import trapsRouter from "./routes/traps";
import { startSubscriptionEnforcement } from './utils/subscription-enforcement';
import intelRouter from "./routes/intel";
import { usersRouter } from "./routes/users";
import { deliveryRouter, handleDeliveryWebhook } from "./routes/delivery";
import googleSheetsRouter from "./routes/google-sheets";
import chatRouter from "./routes/chat";
import aiRouter from "./routes/ai";
import codesRouter from "./routes/codes";
import customerBotRouter from "./routes/customer-bot";
import pixelsRouter from "./routes/pixels";
import affiliatesRouter from "./routes/affiliates";
import colorIntelligenceRouter from "./routes/color-intelligence";
import { authenticateStaff, requireStaffPermission, requireStaffClientAccess } from "./utils/staff-middleware";
import { initializeDatabase, createDefaultAdmin, runPendingMigrations } from "./utils/database";
import { handleHealth } from "./routes/health";
import { handleDbCheck } from "./routes/db-check";
import { hashPassword } from "./utils/auth";
import { purgeOldSecurityEvents, securityMiddleware } from "./utils/security";
import { startScheduledMessageWorker } from "./utils/scheduled-messages";
import { startBotMessageWorker } from "./utils/bot-messaging";
import { startTelegramUpdatePoller } from "./utils/telegram-poller";
import { startGuardianWorker, stopGuardianWorker } from "./utils/guardian-worker";
import { startTrackingPollWorker, stopTrackingPollWorker } from "./utils/tracking-poll-worker";
import oauthRouter from "./routes/oauth";
import messengerRouter from "./routes/messenger";
import facebookOAuthRouter from "./routes/facebook-oauth";
import whatsappCloudRouter from "./routes/whatsapp-cloud";
import legalRouter from "./routes/legal";
import * as platformBillsRoutes from "./routes/platform-bills";
import deliveryPricesRouter, { getStorefrontDeliveryPrices } from "./routes/delivery-prices";
import mobileRouter from "./routes/mobile";
import notificationsRouter from "./routes/notifications";
import {
  validate,
  registerValidation,
  loginValidation,
} from "./middleware/validation";
import { deleteStoreImage } from "./routes/store";
import { validateProductionEnv } from "./utils/required-env";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer(options?: { skipDbInit?: boolean }) {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Fail-fast on missing secrets / unsafe config in production.
  // (Keep this early; it should run before expensive initialization.)
  if (isProduction) {
    try {
      validateProductionEnv();
    } catch (e: any) {
      console.error(e?.message || e);
      process.exit(1);
    }
  }

  // Meta root CA is available at server/meta-root-ca.pem for mTLS webhooks
  // TLS is terminated at Render's load balancer, so mTLS is handled there.

  // Compression — max level for slow Algerian connections
  app.use(
    compression({
      threshold: 0,    // compress everything, no minimum size
      level: 9,        // maximum gzip compression
      filter: (req, res) => {
        // Always compress — override default text-only filter
        return compression.filter(req, res);
      },
    })
  );
  // Single body parsers with elevated limits BEFORE routes
  app.use(
    express.json({
      limit: '50mb',
      verify: (req: any, _res, buf) => {
        const url = String(req.originalUrl || req.url || '');
        if (url.startsWith('/api/messenger/webhook') || url.startsWith('/api/whatsapp/webhook')) {
          req.rawBody = buf;
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize database then run pending migrations
  const url = (process.env.DATABASE_URL || '').trim();
  const hasDatabaseUrl = Boolean(url);
  const masked = url.replace(/:(.*?)@/, ':****@');
  if (!isProduction) {
    console.log('🗄️ DATABASE_URL:', hasDatabaseUrl ? masked : '(not set)');
  }

  const skipDbInit = Boolean(options?.skipDbInit);
  if (skipDbInit && !isProduction) {
    console.log('⏭️ SKIP_DB_INIT (dev) — skipping database initialization in createServer');
  } else if (hasDatabaseUrl || isProduction) {
    initializeDatabase()
      .then(async () => {
        if (process.env.SKIP_MIGRATIONS === 'true') {
          console.log('⏭️ SKIP_MIGRATIONS=true — skipping SQL migrations');
          await initKernel().catch((e) => console.error('Kernel init failed:', e));
          startScheduledMessageWorker();
          startBotMessageWorker({ intervalMs: 30 * 1000 });
          startTelegramUpdatePoller({ intervalMs: 5 * 1000 });
          startGuardianWorker();
          startTrackingPollWorker({ intervalMs: 3 * 60 * 1000 });
          return;
        }
        await runPendingMigrations();
        // Backfill platform bot credentials for all existing accounts
        const { backfillPlatformBotCredentials } = await import('./utils/client-provisioning');
        await backfillPlatformBotCredentials().catch(e => console.warn('[Startup] backfillPlatformBotCredentials failed:', e));
        await initKernel().catch((e) => console.error('Kernel init failed:', e));
        // Start the scheduled message worker (for bot confirmations)
        startScheduledMessageWorker();
        startBotMessageWorker({ intervalMs: 30 * 1000 });
        startTelegramUpdatePoller({ intervalMs: 5 * 1000 });
        startGuardianWorker();
        startTrackingPollWorker({ intervalMs: 3 * 60 * 1000 });
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
      });
  } else {
    console.error('❌ DATABASE_URL is not set. Please set your Render PostgreSQL database URL in .env.local');
    console.error('   Example: DATABASE_URL=postgresql://username:password@host.render.com:5432/database');
    process.exit(1);
  }

  // Default admin bootstrap
  // - Never auto-create an admin with a hardcoded password in production.
  // - In dev only, you may opt-in via env to simplify local testing.
  if (process.env.CREATE_DEFAULT_ADMIN === 'true') {
    const email = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@sahla4eco.com').trim();
    const password = (process.env.DEFAULT_ADMIN_PASSWORD || '').trim();

    if (!password) {
      console.warn('⚠️  CREATE_DEFAULT_ADMIN=true but DEFAULT_ADMIN_PASSWORD is not set; skipping admin bootstrap');
    } else {
      hashPassword(password).then((hashedPassword) => {
        createDefaultAdmin(email, hashedPassword).catch(console.error);
      });
    }
  }

  // Trust proxy for rate limiting (required for deployment behind reverse proxies like Render)
  app.set("trust proxy", 1);

  // Reduce fingerprinting
  app.disable('x-powered-by');

  // Enforce HTTPS in production (Render terminates TLS and forwards proto)
  if (isProduction) {
    app.use((req, res, next) => {
      // Allow Render health checks and basic diagnostics without redirect requirements.
      // Some platforms may probe the service over plain HTTP during deploy.
      const p = req.path || '';
      if (
        p === '/api/ping' ||
        p === '/api/health' ||
        p === '/api/db-check' ||
        p === '/api/email-status'
      ) {
        return next();
      }

      const forwardedProto = (req.get('x-forwarded-proto') || '').toLowerCase();
      const isHttps = req.secure || forwardedProto === 'https';
      if (isHttps) return next();

      const host = req.get('host');
      if (!host) return res.status(400).json({ error: 'HTTPS required' });
      const url = `https://${host}${req.originalUrl}`;

      if (req.method === 'GET' || req.method === 'HEAD') {
        return res.redirect(301, url);
      }
      return res.status(400).json({ error: 'HTTPS required' });
    });
  }

  // Per-request CSP nonce (used by Helmet + index.html injection)
  if (isProduction) {
    app.use((req, res, next) => {
      const nonce = crypto.randomBytes(16).toString('base64');
      (req as any).cspNonce = nonce;
      (res.locals as any).cspNonce = nonce;
      next();
    });
  }

  // Security: Helmet adds security headers (prod-only to avoid breaking local dev tooling)
  if (isProduction) {
    // Permissions-Policy (explicit header; keep separate from Helmet options for TS compatibility)
    app.use((_req, res, next) => {
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)'
      );
      next();
    });

    app.use(
      helmet({
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        referrerPolicy: { policy: 'no-referrer' },
        frameguard: { action: 'deny' },
        noSniff: true,
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            blockAllMixedContent: [],
            upgradeInsecureRequests: [],
            // NOTE: Some UI libs inject inline styles; keep this while blocking inline JS.
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            scriptSrc: [
              "'self'",
              (req) => `'nonce-${(req as any).cspNonce}'`,
              'https://connect.facebook.net',
              'https://unpkg.com',
              'https://analytics.tiktok.com',
            ],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https:'],
            frameSrc: ["'self'", 'https://www.youtube.com', 'https://youtube.com', 'https://player.vimeo.com'],
            mediaSrc: ["'self'", 'https://res.cloudinary.com', 'blob:'],
          },
        },
      })
    );
  }

  // Security: Rate limiting to prevent brute force attacks (prod-only)
  const authLimiter = isProduction
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please try again later.' },
      })
    : (_req: any, _res: any, next: any) => next();

  const apiLimiter = isProduction
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please try again later.' },
      })
    : (_req: any, _res: any, next: any) => next();

  // Public storefront order limiter (protects checkout from spam/fake orders)
  // Strict: 10 orders per 5 minutes per IP — legitimate buyers never hit this
  const storefrontOrderLimiter = isProduction
    ? rateLimit({
        windowMs: 5 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many order attempts. Please try again later.' },
      })
    : (_req: any, _res: any, next: any) => next();

  // Security: CORS configuration
  // - In production, origins must be explicitly configured.
  // - Never use wildcard origins with credentials.
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Auto-detect Render URL if not configured
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  const allowedOrigins = configuredOrigins.length > 0 
    ? configuredOrigins 
    : renderUrl 
      ? [renderUrl, renderUrl.replace('http://', 'https://')]
      : [];

  // Also allow the known Render URL
  if (renderUrl && !allowedOrigins.includes(renderUrl)) {
    allowedOrigins.push(renderUrl);
    allowedOrigins.push(renderUrl.replace('http://', 'https://'));
  }

  // Add common Render patterns
  const renderPattern = /^https:\/\/ecopro[a-z0-9-]*\.onrender\.com$/;

  // Known production domains (custom domain + www). These should always be allowed
  // when running in production, even if ALLOWED_ORIGINS is not explicitly set.
  const knownProductionOrigins = [
    'https://sahla4eco.com',
    'https://www.sahla4eco.com',
  ];

  if (isProduction) {
    for (const o of knownProductionOrigins) {
      if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
    }
  }

  if (isProduction && allowedOrigins.length === 0) {
    console.warn('⚠️  ALLOWED_ORIGINS not set - will use Render pattern matching');
  }

  // Apply CORS only to API routes. Static assets (e.g. /assets/*) must never be blocked by CORS,
  // and browsers may include an Origin header even for same-site module/script/style requests.
  app.use(
    '/api',
    cors((req, callback) => {
      const originHeader = (req as any)?.headers?.origin;
      const origin = typeof originHeader === 'string' ? originHeader : Array.isArray(originHeader) ? originHeader[0] : undefined;

      // Always allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, {
          origin: true,
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Login-Context"],
        });
      }

      // Allow same-host origins automatically (Chromium-based browsers may include Origin on module/script/style).
      try {
        const originUrl = new URL(origin);
        const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
        if (hostHeader && originUrl.host === hostHeader) {
          return callback(null, {
            origin: true,
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Login-Context"],
          });
        }
      } catch {
        // ignore malformed Origin
      }

      // Allow any localhost port for dev convenience
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin);
      const isTunnel = /^https:\/\/.*\.trycloudflare\.com$/.test(origin);
      if (!isProduction && (isLocalhost || isTunnel || allowedOrigins.includes(origin))) {
        return callback(null, {
          origin: true,
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Login-Context"],
        });
      }

      // In production, allow explicitly configured origins
      if (isProduction && allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return callback(null, {
          origin: true,
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Login-Context"],
        });
      }

      // In production, allow Render URLs matching the pattern
      if (isProduction && renderPattern.test(origin)) {
        return callback(null, {
          origin: true,
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Login-Context"],
        });
      }

      console.warn('CORS blocked origin:', origin);
      // Do NOT throw (would turn same-origin asset loads into 500s). Simply omit CORS headers.
      return callback(null, {
        origin: false,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Login-Context"],
      });
    })
  );

  // Subdomain resolver: detect *.sahla4eco.com and resolve to store slug
  const { subdomainResolver, resolveSubdomainApi } = await import('./routes/subdomain-resolver');
  app.use(subdomainResolver);

  // Cookies (required for HttpOnly cookie auth + CSRF)
  app.use(cookieParser());

  // Global Content-Type validation for API JSON endpoints
  // Prevents 500 errors and parser confusion from bad Content-Type
  app.use('/api/', (req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE') return next();
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct && !ct.includes('application/json') && !ct.includes('multipart/form-data') && !ct.includes('application/x-www-form-urlencoded')) {
      return res.status(400).json({ error: 'Content-Type must be application/json' });
    }
    next();
  });

  // Minimal double-submit CSRF protection for cookie-authenticated requests
  // - Sets a readable CSRF cookie if missing
  // - For unsafe methods, requires X-CSRF-Token header to match the CSRF cookie
  const CSRF_COOKIE = 'ecopro_csrf';
  const ACCESS_COOKIE = 'ecopro_at';
  const REFRESH_COOKIE = 'ecopro_rt';
  const STAFF_ACCESS_COOKIE = 'ecopro_staff_at';
  const KERNEL_ACCESS_COOKIE = 'ecopro_kernel_at';
  const csrfCookieOptions = {
    httpOnly: false,
    secure: isProduction || !!process.env.TUNNEL_MODE,
    sameSite: (isProduction || !!process.env.TUNNEL_MODE ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };

  app.use((req, res, next) => {
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, { ...csrfCookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
    next();
  });

  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

    // Never require CSRF for initial authentication endpoints.
    // (A stale/other auth cookie like ecopro_kernel_at should not block login.)
    const p = req.path;
    if (p === '/api/auth/login' || p === '/api/auth/register' || p === '/api/admin/login') return next();

    // Telemetry is write-only, rate-limited, and safe to accept without CSRF.
    // Important: sendBeacon cannot attach custom headers, so CSRF would block reports
    // whenever a user has an auth cookie.
    if (p === '/api/telemetry/client-error') return next();

    // Mobile API routes use Bearer token (not cookie) auth, so they're not susceptible to CSRF.
    // The mobile app doesn't send X-CSRF-Token, but React Native stores cookies set during
    // login (ecopro_at, ecopro_csrf, etc.), which would trigger the CSRF check and fail.
    if (p.startsWith('/api/mobile/')) return next();

    // If the request carries a Bearer token (Authorization: Bearer <jwt>), it's likely
    // the mobile app — not vulnerable to CSRF since cookies aren't the auth mechanism.
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) return next();

    const hasAuthCookie = Boolean(
      req.cookies?.[ACCESS_COOKIE] ||
        req.cookies?.[REFRESH_COOKIE] ||
        req.cookies?.[STAFF_ACCESS_COOKIE] ||
        req.cookies?.[KERNEL_ACCESS_COOKIE]
    );
    if (!hasAuthCookie) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get('X-CSRF-Token');
    if (!cookieToken || !headerToken || headerToken !== cookieToken) {
      return res.status(403).json({ error: 'CSRF token missing or invalid' });
    }

    return next();
  });

  // Attach req.user when a valid token exists (without rejecting missing/invalid tokens)
  app.use(optionalAuthenticate);

  // Lightweight in-memory traffic capture (used by Kernel portal)
  app.use(trafficMiddleware);

    // Platform page view tracking (lightweight, batched)
  const { pageViewMiddleware } = await import('./utils/pageViews');
  app.use(pageViewMiddleware);

  // Security monitoring: DZ-only hard block for unauth admin/kernel traffic + event logging
  app.use(
    securityMiddleware({
      dzOnlyUnauth: true,
      allowUnknownCountry: false,
      retentionDays: 90,
    })
  );

  // Obvious trap endpoints/pages (always 404, but logged)
  app.use(trapsRouter);

  // Enforce 90-day retention for security events
  void purgeOldSecurityEvents(90)
    .then((n) => {
      if (n > 0) console.log(`[security] Purged ${n} old events`);
    })
    .catch(() => null);
  setInterval(() => {
    void purgeOldSecurityEvents(90).catch(() => null);
  }, 6 * 60 * 60 * 1000);

  // Subscription enforcement (auto-lock expired trials/subscriptions)
  startSubscriptionEnforcement();

  // Global announcements
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/admin/announcements', authenticate, requireAdmin, adminAnnouncementsRouter);

  // NOTE: Removed duplicate express.json()/urlencoded registrations to avoid
  // early PayloadTooLargeError from default 100kb parser.

  // Graceful handler for payload too large errors
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload too large. Use image upload endpoint or reduce size.' });
    }
    return next(err);
  });

  // Public routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Dynamic sitemap.xml — includes all public store pages for SEO
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const db = await ensureConnection();
      const result = await db.query(
        `SELECT store_slug FROM client_settings WHERE store_slug IS NOT NULL AND store_slug != '' ORDER BY updated_at DESC LIMIT 5000`
      );
      const base = 'https://www.sahla4eco.com';
      const staticPages = [
        { loc: base, priority: '1.0', changefreq: 'weekly' },
        { loc: `${base}/pricing`, priority: '0.9', changefreq: 'monthly' },
        { loc: `${base}/features`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${base}/about`, priority: '0.7', changefreq: 'monthly' },
      ];
      const storePages = result.rows.map((r: any) => ({
        loc: `${base}/store/${encodeURIComponent(r.store_slug)}`,
        priority: '0.8',
        changefreq: 'daily',
      }));
      const allPages = [...staticPages, ...storePages];
      const urls = allPages.map(p => `
  <url>
    <loc>${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.send(xml);
    } catch (e) {
      res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }
  });

  // Privacy Policy page for Facebook App verification
  app.get("/privacy-policy", (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Privacy Policy</title></head>
<body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;">
<h1>Privacy Policy</h1>
<p>Last updated: January 2026</p>
<h2>1. Information We Collect</h2>
<p>We collect information you provide when placing orders including name, phone number, and delivery address. We also collect messaging identifiers when you opt-in to notifications.</p>
<h2>2. How We Use Information</h2>
<p>We use your information to process orders, send notifications via your preferred messaging platform, and improve our services.</p>
<h2>3. Information Sharing</h2>
<p>We do not sell personal information. We share data only with delivery partners and messaging platforms for order fulfillment.</p>
<h2>4. Contact</h2>
<p>Contact the store directly for privacy inquiries.</p>
</body></html>`);
  });

  // Email config check (for internal use only)
  app.get("/api/email-status", (_req, res) => {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    res.json({
      configured: !!(user && pass),
    });
  });

  // Health check: confirms DB connectivity regardless of frontend port
  app.get("/api/health", handleHealth);

  // DB details check (non-sensitive; shows current_database and socket)
  app.get("/api/db-check", handleDbCheck);

  // Database connectivity ping (quick simple query)
  app.get('/api/db/ping', async (_req, res) => {
    const start = performance.now();
    try {
      const r = await (await import('./utils/database')).pool.query('SELECT 1 as ok');
      const dur = performance.now() - start;
      res.set('Server-Timing', `db;dur=${dur.toFixed(2)}`);
      res.json({ ok: r.rows[0].ok, db_time_ms: dur });
    } catch (e) {
      const details = !isProduction ? (e as any)?.message : undefined;
      return res.status(500).json({
        error: 'DB ping failed',
        ...(details ? { details } : {}),
      });
    }
  });

  app.get("/api/demo", handleDemo);

  // Telegram webhook (public)
  app.post('/api/telegram/webhook', telegramRoutes.telegramWebhook);
  
  // Telegram public endpoints for customer pre-connection
  app.get('/api/telegram/bot-link/:storeSlug', telegramRoutes.getTelegramBotLink);
  app.get('/api/telegram/check-connection/:storeSlug', telegramRoutes.checkTelegramConnection);
  app.post('/api/telegram/set-webhook-secret', telegramRoutes.setWebhookSecret); // Temporary for testing

  // Auth routes (with rate limiting)
  app.post(
    "/api/auth/register",
    authLimiter,
    registerValidation,
    validate,
    authRoutes.register
  );
  // Email verification signup flow
  app.post(
    "/api/auth/send-verification",
    authLimiter,
    authRoutes.sendVerificationCodeHandler
  );
  app.post(
    "/api/auth/verify-and-register",
    authLimiter,
    authRoutes.verifyAndRegister
  );
  app.post(
    "/api/auth/login",
    authLimiter,
    loginValidation,
    validate,
    authRoutes.login
  );

  // One-time unblock endpoint — clears all auto IP blocks
  app.get('/api/sys/clear-auto-blocks-x9k2m7', async (_req: any, res: any) => {
    try {
      const { pool } = await import('./utils/database');
      await pool.query(`UPDATE security_ip_blocks SET is_active = false WHERE reason LIKE 'AUTO:%'`);
      await pool.query(`UPDATE admins SET is_blocked = false, blocked_reason = NULL, blocked_at = NULL, blocked_by_admin_id = NULL WHERE is_blocked = true`);
      res.json({ ok: true, message: 'All auto-blocks cleared' });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Platform admin login (admin-only)
  app.post(
    '/api/admin/login',
    authLimiter,
    loginValidation,
    validate,
    adminRoutes.adminLogin
  );
  app.post(
    "/api/auth/refresh",
    authLimiter,
    authRoutes.refresh
  );
  app.post(
    "/api/auth/logout",
    authLimiter,
    authRoutes.logout
  );
  // Password reset flow
  app.post(
    "/api/auth/forgot-password",
    authLimiter,
    authRoutes.forgotPassword
  );
  app.post(
    "/api/auth/reset-password",
    authLimiter,
    authRoutes.resetPassword
  );
  // Admin 2FA (TOTP)
  app.post('/api/auth/2fa/setup', authenticate, requireAdmin, authRoutes.setupAdmin2FA);
  app.post('/api/auth/2fa/enable', authenticate, requireAdmin, authRoutes.enableAdmin2FA);
  app.post('/api/auth/2fa/disable', authenticate, requireAdmin, authRoutes.disableAdmin2FA);
  app.get("/api/auth/me", authenticate, authRoutes.getCurrentUser);
  app.post("/api/auth/change-password", authenticate, authRoutes.changePassword);

  // QR Auth (mobile app)
  app.post("/api/auth/qr-request", authenticate, requireClient, authRoutes.qrRequest);
  app.post("/api/auth/qr-login", apiLimiter, authRoutes.qrLogin);

  // Google (Gmail) Auth (mobile app)
  app.post("/api/auth/google", apiLimiter, authRoutes.googleAuth);

  // OAuth Social Login routes (public)
  app.use('/api/oauth', oauthRouter);

  // Facebook Messenger webhook (public for FB verification)
  app.use('/api/messenger', messengerRouter);
  
  // WhatsApp Cloud API webhook (public for Meta verification)
  app.use('/api/whatsapp', whatsappCloudRouter);
  
  
  app.use('/api/telemetry', telemetryRouter);

  // Kernel (root-only) APIs — security monitoring & attack detection
  app.use('/api/kernel', kernelRouter);
  
  // IP Intelligence APIs (public + admin)
  app.use('/api/intel', intelRouter);
  
  // Admin: Search user by email
  app.get("/api/users/search", authenticate, authRoutes.searchUserByEmail);

  // Client profile APIs
  app.use('/api/users', authenticate, usersRouter);

  // Templates API (public)
  app.get("/api/templates", apiLimiter, templateRoutes.getTemplates);
  app.get("/api/templates/:id", apiLimiter, templateRoutes.getTemplateById);
  app.get("/api/templates/category/:category", apiLimiter, templateRoutes.getTemplatesByCategory);

  // Staff orders route (staff members can access their store's orders)
  app.get(
    "/api/staff/orders",
    authenticateStaff,
    requireStaffPermission('view_orders_list'),
    staffRoutes.getStaffOrders
  );

  // Staff order statuses (for staff UI dropdowns)
  app.get(
    "/api/staff/order-statuses",
    authenticateStaff,
    requireStaffPermission('view_orders_list'),
    staffRoutes.getStaffOrderStatuses
  );

  // Staff profile (auth check)
  app.get(
    "/api/staff/me",
    authenticateStaff,
    staffRoutes.getStaffMe
  );

  // Staff order status update route
  app.patch(
    "/api/staff/orders/:orderId/status",
    authenticateStaff,
    requireStaffPermission('edit_order_status'),
    staffRoutes.updateStaffOrderStatus
  );

  // Staff login (unauthenticated)
  app.post(
    "/api/staff/login",
    apiLimiter,
    staffRoutes.staffLogin
  );

  // Staff logout (clears staff auth cookie)
  app.post(
    "/api/staff/logout",
    staffRoutes.staffLogout
  );

  // Subscription check middleware: Enforce active subscriptions on /api/client/*, /api/seller/* routes
  // This must come AFTER staff/login (public route) but BEFORE authenticated routes
  // Note: /api/store/* is intentionally NOT included here as it contains public-facing product routes
  app.use(/^\/api\/client\//, authenticate, requireActiveSubscription);
  app.use(/^\/api\/seller\//, authenticate, requireActiveSubscription);

  // Staff management routes (authenticated store owners/clients only)
  app.post(
    "/api/client/staff/create",
    authenticate,
    requireStoreOwner,
    apiLimiter,
    staffRoutes.createStaff
  );
  app.post(
    "/api/client/staff/invite",
    authenticate,
    requireStoreOwner,
    apiLimiter,
    staffRoutes.inviteStaff
  );
  app.get(
    "/api/client/staff",
    authenticate,
    requireStoreOwner,
    staffRoutes.getStaffList
  );
  app.patch(
    "/api/client/staff/:id/permissions",
    authenticate,
    requireStoreOwner,
    apiLimiter,
    staffRoutes.updateStaffPermissions
  );
  app.delete(
    "/api/client/staff/:id",
    authenticate,
    requireStoreOwner,
    apiLimiter,
    staffRoutes.removeStaff
  );
  app.get(
    "/api/client/staff/:id/activity",
    authenticate,
    requireStoreOwner,
    staffRoutes.getActivityLog
  );

  // Dashboard aggregated stats (authenticated users)
  app.get(
    "/api/dashboard/stats",
    authenticate,
    apiLimiter,
    dashboardRoutes.getDashboardStats
  );

  // Dashboard rich analytics (authenticated users)
  app.get(
    "/api/dashboard/analytics",
    authenticate,
    apiLimiter,
    dashboardRoutes.getDashboardAnalytics
  );

  // Bot settings routes (authenticated clients)
  app.get(
    "/api/bot/settings",
    authenticate,
    requireClient,
    apiLimiter,
    botRoutes.getBotSettings
  );

  app.put(
    "/api/bot/settings",
    authenticate,
    requireClient,
    apiLimiter,
    botRoutes.updateBotSettings
  );

  app.post(
    "/api/bot/test-connection",
    authenticate,
    requireClient,
    apiLimiter,
    botRoutes.testBotConnection
  );

  // AI autopilot settings
  app.get(
    "/api/ai-settings",
    authenticate,
    requireClient,
    apiLimiter,
    aiSettingsRoutes.getAISettings
  );

  app.put(
    "/api/ai-settings",
    authenticate,
    requireClient,
    apiLimiter,
    aiSettingsRoutes.updateAISettings
  );

  // Admin management routes (platform admin only)
  app.post(
    "/api/admin/promote",
    authenticate,
    requireAdmin,
    adminRoutes.promoteUserToAdmin
  );

  app.get(
    "/api/admin/users",
    authenticate,
    requireAdmin,
    adminRoutes.listUsers
  );

  app.delete(
    "/api/admin/users/:id",
    authenticate,
    requireAdmin,
    adminRoutes.deleteUser
  );
  app.delete(
    "/api/admin/client-store/products/:id",
    authenticate,
    requireAdmin,
    adminRoutes.deleteClientStoreProduct
  );

  app.get(
    "/api/admin/stats",
    authenticate,
    requireAdmin,
    adminRoutes.getPlatformStats
  );

  app.get(
    "/api/admin/health",
    authenticate,
    requireAdmin,
    adminRoutes.getServerHealth
  );

  app.get(
    "/api/admin/capacity",
    authenticate,
    requireAdmin,
    adminRoutes.getSystemCapacity
  );

  app.get(
    "/api/admin/active-users",
    authenticate,
    requireAdmin,
    adminRoutes.getActiveUsers
  );

  app.get(
    "/api/admin/staff",
    authenticate,
    requireAdmin,
    adminRoutes.listAllStaff
  );

  app.delete(
    "/api/admin/staff/:id",
    authenticate,
    requireAdmin,
    adminRoutes.deleteStaffMember
  );

  app.get(
    "/api/admin/stores",
    authenticate,
    requireAdmin,
    adminRoutes.listAllStores
  );

  app.get(
    "/api/admin/activity-logs",
    authenticate,
    requireAdmin,
    adminRoutes.listActivityLogs
  );

  app.get(
    "/api/admin/audit-logs",
    authenticate,
    requireAdmin,
    adminRoutes.listAdminAuditLogs
  );

  // Admin maintenance actions
  app.post(
    "/api/admin/clear-cache",
    authenticate,
    requireAdmin,
    adminRoutes.clearCache
  );

  app.get(
    "/api/admin/export-db",
    authenticate,
    requireAdmin,
    adminRoutes.exportDbSnapshot
  );

  // Kernel Portal credentials (admin only)
  app.post(
    "/api/admin/kernel/reset-creds",
    authenticate,
    requireAdmin,
    adminRoutes.resetKernelCredentials
  );

  app.get(
    "/api/admin/products",
    authenticate,
    requireAdmin,
    adminRoutes.listAllProducts
  );

  app.post(
    "/api/admin/flag-product",
    authenticate,
    requireAdmin,
    adminRoutes.flagProduct
  );

  app.post(
    "/api/admin/unflag-product",
    authenticate,
    requireAdmin,
    adminRoutes.unflagProduct
  );

  // Account lock/unlock routes
  app.post(
    "/api/admin/users/:id/lock",
    authenticate,
    requireAdmin,
    adminRoutes.lockUser
  );

  app.post(
    "/api/admin/users/:id/unlock",
    authenticate,
    requireAdmin,
    adminRoutes.unlockUser
  );

  // Get locked accounts (for Tools page)
  app.get(
    "/api/admin/locked-accounts",
    authenticate,
    requireAdmin,
    adminRoutes.getLockedAccounts
  );

  // Unlock account with options (extend days or mark as paid)
  app.post(
    "/api/admin/unlock-account",
    authenticate,
    requireAdmin,
    adminRoutes.unlockAccountWithOptions
  );

  // Lock account manually for subscription issues
  app.post(
    "/api/admin/lock-account",
    authenticate,
    requireAdmin,
    adminRoutes.lockAccountManually
  );

  // Admin Notes routes
  app.get(
    "/api/admin/notes",
    authenticate,
    requireAdmin,
    adminRoutes.getAdminNotes
  );

  app.post(
    "/api/admin/notes",
    authenticate,
    requireAdmin,
    adminRoutes.createAdminNote
  );

  app.put(
    "/api/admin/notes/:id",
    authenticate,
    requireAdmin,
    adminRoutes.updateAdminNote
  );

  app.delete(
    "/api/admin/notes/:id",
    authenticate,
    requireAdmin,
    adminRoutes.deleteAdminNote
  );

  // Growth metrics (admin overview analytics)
  app.get(
    "/api/admin/growth-metrics",
    authenticate,
    requireAdmin,
    adminRoutes.getGrowthMetrics
  );
  app.get(
    "/api/admin/visitor-analytics",
    authenticate,
    requireAdmin,
    adminRoutes.getVisitorAnalytics
  );

  // Billing routes (both user and admin)
  app.get(
    "/api/billing/public",
    billingRoutes.getPublicBillingInfo
  );

  app.get(
    "/api/billing/subscription",
    authenticate,
    billingRoutes.getSubscription
  );

  app.get(
    "/api/billing/check-access",
    authenticate,
    billingRoutes.checkAccess
  );

  // Admin billing routes
  app.get(
    "/api/billing/admin/subscriptions",
    authenticate,
    requireAdmin,
    billingRoutes.getAllSubscriptions
  );

  app.get(
    "/api/billing/admin/metrics",
    authenticate,
    requireAdmin,
    billingRoutes.getPaymentMetrics
  );

  app.get(
    "/api/billing/admin/settings",
    authenticate,
    requireAdmin,
    billingRoutes.getPlatformSettings
  );

  app.get(
    "/api/billing/public/settings",
    billingRoutes.getPublicSettings
  );

  app.post(
    "/api/billing/admin/settings",
    authenticate,
    requireAdmin,
    billingRoutes.updatePlatformSettings
  );

  app.get(
    "/api/billing/admin/stores",
    authenticate,
    requireAdmin,
    billingRoutes.getStoresWithSubscription
  );

  // Admin: Expire subscription (for testing)
  app.post(
    "/api/billing/admin/expire-subscription",
    authenticate,
    requireAdmin,
    billingRoutes.expireSubscription
  );

  // Admin: Reactivate subscription
  app.post(
    "/api/billing/admin/reactivate-subscription",
    authenticate,
    requireAdmin,
    billingRoutes.reactivateSubscription
  );

  // Phase 3: Checkout and payment endpoints
  app.post(
    "/api/billing/checkout",
    authenticate,
    apiLimiter,
    billingRoutes.createCheckout
  );

  app.get(
    "/api/billing/payments",
    authenticate,
    billingRoutes.getPaymentHistory
  );

  // Payment failures management endpoints
  app.get(
    "/api/billing/admin/payment-failures",
    authenticate,
    requireAdmin,
    billingRoutes.getPaymentFailures
  );

  app.post(
    "/api/billing/admin/retry-payment",
    authenticate,
    requireAdmin,
    billingRoutes.retryPayment
  );

  // Platform Bills routes (admin)
  app.get(
    "/api/admin/bills/summary",
    authenticate,
    requireAdmin,
    platformBillsRoutes.getBillsSummary
  );
  app.get(
    "/api/admin/bills",
    authenticate,
    requireAdmin,
    platformBillsRoutes.listBills
  );
  app.post(
    "/api/admin/bills",
    authenticate,
    requireAdmin,
    platformBillsRoutes.createBill
  );
  app.put(
    "/api/admin/bills/:id",
    authenticate,
    requireAdmin,
    platformBillsRoutes.updateBill
  );
  app.delete(
    "/api/admin/bills/:id",
    authenticate,
    requireAdmin,
    platformBillsRoutes.deleteBill
  );

  // RedotPay webhook (public, signature verified, with raw body parser)
  app.post(
    "/api/billing/webhook/redotpay",
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
      // Convert raw body back to json for handler
      try {
        if (Buffer.isBuffer(req.body)) {
          (req as any).rawBody = req.body.toString('utf8');
          req.body = JSON.parse((req as any).rawBody);
        }
        next();
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON' });
      }
    },
    billingRoutes.handleRedotPayWebhook
  );

  // Client Stock Management routes (protected)
  app.get(
    "/api/client/stock",
    authenticate,
    requireClient,
    apiLimiter,
    stockRoutes.getClientStock
  );
  app.get(
    "/api/client/stock/alerts/low-stock",
    authenticate,
    requireClient,
    stockRoutes.getLowStockAlerts
  );
  app.get(
    "/api/client/stock/categories",
    authenticate,
    requireClient,
    stockRoutes.getStockCategories
  );
  app.get(
    "/api/client/stock/categories/all",
    authenticate,
    requireClient,
    stockRoutes.getAllStockCategories
  );
  app.post(
    "/api/client/stock/categories",
    authenticate,
    requireClient,
    apiLimiter,
    stockRoutes.createStockCategory
  );
  app.delete(
    "/api/client/stock/categories/:id",
    authenticate,
    requireClient,
    stockRoutes.deleteStockCategory
  );
  app.get(
    "/api/client/stock/:id",
    authenticate,
    requireClient,
    stockRoutes.getStockById
  );
  app.get(
    "/api/client/stock/:id/history",
    authenticate,
    requireClient,
    stockRoutes.getStockHistory
  );
  app.get(
    "/api/client/stock/:id/variants",
    authenticate,
    requireClient,
    stockRoutes.getClientStockVariants
  );
  app.post(
    "/api/client/stock",
    authenticate,
    requireClient,
    apiLimiter,
    stockRoutes.createStock
  );
  app.put(
    "/api/client/stock/:id/variants",
    authenticate,
    requireClient,
    apiLimiter,
    stockRoutes.putClientStockVariants
  );
  app.put(
    "/api/client/stock/:id",
    authenticate,
    requireClient,
    apiLimiter,
    stockRoutes.updateStock
  );
  app.post(
    "/api/client/stock/:id/adjust",
    authenticate,
    requireClient,
    apiLimiter,
    stockRoutes.adjustStockQuantity
  );
  app.delete(
    "/api/client/stock/:id",
    authenticate,
    requireClient,
    stockRoutes.deleteStock
  );

  // Client Store routes (private store for clients)
  app.get(
    "/api/client/store/products",
    authenticate,
    requireClient,
    clientStoreRoutes.getStoreProducts
  );
  app.get(
    "/api/client/store/products/:id",
    authenticate,
    requireClient,
    clientStoreRoutes.getStoreProduct
  );
  app.post(
    "/api/client/store/products",
    authenticate,
    requireClient,
    apiLimiter,
    clientStoreRoutes.createStoreProduct
  );
  app.put(
    "/api/client/store/products/:id",
    authenticate,
    requireClient,
    apiLimiter,
    clientStoreRoutes.updateStoreProduct
  );
  app.delete(
    "/api/client/store/products/:id",
    authenticate,
    requireClient,
    clientStoreRoutes.deleteStoreProduct
  );

  // Product variant routes (colors/sizes)
  app.get(
    "/api/client/store/products/:id/variants",
    authenticate,
    requireClient,
    productVariantsRoutes.getClientProductVariants
  );
  app.put(
    "/api/client/store/products/:id/variants",
    authenticate,
    requireClient,
    apiLimiter,
    productVariantsRoutes.putClientProductVariants
  );
  
  // Product offer routes (quantity bundles)
  app.get(
    "/api/client/store/products/:id/offers",
    authenticate,
    requireClient,
    productOffersRoutes.getClientProductOffers
  );
  app.put(
    "/api/client/store/products/:id/offers",
    authenticate,
    requireClient,
    apiLimiter,
    productOffersRoutes.putClientProductOffers
  );

  // Media Library routes
  app.get(
    "/api/client/media-library",
    authenticate,
    requireClient,
    clientStoreRoutes.getMediaLibrary
  );
  app.delete(
    "/api/client/media-library",
    authenticate,
    requireClient,
    clientStoreRoutes.deleteMediaImage
  );
  
  app.get(
    "/api/client/store/categories",
    authenticate,
    requireClient,
    clientStoreRoutes.getStoreCategories
  );
  app.get(
    "/api/client/store/settings",
    authenticate,
    requireClient,
    clientStoreRoutes.getStoreSettings
  );
  app.put(
    "/api/client/store/settings",
    authenticate,
    requireClient,
    apiLimiter,
    clientStoreRoutes.updateStoreSettings
  );
  // Fast template-only update (avoids timeout on slow DB)
  app.patch(
    "/api/client/store/template",
    authenticate,
    requireClient,
    clientStoreRoutes.updateStoreTemplate
  );
  app.get(
    "/api/client/store/stats",
    authenticate,
    requireClient,
    clientStoreRoutes.getStoreStats
  );
  app.get(
    "/api/client/store/products/:id/share-link",
    authenticate,
    requireClient,
    clientStoreRoutes.getProductShareLink
  );

  // One-time repair: fix Arabic store slug + bad product slugs for authenticated client
  app.post("/api/client/store/repair-slugs", authenticate, requireClient, async (req: any, res) => {
    try {
      const clientId = req.user.id;
      const db = await ensureConnection();
      const arabicMap: Record<string, string> = {
        'ا':'a','أ':'a','إ':'i','آ':'aa','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
        'د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
        'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
        'ي':'y','ء':'','ئ':'y','ؤ':'w','ة':'h','ى':'a',
      };
      const toLatinSlug = (s: string) => {
        let r = s.toLowerCase();
        for (const [ar, lat] of Object.entries(arabicMap)) r = r.split(ar).join(lat);
        return r.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'store';
      };
      // Fix store slug
      const storeRes = await db.query(`SELECT store_name, store_slug, is_custom_slug FROM client_store_settings WHERE client_id=$1`,[clientId]);
      let storeFixed = false;
      if (storeRes.rows.length && !storeRes.rows[0].is_custom_slug) {
        const newSlug = toLatinSlug(storeRes.rows[0].store_name || `store-${clientId}`);
        if (newSlug !== storeRes.rows[0].store_slug) {
          await db.query(`UPDATE client_store_settings SET store_slug=$1 WHERE client_id=$2`,[newSlug,clientId]);
          storeFixed = true;
        }
      }
      // Fix product slugs
      const prods = await db.query(`SELECT id, title, slug FROM client_store_products WHERE client_id=$1`,[clientId]);
      let productFixed = 0;
      for (const p of prods.rows) {
        const isBad = !p.slug || /^-+\d+$/.test(p.slug) || p.slug.includes('%');
        if (isBad) {
          const latinTitle = toLatinSlug(p.title || '') || 'product';
          const newSlug = `${latinTitle}-${p.id}`;
          await db.query(`UPDATE client_store_products SET slug=$1 WHERE id=$2`,[newSlug,p.id]);
          productFixed++;
        }
      }
      res.json({ success: true, storeFixed, productFixed });
    } catch(e:any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: one-time migration to fix ALL clients' Arabic store slugs + bad product slugs
  app.post("/api/admin/migrate/repair-all-slugs", authenticate, requireAdmin, async (_req: any, res) => {
    try {
      const db = await ensureConnection();
      const arabicMap: Record<string, string> = {
        'ا':'a','أ':'a','إ':'i','آ':'aa','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
        'د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
        'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
        'ي':'y','ء':'','ئ':'y','ؤ':'w','ة':'h','ى':'a',
      };
      const toLatinSlug = (s: string, fallback: string) => {
        let r = (s || '').toLowerCase();
        for (const [ar, lat] of Object.entries(arabicMap)) r = r.split(ar).join(lat);
        return r.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || fallback;
      };

      // Fix store slugs
      const stores = await db.query(`SELECT client_id, store_name, store_slug, is_custom_slug FROM client_store_settings WHERE is_custom_slug IS NOT TRUE`);
      let storesFixed = 0;
      for (const s of stores.rows) {
        const hasNonLatin = /[^\x00-\x7F]/.test(s.store_slug || '');
        if (hasNonLatin) {
          const newSlug = toLatinSlug(s.store_name || '', `store-${s.client_id}`);
          // Ensure uniqueness
          let candidate = newSlug;
          let suffix = 1;
          while (true) {
            const dup = await db.query(`SELECT 1 FROM client_store_settings WHERE store_slug=$1 AND client_id!=$2 LIMIT 1`, [candidate, s.client_id]);
            if (dup.rows.length === 0) break;
            candidate = `${newSlug}-${suffix++}`;
          }
          await db.query(`UPDATE client_store_settings SET store_slug=$1 WHERE client_id=$2`, [candidate, s.client_id]);
          storesFixed++;
        }
      }

      // Fix product slugs
      const prods = await db.query(`SELECT id, title, slug FROM client_store_products`);
      let productsFixed = 0;
      for (const p of prods.rows) {
        const isBad = !p.slug || /^-+\d+$/.test(p.slug) || /[^\x00-\x7F]/.test(p.slug);
        if (isBad) {
          const newSlug = `${toLatinSlug(p.title || '', 'product')}-${p.id}`;
          await db.query(`UPDATE client_store_products SET slug=$1 WHERE id=$2`, [newSlug, p.id]);
          productsFixed++;
        }
      }

      res.json({ success: true, storesFixed, productsFixed });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Client image management routes
  app.get(
    "/api/client/images",
    authenticate,
    requireClient,
    listClientImages
  );
  app.delete(
    "/api/client/images/:filename",
    authenticate,
    requireClient,
    deleteClientImage
  );

  // Public store routes (no authentication required)
  app.get("/api/storefront/:storeSlug/products", publicStoreRoutes.getStorefrontProducts);
  app.get("/api/storefront/:storeSlug/products/:productId", publicStoreRoutes.getStorefrontProductById);
  app.get("/api/storefront/:storeSlug/settings", publicStoreRoutes.getStorefrontSettings);
  app.get("/api/storefront/:storeSlug/address/hai-suggestions", publicStoreRoutes.getStorefrontHaiSuggestions);
  app.post("/api/storefront/:storeSlug/track-view", publicStoreRoutes.trackStorefrontPageView);
  app.get("/api/store/:storeSlug/:productSlug", publicStoreRoutes.getPublicProduct);
  app.get("/api/product-info/:productId", publicStoreRoutes.getProductWithStoreInfo);
  app.get(
    "/api/storefront/:storeSlug/products/:productId/offers",
    productOffersRoutes.getPublicProductOffers
  );
  app.post(
    "/api/storefront/:storeSlug/orders",
    storefrontOrderLimiter,
    publicStoreRoutes.createPublicStoreOrder
  );

  // Private store product management (seller/client must be authenticated)
  app.post("/api/storefront/:storeSlug/products", authenticate, requireClient, apiLimiter, createStorefrontProduct);
  app.put("/api/storefront/:storeSlug/products/:id", authenticate, requireClient, apiLimiter, updateStorefrontProduct);
  app.delete("/api/storefront/:storeSlug/products/:id", authenticate, requireClient, deleteStorefrontProduct);
  app.post("/api/storefront/:storeSlug/products/:id/images", authenticate, requireClient, uploadStorefrontImages);

  // Order routes
  app.post("/api/orders/create", storefrontOrderLimiter, orderRoutes.createOrder); // Public - buyers can create orders
  app.post("/api/client/orders", authenticate, requireClient, orderRoutes.createClientOrder); // Authenticated - store owner creates order manually
  app.get("/api/client/orders", authenticate, requireClient, orderRoutes.getClientOrders);
  app.get("/api/client/orders/chat", authenticate, requireClient, orderRoutes.getChatOrders);
  app.get("/api/orders/new-count", authenticate, requireClient, orderRoutes.getNewOrdersCount); // Get count of new orders;

  app.get("/api/client/orders/flagged-count", authenticate, requireClient, orderRoutes.getFlaggedOrdersCount); // Get count of flagged orders

  app.get("/api/orders/:id/risk", authenticate, requireClient, orderRoutes.getOrderRisk);
  app.post("/api/orders/check-risk", authenticate, requireClient, orderRoutes.checkPhoneRisk);

  // Allow clients to delete (soft-delete) their orders
  app.delete("/api/client/orders/:id", authenticate, requireClient, orderRoutes.deleteOrder);
  
  // Order statuses routes (authenticated - client only)
  app.post("/api/client/order-statuses/restore-preset", authenticate, requireClient, orderRoutes.restorePresetStatus as any);
  app.get("/api/client/order-statuses", authenticate, requireClient, orderRoutes.getOrderStatuses);
  app.post("/api/client/order-statuses", authenticate, requireClient, orderRoutes.createOrderStatus);
  app.patch("/api/client/order-statuses/:id", authenticate, requireClient, orderRoutes.updateCustomOrderStatus as any);
  app.delete("/api/client/order-statuses/:id", authenticate, requireClient, orderRoutes.deleteOrderStatus as any);

  // Order confirmation routes (public - no auth required)
  app.get("/api/storefront/:storeSlug/order/:orderId", orderConfirmationRoutes.getOrderForConfirmation);
  app.post("/api/storefront/:storeSlug/order/:orderId/confirm", orderConfirmationRoutes.confirmOrder);
  app.patch("/api/storefront/:storeSlug/order/:orderId/update", orderConfirmationRoutes.updateOrderDetails);
  app.patch("/api/client/orders/:id/status", authenticate, requireClient, orderRoutes.updateOrderStatus);
  app.patch("/api/client/orders/:id", authenticate, requireClient, orderRoutes.updateClientOrder);

  // Delivery webhooks — must be public (courier callbacks have no JWT)
  app.post('/api/delivery/webhooks/:company', handleDeliveryWebhook);

  // Delivery routes (authenticated)
  app.use('/api/delivery', authenticate, deliveryRouter);

  // Delivery pricing routes (authenticated for sellers, public endpoint for storefront)
  app.use('/api/delivery-prices', authenticate, deliveryPricesRouter);
  app.get('/api/storefront/:storeSlug/delivery-prices', getStorefrontDeliveryPrices);
  app.get('/api/storefront/:storeSlug/contact-channels', publicStoreRoutes.getStorefrontContactChannels);

  // Facebook/Instagram OAuth routes
  // The callback route must work during redirects (cookie-based auth may not be available)
  app.use('/api/facebook', facebookOAuthRouter);

  // Google Sheets integration routes (authenticated)
  app.use('/api/google', authenticate, googleSheetsRouter);

  // Chat routes (authenticated - handles both client and seller roles)
  app.use('/api/chat', authenticate, chatRouter);

  // AI routes (mixed auth - each sub-route enforces its own role)
  app.use('/api/ai', aiRouter);

  // Subscription codes routes (authenticated - client/seller operations)
  app.use('/api/codes', authenticate, codesRouter);

  // Customer Bot routes (authenticated - for store owners to message customers)
  app.use('/api/customer-bot', authenticate, requireClient, customerBotRouter);

  // Pixel tracking routes (mixed - some public, some authenticated)
  app.use('/api/pixels', pixelsRouter);  // Router handles auth internally

  // Affiliate/Influencer marketing routes (mixed auth - public validate, affiliate auth, admin auth)
  app.use('/api/affiliates', affiliatesRouter);

  // AI Color Intelligence routes (authenticated store owners)
  app.use('/api/color-intelligence', authenticate, colorIntelligenceRouter);

  // Store Slug Management (authenticated store owners)
  app.use('/api/store/slug', authenticate, requireClient, storeSlugRouter);

  // Subdomain resolution API (public - resolves current subdomain to store data)
  app.get('/api/resolve-subdomain', resolveSubdomainApi);

  // Mobile app API (authenticated clients)
  app.use('/api/mobile', authenticate, requireClient, mobileRouter);

  // Push notification device registration (authenticated clients)
  app.use('/api/notifications', authenticate, notificationsRouter);

  // Checkout session routes (database-backed, not localStorage)
  app.post("/api/checkout/save-product", orderRoutes.saveProductForCheckout); // Public - save product for checkout
  app.get("/api/checkout/get-product/:sessionId", orderRoutes.getProductForCheckout); // Public - retrieve product from checkout session

  // Image upload route (authenticated users) - with error handling for multer
  app.post("/api/upload", authenticate, (req, res, next) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        const isProduction = process.env.NODE_ENV === 'production';
        console.error('[upload middleware] multer error:', isProduction ? (err as any)?.message : err);
        const message = isProduction ? 'Upload failed' : `Upload failed: ${err.message}`;
        return res.status(400).json({ error: message });
      }
      uploadImage(req, res, next);
    });
  });

  // Register the delete store image route
  app.delete("/api/store/image", authenticate, requireClient, deleteStoreImage);

  // Serve uploaded files via signed URLs (private storage, no public directory exposure)
  app.get('/uploads/:filename', serveSignedUpload);

  // Public legal pages (required for Meta app review)
  app.use('/', legalRouter);

  // Serve static files from React build (only in production)
  if (process.env.NODE_ENV === "production") {
    // In production, __dirname is dist/server/, so we need to go up one level to dist/, then into spa/
    const spaBuildPath = path.join(__dirname, "../spa");

    // Serve hashed assets directly and never fall through to the SPA HTML handler.
    // If an asset is missing, return 404 instead of serving index.html (which causes MIME-type errors).
    const assetsStatic = express.static(path.join(spaBuildPath, 'assets'), {
      fallthrough: false,
      immutable: true,
      maxAge: '365d',
    });

    // IMPORTANT: when fallthrough=false and the file is missing, express.static calls next(err).
    // Our global error handler returns JSON, which can get cached and causes strict MIME failures.
    // Convert missing assets into a plain 404 response (no long cache) instead.
    app.use('/assets', (req, res, next) => {
      assetsStatic(req, res, (err: any) => {
        if (!err) return next();

        const status = Number(err?.status) || Number(err?.statusCode) || 500;
        const isMissing = status === 404 || err?.code === 'ENOENT';

        if (isMissing) {
          res.status(404);
          res.setHeader('Cache-Control', 'no-store');
          res.type('text/plain').send('Not found');
          return;
        }

        // For any unexpected asset error, avoid JSON responses (which break strict MIME checks).
        if (status >= 500) {
          console.error('[assets] static serve failed:', {
            path: req.path,
            url: (req as any).originalUrl || req.url,
            message: err?.message,
            code: err?.code,
            status,
          });
          res.status(500);
          res.setHeader('Cache-Control', 'no-store');
          res.type('text/plain').send('Internal server error');
          return;
        }

        next(err);
      });
    });

    // Serve other static files (icons, manifest, etc). Do NOT serve index.html here;
    // we want all HTML to go through the nonce-injection handler below.
    app.use(
      express.static(spaBuildPath, {
        index: false,
      })
    );

    // Handle React routing - send all non-API requests to index.html
    // Note: Using a middleware function instead of app.get("*") for Express 5 compatibility
    app.use((req, res, next) => {
      // Only serve index.html for real SPA navigations.
      // Avoid catching requests for static files (e.g. /assets/*.js) which must not return HTML.
      const accepts = String(req.headers['accept'] || '');
      const wantsHtml = accepts.includes('text/html') || accepts.includes('*/*') || accepts === '';
      const looksLikeFile = /\.[a-z0-9]+$/i.test(req.path);

      if (
        req.method === 'GET' &&
        wantsHtml &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/assets') &&
        !looksLikeFile
      ) {
        const nonce = (res.locals as any).cspNonce;
        const buildId = String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').slice(0, 12);
        const indexPath = path.join(spaBuildPath, 'index.html');
        fs.readFile(indexPath, 'utf8')
          .then(async (html) => {
            const withBuild = buildId
              ? html.replace(/(href|src)=(['"])(\/assets\/[^'"?]+)\2/g, `$1=$2$3?v=${buildId}$2`)
              : html;
            let withMeta = withBuild;

            // Inject dynamic meta tags for store pages (from URL slug or subdomain resolution)
            const storeMatch = req.path.match(/^\/store\/([^/]+)/);
            const resolvedSlug = (req as any).storeSlug;
            const targetSlug = storeMatch ? storeMatch[1] : resolvedSlug;
            if (targetSlug) {
              try {
                const { ensureConnection: getPool } = await import('./utils/database');
                const dbPool = await getPool();
                const storeRes = await dbPool.query(
                  `SELECT store_name, seo_description FROM client_store_settings WHERE store_slug = $1 LIMIT 1`,
                  [targetSlug]
                );
                const store = storeRes.rows[0];
                if (store?.store_name) {
                  const storeName = store.store_name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
                  const storeDesc = (store.seo_description || `${store.store_name} — shop online on Sahla4Eco`).replace(/"/g, '&quot;').replace(/</g, '&lt;');
                  const storeUrl = `https://${req.headers.host || 'sahla4eco.com'}${req.path}`;
                  withMeta = withMeta
                    .replace(/<title>[^<]*<\/title>/, `<title>${storeName} — Sahla4Eco</title>`)
                    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${storeDesc}" />`)
                    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${storeName}" />`)
                    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${storeDesc}" />`)
                    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${storeUrl}" />`)
                    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${storeUrl}" />`);
                }
              } catch { /* ignore — serve default meta */ }
            }

            // Inject store slug for subdomain-based SPA access so client can read it without an API call
            if (resolvedSlug) {
              const slugJson = JSON.stringify(resolvedSlug);
              const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
              withMeta = withMeta.replace('</head>', `<script${nonceAttr}>window.__STORE_SLUG=${slugJson}</script></head>`);
            }

            // Inject store settings and products inline so React renders immediately without API calls
            if (targetSlug) {
              try {
                const { ensureConnection: getPool2 } = await import('./utils/database');
                const dbPool2 = await getPool2();
                const settingsRes = await dbPool2.query(
                  `SELECT store_name, store_description, store_logo,
                          primary_color, secondary_color,
                          template, banner_url, 'DZD' as currency_code,
                          template_settings, template_settings_by_template, global_settings,
                          store_slug, store_images
                   FROM client_store_settings WHERE store_slug = $1 LIMIT 1`,
                  [targetSlug]
                );
                if (settingsRes.rows.length > 0) {
                  const row = settingsRes.rows[0];
                  const templateSettings = row.template_settings && typeof row.template_settings === 'object' ? row.template_settings : {};
                  const globalSettings = row.global_settings && typeof row.global_settings === 'object' ? row.global_settings : {};
                  const settingsPayload = JSON.stringify({ ...globalSettings, ...templateSettings, ...row, store_slug: row.store_slug || targetSlug });
                  const nonceAttr2 = nonce ? ` nonce="${nonce}"` : '';
                  withMeta = withMeta.replace('</head>', `<script${nonceAttr2}>window.__STORE_SETTINGS=${settingsPayload}</script></head>`);
                }
                // Also inject products to eliminate the second API call
                try {
                  const productsRes = await dbPool2.query(
                    `SELECT p.id, p.title, p.description, p.price, p.original_price, p.images,
                            p.stock_quantity, p.is_featured, p.slug, p.views, p.created_at, p.metadata
                     FROM client_store_products p
                     INNER JOIN client_store_settings s ON p.client_id = s.client_id
                     WHERE s.store_slug = $1 AND p.status = 'active'
                     ORDER BY p.is_featured DESC, p.created_at DESC`,
                    [targetSlug]
                  );
                  if (productsRes.rows.length > 0) {
                    const productsPayload = JSON.stringify(productsRes.rows.map((p: any) => ({ ...p, category: undefined })));
                    const nonceAttr3 = nonce ? ` nonce="${nonce}"` : '';
                    withMeta = withMeta.replace('</head>', `<script${nonceAttr3}>window.__STORE_PRODUCTS=${productsPayload}</script></head>`);
                  }
                } catch { /* ignore — client will fetch products normally */ }
              } catch { /* ignore — client will fetch normally */ }
            }

            const injected = nonce
              ? withMeta.replace(/<script\s+type="module"\s+/g, `<script type="module" nonce="${nonce}" `)
              : withMeta;
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate, s-maxage=60');
            res.setHeader('Vary', 'Accept-Encoding');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.type('html').send(injected);
          })
          .catch(() => {
            res.sendFile(indexPath);
          });
      } else {
        next();
      }
    });
  }

  // Debug schema route (guarded by admin auth)
  app.get('/api/debug/schema', authenticate, requireAdmin, async (_req, res) => {
    try {
      const { pool } = await import('./utils/database');
      const tables = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
        ORDER BY table_name`);
      const details: Record<string, any[]> = {};
      for (const row of tables.rows) {
        const cols = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema='public'`, [row.table_name]);
        details[row.table_name] = cols.rows;
      }
      res.json({ tables: tables.rows.map(r => r.table_name), columns: details });
    } catch (e) {
      const details = !isProduction ? (e as any)?.message : undefined;
      return res.status(500).json({
        error: 'Schema introspection failed',
        ...(details ? { details } : {}),
      });
    }
  });

  // Global error handler (after routes)
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    const status = Number(err?.status) || 500;
    console.error('Unhandled error:', err);

    // Best-effort platform error telemetry (server-side).
    if (status >= 500) {
      try {
        const ip = (req as any).clientIp || (req.headers['cf-connecting-ip'] as string | undefined) || null;
        const ua = (req.headers['user-agent'] as string | undefined) || null;
        const user = (req as any).user as any;

        void import('./utils/error-telemetry')
          .then(({ logPlatformErrorEvent }) =>
            logPlatformErrorEvent({
              source: 'server',
              message: err?.message || 'Unhandled error',
              stack: err?.stack || null,
              url: (req as any).originalUrl || req.url,
              method: req.method,
              path: req.path,
              status_code: status,
              request_id: (req as any).requestId || null,
              ip,
              user_agent: ua,
              user_id: user?.id ? String(user.id) : null,
              user_type: user?.user_type ? String(user.user_type) : null,
              role: user?.role ? String(user.role) : null,
              client_id: user?.user_type === 'client' && user?.id ? Number(user.id) : null,
              metadata: { name: err?.name || null },
            })
          )
          .catch(() => null);
      } catch {
        // ignore
      }
    }

    const message =
      status >= 500
        ? (isProduction ? 'Internal server error' : (err?.message || String(err)))
        : (err?.message || 'Request failed');

    return res.status(status).json({ error: message, status });
  });

  return app;
}
