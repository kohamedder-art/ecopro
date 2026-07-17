import crypto from 'crypto';
import { ensureConnection } from '../utils/database';

type NullableText = string | null | undefined;

const SUCCESS_ORDER_STATUSES = new Set(['delivered', 'completed']);
const RETURNED_ORDER_STATUSES = new Set(['returned', 'failed', 'delivery_failed', 'didnt_pickup']);
const EXCLUDED_BOOKED_ORDER_STATUSES = new Set(['cancelled', 'declined', 'fake', 'duplicate', 'refunded']);

// Map old English friction labels (stored in DB) to i18n-friendly keys
const FRICTION_LABEL_MAP: Record<string, string> = {
  'Converted': 'converted',
  'Shipping/Payment Friction': 'shipping_friction',
  'High Interest, Price/Trust Friction': 'price_trust_friction',
  'Ad/Creative Mismatch': 'ad_mismatch',
  'Low-Confidence Drop-Off': 'low_confidence',
};

function normalizeFrictionLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  return FRICTION_LABEL_MAP[label] || label;
}

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
    return { label: 'converted', reason: 'converted' };
  }

  if (checkout > 0 || addToCart > 0 || exitPage.includes('checkout')) {
    return {
      label: 'shipping_friction',
      reason: 'shipping_friction',
    };
  }

  if (productViews > 0 && scrollDepth >= 60 && activeTime >= 45) {
    return {
      label: 'price_trust_friction',
      reason: 'price_trust_friction',
    };
  }

  if (pageViews <= 1 && activeTime < 20) {
    return {
      label: 'ad_mismatch',
      reason: 'ad_mismatch',
    };
  }

  return {
    label: 'low_confidence',
    reason: 'low_confidence',
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

  // Only create a touch record when there's real marketing attribution (UTM params, ad click IDs, or campaign data).
  // pixelType alone (internal tracker) and source='direct' are NOT marketing attribution.
  const hasMarketingData = [data.campaignName, data.adsetName, data.creativeName, data.fbclid, data.ttclid, data.gclid].some(Boolean);
  if (!hasMarketingData) return;

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
      toOptionalText(data.fbclid)?.slice(0, 255) ?? null,
      toOptionalText(data.ttclid)?.slice(0, 255) ?? null,
      toOptionalText(data.gclid)?.slice(0, 255) ?? null,
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
  const rawSource = toOptionalText(eventData.source) || toOptionalText(eventData.utm_source) || 'direct';
  const source = rawSource === 'fb' ? 'facebook' : rawSource === 'ig' ? 'instagram' : rawSource === 'an' ? 'unknown' : rawSource;
  const medium = toOptionalText(eventData.utm_medium) || null;
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
  key: string;
  severity: 'high' | 'medium' | 'low';
  params?: Record<string, string | number>;
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
  const shippingFriction = snapshot.frictionClusters.find(cluster => cluster.label === 'shipping_friction');
  const priceTrustFriction = snapshot.frictionClusters.find(cluster => cluster.label === 'price_trust_friction');
  const mismatchFriction = snapshot.frictionClusters.find(cluster => cluster.label === 'ad_mismatch');

  if (snapshot.overview.toxicCreativeCount > 0) {
    recommendations.push({
      key: 'toxic_creatives',
      severity: 'high',
      params: { count: snapshot.overview.toxicCreativeCount },
    });
  }

  if ((shippingFriction?.share || 0) >= 20) {
    recommendations.push({
      key: 'checkout_friction',
      severity: 'high',
      params: { sessions: shippingFriction?.sessions || 0 },
    });
  }

  if ((priceTrustFriction?.share || 0) >= 15) {
    recommendations.push({
      key: 'price_trust',
      severity: 'medium',
      params: { sessions: priceTrustFriction?.sessions || 0 },
    });
  }

  if ((mismatchFriction?.share || 0) >= 20) {
    recommendations.push({
      key: 'ad_mismatch',
      severity: 'medium',
    });
  }

  if (snapshot.overview.missingEconomicsProducts > 0) {
    recommendations.push({
      key: 'missing_economics',
      severity: 'medium',
      params: { count: snapshot.overview.missingEconomicsProducts },
    });
  }

  if (snapshot.overview.adSpend <= 0) {
    recommendations.push({
      key: 'missing_spend',
      severity: 'low',
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
         COALESCE(pe.call_center_cost, 0) AS call_center_cost,
         COALESCE(pe.return_cost, 0) AS return_cost,
         COALESCE(pe.other_costs, 0) AS other_costs,
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
      `SELECT cse.id, cse.entry_date, cse.platform, cse.product_id, cse.campaign_name, cse.adset_name, cse.creative_name, cse.creative_key,
              cse.spend, cse.impressions, cse.clicks, cse.link_clicks, cse.notes, cse.created_at,
              p.title AS product_title
       FROM creative_spend_entries cse
       LEFT JOIN client_store_products p ON p.id = cse.product_id
       WHERE cse.client_id = $1
       ORDER BY cse.entry_date DESC, cse.created_at DESC
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
  callCenterCost?: number;
  returnCost?: number;
  otherCosts?: number;
  notes?: string | null;
}) {
  const db = await ensureConnection();
  const result = await db.query(
    `INSERT INTO product_economics (
       client_id, product_id, buy_cost, packaging_cost, handling_cost, fallback_shipping_cost,
       call_center_cost, return_cost, other_costs, notes, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
     ON CONFLICT (client_id, product_id) DO UPDATE SET
       buy_cost = EXCLUDED.buy_cost,
       packaging_cost = EXCLUDED.packaging_cost,
       handling_cost = EXCLUDED.handling_cost,
       fallback_shipping_cost = EXCLUDED.fallback_shipping_cost,
       call_center_cost = EXCLUDED.call_center_cost,
       return_cost = EXCLUDED.return_cost,
       other_costs = EXCLUDED.other_costs,
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
      toNumber(input.callCenterCost ?? 0),
      toNumber(input.returnCost ?? 0),
      toNumber(input.otherCosts ?? 0),
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
  productId?: number | null;
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
       client_id, entry_date, platform, product_id, campaign_name, adset_name, creative_name,
       creative_key, spend, impressions, clicks, link_clicks, notes, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
     RETURNING *`,
    [
      clientId,
      input.entryDate,
      normalizePlatform(input.platform),
      input.productId || null,
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
          entrySource: (() => {
            const es = toOptionalText(eventData.source) || toOptionalText(eventData.utm_source) || normalizePlatform(row.pixel_type) || 'direct';
            return es === 'fb' ? 'facebook' : es === 'ig' ? 'instagram' : es === 'an' ? 'unknown' : es;
          })(),
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
    diagnosticLabel: normalizeFrictionLabel(toOptionalText(row.diagnostic_label)),
    diagnosticReason: normalizeFrictionLabel(toOptionalText(row.diagnostic_reason)),
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
  let totalOrders = 0;
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

    if (isBooked) {
      totalOrders += 1;
      bookedRevenue += orderTotal;
    }
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
    // Only include entries with actual marketing attribution (campaign, adset, creative, or ad spend).
    // Organic/direct visits without UTM params should not appear as "ads".
    .filter(creative =>
      creative.campaignName || creative.adsetName || creative.creativeName || creative.spend > 0
    )
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
    totalOrders,
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
      const label = session.diagnosticLabel || 'low_confidence';
      if (!map.has(label)) {
        map.set(label, {
          label,
          sessions: 0,
          scrollSum: 0,
          timeSum: 0,
          exitPages: new Map<string, number>(),
          products: new Map<string, number>(),
          sources: new Map<string, number>(),
          reason: session.diagnosticReason || 'low_confidence',
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
    .filter(cluster => cluster.label !== 'converted')
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
      { label: 'sessions', value: overview.sessions, rate: 100 },
      { label: 'views', value: overview.productViews, rate: percent(overview.productViews, Math.max(1, overview.sessions)) },
      { label: 'orders', value: overview.totalOrders, rate: percent(overview.totalOrders, Math.max(1, overview.productViews || overview.sessions)) },
      { label: 'delivered', value: deliveredOrders, rate: percent(deliveredOrders, Math.max(1, overview.totalOrders)) },
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

// ─── Customer Analytics ─────────────────────────────────────────

export interface CustomerAnalytics {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  averageOrderValue: number;
  averageOrdersPerCustomer: number;
  totalRevenue: number;
  topCustomers: { name: string; phone: string; orders: number; totalSpent: number; lastOrder: string }[];
  wilayaBreakdown: { wilayaId: number; wilayaName: string; orders: number; revenue: number; customers: number }[];
  deviceBreakdown: { device: string; sessions: number; share: number }[];
  ordersByDay: { date: string; orders: number; revenue: number }[];
  newVsReturning: { newCustomers: number; returningCustomers: number; newRevenue: number; returningRevenue: number };
  conversionRate: number;
  cartAbandonmentRate: number;
}

export async function getCustomerAnalytics(clientId: number, days: number): Promise<CustomerAnalytics> {
  const safeDays = Math.min(3650, Math.max(1, Math.round(days || 30)));
  const db = await ensureConnection();
  const { getAlgeriaWilayaNameById } = await import('../utils/algeria-geo');

  const cutoff = `NOW() - INTERVAL '${safeDays} days'`;

  const [
    customerStatsResult,
    topCustomersResult,
    wilayaResult,
    deviceResult,
    dailyOrdersResult,
    newVsReturningResult,
    funnelResult,
  ] = await Promise.all([
    // 1. Customer aggregate stats
    db.query(`
      WITH customer_orders AS (
        SELECT
          customer_phone,
          COUNT(*) AS order_count,
          SUM(total_price) AS total_spent
        FROM store_orders
        WHERE client_id = $1
          AND deleted_at IS NULL
          AND status NOT IN ('cancelled', 'declined', 'fake')
          AND created_at >= ${cutoff}
        GROUP BY customer_phone
      )
      SELECT
        COUNT(*) AS total_customers,
        COUNT(*) FILTER (WHERE order_count > 1) AS repeat_customers,
        COALESCE(AVG(total_spent / order_count), 0) AS avg_order_value,
        COALESCE(AVG(order_count), 0) AS avg_orders_per_customer,
        COALESCE(SUM(total_spent), 0) AS total_revenue
      FROM customer_orders
    `, [clientId]),

    // 2. Top 10 customers
    db.query(`
      SELECT
        customer_name AS name,
        customer_phone AS phone,
        COUNT(*) AS orders,
        SUM(total_price) AS total_spent,
        MAX(created_at) AS last_order
      FROM store_orders
      WHERE client_id = $1
        AND deleted_at IS NULL
        AND status NOT IN ('cancelled', 'declined', 'fake')
        AND created_at >= ${cutoff}
      GROUP BY customer_phone, customer_name
      ORDER BY total_spent DESC
      LIMIT 10
    `, [clientId]),

    // 3. Wilaya breakdown
    db.query(`
      SELECT
        shipping_wilaya_id AS wilaya_id,
        COUNT(*) AS orders,
        SUM(total_price) AS revenue,
        COUNT(DISTINCT customer_phone) AS customers
      FROM store_orders
      WHERE client_id = $1
        AND deleted_at IS NULL
        AND status NOT IN ('cancelled', 'declined', 'fake')
        AND shipping_wilaya_id IS NOT NULL
        AND created_at >= ${cutoff}
      GROUP BY shipping_wilaya_id
      ORDER BY orders DESC
    `, [clientId]),

    // 4. Device breakdown from sessions
    db.query(`
      SELECT
        COALESCE(device_type, 'unknown') AS device,
        COUNT(*) AS sessions
      FROM analytic_sessions
      WHERE client_id = $1
        AND first_seen_at >= ${cutoff}
      GROUP BY COALESCE(device_type, 'unknown')
      ORDER BY sessions DESC
    `, [clientId]),

    // 5. Daily orders + revenue (last N days)
    db.query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(total_price), 0) AS revenue
      FROM store_orders
      WHERE client_id = $1
        AND deleted_at IS NULL
        AND status NOT IN ('cancelled', 'declined', 'fake')
        AND created_at >= ${cutoff}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [clientId]),

    // 6. New vs returning customers
    db.query(`
      WITH first_orders AS (
        SELECT customer_phone, MIN(created_at) AS first_order_date
        FROM store_orders
        WHERE client_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled', 'declined', 'fake')
        GROUP BY customer_phone
      ),
      period_orders AS (
        SELECT
          o.customer_phone,
          o.total_price,
          CASE WHEN fo.first_order_date >= ${cutoff} THEN 'new' ELSE 'returning' END AS customer_type
        FROM store_orders o
        JOIN first_orders fo ON fo.customer_phone = o.customer_phone
        WHERE o.client_id = $1
          AND o.deleted_at IS NULL
          AND o.status NOT IN ('cancelled', 'declined', 'fake')
          AND o.created_at >= ${cutoff}
      )
      SELECT
        COUNT(DISTINCT customer_phone) FILTER (WHERE customer_type = 'new') AS new_customers,
        COUNT(DISTINCT customer_phone) FILTER (WHERE customer_type = 'returning') AS returning_customers,
        COALESCE(SUM(total_price) FILTER (WHERE customer_type = 'new'), 0) AS new_revenue,
        COALESCE(SUM(total_price) FILTER (WHERE customer_type = 'returning'), 0) AS returning_revenue
      FROM period_orders
    `, [clientId]),

    // 7. Funnel for conversion & cart abandonment
    db.query(`
      SELECT
        COUNT(*) AS total_sessions,
        COUNT(*) FILTER (WHERE add_to_cart_count > 0) AS cart_sessions,
        COUNT(*) FILTER (WHERE purchase_count > 0) AS purchase_sessions
      FROM analytic_sessions
      WHERE client_id = $1
        AND first_seen_at >= ${cutoff}
    `, [clientId]),
  ]);

  const cs = customerStatsResult.rows[0] || {};
  const totalSessions = Number(funnelResult.rows[0]?.total_sessions || 0);
  const cartSessions = Number(funnelResult.rows[0]?.cart_sessions || 0);
  const purchaseSessions = Number(funnelResult.rows[0]?.purchase_sessions || 0);

  const deviceRows = deviceResult.rows;
  const totalDeviceSessions = deviceRows.reduce((sum: number, r: any) => sum + Number(r.sessions), 0);

  const nvr = newVsReturningResult.rows[0] || {};

  return {
    totalCustomers: Number(cs.total_customers || 0),
    repeatCustomers: Number(cs.repeat_customers || 0),
    repeatRate: Number(cs.total_customers) > 0 ? (Number(cs.repeat_customers) / Number(cs.total_customers)) * 100 : 0,
    averageOrderValue: Number(cs.avg_order_value || 0),
    averageOrdersPerCustomer: Number(cs.avg_orders_per_customer || 0),
    totalRevenue: Number(cs.total_revenue || 0),
    topCustomers: topCustomersResult.rows.map((r: any) => ({
      name: r.name || 'Unknown',
      phone: r.phone,
      orders: Number(r.orders),
      totalSpent: Number(r.total_spent),
      lastOrder: r.last_order,
    })),
    wilayaBreakdown: wilayaResult.rows.map((r: any) => ({
      wilayaId: Number(r.wilaya_id),
      wilayaName: getAlgeriaWilayaNameById(r.wilaya_id) || `Wilaya ${r.wilaya_id}`,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
      customers: Number(r.customers),
    })),
    deviceBreakdown: deviceRows.map((r: any) => ({
      device: r.device,
      sessions: Number(r.sessions),
      share: totalDeviceSessions > 0 ? (Number(r.sessions) / totalDeviceSessions) * 100 : 0,
    })),
    ordersByDay: dailyOrdersResult.rows.map((r: any) => ({
      date: r.date,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    })),
    newVsReturning: {
      newCustomers: Number(nvr.new_customers || 0),
      returningCustomers: Number(nvr.returning_customers || 0),
      newRevenue: Number(nvr.new_revenue || 0),
      returningRevenue: Number(nvr.returning_revenue || 0),
    },
    conversionRate: totalSessions > 0 ? (purchaseSessions / totalSessions) * 100 : 0,
    cartAbandonmentRate: cartSessions > 0 ? ((cartSessions - purchaseSessions) / cartSessions) * 100 : 0,
  };
}

// ─── Gender Detection ─────────────────────────────────────────────────────────

const MALE_NAMES = new Set([
  // Arabic/Algerian male names
  'محمد','ahmed','ahmad','محمداحمد','ali','علي','omar','عمر','youssef','يوسف','karim','كريم',
  'said','سعيد','samir','سامر','samير','hicham','هشام','hamid','حميد','abdelkader','عبد القادر',
  'abderrahmane','عبد الرحمن','abdelmalek','عبد المالك','abdelhamid','عبد الحميد',
  'abdelhak','عبد الحق','abdelouahab','عبد الوهاب','abdelaziz','عبد العزيز',
  'abdelkrim','عبد الكريم','abdelwahid','عبد الواحد','abdeljalil','عبد الجليل',
  'abdelghani','عبد الغني','abdelatif','عبد اللطيف','abdelbaki','عبد الباقي',
  'abdelali','عبد العلي','abdallah','عبد الله','abdellah','رياض',
  'riad','رياض','riyad','riyadh','bilal','بلال','nabil','نبيل',
  'farid','فريد','mehdi','مهدي','walid','وليد','khaled','خالد',
  'khalid','tariq','طارق','tarek','مراد','mourad','murad','nour','نور الدين',
  'younes','يونس','youness','nassim','نسيم','nassim','wassim','وسيم',
  'sami','سامي','sofiane','سفيان','soufiane','islam','إسلام','islamدين',
  'lamine','أمين','amine','امين','amin','الامين','el amine','anis','أنيس',
  'naim','نعيم','badr','بدر','bader','hakim','حكيم','hossam','حسام',
  'houssem','توفيق','tawfiq','taoufiq','ramzi','رامزي','rami','رامي',
  'djamel','جمال','jamal','gamal','mustapha','مصطفى','mustafa','mokhtar','مختار',
  'rachid','رشيد','rashid','salim','سليم','slim','adel','عادل','adil',
  'mondher','منذر','mounir','منير','yacine','ياسين','yassin','yazid','يزيد',
  'ismail','إسماعيل','ibrahim','إبراهيم','idris','إدريس','ilyes','إلياس',
  'ilias','elias','tayeb','الطيب','tijani','التيجاني','madjid','ماجد',
  'majid','hamza','حمزة','hassan','حسن','hussein','حسين','hasan','حسين',
  'fares','فارس','aymen','أيمن','ayman','lotfi','لطفي','latif','لطيف',
  'ridha','رضا','reda','رضا','zine','زين','zinedine','زين الدين',
  'saad','سعد','sad','fouad','فؤاد','fuad','mouad','مؤيد','fathi','فتحي',
  'belgacem','البلقاسم','brahim','براهيم','mimoun','ميمون','mouloud','مولود',
  'taha','طه','tahar','طاهر','slimane','سليمان','suleiman','sulaiman',
  'maher','ماهر','moussa','موسى','musa','massinissa','ماسينيسا','yidir','يدير',
  'aghiles','أغيلاس','takfarinas','تاقفاريناس','idir','إيدير','jugurtha','يوغرطة',
]);

const FEMALE_NAMES = new Set([
  // Arabic/Algerian female names
  'فاطمة','fatima','fatma','سارة','sara','sarah','أميرة','amira','amirat',
  'نادية','nadia','nadya','سامية','samia','samiya','كريمة','karima','karime',
  'سهيلة','souhila','suheila','وردة','warda','وردية','wardia',
  'زهرة','zahra','zohra','نوال','nawal','nawel','رحمة','rahma',
  'حنان','hanan','hanane','هناء','hanaa','هيام','hiyam',
  'مليكة','malika','ملاك','malak','ليلى','leila','layla','laila',
  'نسرين','nesrin','nissrine','منى','mona','muna','سلمى','salma',
  'ياسمين','yasmine','jasmine','إيمان','imane','iman','أسماء','asma','asmaa',
  'رجاء','raja','rajaa','شيماء','shayma','chaima','يمنى','yomna',
  'أريج','arij','عائشة','aisha','aicha','خديجة','khadija','khedidja',
  'مريم','meryem','mariam','مريمة','meriem','زينب','zeinab','zaynab',
  'هدى','houda','hoda','hadda','حدة','سعاد','souad','soad',
  'رنا','rana','رانيا','rania','رانية','بسمة','bassma','basma',
  'حورية','houria','horia','وفاء','wafaa','wafa','أماني','amani',
  'حياة','hayat','هيفاء','haifa','سناء','sanaa','sana',
  'دليلة','dalila','ديلة','دنيا','dounia','duniya',
  'ربيعة','rabiaa','rabia','حسيبة','hassiba','hasiba','نجمة','najma',
  'تقى','taqwa','nabila','نبيلة','nabilat','إكرام','ikram','وسيلة','wassila',
  'فيروز','fairouz','fayrouz','فريدة','farida','جميلة','djamila','jamila',
  'نزيهة','nazha','naziha','خولة','khawla','عزيزة','aziza','صبرينة','sabrina',
  'سيرين','sirin','sirine','سيلين','selene','أميمة','omeima','حفصة','hafsa',
  'صفية','safia','safiya','كوثر','kawtar','kaouther','لبنى','lobna','lubna',
  'لينة','lina','lynا','لمى','lama','loma','شهد','shahd','شهرزاد','shahrazad',
  'وئام','wiam','وسن','wassan','نهى','noha','ندى','nada','sonia','سونيا',
]);

/**
 * Detect likely gender from a customer name.
 * Returns 'male', 'female', or 'unknown'.
 */
export function detectGenderFromName(name: string | null | undefined): 'male' | 'female' | 'unknown' {
  if (!name) return 'unknown';
  const normalized = name.trim().toLowerCase();
  // Try the first word of the name (given name)
  const firstWord = normalized.split(/[\s,]+/)[0];

  if (MALE_NAMES.has(firstWord) || MALE_NAMES.has(normalized)) return 'male';
  if (FEMALE_NAMES.has(firstWord) || FEMALE_NAMES.has(normalized)) return 'female';

  // Arabic prefix detection
  if (/^(عبد|أبو|ابو)/.test(firstWord)) return 'male';
  if (/^(أم |ام )/.test(normalized)) return 'female';

  // Suffix heuristics for Arabic (ة = female marker)
  if (firstWord.endsWith('ة') || firstWord.endsWith('ات') || firstWord.endsWith('ة ')) return 'female';

  return 'unknown';
}

export interface GenderAnalytics {
  male: number;
  female: number;
  unknown: number;
  total: number;
  malePercent: number;
  femalePercent: number;
  unknownPercent: number;
  // By product breakdown
  byProduct: { productId: number; productTitle: string; male: number; female: number; unknown: number }[];
}

export async function getGenderAnalytics(clientId: number, days: number): Promise<GenderAnalytics> {
  const safeDays = Math.min(3650, Math.max(1, Math.round(days || 30)));
  const db = await ensureConnection();
  const cutoff = `NOW() - INTERVAL '${safeDays} days'`;

  const [ordersResult, byProductResult] = await Promise.all([
    db.query(`
      SELECT customer_name
      FROM store_orders
      WHERE client_id = $1
        AND deleted_at IS NULL
        AND status NOT IN ('cancelled', 'declined', 'fake', 'duplicate')
        AND created_at >= ${cutoff}
    `, [clientId]),

    db.query(`
      SELECT
        so.product_id,
        csp.title AS product_title,
        so.customer_name
      FROM store_orders so
      LEFT JOIN client_store_products csp ON csp.id = so.product_id
      WHERE so.client_id = $1
        AND so.deleted_at IS NULL
        AND so.status NOT IN ('cancelled', 'declined', 'fake', 'duplicate')
        AND so.created_at >= ${cutoff}
      ORDER BY so.product_id
    `, [clientId]),
  ]);

  let male = 0, female = 0, unknown = 0;
  for (const row of ordersResult.rows) {
    const g = detectGenderFromName(row.customer_name);
    if (g === 'male') male++;
    else if (g === 'female') female++;
    else unknown++;
  }
  const total = male + female + unknown;

  // By product
  const productMap: Record<number, { productId: number; productTitle: string; male: number; female: number; unknown: number }> = {};
  for (const row of byProductResult.rows) {
    const pid = Number(row.product_id) || 0;
    if (!productMap[pid]) {
      productMap[pid] = { productId: pid, productTitle: row.product_title || 'Unknown', male: 0, female: 0, unknown: 0 };
    }
    const g = detectGenderFromName(row.customer_name);
    productMap[pid][g]++;
  }

  const byProduct = Object.values(productMap)
    .sort((a, b) => (b.male + b.female + b.unknown) - (a.male + a.female + a.unknown))
    .slice(0, 10);

  return {
    male, female, unknown, total,
    malePercent: total > 0 ? Math.round((male / total) * 100) : 0,
    femalePercent: total > 0 ? Math.round((female / total) * 100) : 0,
    unknownPercent: total > 0 ? Math.round((unknown / total) * 100) : 0,
    byProduct,
  };
}

// ─── Product Performance ─────────────────────────────────────

export interface ProductPerformance {
  productId: number;
  title: string;
  sellingPrice: number;
  totalOrders: number;
  revenue: number;
  deliveredOrders: number;
  returnedOrders: number;
  deliveryRate: number;
  buyCost: number;
  packagingCost: number;
  handlingCost: number;
  shippingCost: number;
  callCenterCost: number;
  otherCosts: number;
  returnCost: number;
  adCostPerOrder: number;
  totalCostPerOrder: number;
  netProfitPerOrder: number;
  totalProfit: number;
  roi: number;
}

export async function getProductPerformance(clientId: number, days: number): Promise<ProductPerformance[]> {
  const safeDays = Math.min(3650, Math.max(1, Math.round(days || 30)));
  const db = await ensureConnection();

  const result = await db.query(`
    WITH product_orders AS (
      SELECT
        o.product_id,
        COALESCE(p.title, 'منتج غير معروف') AS title,
        COALESCE(p.price, 0) AS selling_price,
        COUNT(*) AS total_orders,
        COALESCE(SUM(o.total_price), 0) AS revenue,
        COUNT(*) FILTER (WHERE o.status IN ('delivered','completed')) AS delivered_orders,
        COUNT(*) FILTER (WHERE o.status IN ('cancelled','declined','returned','refunded')) AS returned_orders
      FROM store_orders o
      LEFT JOIN client_store_products p ON p.id = o.product_id
      WHERE o.client_id = $1
        AND o.created_at >= NOW() - INTERVAL '${safeDays} days'
        AND o.deleted_at IS NULL
        AND o.status NOT IN ('fake')
      GROUP BY o.product_id, p.title, p.price
      HAVING COUNT(*) > 0
    ),
    total_ad AS (
      SELECT COALESCE(SUM(spend), 0) AS total_spend
      FROM creative_spend_entries
      WHERE client_id = $1
        AND entry_date >= CURRENT_DATE - INTERVAL '${safeDays} days'
    )
    SELECT
      po.*,
      COALESCE(pe.buy_cost, 0) AS buy_cost,
      COALESCE(pe.packaging_cost, 0) AS packaging_cost,
      COALESCE(pe.handling_cost, 0) AS handling_cost,
      COALESCE(pe.fallback_shipping_cost, 0) AS fallback_shipping_cost,
      COALESCE(pe.call_center_cost, 0) AS call_center_cost,
      COALESCE(pe.other_costs, 0) AS other_costs,
      COALESCE(pe.return_cost, 0) AS return_cost,
      ta.total_spend
    FROM product_orders po
    LEFT JOIN product_economics pe ON pe.client_id = $1 AND pe.product_id = po.product_id
    CROSS JOIN total_ad ta
    ORDER BY po.revenue DESC
    LIMIT 20
  `, [clientId]);

  return result.rows.map((r: any) => {
    const totalOrders = Number(r.total_orders);
    const deliveredOrders = Number(r.delivered_orders);
    const revenue = Number(r.revenue);
    const totalSpend = Number(r.total_spend);

    const buyCost = Number(r.buy_cost);
    const packagingCost = Number(r.packaging_cost);
    const handlingCost = Number(r.handling_cost);
    const shippingCost = Number(r.fallback_shipping_cost);
    const callCenterCost = Number(r.call_center_cost);
    const otherCosts = Number(r.other_costs);
    const returnCost = Number(r.return_cost);

    const adCostPerOrder = deliveredOrders > 0 ? totalSpend / deliveredOrders : 0;
    const totalCostPerOrder = buyCost + packagingCost + handlingCost + shippingCost + callCenterCost + otherCosts + adCostPerOrder;
    const sellingPrice = Number(r.selling_price);
    const netProfitPerOrder = sellingPrice - totalCostPerOrder;
    const totalProfit = netProfitPerOrder * deliveredOrders - returnCost * Number(r.returned_orders);
    const roi = totalCostPerOrder > 0 ? (netProfitPerOrder / totalCostPerOrder) * 100 : 0;

    return {
      productId: Number(r.product_id),
      title: String(r.title),
      sellingPrice,
      totalOrders,
      revenue,
      deliveredOrders,
      returnedOrders: Number(r.returned_orders),
      deliveryRate: totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0,
      buyCost,
      packagingCost,
      handlingCost,
      shippingCost,
      callCenterCost,
      otherCosts,
      returnCost,
      adCostPerOrder: Number(adCostPerOrder.toFixed(2)),
      totalCostPerOrder: Number(totalCostPerOrder.toFixed(2)),
      netProfitPerOrder: Number(netProfitPerOrder.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      roi: Number(roi.toFixed(1)),
    };
  });
}