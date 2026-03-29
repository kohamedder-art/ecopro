import crypto from 'crypto';
import { ensureConnection } from '../utils/database';

type NullableText = string | null | undefined;

const SUCCESS_ORDER_STATUSES = new Set(['delivered', 'completed']);
const RETURNED_ORDER_STATUSES = new Set(['returned', 'failed', 'delivery_failed', 'didnt_pickup']);
const EXCLUDED_BOOKED_ORDER_STATUSES = new Set(['cancelled', 'declined', 'fake', 'duplicate', 'refunded']);

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalText(value: NullableText): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function toSafeInt(value: unknown): number {
  const parsed = Math.round(toNumber(value));
  return parsed >= 0 ? parsed : 0;
}

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function parsePagePath(pageUrl?: NullableText, pagePath?: NullableText): string | null {
  const explicit = toOptionalText(pagePath);
  if (explicit) return explicit;
  const candidate = toOptionalText(pageUrl);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.pathname || null;
  } catch {
    return candidate.startsWith('/') ? candidate : null;
  }
}

function inferDeviceType(userAgent?: NullableText): string | null {
  const ua = String(userAgent ?? '').toLowerCase();
  if (!ua) return null;
  if (/mobile|iphone|android(?!.*tablet)/.test(ua)) return 'mobile';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  return 'desktop';
}

function hashIp(ipAddress?: NullableText): string | null {
  const ip = toOptionalText(ipAddress);
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function normalizePlatform(value?: NullableText): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['facebook', 'instagram'].includes(normalized)) return 'facebook';
  if (['tiktok', 'tik tok'].includes(normalized)) return 'tiktok';
  return normalized;
}

export function buildCreativeKey(input: {
  platform?: NullableText;
  campaignName?: NullableText;
  adsetName?: NullableText;
  creativeName?: NullableText;
}): string | null {
  const parts = [
    normalizePlatform(input.platform),
    toOptionalText(input.campaignName)?.toLowerCase(),
    toOptionalText(input.adsetName)?.toLowerCase(),
    toOptionalText(input.creativeName)?.toLowerCase(),
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return parts.join('::');
}

function classifySessionRow(row: {
  purchase_count?: unknown;
  checkout_count?: unknown;
  add_to_cart_count?: unknown;
  product_views?: unknown;
  page_views?: unknown;
  active_time_seconds?: unknown;
  max_scroll_depth?: unknown;
  exit_page?: NullableText;
}) {
  const purchases = toSafeInt(row.purchase_count);
  const checkout = toSafeInt(row.checkout_count);
  const addToCart = toSafeInt(row.add_to_cart_count);
  const productViews = toSafeInt(row.product_views);
  const pageViews = toSafeInt(row.page_views);
  const activeTime = toSafeInt(row.active_time_seconds);
  const scrollDepth = toSafeInt(row.max_scroll_depth);
  const exitPage = String(row.exit_page ?? '').toLowerCase();

  if (purchases > 0) {
    return { label: 'Converted', reason: 'The session completed a purchase.' };
  }

  if (checkout > 0 || addToCart > 0 || exitPage.includes('checkout')) {
    return {
      label: 'Shipping/Payment Friction',
      reason: 'The visitor showed buying intent but dropped before purchase, usually around shipping, payment, or trust at checkout.',
    };
  }

  if (productViews > 0 && scrollDepth >= 60 && activeTime >= 45) {
    return {
      label: 'High Interest, Price/Trust Friction',
      reason: 'The visitor stayed engaged on the product page without moving into cart, which usually points to price, proof, or trust friction.',
    };
  }

  if (pageViews <= 1 && activeTime < 20) {
    return {
      label: 'Ad/Creative Mismatch',
      reason: 'The landing did not hold attention long enough, which usually means the ad promise and page experience are misaligned.',
    };
  }

  return {
    label: 'Low-Confidence Drop-Off',
    reason: 'The session ended without enough engagement data to identify a stronger friction cause.',
  };
}

export interface AnalyticEventInput {
  clientId: number;
  storeSlug: string;
  pixelType: string;
  eventName: string;
  eventData?: Record<string, any> | null;
  pageUrl?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  productId?: number | null;
  orderId?: number | null;
  revenue?: number | null;
  currency?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

async function saveSessionTouch(sessionDbId: string | number, clientId: number, data: {
  pixelType?: NullableText;
  source?: NullableText;
  medium?: NullableText;
  campaignName?: NullableText;
  adsetName?: NullableText;
  creativeName?: NullableText;
  landingPage?: NullableText;
  fbclid?: NullableText;
  ttclid?: NullableText;
  gclid?: NullableText;
}) {
  const creativeKey = buildCreativeKey({
    platform: data.pixelType,
    campaignName: data.campaignName,
    adsetName: data.adsetName,
    creativeName: data.creativeName,
  });

  const hasTouchData = [data.pixelType, data.source, data.medium, data.campaignName, data.creativeName, data.fbclid, data.ttclid, data.gclid].some(Boolean);
  if (!hasTouchData) return;

  const db = await ensureConnection();
  await db.query(
    `INSERT INTO analytic_session_touches (
       analytic_session_id, client_id, touch_position, platform, source, medium,
       campaign_name, adset_name, creative_name, creative_key, landing_page,
       fbclid, ttclid, gclid, is_entry, created_at, updated_at
     ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), NOW())
     ON CONFLICT (client_id, analytic_session_id, touch_position) DO UPDATE SET
       platform = COALESCE(analytic_session_touches.platform, EXCLUDED.platform),
       source = COALESCE(analytic_session_touches.source, EXCLUDED.source),
       medium = COALESCE(analytic_session_touches.medium, EXCLUDED.medium),
       campaign_name = COALESCE(analytic_session_touches.campaign_name, EXCLUDED.campaign_name),
       adset_name = COALESCE(analytic_session_touches.adset_name, EXCLUDED.adset_name),
       creative_name = COALESCE(analytic_session_touches.creative_name, EXCLUDED.creative_name),
       creative_key = COALESCE(analytic_session_touches.creative_key, EXCLUDED.creative_key),
       landing_page = COALESCE(analytic_session_touches.landing_page, EXCLUDED.landing_page),
       fbclid = COALESCE(analytic_session_touches.fbclid, EXCLUDED.fbclid),
       ttclid = COALESCE(analytic_session_touches.ttclid, EXCLUDED.ttclid),
       gclid = COALESCE(analytic_session_touches.gclid, EXCLUDED.gclid),
       updated_at = NOW()`,
    [
      sessionDbId,
      clientId,
      normalizePlatform(data.pixelType),
      toOptionalText(data.source),
      toOptionalText(data.medium),
      toOptionalText(data.campaignName),
      toOptionalText(data.adsetName),
      toOptionalText(data.creativeName),
      creativeKey,
      toOptionalText(data.landingPage),
      toOptionalText(data.fbclid),
      toOptionalText(data.ttclid),
      toOptionalText(data.gclid),
    ]
  );
}

async function persistSessionDiagnostic(sessionDbId: string | number, row: any) {
  const db = await ensureConnection();
  const diagnostic = classifySessionRow(row);
  await db.query(
    `UPDATE analytic_sessions
     SET diagnostic_label = $2,
         diagnostic_reason = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [sessionDbId, diagnostic.label, diagnostic.reason]
  );
}

export async function upsertAnalyticSessionFromEvent(input: AnalyticEventInput) {
  const sessionId = toOptionalText(input.sessionId);
  if (!sessionId) return null;

  const eventData = input.eventData && typeof input.eventData === 'object' ? input.eventData : {};
  const pagePath = parsePagePath(input.pageUrl, eventData.page_path);
  const source = toOptionalText(eventData.source) || toOptionalText(eventData.utm_source) || normalizePlatform(input.pixelType) || 'direct';
  const medium = toOptionalText(eventData.utm_medium) || (normalizePlatform(input.pixelType) ? 'paid_social' : null);
  const campaignName = toOptionalText(eventData.utm_campaign || eventData.campaign_name);
  const adsetName = toOptionalText(eventData.adset_name);
  const creativeName = toOptionalText(eventData.creative_name || eventData.ad_name);
  const locale = toOptionalText(eventData.locale);
  const pageViews = input.eventName === 'PageView' ? 1 : 0;
  const productViews = input.eventName === 'ViewContent' ? 1 : 0;
  const addToCartCount = input.eventName === 'AddToCart' ? 1 : 0;
  const checkoutCount = input.eventName === 'InitiateCheckout' ? 1 : 0;
  const purchaseCount = input.eventName === 'Purchase' ? 1 : 0;

  const db = await ensureConnection();
  const result = await db.query(
    `INSERT INTO analytic_sessions (
       client_id, store_slug, session_id, visitor_id, status,
       first_seen_at, last_seen_at, landing_page, exit_page,
       entry_referrer, entry_source, entry_medium, entry_campaign,
       entry_content, entry_term, platform_hint,
       page_views, product_views, add_to_cart_count, checkout_count, purchase_count,
       max_scroll_depth, active_time_seconds,
       last_event_name, last_page_url, last_product_id, last_order_id,
       device_type, locale, ip_hash, is_partial, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       NOW(), NOW(), $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14,
       $15, $16, $17, $18, $19,
       0, 0,
       $20, $21, $22, $23,
       $24, $25, $26, false, NOW(), NOW()
     )
     ON CONFLICT (client_id, session_id) DO UPDATE SET
       visitor_id = COALESCE(analytic_sessions.visitor_id, EXCLUDED.visitor_id),
       status = CASE WHEN EXCLUDED.purchase_count > 0 THEN 'completed' ELSE analytic_sessions.status END,
       last_seen_at = NOW(),
       ended_at = CASE WHEN EXCLUDED.purchase_count > 0 THEN NOW() ELSE analytic_sessions.ended_at END,
       landing_page = COALESCE(analytic_sessions.landing_page, EXCLUDED.landing_page),
       exit_page = COALESCE(EXCLUDED.exit_page, analytic_sessions.exit_page),
       entry_referrer = COALESCE(analytic_sessions.entry_referrer, EXCLUDED.entry_referrer),
       entry_source = COALESCE(analytic_sessions.entry_source, EXCLUDED.entry_source),
       entry_medium = COALESCE(analytic_sessions.entry_medium, EXCLUDED.entry_medium),
       entry_campaign = COALESCE(analytic_sessions.entry_campaign, EXCLUDED.entry_campaign),
       entry_content = COALESCE(analytic_sessions.entry_content, EXCLUDED.entry_content),
       entry_term = COALESCE(analytic_sessions.entry_term, EXCLUDED.entry_term),
       platform_hint = COALESCE(analytic_sessions.platform_hint, EXCLUDED.platform_hint),
       page_views = analytic_sessions.page_views + EXCLUDED.page_views,
       product_views = analytic_sessions.product_views + EXCLUDED.product_views,
       add_to_cart_count = analytic_sessions.add_to_cart_count + EXCLUDED.add_to_cart_count,
       checkout_count = analytic_sessions.checkout_count + EXCLUDED.checkout_count,
       purchase_count = analytic_sessions.purchase_count + EXCLUDED.purchase_count,
       last_event_name = EXCLUDED.last_event_name,
       last_page_url = COALESCE(EXCLUDED.last_page_url, analytic_sessions.last_page_url),
       last_product_id = COALESCE(EXCLUDED.last_product_id, analytic_sessions.last_product_id),
       last_order_id = COALESCE(EXCLUDED.last_order_id, analytic_sessions.last_order_id),
       device_type = COALESCE(analytic_sessions.device_type, EXCLUDED.device_type),
       locale = COALESCE(EXCLUDED.locale, analytic_sessions.locale),
       ip_hash = COALESCE(analytic_sessions.ip_hash, EXCLUDED.ip_hash),
       updated_at = NOW()
     RETURNING id, page_views, product_views, add_to_cart_count, checkout_count, purchase_count, max_scroll_depth, active_time_seconds, exit_page`,
    [
      input.clientId,
      input.storeSlug,
      sessionId,
      toOptionalText(input.visitorId),
      purchaseCount > 0 ? 'completed' : 'live',
      pagePath,
      pagePath,
      toOptionalText(eventData.referrer),
      source,
      medium,
      campaignName,
      toOptionalText(eventData.utm_content),
      toOptionalText(eventData.utm_term),
      normalizePlatform(input.pixelType),
      pageViews,
      productViews,
      addToCartCount,
      checkoutCount,
      purchaseCount,
      input.eventName,
      toOptionalText(input.pageUrl),
      input.productId || null,
      input.orderId || null,
      inferDeviceType(input.userAgent),
      locale,
      hashIp(input.ipAddress),
    ]
  );

  const row = result.rows[0];
  if (!row) return null;

  await saveSessionTouch(row.id, input.clientId, {
    pixelType: input.pixelType,
    source,
    medium,
    campaignName,
    adsetName,
    creativeName,
    landingPage: pagePath,
    fbclid: eventData.fbclid,
    ttclid: eventData.ttclid,
    gclid: eventData.gclid,
  });
  await persistSessionDiagnostic(row.id, row);

  return row.id;
}

export async function upsertAnalyticSessionSummary(input: {
  clientId: number;
  storeSlug: string;
  sessionId?: string | null;
  visitorId?: string | null;
  pageUrl?: string | null;
  pagePath?: string | null;
  maxScrollDepth?: number | null;
  activeTimeSeconds?: number | null;
  locale?: string | null;
  referrer?: string | null;
  source?: string | null;
  medium?: string | null;
  campaignName?: string | null;
  ended?: boolean;
}) {
  const sessionId = toOptionalText(input.sessionId);
  if (!sessionId) return null;

  const pagePath = parsePagePath(input.pageUrl, input.pagePath);
  const db = await ensureConnection();
  const result = await db.query(
    `INSERT INTO analytic_sessions (
       client_id, store_slug, session_id, visitor_id, status,
       first_seen_at, last_seen_at, ended_at,
       landing_page, exit_page,
       entry_referrer, entry_source, entry_medium, entry_campaign,
       max_scroll_depth, active_time_seconds,
       last_page_url, locale, is_partial, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       NOW(), NOW(), CASE WHEN $6 THEN NOW() ELSE NULL END,
       $7, $8,
       $9, $10, $11, $12,
       $13, $14,
       $15, $16, false, NOW(), NOW()
     )
     ON CONFLICT (client_id, session_id) DO UPDATE SET
       visitor_id = COALESCE(analytic_sessions.visitor_id, EXCLUDED.visitor_id),
       status = CASE WHEN $6 THEN 'completed' ELSE analytic_sessions.status END,
       last_seen_at = NOW(),
       ended_at = CASE WHEN $6 THEN NOW() ELSE analytic_sessions.ended_at END,
       landing_page = COALESCE(analytic_sessions.landing_page, EXCLUDED.landing_page),
       exit_page = COALESCE(EXCLUDED.exit_page, analytic_sessions.exit_page),
       entry_referrer = COALESCE(analytic_sessions.entry_referrer, EXCLUDED.entry_referrer),
       entry_source = COALESCE(analytic_sessions.entry_source, EXCLUDED.entry_source),
       entry_medium = COALESCE(analytic_sessions.entry_medium, EXCLUDED.entry_medium),
       entry_campaign = COALESCE(analytic_sessions.entry_campaign, EXCLUDED.entry_campaign),
       max_scroll_depth = GREATEST(analytic_sessions.max_scroll_depth, EXCLUDED.max_scroll_depth),
       active_time_seconds = analytic_sessions.active_time_seconds + EXCLUDED.active_time_seconds,
       last_page_url = COALESCE(EXCLUDED.last_page_url, analytic_sessions.last_page_url),
       locale = COALESCE(EXCLUDED.locale, analytic_sessions.locale),
       updated_at = NOW()
     RETURNING id, page_views, product_views, add_to_cart_count, checkout_count, purchase_count, max_scroll_depth, active_time_seconds, exit_page`,
    [
      input.clientId,
      input.storeSlug,
      sessionId,
      toOptionalText(input.visitorId),
      input.ended ? 'completed' : 'live',
      Boolean(input.ended),
      pagePath,
      pagePath,
      toOptionalText(input.referrer),
      toOptionalText(input.source),
      toOptionalText(input.medium),
      toOptionalText(input.campaignName),
      toSafeInt(input.maxScrollDepth),
      toSafeInt(input.activeTimeSeconds),
      toOptionalText(input.pageUrl),
      toOptionalText(input.locale),
    ]
  );

  const row = result.rows[0];
  if (!row) return null;
  await persistSessionDiagnostic(row.id, row);
  return row.id;
}

export interface OmniRecommendation {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  action: string;
}

export interface OmniOverviewResponse {
  periodDays: number;
  overview: {
    sessions: number;
    partialSessions: number;
    productViews: number;
    addToCart: number;
    checkout: number;
    purchases: number;
    bookedRevenue: number;
    realizedRevenue: number;
    adSpend: number;
    grossProfit: number;
    netProfit: number;
    poas: number | null;
    deliveredOrders: number;
    returnedOrders: number;
    toxicCreativeCount: number;
    avgActiveTimeSeconds: number;
    avgScrollDepth: number;
    unattributedOrders: number;
    missingEconomicsProducts: number;
  };
  funnel: Array<{ label: string; value: number; rate: number }>;
  frictionClusters: Array<{
    label: string;
    sessions: number;
    share: number;
    avgScrollDepth: number;
    avgActiveTimeSeconds: number;
    topExitPage: string | null;
    topProductTitle: string | null;
    topSource: string | null;
    reason: string;
  }>;
  creativeComparison: Array<{
    key: string;
    platform: string | null;
    campaignName: string | null;
    adsetName: string | null;
    creativeName: string | null;
    landingPage: string | null;
    promiseAngle: string | null;
    sessions: number;
    productViews: number;
    addToCart: number;
    checkout: number;
    purchases: number;
    bookedRevenue: number;
    realizedRevenue: number;
    spend: number;
    grossProfit: number;
    netProfit: number;
    poas: number | null;
    deliveredOrders: number;
    returnedOrders: number;
    deliveredRate: number;
    returnRate: number;
    toxicSuccess: boolean;
    topFriction: string | null;
  }>;
  recentSessions: Array<{
    id: string;
    startedAt: string;
    source: string | null;
    productTitle: string | null;
    diagnosticLabel: string | null;
    activeTimeSeconds: number;
    maxScrollDepth: number;
    converted: boolean;
    partial: boolean;
  }>;
  sourceBreakdown: Array<{ source: string; sessions: number; purchases: number; share: number }>;
  statusBreakdown: Array<{ status: string; count: number; share: number }>;
  recommendations: OmniRecommendation[];
}

function buildOverviewRecommendations(snapshot: OmniOverviewResponse): OmniRecommendation[] {
  const recommendations: OmniRecommendation[] = [];
  const shippingFriction = snapshot.frictionClusters.find(cluster => cluster.label === 'Shipping/Payment Friction');
  const priceTrustFriction = snapshot.frictionClusters.find(cluster => cluster.label === 'High Interest, Price/Trust Friction');
  const mismatchFriction = snapshot.frictionClusters.find(cluster => cluster.label === 'Ad/Creative Mismatch');

  if (snapshot.overview.toxicCreativeCount > 0) {
    recommendations.push({
      title: 'Pause or repair toxic creatives',
      detail: `${snapshot.overview.toxicCreativeCount} creative segments are generating revenue with weak realized profit or high return rates.`,
      severity: 'high',
      action: 'Audit creative profit and lower spend on toxic rows first.',
    });
  }

  if ((shippingFriction?.share || 0) >= 20) {
    recommendations.push({
      title: 'Reduce checkout friction',
      detail: `${shippingFriction?.sessions || 0} sessions reached cart or checkout and still dropped.`,
      severity: 'high',
      action: 'Review delivery price display, COD trust copy, and checkout reassurance above the fold.',
    });
  }

  if ((priceTrustFriction?.share || 0) >= 15) {
    recommendations.push({
      title: 'Improve price and trust proof',
      detail: `${priceTrustFriction?.sessions || 0} engaged sessions stayed on the product page without moving to cart.`,
      severity: 'medium',
      action: 'Add social proof, warranty, clearer value framing, and richer product proof on the landing page.',
    });
  }

  if ((mismatchFriction?.share || 0) >= 20) {
    recommendations.push({
      title: 'Match ad promise to landing page',
      detail: 'Too many sessions bounce before meaningful engagement, which usually means the ad angle is not being fulfilled on-page.',
      severity: 'medium',
      action: 'Rewrite the hero and first screen to reflect the creative promise and product hook exactly.',
    });
  }

  if (snapshot.overview.missingEconomicsProducts > 0) {
    recommendations.push({
      title: 'Complete product cost inputs',
      detail: `${snapshot.overview.missingEconomicsProducts} products are still missing economics data, so profit and POAS are understated in confidence.`,
      severity: 'medium',
      action: 'Add buy cost, packaging, handling, and fallback shipping for the missing products.',
    });
  }

  if (snapshot.overview.adSpend <= 0) {
    recommendations.push({
      title: 'Enter ad spend',
      detail: 'The page has traffic and order data, but ad spend is still missing for this period.',
      severity: 'low',
      action: 'Add daily spend rows so creative POAS and toxic-success detection become actionable.',
    });
  }

  return recommendations.slice(0, 5);
}

export async function getOmniInputs(clientId: number) {
  const db = await ensureConnection();
  const [products, creativeCatalog, spendEntries, importJobs] = await Promise.all([
    db.query(
      `SELECT
         p.id,
         p.title,
         p.price,
         p.category,
         COALESCE(pe.buy_cost, 0) AS buy_cost,
         COALESCE(pe.packaging_cost, 0) AS packaging_cost,
         COALESCE(pe.handling_cost, 0) AS handling_cost,
         COALESCE(pe.fallback_shipping_cost, 0) AS fallback_shipping_cost,
         pe.notes
       FROM client_store_products p
       LEFT JOIN product_economics pe
         ON pe.client_id = p.client_id
        AND pe.product_id = p.id
       WHERE p.client_id = $1
         AND COALESCE(p.status, 'active') <> 'archived'
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [clientId]
    ),
    db.query(
      `SELECT id, platform, campaign_name, adset_name, creative_name, creative_key, landing_page,
              promise_angle, target_persona, notes, is_active, created_at, updated_at
       FROM creative_catalog
       WHERE client_id = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 100`,
      [clientId]
    ),
    db.query(
      `SELECT id, entry_date, platform, campaign_name, adset_name, creative_name, creative_key,
              spend, impressions, clicks, link_clicks, notes, created_at
       FROM creative_spend_entries
       WHERE client_id = $1
       ORDER BY entry_date DESC, created_at DESC
       LIMIT 120`,
      [clientId]
    ),
    db.query(
      `SELECT id, job_type, status, source_label, started_at, completed_at, processed_rows, partial_rows, notes, payload, created_at
       FROM historical_import_jobs
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [clientId]
    ),
  ]);

  return {
    products: products.rows,
    creativeCatalog: creativeCatalog.rows,
    spendEntries: spendEntries.rows,
    importJobs: importJobs.rows,
  };
}

export async function upsertProductEconomics(clientId: number, input: {
  productId: number;
  buyCost: number;
  packagingCost: number;
  handlingCost: number;
  fallbackShippingCost: number;
  notes?: string | null;
}) {
  const db = await ensureConnection();
  const result = await db.query(
    `INSERT INTO product_economics (
       client_id, product_id, buy_cost, packaging_cost, handling_cost, fallback_shipping_cost, notes, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (client_id, product_id) DO UPDATE SET
       buy_cost = EXCLUDED.buy_cost,
       packaging_cost = EXCLUDED.packaging_cost,
       handling_cost = EXCLUDED.handling_cost,
       fallback_shipping_cost = EXCLUDED.fallback_shipping_cost,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    [
      clientId,
      input.productId,
      toNumber(input.buyCost),
      toNumber(input.packagingCost),
      toNumber(input.handlingCost),
      toNumber(input.fallbackShippingCost),
      toOptionalText(input.notes),
    ]
  );

  return result.rows[0];
}

export async function upsertCreativeCatalogEntry(clientId: number, input: {
  id?: number | null;
  platform: string;
  campaignName?: string | null;
  adsetName?: string | null;
  creativeName: string;
  landingPage?: string | null;
  promiseAngle?: string | null;
  targetPersona?: string | null;
  notes?: string | null;
  isActive?: boolean;
}) {
  const db = await ensureConnection();
  const creativeKey = buildCreativeKey({
    platform: input.platform,
    campaignName: input.campaignName,
    adsetName: input.adsetName,
    creativeName: input.creativeName,
  });

  if (!creativeKey) {
    throw new Error('Creative key could not be derived');
  }

  const result = await db.query(
    `INSERT INTO creative_catalog (
       client_id, platform, campaign_name, adset_name, creative_name, creative_key,
       landing_page, promise_angle, target_persona, notes, is_active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     ON CONFLICT (client_id, creative_key) DO UPDATE SET
       platform = EXCLUDED.platform,
       campaign_name = EXCLUDED.campaign_name,
       adset_name = EXCLUDED.adset_name,
       creative_name = EXCLUDED.creative_name,
       landing_page = EXCLUDED.landing_page,
       promise_angle = EXCLUDED.promise_angle,
       target_persona = EXCLUDED.target_persona,
       notes = EXCLUDED.notes,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING *`,
    [
      clientId,
      normalizePlatform(input.platform),
      toOptionalText(input.campaignName),
      toOptionalText(input.adsetName),
      toOptionalText(input.creativeName),
      creativeKey,
      toOptionalText(input.landingPage),
      toOptionalText(input.promiseAngle),
      toOptionalText(input.targetPersona),
      toOptionalText(input.notes),
      input.isActive !== false,
    ]
  );

  return result.rows[0];
}

export async function deleteCreativeCatalogEntry(clientId: number, entryId: number) {
  const db = await ensureConnection();
  await db.query('DELETE FROM creative_catalog WHERE client_id = $1 AND id = $2', [clientId, entryId]);
}

export async function upsertCreativeSpendEntry(clientId: number, input: {
  entryDate: string;
  platform: string;
  campaignName?: string | null;
  adsetName?: string | null;
  creativeName?: string | null;
  spend: number;
  impressions?: number | null;
  clicks?: number | null;
  linkClicks?: number | null;
  notes?: string | null;
}) {
  const db = await ensureConnection();
  const creativeKey = buildCreativeKey({
    platform: input.platform,
    campaignName: input.campaignName,
    adsetName: input.adsetName,
    creativeName: input.creativeName,
  });

  const result = await db.query(
    `INSERT INTO creative_spend_entries (
       client_id, entry_date, platform, campaign_name, adset_name, creative_name,
       creative_key, spend, impressions, clicks, link_clicks, notes, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     RETURNING *`,
    [
      clientId,
      input.entryDate,
      normalizePlatform(input.platform),
      toOptionalText(input.campaignName),
      toOptionalText(input.adsetName),
      toOptionalText(input.creativeName),
      creativeKey,
      toNumber(input.spend),
      toSafeInt(input.impressions),
      toSafeInt(input.clicks),
      toSafeInt(input.linkClicks),
      toOptionalText(input.notes),
    ]
  );

  return result.rows[0];
}

export async function deleteCreativeSpendEntry(clientId: number, entryId: number) {
  const db = await ensureConnection();
  await db.query('DELETE FROM creative_spend_entries WHERE client_id = $1 AND id = $2', [clientId, entryId]);
}

export async function backfillHistoricalSessions(clientId: number, days?: number) {
  const db = await ensureConnection();
  const jobInsert = await db.query(
    `INSERT INTO historical_import_jobs (
       client_id, job_type, status, source_label, started_at, created_at, updated_at, payload
     ) VALUES ($1, 'historical_session_backfill', 'running', 'pixel_events', NOW(), NOW(), NOW(), $2)
     RETURNING id`,
    [clientId, JSON.stringify({ days: days || null })]
  );

  const jobId = jobInsert.rows[0]?.id;

  try {
    const params: any[] = [clientId];
    let whereClause = 'WHERE client_id = $1';
    if (days && Number.isFinite(days) && days > 0) {
      whereClause += ` AND created_at >= NOW() - INTERVAL '${Math.min(3650, Math.max(1, Math.round(days)))} days'`;
    }

    const rows = (
      await db.query(
        `SELECT id, pixel_type, event_name, event_data, page_url, session_id, visitor_id, product_id, order_id, revenue, currency, created_at
         FROM pixel_events
         ${whereClause}
         ORDER BY created_at ASC`,
        params
      )
    ).rows;

    const grouped = new Map<string, any>();
    for (const row of rows) {
      const eventData = row.event_data && typeof row.event_data === 'object' ? row.event_data : {};
      const sessionId = toOptionalText(row.session_id) || (toOptionalText(row.visitor_id) ? `legacy-${row.visitor_id}-${String(row.created_at).slice(0, 10)}` : `legacy-event-${row.id}`);
      const pagePath = parsePagePath(row.page_url, eventData.page_path);

      if (!grouped.has(sessionId)) {
        grouped.set(sessionId, {
          sessionId,
          visitorId: toOptionalText(row.visitor_id),
          storeSlug: null,
          firstSeenAt: row.created_at,
          lastSeenAt: row.created_at,
          landingPage: pagePath,
          exitPage: pagePath,
          entryReferrer: toOptionalText(eventData.referrer),
          entrySource: toOptionalText(eventData.source) || toOptionalText(eventData.utm_source) || normalizePlatform(row.pixel_type) || 'direct',
          entryMedium: toOptionalText(eventData.utm_medium) || (normalizePlatform(row.pixel_type) ? 'paid_social' : null),
          entryCampaign: toOptionalText(eventData.utm_campaign || eventData.campaign_name),
          platformHint: normalizePlatform(row.pixel_type),
          pageViews: 0,
          productViews: 0,
          addToCartCount: 0,
          checkoutCount: 0,
          purchaseCount: 0,
          lastProductId: row.product_id || null,
          lastOrderId: row.order_id || null,
          lastEventName: row.event_name,
          locale: toOptionalText(eventData.locale),
          touch: {
            pixelType: row.pixel_type,
            source: toOptionalText(eventData.source) || toOptionalText(eventData.utm_source) || normalizePlatform(row.pixel_type),
            medium: toOptionalText(eventData.utm_medium) || (normalizePlatform(row.pixel_type) ? 'paid_social' : null),
            campaignName: toOptionalText(eventData.utm_campaign || eventData.campaign_name),
            adsetName: toOptionalText(eventData.adset_name),
            creativeName: toOptionalText(eventData.creative_name || eventData.ad_name),
            landingPage: pagePath,
            fbclid: toOptionalText(eventData.fbclid),
            ttclid: toOptionalText(eventData.ttclid),
            gclid: toOptionalText(eventData.gclid),
          },
        });
      }

      const aggregate = grouped.get(sessionId);
      aggregate.lastSeenAt = row.created_at;
      aggregate.exitPage = pagePath || aggregate.exitPage;
      aggregate.lastProductId = row.product_id || aggregate.lastProductId;
      aggregate.lastOrderId = row.order_id || aggregate.lastOrderId;
      aggregate.lastEventName = row.event_name || aggregate.lastEventName;
      if (row.event_name === 'PageView') aggregate.pageViews += 1;
      if (row.event_name === 'ViewContent') aggregate.productViews += 1;
      if (row.event_name === 'AddToCart') aggregate.addToCartCount += 1;
      if (row.event_name === 'InitiateCheckout') aggregate.checkoutCount += 1;
      if (row.event_name === 'Purchase') aggregate.purchaseCount += 1;
    }

    for (const aggregate of grouped.values()) {
      const sessionResult = await db.query(
        `INSERT INTO analytic_sessions (
           client_id, session_id, visitor_id, status, first_seen_at, last_seen_at, ended_at,
           landing_page, exit_page, entry_referrer, entry_source, entry_medium, entry_campaign,
           platform_hint, page_views, product_views, add_to_cart_count, checkout_count, purchase_count,
           last_event_name, last_product_id, last_order_id, locale, is_partial, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19,
           $20, $21, $22, $23, true, NOW(), NOW()
         )
         ON CONFLICT (client_id, session_id) DO UPDATE SET
           visitor_id = COALESCE(analytic_sessions.visitor_id, EXCLUDED.visitor_id),
           status = EXCLUDED.status,
           first_seen_at = LEAST(analytic_sessions.first_seen_at, EXCLUDED.first_seen_at),
           last_seen_at = GREATEST(analytic_sessions.last_seen_at, EXCLUDED.last_seen_at),
           ended_at = COALESCE(EXCLUDED.ended_at, analytic_sessions.ended_at),
           landing_page = COALESCE(analytic_sessions.landing_page, EXCLUDED.landing_page),
           exit_page = COALESCE(EXCLUDED.exit_page, analytic_sessions.exit_page),
           entry_referrer = COALESCE(analytic_sessions.entry_referrer, EXCLUDED.entry_referrer),
           entry_source = COALESCE(analytic_sessions.entry_source, EXCLUDED.entry_source),
           entry_medium = COALESCE(analytic_sessions.entry_medium, EXCLUDED.entry_medium),
           entry_campaign = COALESCE(analytic_sessions.entry_campaign, EXCLUDED.entry_campaign),
           platform_hint = COALESCE(analytic_sessions.platform_hint, EXCLUDED.platform_hint),
           page_views = GREATEST(analytic_sessions.page_views, EXCLUDED.page_views),
           product_views = GREATEST(analytic_sessions.product_views, EXCLUDED.product_views),
           add_to_cart_count = GREATEST(analytic_sessions.add_to_cart_count, EXCLUDED.add_to_cart_count),
           checkout_count = GREATEST(analytic_sessions.checkout_count, EXCLUDED.checkout_count),
           purchase_count = GREATEST(analytic_sessions.purchase_count, EXCLUDED.purchase_count),
           last_event_name = EXCLUDED.last_event_name,
           last_product_id = COALESCE(EXCLUDED.last_product_id, analytic_sessions.last_product_id),
           last_order_id = COALESCE(EXCLUDED.last_order_id, analytic_sessions.last_order_id),
           locale = COALESCE(EXCLUDED.locale, analytic_sessions.locale),
           is_partial = true,
           updated_at = NOW()
         RETURNING id, page_views, product_views, add_to_cart_count, checkout_count, purchase_count, max_scroll_depth, active_time_seconds, exit_page`,
        [
          clientId,
          aggregate.sessionId,
          aggregate.visitorId,
          aggregate.purchaseCount > 0 ? 'completed' : 'completed',
          aggregate.firstSeenAt,
          aggregate.lastSeenAt,
          aggregate.lastSeenAt,
          aggregate.landingPage,
          aggregate.exitPage,
          aggregate.entryReferrer,
          aggregate.entrySource,
          aggregate.entryMedium,
          aggregate.entryCampaign,
          aggregate.platformHint,
          aggregate.pageViews,
          aggregate.productViews,
          aggregate.addToCartCount,
          aggregate.checkoutCount,
          aggregate.purchaseCount,
          aggregate.lastEventName,
          aggregate.lastProductId,
          aggregate.lastOrderId,
          aggregate.locale,
        ]
      );
      const sessionRow = sessionResult.rows[0];
      await saveSessionTouch(sessionRow.id, clientId, aggregate.touch);
      await persistSessionDiagnostic(sessionRow.id, sessionRow);
    }

    await db.query(
      `UPDATE historical_import_jobs
       SET status = 'completed',
           completed_at = NOW(),
           processed_rows = $2,
           partial_rows = $3,
           notes = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, grouped.size, grouped.size, `Imported ${grouped.size} session summaries from ${rows.length} pixel events.`]
    );

    return {
      jobId,
      processedSessions: grouped.size,
      sourceEvents: rows.length,
    };
  } catch (error: any) {
    await db.query(
      `UPDATE historical_import_jobs
       SET status = 'failed',
           completed_at = NOW(),
           notes = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, String(error?.message || error || 'Unknown error')]
    );
    throw error;
  }
}

export async function getOmniOverview(clientId: number, days: number): Promise<OmniOverviewResponse> {
  const safeDays = Math.min(3650, Math.max(1, Math.round(days || 30)));
  const db = await ensureConnection();

  const [sessionResult, ordersResult, spendResult, catalogResult, coverageResult] = await Promise.all([
    db.query(
      `SELECT
         s.id,
         s.session_id,
         s.first_seen_at,
         s.last_seen_at,
         s.landing_page,
         s.exit_page,
         s.entry_source,
         s.entry_medium,
         s.entry_campaign,
         s.page_views,
         s.product_views,
         s.add_to_cart_count,
         s.checkout_count,
         s.purchase_count,
         s.max_scroll_depth,
         s.active_time_seconds,
         s.last_product_id,
         s.last_order_id,
         s.is_partial,
         s.diagnostic_label,
         s.diagnostic_reason,
         p.title AS product_title,
         t.platform,
         t.source,
         t.campaign_name,
         t.adset_name,
         t.creative_name,
         t.creative_key,
         t.landing_page AS touch_landing_page
       FROM analytic_sessions s
       LEFT JOIN analytic_session_touches t
         ON t.analytic_session_id = s.id
        AND t.touch_position = 1
       LEFT JOIN client_store_products p
         ON p.id = s.last_product_id
       WHERE s.client_id = $1
         AND s.first_seen_at >= NOW() - INTERVAL '${safeDays} days'
       ORDER BY s.first_seen_at DESC`,
      [clientId]
    ),
    db.query(
      `SELECT
         o.id,
         o.product_id,
         p.title AS product_title,
         o.status,
         o.delivery_status,
         o.total_price,
         o.delivery_fee,
         o.created_at,
         COALESCE(pe.buy_cost, 0) AS buy_cost,
         COALESCE(pe.packaging_cost, 0) AS packaging_cost,
         COALESCE(pe.handling_cost, 0) AS handling_cost,
         COALESCE(NULLIF(o.delivery_fee, 0), pe.fallback_shipping_cost, pricing.home_delivery_price, 0) AS shipping_cost,
         s.id AS analytic_session_id
       FROM store_orders o
       LEFT JOIN client_store_products p
         ON p.id = o.product_id
       LEFT JOIN product_economics pe
         ON pe.client_id = o.client_id
        AND pe.product_id = o.product_id
       LEFT JOIN LATERAL (
         SELECT home_delivery_price
         FROM delivery_prices dp
         WHERE dp.client_id = o.client_id
           AND dp.wilaya_id = o.shipping_wilaya_id
           AND dp.is_active = true
         ORDER BY dp.home_delivery_price ASC
         LIMIT 1
       ) pricing ON true
       LEFT JOIN analytic_sessions s
         ON s.client_id = o.client_id
        AND s.last_order_id = o.id
       WHERE o.client_id = $1
         AND o.created_at >= NOW() - INTERVAL '${safeDays} days'
         AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC`,
      [clientId]
    ),
    db.query(
      `SELECT entry_date, platform, campaign_name, adset_name, creative_name, creative_key, spend, clicks, impressions, link_clicks
       FROM creative_spend_entries
       WHERE client_id = $1
         AND entry_date >= CURRENT_DATE - INTERVAL '${safeDays} days'
       ORDER BY entry_date DESC`,
      [clientId]
    ),
    db.query(
      `SELECT creative_key, promise_angle, target_persona, landing_page
       FROM creative_catalog
       WHERE client_id = $1`,
      [clientId]
    ),
    db.query(
      `SELECT
         COUNT(*)::int AS total_products,
         COUNT(*) FILTER (WHERE pe.product_id IS NULL)::int AS missing_economics_products
       FROM client_store_products p
       LEFT JOIN product_economics pe
         ON pe.client_id = p.client_id
        AND pe.product_id = p.id
       WHERE p.client_id = $1
         AND COALESCE(p.status, 'active') <> 'archived'`,
      [clientId]
    ),
  ]);

  const catalogByKey = new Map<string, any>();
  for (const row of catalogResult.rows) {
    if (row.creative_key) catalogByKey.set(String(row.creative_key), row);
  }

  const sessions = sessionResult.rows.map(row => ({
    id: String(row.id),
    sessionId: String(row.session_id),
    firstSeenAt: String(row.first_seen_at),
    source: toOptionalText(row.source || row.entry_source),
    campaignName: toOptionalText(row.campaign_name || row.entry_campaign),
    adsetName: toOptionalText(row.adset_name),
    creativeName: toOptionalText(row.creative_name),
    creativeKey: toOptionalText(row.creative_key) || buildCreativeKey({
      platform: row.platform,
      campaignName: row.campaign_name || row.entry_campaign,
      adsetName: row.adset_name,
      creativeName: row.creative_name,
    }) || 'unattributed',
    platform: normalizePlatform(row.platform),
    landingPage: toOptionalText(row.touch_landing_page || row.landing_page),
    productViews: toSafeInt(row.product_views),
    addToCart: toSafeInt(row.add_to_cart_count),
    checkout: toSafeInt(row.checkout_count),
    purchases: toSafeInt(row.purchase_count),
    pageViews: toSafeInt(row.page_views),
    activeTimeSeconds: toSafeInt(row.active_time_seconds),
    maxScrollDepth: toSafeInt(row.max_scroll_depth),
    productTitle: toOptionalText(row.product_title),
    diagnosticLabel: toOptionalText(row.diagnostic_label),
    diagnosticReason: toOptionalText(row.diagnostic_reason),
    exitPage: toOptionalText(row.exit_page),
    partial: Boolean(row.is_partial),
  }));

  const creativeMap = new Map<string, any>();
  const sourceMap = new Map<string, { source: string; sessions: number; purchases: number }>();

  for (const session of sessions) {
    const creativeKey = session.creativeKey || 'unattributed';
    const catalog = catalogByKey.get(creativeKey);
    if (!creativeMap.has(creativeKey)) {
      creativeMap.set(creativeKey, {
        key: creativeKey,
        platform: session.platform,
        campaignName: session.campaignName,
        adsetName: session.adsetName,
        creativeName: session.creativeName,
        landingPage: session.landingPage || catalog?.landing_page || null,
        promiseAngle: catalog?.promise_angle || null,
        sessions: 0,
        productViews: 0,
        addToCart: 0,
        checkout: 0,
        purchases: 0,
        bookedRevenue: 0,
        realizedRevenue: 0,
        spend: 0,
        grossProfit: 0,
        netProfit: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        frictionCounts: new Map<string, number>(),
      });
    }

    const creative = creativeMap.get(creativeKey);
    creative.sessions += 1;
    creative.productViews += session.productViews;
    creative.addToCart += session.addToCart;
    creative.checkout += session.checkout;
    creative.purchases += session.purchases;
    if (session.diagnosticLabel) {
      creative.frictionCounts.set(session.diagnosticLabel, (creative.frictionCounts.get(session.diagnosticLabel) || 0) + 1);
    }

    const sourceKey = session.source || 'unknown';
    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, { source: sourceKey, sessions: 0, purchases: 0 });
    }
    const source = sourceMap.get(sourceKey)!;
    source.sessions += 1;
    source.purchases += session.purchases;
  }

  const sessionByDbId = new Map<string, any>();
  for (const session of sessions) {
    sessionByDbId.set(session.id, session);
  }

  const statusBreakdownMap = new Map<string, number>();
  let bookedRevenue = 0;
  let realizedRevenue = 0;
  let grossProfit = 0;
  let deliveredOrders = 0;
  let returnedOrders = 0;
  let unattributedOrders = 0;

  for (const row of ordersResult.rows) {
    const status = String(row.status || 'unknown');
    statusBreakdownMap.set(status, (statusBreakdownMap.get(status) || 0) + 1);

    const orderTotal = toNumber(row.total_price);
    const shippingCost = toNumber(row.shipping_cost);
    const baseCost = toNumber(row.buy_cost) + toNumber(row.packaging_cost) + toNumber(row.handling_cost) + shippingCost;
    const isBooked = !EXCLUDED_BOOKED_ORDER_STATUSES.has(status);
    const isDelivered = SUCCESS_ORDER_STATUSES.has(status);
    const isReturned = RETURNED_ORDER_STATUSES.has(status) || RETURNED_ORDER_STATUSES.has(String(row.delivery_status || ''));

    if (isBooked) bookedRevenue += orderTotal;
    if (isDelivered) {
      deliveredOrders += 1;
      realizedRevenue += orderTotal;
      grossProfit += orderTotal - baseCost;
    } else if (isReturned) {
      returnedOrders += 1;
      grossProfit -= baseCost;
    }

    const session = row.analytic_session_id ? sessionByDbId.get(String(row.analytic_session_id)) : null;
    const creativeKey = session?.creativeKey || 'unattributed';
    if (!creativeMap.has(creativeKey)) {
      const catalog = catalogByKey.get(creativeKey);
      creativeMap.set(creativeKey, {
        key: creativeKey,
        platform: session?.platform || null,
        campaignName: session?.campaignName || null,
        adsetName: session?.adsetName || null,
        creativeName: session?.creativeName || null,
        landingPage: session?.landingPage || catalog?.landing_page || null,
        promiseAngle: catalog?.promise_angle || null,
        sessions: 0,
        productViews: 0,
        addToCart: 0,
        checkout: 0,
        purchases: 0,
        bookedRevenue: 0,
        realizedRevenue: 0,
        spend: 0,
        grossProfit: 0,
        netProfit: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        frictionCounts: new Map<string, number>(),
      });
    }
    const creative = creativeMap.get(creativeKey);
    if (!session) unattributedOrders += 1;
    if (isBooked) creative.bookedRevenue += orderTotal;
    if (isDelivered) {
      creative.realizedRevenue += orderTotal;
      creative.grossProfit += orderTotal - baseCost;
      creative.deliveredOrders += 1;
    } else if (isReturned) {
      creative.grossProfit -= baseCost;
      creative.returnedOrders += 1;
    }
  }

  for (const row of spendResult.rows) {
    const creativeKey = toOptionalText(row.creative_key) || buildCreativeKey({
      platform: row.platform,
      campaignName: row.campaign_name,
      adsetName: row.adset_name,
      creativeName: row.creative_name,
    }) || 'unattributed';

    const catalog = catalogByKey.get(creativeKey);
    if (!creativeMap.has(creativeKey)) {
      creativeMap.set(creativeKey, {
        key: creativeKey,
        platform: normalizePlatform(row.platform),
        campaignName: toOptionalText(row.campaign_name),
        adsetName: toOptionalText(row.adset_name),
        creativeName: toOptionalText(row.creative_name),
        landingPage: catalog?.landing_page || null,
        promiseAngle: catalog?.promise_angle || null,
        sessions: 0,
        productViews: 0,
        addToCart: 0,
        checkout: 0,
        purchases: 0,
        bookedRevenue: 0,
        realizedRevenue: 0,
        spend: 0,
        grossProfit: 0,
        netProfit: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        frictionCounts: new Map<string, number>(),
      });
    }
    const creative = creativeMap.get(creativeKey);
    creative.spend += toNumber(row.spend);
  }

  const creativeComparison = Array.from(creativeMap.values())
    .map(creative => {
      creative.netProfit = creative.grossProfit - creative.spend;
      const totalOutcomeOrders = creative.deliveredOrders + creative.returnedOrders;
      const deliveredRate = percent(creative.deliveredOrders, Math.max(1, creative.purchases || totalOutcomeOrders));
      const returnRate = percent(creative.returnedOrders, Math.max(1, totalOutcomeOrders || creative.purchases));
      const poas = creative.spend > 0 ? Number((creative.netProfit / creative.spend).toFixed(2)) : null;
      const topFriction = Array.from(creative.frictionCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
      const toxicSuccess = creative.bookedRevenue > 0 && (
        (poas !== null && poas <= 0.5) ||
        returnRate >= 25 ||
        deliveredRate <= 55
      );

      return {
        key: creative.key,
        platform: creative.platform,
        campaignName: creative.campaignName,
        adsetName: creative.adsetName,
        creativeName: creative.creativeName,
        landingPage: creative.landingPage,
        promiseAngle: creative.promiseAngle,
        sessions: creative.sessions,
        productViews: creative.productViews,
        addToCart: creative.addToCart,
        checkout: creative.checkout,
        purchases: creative.purchases,
        bookedRevenue: Number(creative.bookedRevenue.toFixed(2)),
        realizedRevenue: Number(creative.realizedRevenue.toFixed(2)),
        spend: Number(creative.spend.toFixed(2)),
        grossProfit: Number(creative.grossProfit.toFixed(2)),
        netProfit: Number(creative.netProfit.toFixed(2)),
        poas,
        deliveredOrders: creative.deliveredOrders,
        returnedOrders: creative.returnedOrders,
        deliveredRate,
        returnRate,
        toxicSuccess,
        topFriction,
      };
    })
    .sort((left, right) => right.netProfit - left.netProfit);

  const toxicCreativeCount = creativeComparison.filter(creative => creative.toxicSuccess).length;
  const coverage = coverageResult.rows[0] || { missing_economics_products: 0 };
  const overview = {
    sessions: sessions.length,
    partialSessions: sessions.filter(session => session.partial).length,
    productViews: sessions.reduce((sum, session) => sum + session.productViews, 0),
    addToCart: sessions.reduce((sum, session) => sum + session.addToCart, 0),
    checkout: sessions.reduce((sum, session) => sum + session.checkout, 0),
    purchases: sessions.reduce((sum, session) => sum + session.purchases, 0),
    bookedRevenue: Number(bookedRevenue.toFixed(2)),
    realizedRevenue: Number(realizedRevenue.toFixed(2)),
    adSpend: Number(spendResult.rows.reduce((sum, row) => sum + toNumber(row.spend), 0).toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    netProfit: Number((grossProfit - spendResult.rows.reduce((sum, row) => sum + toNumber(row.spend), 0)).toFixed(2)),
    poas: spendResult.rows.reduce((sum, row) => sum + toNumber(row.spend), 0) > 0
      ? Number(((grossProfit - spendResult.rows.reduce((sum, row) => sum + toNumber(row.spend), 0)) / spendResult.rows.reduce((sum, row) => sum + toNumber(row.spend), 0)).toFixed(2))
      : null,
    deliveredOrders,
    returnedOrders,
    toxicCreativeCount,
    avgActiveTimeSeconds: sessions.length ? Math.round(sessions.reduce((sum, session) => sum + session.activeTimeSeconds, 0) / sessions.length) : 0,
    avgScrollDepth: sessions.length ? Math.round(sessions.reduce((sum, session) => sum + session.maxScrollDepth, 0) / sessions.length) : 0,
    unattributedOrders,
    missingEconomicsProducts: toSafeInt(coverage.missing_economics_products),
  };

  const frictionClusters = Array.from(
    sessions.reduce((map, session) => {
      const label = session.diagnosticLabel || 'Low-Confidence Drop-Off';
      if (!map.has(label)) {
        map.set(label, {
          label,
          sessions: 0,
          scrollSum: 0,
          timeSum: 0,
          exitPages: new Map<string, number>(),
          products: new Map<string, number>(),
          sources: new Map<string, number>(),
          reason: session.diagnosticReason || 'Session classified deterministically from engagement and funnel signals.',
        });
      }
      const bucket = map.get(label)!;
      bucket.sessions += 1;
      bucket.scrollSum += session.maxScrollDepth;
      bucket.timeSum += session.activeTimeSeconds;
      if (session.exitPage) bucket.exitPages.set(session.exitPage, (bucket.exitPages.get(session.exitPage) || 0) + 1);
      if (session.productTitle) bucket.products.set(session.productTitle, (bucket.products.get(session.productTitle) || 0) + 1);
      if (session.source) bucket.sources.set(session.source, (bucket.sources.get(session.source) || 0) + 1);
      return map;
    }, new Map<string, any>()).values()
  )
    .filter(cluster => cluster.label !== 'Converted')
    .map(cluster => ({
      label: cluster.label,
      sessions: cluster.sessions,
      share: percent(cluster.sessions, Math.max(1, sessions.length)),
      avgScrollDepth: Math.round(cluster.scrollSum / Math.max(1, cluster.sessions)),
      avgActiveTimeSeconds: Math.round(cluster.timeSum / Math.max(1, cluster.sessions)),
      topExitPage: Array.from(cluster.exitPages.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null,
      topProductTitle: Array.from(cluster.products.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null,
      topSource: Array.from(cluster.sources.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null,
      reason: cluster.reason,
    }))
    .sort((left, right) => right.sessions - left.sessions)
    .slice(0, 4);

  const sourceBreakdown = Array.from(sourceMap.values())
    .map(source => ({
      source: source.source,
      sessions: source.sessions,
      purchases: source.purchases,
      share: percent(source.sessions, Math.max(1, sessions.length)),
    }))
    .sort((left, right) => right.sessions - left.sessions)
    .slice(0, 6);

  const statusBreakdown = Array.from(statusBreakdownMap.entries())
    .map(([status, count]) => ({ status, count, share: percent(count, Math.max(1, ordersResult.rows.length)) }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const snapshot: OmniOverviewResponse = {
    periodDays: safeDays,
    overview,
    funnel: [
      { label: 'Sessions', value: overview.sessions, rate: 100 },
      { label: 'Product Views', value: overview.productViews, rate: percent(overview.productViews, Math.max(1, overview.sessions)) },
      { label: 'Add To Cart', value: overview.addToCart, rate: percent(overview.addToCart, Math.max(1, overview.productViews)) },
      { label: 'Checkout', value: overview.checkout, rate: percent(overview.checkout, Math.max(1, overview.addToCart)) },
      { label: 'Purchases', value: overview.purchases, rate: percent(overview.purchases, Math.max(1, overview.checkout || overview.sessions)) },
    ],
    frictionClusters,
    creativeComparison,
    recentSessions: sessions.slice(0, 8).map(session => ({
      id: session.sessionId,
      startedAt: session.firstSeenAt,
      source: session.source,
      productTitle: session.productTitle,
      diagnosticLabel: session.diagnosticLabel,
      activeTimeSeconds: session.activeTimeSeconds,
      maxScrollDepth: session.maxScrollDepth,
      converted: session.purchases > 0,
      partial: session.partial,
    })),
    sourceBreakdown,
    statusBreakdown,
    recommendations: [],
  };

  snapshot.recommendations = buildOverviewRecommendations(snapshot);
  return snapshot;
}