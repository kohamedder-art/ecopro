import { Router, RequestHandler } from "express";
import { ensureConnection } from "../utils/database";
import { authenticate, requireClient } from "../middleware/auth";
import { z } from 'zod';
import {
  backfillHistoricalSessions,
  deleteCreativeCatalogEntry,
  deleteCreativeSpendEntry,
  getOmniInputs,
  getOmniOverview,
  getCustomerAnalytics,
  getGenderAnalytics,
  getProductPerformance,
  upsertAnalyticSessionFromEvent,
  upsertAnalyticSessionSummary,
  upsertCreativeCatalogEntry,
  upsertCreativeSpendEntry,
  upsertProductEconomics,
} from '../services/omni-intelligence';

const router = Router();

// Get pool helper
async function getPool() {
  return await ensureConnection();
}

// Standard pixel events
const VALID_EVENTS = [
  'PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 
  'Purchase', 'Lead', 'CompleteRegistration', 'Search', 'AddToWishlist'
];

const productEconomicsSchema = z.object({
  productId: z.coerce.number().int().positive(),
  buyCost: z.coerce.number().min(0).max(1_000_000_000),
  packagingCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
  handlingCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
  fallbackShippingCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
  callCenterCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
  returnCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
  otherCosts: z.coerce.number().min(0).max(1_000_000_000).default(0),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const creativeCatalogSchema = z.object({
  platform: z.enum(['facebook', 'tiktok', 'google', 'direct', 'other']),
  campaignName: z.string().trim().max(160).optional().nullable(),
  adsetName: z.string().trim().max(160).optional().nullable(),
  creativeName: z.string().trim().min(1).max(160),
  landingPage: z.string().trim().max(500).optional().nullable(),
  promiseAngle: z.string().trim().max(1000).optional().nullable(),
  targetPersona: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const creativeSpendSchema = z.object({
  entryDate: z.string().trim().min(1).max(30),
  platform: z.enum(['facebook', 'tiktok', 'google', 'instagram', 'snapchat', 'youtube', 'whatsapp', 'telegram', 'direct', 'other']),
  productId: z.coerce.number().int().min(1).optional().nullable(),
  campaignName: z.string().trim().max(160).optional().nullable(),
  adsetName: z.string().trim().max(160).optional().nullable(),
  creativeName: z.string().trim().max(160).optional().nullable(),
  spend: z.coerce.number().min(0).max(1_000_000_000),
  impressions: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  clicks: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  linkClicks: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const historicalImportSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

const sessionSummarySchema = z.object({
  store_slug: z.string().trim().min(1).max(120),
  session_id: z.string().trim().min(1).max(120),
  visitor_id: z.string().trim().max(120).optional().nullable(),
  page_url: z.string().trim().max(1000).optional().nullable(),
  page_path: z.string().trim().max(500).optional().nullable(),
  max_scroll_depth: z.coerce.number().int().min(0).max(100).optional().nullable(),
  active_time_seconds: z.coerce.number().int().min(0).max(86_400).optional().nullable(),
  locale: z.string().trim().max(16).optional().nullable(),
  referrer: z.string().trim().max(1000).optional().nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  medium: z.string().trim().max(80).optional().nullable(),
  campaign_name: z.string().trim().max(160).optional().nullable(),
  ended: z.boolean().optional(),
});

async function resolveClientIdByStoreSlug(storeSlug: string): Promise<number | null> {
  const pool = await getPool();
  const storeResult = await pool.query(
    `SELECT client_id
     FROM client_store_settings
     WHERE store_slug = $1
        OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)
     LIMIT 1`,
    [storeSlug]
  );
  return storeResult.rows.length > 0 ? Number(storeResult.rows[0].client_id) : null;
}

// =====================
// PIXEL SETTINGS
// =====================

// Get pixel settings for client
export const getPixelSettings: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const clientId = user.id;
    
    const pool = await getPool();
    const result = await pool.query(
      `SELECT * FROM client_pixel_settings WHERE client_id = $1`,
      [clientId]
    );
    
    if (result.rows.length === 0) {
      // Return empty defaults
      return res.json({
        client_id: clientId,
        facebook_pixel_id: null,
        tiktok_pixel_id: null,
        is_facebook_enabled: false,
        is_tiktok_enabled: false
      });
    }
    
    // Don't expose access tokens to frontend
    const settings = result.rows[0];
    res.json({
      ...settings,
      facebook_access_token: settings.facebook_access_token ? '***configured***' : null,
      tiktok_access_token: settings.tiktok_access_token ? '***configured***' : null
    });
  } catch (error) {
    console.error("Get pixel settings error:", error);
    res.status(500).json({ error: "Failed to fetch pixel settings" });
  }
};

// Update pixel settings
export const updatePixelSettings: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const clientId = user.id;
    const {
      facebook_pixel_id,
      facebook_access_token,
      tiktok_pixel_id,
      tiktok_access_token,
      is_facebook_enabled,
      is_tiktok_enabled,
      additional_pixels
    } = req.body;

    // Validate pixel IDs — must be numeric for Facebook, alphanumeric for TikTok
    if (facebook_pixel_id) {
      const cleaned = String(facebook_pixel_id).trim();
      if (!/^\d{13,16}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Facebook Pixel ID must be a numeric ID (13-16 digits)' });
      }
      req.body.facebook_pixel_id = cleaned;
    }
    if (tiktok_pixel_id) {
      const cleaned = String(tiktok_pixel_id).trim();
      if (!/^[A-Za-z0-9]{15,25}$/.test(cleaned)) {
        return res.status(400).json({ error: 'TikTok Pixel ID must be alphanumeric (15-25 characters)' });
      }
      req.body.tiktok_pixel_id = cleaned;
    }
    if (additional_pixels) {
      for (const p of additional_pixels) {
        if (p.type === 'facebook' && !/^\d{13,16}$/.test(String(p.pixel_id || '').trim())) {
          return res.status(400).json({ error: `Invalid Facebook Pixel ID: ${p.pixel_id}` });
        }
        if (p.type === 'tiktok' && !/^[A-Za-z0-9]{15,25}$/.test(String(p.pixel_id || '').trim())) {
          return res.status(400).json({ error: `Invalid TikTok Pixel ID: ${p.pixel_id}` });
        }
      }
    }
    
    const pool = await getPool();
    
    const upsertResult = await pool.query(
      `INSERT INTO client_pixel_settings (
        client_id, facebook_pixel_id, facebook_access_token,
        tiktok_pixel_id, tiktok_access_token,
        is_facebook_enabled, is_tiktok_enabled,
        additional_pixels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (client_id) DO UPDATE SET
        facebook_pixel_id = EXCLUDED.facebook_pixel_id,
        facebook_access_token = CASE
          WHEN EXCLUDED.facebook_access_token IS NOT NULL THEN EXCLUDED.facebook_access_token
          ELSE client_pixel_settings.facebook_access_token
        END,
        tiktok_pixel_id = EXCLUDED.tiktok_pixel_id,
        tiktok_access_token = CASE
          WHEN EXCLUDED.tiktok_access_token IS NOT NULL THEN EXCLUDED.tiktok_access_token
          ELSE client_pixel_settings.tiktok_access_token
        END,
        is_facebook_enabled = EXCLUDED.is_facebook_enabled,
        is_tiktok_enabled = EXCLUDED.is_tiktok_enabled,
        additional_pixels = EXCLUDED.additional_pixels,
        updated_at = NOW()
      RETURNING *`,
      [
        clientId,
        facebook_pixel_id || null,
        facebook_access_token === '***configured***' ? null : (facebook_access_token || null),
        tiktok_pixel_id || null,
        tiktok_access_token === '***configured***' ? null : (tiktok_access_token || null),
        is_facebook_enabled ?? false,
        is_tiktok_enabled ?? false,
        JSON.stringify(additional_pixels || [])
      ]
    );
    
    const settings = upsertResult.rows[0];
    res.json({
      ...settings,
      facebook_access_token: settings.facebook_access_token ? '***configured***' : null,
      tiktok_access_token: settings.tiktok_access_token ? '***configured***' : null
    });
  } catch (error) {
    console.error("Update pixel settings error:", error);
    res.status(500).json({ error: "Failed to update pixel settings" });
  }
};

// =====================
// PIXEL EVENT TRACKING
// =====================

// Track a pixel event (called from storefront)
export const trackPixelEvent: RequestHandler = async (req, res) => {
  try {
    const {
      store_slug,
      pixel_type,
      event_name,
      event_data,
      page_url,
      session_id,
      visitor_id,
      product_id,
      order_id,
      revenue,
      currency
    } = req.body;
    
    if (!store_slug || !pixel_type || !event_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!VALID_EVENTS.includes(String(event_name))) {
      return res.status(400).json({ error: 'Invalid event name' });
    }
    
    if (!['facebook', 'tiktok', 'platform'].includes(pixel_type)) {
      return res.status(400).json({ error: 'Invalid pixel type' });
    }
    
    const pool = await getPool();

    // Normalize page path from page_url (for dedupe + analytics)
    let pagePath: string | null = null;
    if (typeof page_url === 'string' && page_url) {
      try {
        const u = new URL(page_url);
        pagePath = u.pathname || null;
      } catch {
        pagePath = null;
      }
    }
    
    // Get client_id from store_slug
    const clientId = await resolveClientIdByStoreSlug(String(store_slug));

    if (!clientId) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Check if pixel is enabled for this store (skip for platform-level analytics)
    const isPlatformTracking = pixel_type === 'platform';
    const pixelSettings = await pool.query(
      `SELECT * FROM client_pixel_settings WHERE client_id = $1`,
      [clientId]
    );
    
    if (!isPlatformTracking && pixelSettings.rows.length === 0) {
      return res.json({ tracked: false, reason: 'No pixel configured' });
    }
    
    const settings = pixelSettings.rows[0] || {};
    if (!isPlatformTracking && pixel_type === 'facebook' && !settings.is_facebook_enabled) {
      return res.json({ tracked: false, reason: 'Facebook pixel disabled' });
    }
    if (!isPlatformTracking && pixel_type === 'tiktok' && !settings.is_tiktok_enabled) {
      return res.json({ tracked: false, reason: 'TikTok pixel disabled' });
    }

    // De-duplicate noisy events (refresh, React strict-mode double effects, multiple mounts).
    // This keeps the dashboard usable and closer to “unique per session per page”.
    // Window: short TTL to still allow legitimate repeat navigation.
    const dedupeWindowMinutes = 10;
    if (session_id && (event_name === 'PageView' || event_name === 'ViewContent')) {
      const dedupeParams: any[] = [clientId, event_name, session_id];
      let dedupeWhere = `client_id = $1 AND event_name = $2 AND session_id = $3 AND created_at > NOW() - INTERVAL '${dedupeWindowMinutes} minutes'`;

      if (event_name === 'PageView' && pagePath) {
        dedupeWhere += ` AND (event_data->>'page_path') = $4`;
        dedupeParams.push(pagePath);
      }

      if (event_name === 'ViewContent' && product_id) {
        dedupeWhere += ` AND product_id = $4`;
        dedupeParams.push(product_id);
      }

      // Only dedupe when we have a stable key (page_path for PageView, product_id for ViewContent)
      const shouldDedupe =
        (event_name === 'PageView' && Boolean(pagePath)) ||
        (event_name === 'ViewContent' && Boolean(product_id));

      if (shouldDedupe) {
        const exists = await pool.query(
          `SELECT 1 FROM pixel_events WHERE ${dedupeWhere} LIMIT 1`,
          dedupeParams
        );
        if (exists.rows.length > 0) {
          return res.json({ tracked: false, reason: 'Deduped' });
        }
      }
    }
    
    // Get IP and User Agent
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Insert event
    const mergedEventData = {
      ...(event_data && typeof event_data === 'object' ? event_data : {}),
      ...(pagePath ? { page_path: pagePath } : {}),
    };

    await pool.query(
      `INSERT INTO pixel_events (
        client_id, pixel_type, event_name, event_data, page_url,
        user_agent, ip_address, session_id, visitor_id,
        product_id, order_id, revenue, currency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        clientId,
        pixel_type,
        event_name,
        JSON.stringify(mergedEventData),
        page_url || null,
        userAgent,
        ip ? String(ip).split(',')[0].trim() : null,
        session_id || null,
        visitor_id || null,
        product_id || null,
        order_id || null,
        revenue || null,
        currency || 'DZD'
      ]
    );
    
    // Update daily stats
    await updateDailyStats(clientId, pixel_type, event_name, revenue);

    // Increment product view count when a ViewContent event is recorded
    if (event_name === 'ViewContent' && product_id) {
      pool.query(
        `UPDATE client_store_products SET views = views + 1 WHERE id = $1 AND client_id = $2`,
        [product_id, clientId]
      ).catch(() => {});
    }

    try {
      await upsertAnalyticSessionFromEvent({
        clientId,
        storeSlug: String(store_slug),
        pixelType: String(pixel_type),
        eventName: String(event_name),
        eventData: mergedEventData,
        pageUrl: page_url || null,
        sessionId: session_id || null,
        visitorId: visitor_id || null,
        productId: product_id || null,
        orderId: order_id || null,
        revenue: revenue || null,
        currency: currency || 'DZD',
        userAgent: userAgent ? String(userAgent) : null,
        ipAddress: ip ? String(ip).split(',')[0].trim() : null,
      });
    } catch (sessionError) {
      console.error('[Pixels] Failed to upsert analytic session from event:', sessionError);
    }
    
    res.json({ tracked: true });
  } catch (error) {
    console.error("Track pixel event error:", error);
    res.status(500).json({ error: "Failed to track event" });
  }
};

// Helper to update daily aggregated stats
async function updateDailyStats(clientId: number, pixelType: string, eventName: string, revenue?: number) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Map event names to stat columns
    const eventColumnMap: Record<string, string> = {
      'PageView': 'page_views',
      'ViewContent': 'view_content',
      'AddToCart': 'add_to_cart',
      'InitiateCheckout': 'initiate_checkout',
      'Purchase': 'purchases'
    };
    
    const column = eventColumnMap[eventName];
    if (!column) return;
    
    const pool = await getPool();
    
    // Upsert daily stats
    let query = `
      INSERT INTO pixel_stats_daily (client_id, pixel_type, stat_date, ${column}, total_revenue)
      VALUES ($1, $2, $3, 1, $4)
      ON CONFLICT (client_id, pixel_type, stat_date) DO UPDATE SET
        ${column} = pixel_stats_daily.${column} + 1,
        total_revenue = pixel_stats_daily.total_revenue + COALESCE($4, 0),
        updated_at = NOW()
    `;
    
    const revenueToAdd = eventName === 'Purchase' ? (revenue || 0) : 0;
    await pool.query(query, [clientId, pixelType, today, revenueToAdd]);
  } catch (error) {
    console.error("Update daily stats error:", error);
  }
}

// Track live session behavior snapshots from the storefront.
export const trackSessionSummary: RequestHandler = async (req, res) => {
  try {
    const parsed = sessionSummarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid session payload', details: parsed.error.flatten() });
    }

    const {
      store_slug,
      session_id,
      visitor_id,
      page_url,
      page_path,
      max_scroll_depth,
      active_time_seconds,
      locale,
      referrer,
      source,
      medium,
      campaign_name,
      ended,
    } = parsed.data;

    const clientId = await resolveClientIdByStoreSlug(store_slug);
    if (!clientId) {
      return res.status(404).json({ error: 'Store not found' });
    }

    await upsertAnalyticSessionSummary({
      clientId,
      storeSlug: store_slug,
      sessionId: session_id,
      visitorId: visitor_id || null,
      pageUrl: page_url || null,
      pagePath: page_path || null,
      maxScrollDepth: max_scroll_depth ?? 0,
      activeTimeSeconds: active_time_seconds ?? 0,
      locale: locale || null,
      referrer: referrer || null,
      source: source || null,
      medium: medium || null,
      campaignName: campaign_name || null,
      ended: ended === true,
    });

    return res.json({ tracked: true });
  } catch (error) {
    console.error('Track session summary error:', error);
    return res.status(500).json({ error: 'Failed to track session summary' });
  }
};

// =====================
// PIXEL STATISTICS
// =====================

// Get pixel statistics for client dashboard
export const getPixelStats: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const clientId = user.id;
    const { days = 30, pixel_type } = req.query;
    const numDays = Math.min(90, Math.max(1, parseInt(String(days)) || 30));
    
    const pool = await getPool();
    
    // Get daily stats for the period
    let statsQuery = `
      SELECT 
        stat_date,
        pixel_type,
        page_views,
        view_content,
        add_to_cart,
        initiate_checkout,
        purchases,
        total_revenue
      FROM pixel_stats_daily
      WHERE client_id = $1 
        AND stat_date >= CURRENT_DATE - INTERVAL '${numDays} days'
    `;
    
    const params: any[] = [clientId];
    if (pixel_type && ['facebook', 'tiktok'].includes(String(pixel_type))) {
      statsQuery += ` AND pixel_type = $2`;
      params.push(pixel_type);
    }
    
    statsQuery += ` ORDER BY stat_date DESC`;
    
    const statsResult = await pool.query(statsQuery, params);
    
    // Get totals
    const totalsQuery = `
      SELECT 
        pixel_type,
        SUM(page_views) as total_page_views,
        SUM(view_content) as total_view_content,
        SUM(add_to_cart) as total_add_to_cart,
        SUM(initiate_checkout) as total_initiate_checkout,
        SUM(purchases) as total_purchases,
        SUM(total_revenue) as total_revenue
      FROM pixel_stats_daily
      WHERE client_id = $1 
        AND stat_date >= CURRENT_DATE - INTERVAL '${numDays} days'
      GROUP BY pixel_type
    `;
    
    const totalsResult = await pool.query(totalsQuery, [clientId]);
    
    // Calculate conversion rates
    const facebookTotals = totalsResult.rows.find(r => r.pixel_type === 'facebook') || {};
    const tiktokTotals = totalsResult.rows.find(r => r.pixel_type === 'tiktok') || {};
    const platformTotals = totalsResult.rows.find(r => r.pixel_type === 'platform') || {};

    // Merge platform into facebook+tiktok so dashboard always shows data
    // even when no external pixel is configured
    const mergeTotals = (specific: any, platform: any) => ({
      total_page_views: (parseInt(specific.total_page_views) || 0) + (parseInt(platform.total_page_views) || 0),
      total_view_content: (parseInt(specific.total_view_content) || 0) + (parseInt(platform.total_view_content) || 0),
      total_add_to_cart: (parseInt(specific.total_add_to_cart) || 0) + (parseInt(platform.total_add_to_cart) || 0),
      total_initiate_checkout: (parseInt(specific.total_initiate_checkout) || 0) + (parseInt(platform.total_initiate_checkout) || 0),
      total_purchases: (parseInt(specific.total_purchases) || 0) + (parseInt(platform.total_purchases) || 0),
      total_revenue: (parseFloat(specific.total_revenue) || 0) + (parseFloat(platform.total_revenue) || 0),
    });

    const fbMerged = Object.keys(facebookTotals).length > 0 ? mergeTotals(facebookTotals, {}) : mergeTotals({}, platformTotals);
    const ttMerged = Object.keys(tiktokTotals).length > 0 ? mergeTotals(tiktokTotals, {}) : mergeTotals({}, platformTotals);
    
    const calcConversionRate = (purchases: number, pageViews: number) => {
      if (!pageViews || pageViews === 0) return 0;
      return ((purchases / pageViews) * 100).toFixed(2);
    };
    
    const calcCartRate = (addToCart: number, viewContent: number) => {
      if (!viewContent || viewContent === 0) return 0;
      return ((addToCart / viewContent) * 100).toFixed(2);
    };
    
    res.json({
      period_days: numDays,
      daily_stats: statsResult.rows,
      platform: {
        ...platformTotals,
        conversion_rate: calcConversionRate(
          parseInt(platformTotals.total_purchases) || 0,
          parseInt(platformTotals.total_page_views) || 0
        ),
        cart_rate: calcCartRate(
          parseInt(platformTotals.total_add_to_cart) || 0,
          parseInt(platformTotals.total_view_content) || 0
        )
      },
      facebook: {
        ...fbMerged,
        conversion_rate: calcConversionRate(fbMerged.total_purchases, fbMerged.total_page_views),
        cart_rate: calcCartRate(fbMerged.total_add_to_cart, fbMerged.total_view_content)
      },
      tiktok: {
        ...ttMerged,
        conversion_rate: calcConversionRate(ttMerged.total_purchases, ttMerged.total_page_views),
        cart_rate: calcCartRate(ttMerged.total_add_to_cart, ttMerged.total_view_content)
      }
    });
  } catch (error) {
    console.error("Get pixel stats error:", error);
    res.status(500).json({ error: "Failed to fetch pixel statistics" });
  }
};

// Get recent pixel events for debugging
export const getRecentPixelEvents: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const clientId = user.id;
    const { limit = 50, pixel_type, event_name } = req.query;
    const numLimit = Math.min(200, Math.max(1, parseInt(String(limit)) || 50));
    
    const pool = await getPool();
    
    let query = `
      SELECT 
        id, pixel_type, event_name, event_data, page_url,
        product_id, order_id, revenue, currency, created_at
      FROM pixel_events
      WHERE client_id = $1
    `;
    
    const params: any[] = [clientId];
    let paramCount = 2;
    
    if (pixel_type && ['facebook', 'tiktok'].includes(String(pixel_type))) {
      query += ` AND pixel_type = $${paramCount++}`;
      params.push(pixel_type);
    }
    
    if (event_name) {
      query += ` AND event_name = $${paramCount++}`;
      params.push(event_name);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(numLimit);
    
    const result = await pool.query(query, params);
    
    res.json({
      events: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Get recent pixel events error:", error);
    res.status(500).json({ error: "Failed to fetch recent events" });
  }
};

// Get funnel analysis
export const getPixelFunnel: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const clientId = user.id;
    const { days = 30, pixel_type = 'facebook' } = req.query;
    const numDays = Math.min(90, Math.max(1, parseInt(String(days)) || 30));
    
    const pool = await getPool();
    
    // Get funnel data
    const funnelQuery = `
      SELECT 
        SUM(page_views) as page_views,
        SUM(view_content) as view_content,
        SUM(add_to_cart) as add_to_cart,
        SUM(initiate_checkout) as initiate_checkout,
        SUM(purchases) as purchases,
        SUM(total_revenue) as total_revenue
      FROM pixel_stats_daily
      WHERE client_id = $1 
        AND pixel_type = $2
        AND stat_date >= CURRENT_DATE - INTERVAL '${numDays} days'
    `;
    
    const result = await pool.query(funnelQuery, [clientId, pixel_type]);
    const data = result.rows[0] || {};
    
    const pageViews = parseInt(data.page_views) || 0;
    const viewContent = parseInt(data.view_content) || 0;
    const addToCart = parseInt(data.add_to_cart) || 0;
    const initiateCheckout = parseInt(data.initiate_checkout) || 0;
    const purchases = parseInt(data.purchases) || 0;
    
    res.json({
      pixel_type,
      period_days: numDays,
      funnel: [
        { stage: 'Page Views', count: pageViews, rate: 100 },
        { stage: 'View Content', count: viewContent, rate: pageViews ? ((viewContent / pageViews) * 100).toFixed(1) : 0 },
        { stage: 'Add to Cart', count: addToCart, rate: viewContent ? ((addToCart / viewContent) * 100).toFixed(1) : 0 },
        { stage: 'Checkout', count: initiateCheckout, rate: addToCart ? ((initiateCheckout / addToCart) * 100).toFixed(1) : 0 },
        { stage: 'Purchase', count: purchases, rate: initiateCheckout ? ((purchases / initiateCheckout) * 100).toFixed(1) : 0 }
      ],
      total_revenue: parseFloat(data.total_revenue) || 0,
      avg_order_value: purchases > 0 ? ((parseFloat(data.total_revenue) || 0) / purchases).toFixed(2) : 0
    });
  } catch (error) {
    console.error("Get pixel funnel error:", error);
    res.status(500).json({ error: "Failed to fetch funnel data" });
  }
};

// =====================
// OMNI INTELLIGENCE
// =====================

export const getOmniOverviewHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const numDays = Math.min(3650, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const snapshot = await getOmniOverview(user.id, numDays);
    return res.json(snapshot);
  } catch (error) {
    console.error('Get Omni overview error:', error);
    return res.status(500).json({ error: 'Failed to fetch Omni overview' });
  }
};

export const getCustomerAnalyticsHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const numDays = Math.min(3650, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const analytics = await getCustomerAnalytics(user.id, numDays);
    return res.json(analytics);
  } catch (error) {
    console.error('Get customer analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch customer analytics' });
  }
};

export const getGenderAnalyticsHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const numDays = Math.min(3650, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const analytics = await getGenderAnalytics(user.id, numDays);
    return res.json(analytics);
  } catch (error) {
    console.error('Get gender analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch gender analytics' });
  }
};

export const getOmniInputsHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const inputs = await getOmniInputs(user.id);
    return res.json(inputs);
  } catch (error) {
    console.error('Get Omni inputs error:', error);
    return res.status(500).json({ error: 'Failed to fetch Omni inputs' });
  }
};

export const saveProductEconomicsHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parsed = productEconomicsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid product economics payload', details: parsed.error.flatten() });
    }

    const row = await upsertProductEconomics(user.id, parsed.data);
    return res.json(row);
  } catch (error) {
    console.error('Save product economics error:', error);
    return res.status(500).json({ error: 'Failed to save product economics' });
  }
};

export const saveCreativeCatalogHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parsed = creativeCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid creative payload', details: parsed.error.flatten() });
    }

    const row = await upsertCreativeCatalogEntry(user.id, parsed.data);
    return res.json(row);
  } catch (error) {
    console.error('Save creative catalog error:', error);
    return res.status(500).json({ error: 'Failed to save creative metadata' });
  }
};

export const deleteCreativeCatalogHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const entryId = Number(req.params.id);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return res.status(400).json({ error: 'Invalid creative id' });
    }

    await deleteCreativeCatalogEntry(user.id, entryId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete creative catalog error:', error);
    return res.status(500).json({ error: 'Failed to delete creative metadata' });
  }
};

export const saveCreativeSpendHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parsed = creativeSpendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid spend payload', details: parsed.error.flatten() });
    }

    const row = await upsertCreativeSpendEntry(user.id, parsed.data);
    return res.json(row);
  } catch (error) {
    console.error('Save creative spend error:', error);
    return res.status(500).json({ error: 'Failed to save ad spend' });
  }
};

export const deleteCreativeSpendHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const entryId = Number(req.params.id);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      return res.status(400).json({ error: 'Invalid spend entry id' });
    }

    await deleteCreativeSpendEntry(user.id, entryId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete creative spend error:', error);
    return res.status(500).json({ error: 'Failed to delete spend entry' });
  }
};

export const backfillHistoricalSessionsHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parsed = historicalImportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid historical import payload', details: parsed.error.flatten() });
    }

    const result = await backfillHistoricalSessions(user.id, parsed.data.days);
    return res.json(result);
  } catch (error) {
    console.error('Backfill historical sessions error:', error);
    return res.status(500).json({ error: 'Failed to backfill historical sessions' });
  }
};

export const getProductPerformanceHandler: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role === 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const numDays = Math.min(3650, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const products = await getProductPerformance(user.id, numDays);
    return res.json({ products });
  } catch (error) {
    console.error('Get product performance error:', error);
    return res.status(500).json({ error: 'Failed to fetch product performance' });
  }
};

// Get public pixel config by store slug (for frontend script injection - no auth)
export const getPublicPixelConfig: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    
    if (!storeSlug) {
      return res.status(400).json({ error: 'Store slug required' });
    }
    
    const pool = await getPool();
    const clientId = await resolveClientIdByStoreSlug(storeSlug);

    if (!clientId) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Get pixel settings
    const pixelSettings = await pool.query(
      `SELECT facebook_pixel_id, tiktok_pixel_id, is_facebook_enabled, is_tiktok_enabled, additional_pixels
       FROM client_pixel_settings WHERE client_id = $1`,
      [clientId]
    );
    
    if (pixelSettings.rows.length === 0) {
      return res.json({ 
        facebook_pixel_id: null, 
        tiktok_pixel_id: null,
        is_facebook_enabled: false,
        is_tiktok_enabled: false
      });
    }
    
    const settings = pixelSettings.rows[0];
    
    // Merge additional_pixels into the main pixel IDs (comma-separated)
    let fbIds = settings.is_facebook_enabled ? (settings.facebook_pixel_id || '') : '';
    let ttIds = settings.is_tiktok_enabled ? (settings.tiktok_pixel_id || '') : '';
    
    if (settings.additional_pixels && Array.isArray(settings.additional_pixels)) {
      for (const px of settings.additional_pixels) {
        if (px.enabled !== false && px.pixel_id) {
          if (px.type === 'facebook' && settings.is_facebook_enabled) {
            fbIds = fbIds ? `${fbIds},${px.pixel_id}` : px.pixel_id;
          } else if (px.type === 'tiktok' && settings.is_tiktok_enabled) {
            ttIds = ttIds ? `${ttIds},${px.pixel_id}` : px.pixel_id;
          }
        }
      }
    }
    
    res.json({
      facebook_pixel_id: fbIds || null,
      tiktok_pixel_id: ttIds || null,
      is_facebook_enabled: settings.is_facebook_enabled,
      is_tiktok_enabled: settings.is_tiktok_enabled
    });
  } catch (error) {
    console.error("Get public pixel config error:", error);
    res.status(500).json({ error: "Failed to fetch pixel config" });
  }
};

// =====================
// ROUTES
// =====================

// Protected routes (require auth + client role)
router.get('/settings', authenticate, requireClient, getPixelSettings);
router.put('/settings', authenticate, requireClient, updatePixelSettings);
router.get('/stats', authenticate, requireClient, getPixelStats);
router.get('/events', authenticate, requireClient, getRecentPixelEvents);
router.get('/funnel', authenticate, requireClient, getPixelFunnel);
router.get('/omni/overview', authenticate, requireClient, getOmniOverviewHandler);
router.get('/omni/customers', authenticate, requireClient, getCustomerAnalyticsHandler);
router.get('/omni/gender', authenticate, requireClient, getGenderAnalyticsHandler);
router.get('/omni/inputs', authenticate, requireClient, getOmniInputsHandler);
router.get('/omni/products', authenticate, requireClient, getProductPerformanceHandler);
router.put('/omni/product-economics', authenticate, requireClient, saveProductEconomicsHandler);
router.post('/omni/creative-catalog', authenticate, requireClient, saveCreativeCatalogHandler);
router.delete('/omni/creative-catalog/:id', authenticate, requireClient, deleteCreativeCatalogHandler);
router.post('/omni/creative-spend', authenticate, requireClient, saveCreativeSpendHandler);
router.delete('/omni/creative-spend/:id', authenticate, requireClient, deleteCreativeSpendHandler);
router.post('/omni/import-historical-sessions', authenticate, requireClient, backfillHistoricalSessionsHandler);

// Public routes (no auth required)
router.post('/track', trackPixelEvent);
router.post('/session', trackSessionSummary);
router.get('/config/:storeSlug', getPublicPixelConfig);

export default router;
