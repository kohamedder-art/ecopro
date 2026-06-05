/**
 * AI Routes — /api/ai/*
 *
 * Role-Based AI Routing: each endpoint verifies the caller's role
 * and passes only the data that role is authorized to see to Gemini.
 * The API key and raw DB data NEVER reach the client.
 *
 * Route groups:
 *   /api/ai/product/*       → store owner (requireClient)
 *   /api/ai/whatsapp/*      → store owner (requireClient)
 *   /api/ai/order/*         → store owner or staff
 *   /api/ai/analytics/*     → store owner (requireClient)
 *   /api/ai/store/*         → store owner (requireClient)
 *   /api/ai/storefront/*    → public (rate limited)
 *   /api/ai/admin/*         → admin (requireAdmin)
 *   /api/ai/staff/*         → staff (authenticateStaff)
 *   /api/ai/faq             → public (rate limited)
 *   /api/ai/announcement    → admin (requireAdmin)
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { generateText, generateTextWithSearch, generateJSON, analyzeProductImage } from '../services/gemini';
import { handleOwnerMessage, getOwnerHistory, saveOwnerHistory, executeAction } from '../services/owner-ai';
import { verifyToken } from '../utils/auth';
import { authenticate, requireAdmin, requireClient } from '../middleware/auth';
import { authenticateStaff } from '../utils/staff-middleware';
import { pool } from '../utils/database';

async function checkAIActionPermission(clientId: number, toggle: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT ${toggle} FROM ai_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    return res.rows[0]?.[toggle] !== false;
  } catch {
    return true;
  }
}
import {
  getClientAlerts,
  markAlertRead,
  markAlertDismissed,
  markAlertFollowed,
  verifyAlertOwnership,
} from '../utils/alert-service';
import { getOmniOverview } from '../services/omni-intelligence';
import { getQuotaSummary } from '../services/ai-quota';
import { handleCustomerMessage } from '../services/customer-ai';
import { sendTelegramMessage } from '../utils/bot-messaging';
import { sendWhatsAppTextMessage } from './whatsapp-cloud';
import { sendMessengerMessageDirect } from '../utils/bot-messaging';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

const serverError = (res: Response, err: any) => {
  const raw: string = err?.message || String(err);
  console.error('[AI route error]', raw);
  if (raw === 'AI_QUOTA_EXCEEDED') {
    return res.status(503).json({ error: 'The AI service is temporarily unavailable. Please try again in a few minutes.' });
  }
  // Never expose raw internal errors to the client
  return res.status(500).json({ error: 'AI request failed. Please try again.' });
};

function extractAiUser(req: Request): any | null {
  try {
    const token = req.cookies?.ecopro_at;
    if (!token) return null;
    return verifyToken(token) as any;
  } catch {
    return null;
  }
}

// Strict rate limiter for public AI endpoints (prevents abuse / cost overruns)
const publicAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

// Authenticated AI endpoints allow more headroom
const authAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

// ════════════════════════════════════════════════════════════
// PHASE 2 — Store Owner: Product Management
// ════════════════════════════════════════════════════════════

/**
 * GET /api/ai/quota
 * Returns AI quota usage summary for the authenticated store owner.
 */
router.get('/quota', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const summary = await getQuotaSummary(user.id);
    return res.json(summary);
  } catch (err) {
    console.error('[AI quota error]', err);
    return res.status(500).json({ error: 'Failed to fetch quota data' });
  }
});

/**
 * POST /api/ai/product/description
 * Generates a product description for the store owner's own product.
 * Body: { title, category?, keywords? }
 */
router.post('/product/description', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { title, category, keywords } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    // Fetch store context server-side only (owner sees only their own store)
    let storeName = '';
    try {
      const r = await pool.query('SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1', [user.id]);
      storeName = r.rows[0]?.store_name || '';
    } catch { /* non-critical */ }

    const prompt = `Write a compelling product description for the following product in an Algerian online store.
Product title: "${title}"
${category ? `Category: ${category}` : ''}
${keywords ? `Keywords/features: ${keywords}` : ''}
${storeName ? `Store: ${storeName}` : ''}

Requirements:
- 2–4 sentences, marketing-focused
- Highlight key benefits and appeal to Algerian buyers
- Use the same language as the product title (Arabic or French or English)
- Do not add a price
- Do not include HTML tags`;

    const description = await generateText('store_owner', prompt, { storeId: user.id, storeName, clientId: user.id, userType: 'owner' });
    return res.json({ description });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/product/title
 * Generates 3 title suggestions.
 * Body: { currentTitle, category? }
 */
router.post('/product/title', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { currentTitle, category } = req.body;
    if (!currentTitle) return res.status(400).json({ error: 'currentTitle is required' });

    const prompt = `Given the product title "${currentTitle}"${category ? ` in category "${category}"` : ''}, suggest 3 improved, catchy product titles for an Algerian e-commerce store. Return a JSON array of 3 strings only. Example: ["Title 1","Title 2","Title 3"]`;

    const suggestions = await generateJSON<string[]>('store_owner', prompt, { storeId: user.id });
    return res.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [] });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/product/pricing
 * Suggests a price range based on product info.
 * Body: { title, description?, category? }
 */
router.post('/product/pricing', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const prompt = `For the following product sold in Algeria (currency: Algerian Dinar DZD), suggest a competitive retail price range.
Product: "${title}"
${category ? `Category: ${category}` : ''}
${description ? `Description: ${description}` : ''}

Return JSON: {"min": number, "max": number, "recommended": number, "reasoning": "brief explanation in same language as input"}`;

    const pricing = await generateJSON<{ min: number; max: number; recommended: number; reasoning: string }>(
      'store_owner', prompt, { storeId: user.id }
    );
    return res.json(pricing);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/product/alt-text
 * Generates alt text for a product image URL.
 * Body: { imageUrl, productTitle }
 */
router.post('/product/alt-text', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { productTitle } = req.body;
    if (!productTitle) return res.status(400).json({ error: 'productTitle is required' });

    const prompt = `Write a concise, SEO-friendly image alt text (max 15 words) for a product image of: "${productTitle}". Return only the alt text string, no quotes.`;
    const altText = await generateText('store_owner', prompt, { storeId: user.id, clientId: user.id, userType: 'owner' });
    return res.json({ altText });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 3 — Store Owner: Customer Communication
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/whatsapp/compose
 * Drafts a WhatsApp broadcast campaign message.
 * Body: { segment, campaignType, storeInfo? }
 */
router.post('/whatsapp/compose', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { segment, campaignType, storeInfo } = req.body;

    let storeName = storeInfo?.storeName || '';
    if (!storeName) {
      try {
        const r = await pool.query('SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1', [user.id]);
        storeName = r.rows[0]?.store_name || 'our store';
      } catch { storeName = 'our store'; }
    }

    const segmentDesc: Record<string, string> = {
      all: 'all customers',
      completed: 'customers who completed orders',
      cancelled: 'customers who cancelled orders',
      pending: 'customers with pending orders',
      failed: 'customers with failed delivery',
    };

    const prompt = `Write a WhatsApp marketing message for ${segmentDesc[segment] || segment} of "${storeName}".
Campaign type: ${campaignType || 'general promotion'}
Language: Arabic or French (choose based on store name language)
Requirements:
- Friendly, conversational WhatsApp style
- Max 3 sentences / 100 words
- Include a clear call-to-action
- No HTML, no links (the system adds them)
- Start with a greeting emoji`;

    const message = await generateText('store_owner', prompt, { storeId: user.id, storeName, clientId: user.id, userType: 'owner' });
    return res.json({ message });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/order/reply-templates
 * Returns 3 WhatsApp reply templates for a given situation.
 * Body: { situation }
 */
router.post('/order/reply-templates', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { situation } = req.body;
    if (!situation) return res.status(400).json({ error: 'situation is required' });

    const prompt = `Write 3 short, friendly WhatsApp reply templates for a store owner dealing with this situation: "${situation}".
Return JSON array of 3 strings. Each template max 2 sentences. Written in Arabic or French.
Example: ["Template 1","Template 2","Template 3"]`;

    const templates = await generateJSON<string[]>('store_owner', prompt, { storeId: user.id });
    return res.json({ templates: Array.isArray(templates) ? templates.slice(0, 3) : [] });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/order/priority
 * Summarizes today's pending orders and flags urgent ones.
 * Body: { orders: { id, customer_name, status, created_at, total_price }[] }
 */
router.post('/order/priority', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let { orders } = req.body;

    // Fetch server-side if not provided (more secure)
    if (!orders || !Array.isArray(orders)) {
      const r = await pool.query(
        `SELECT id, customer_name, status, created_at, total_price
         FROM store_orders WHERE client_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 50`,
        [user.id]
      );
      orders = r.rows;
    }

    if (orders.length === 0) {
      return res.json({ summary: 'No pending orders at the moment.', urgentOrders: [] });
    }

    // Sanitize: only pass non-PII fields to AI
    const safeOrders = orders.map((o: any) => ({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      total_price: o.total_price,
      product_title: "N/A",
    }));

    const prompt = `You are analyzing pending orders for a store. Here are the orders (JSON):
${JSON.stringify(safeOrders)}

Provide:
1. A 2-sentence plain-language summary of the pending orders situation
2. IDs of orders that are urgent (older than 24 hours or high value above 5000 DZD)

Return JSON: {"summary": "...", "urgentOrders": [id1, id2, ...]}`;

    const result = await generateJSON<{ summary: string; urgentOrders: number[] }>(
      'store_owner', prompt, { storeId: user.id }
    );
    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 4 — Store Owner: Analytics Insights
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/analytics/narrate
 * Generates a plain-language weekly narrative from analytics data.
 * Body: { stats, analytics }
 */
router.post('/analytics/narrate', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { stats, analytics, days, locale } = req.body;
    if (!stats) return res.status(400).json({ error: 'stats is required' });

    const langMap: Record<string, string> = { ar: 'Arabic', fr: 'French', en: 'English' };
    const lang = langMap[String(locale || 'ar').slice(0, 2)] || 'Arabic';

    const summary = {
      totalOrders: stats.orders,
      revenue: stats.revenue,
      pendingOrders: stats.pendingOrders,
      completedOrders: stats.completedOrders,
      topProducts: analytics?.topProducts?.slice(0, 3).map((p: any) => ({ title: p.title, orders: p.total_orders })) || [],
      topCities: analytics?.cityBreakdown?.slice(0, 3).map((c: any) => ({ city: c.city, orders: c.count })) || [],
      days: days || 7,
    };

    const prompt = `Write a friendly, insightful business summary paragraph (3–5 sentences) for a store owner based on these ${summary.days}-day stats:
${JSON.stringify(summary)}

Include: total orders, revenue in DZD, top-selling products, top cities, and one actionable recommendation.
You MUST write exclusively in ${lang}. Do not use any other language.`;

    const narrative = await generateText('store_owner', prompt, { storeId: user.id, clientId: user.id, userType: 'owner' });
    return res.json({ narrative });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/analytics/forecast
 * Predicts which products to restock based on recent order history.
 */
router.post('/analytics/forecast', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Fetch top products and their current stock server-side
    const r = await pool.query(
      `SELECT p.id, p.title, p.stock_quantity,
              COUNT(o.id) as recent_orders,
              MAX(o.created_at) as last_ordered
       FROM client_store_products p
       LEFT JOIN store_orders o ON o.product_id = p.id AND o.created_at > NOW() - INTERVAL '30 days'
       WHERE p.client_id = $1
       GROUP BY p.id, p.title, p.stock_quantity
       ORDER BY recent_orders DESC
       LIMIT 20`,
      [user.id]
    );

    if (r.rows.length === 0) return res.json({ forecast: [] });

    const { locale: forecastLocale } = req.body;
    const forecastLangMap: Record<string, string> = { ar: 'Arabic', fr: 'French', en: 'English' };
    const forecastLang = forecastLangMap[String(forecastLocale || 'ar').slice(0, 2)] || 'Arabic';

    const prompt = `Based on this product sales data from the last 30 days, identify which products need restocking and predict demand.
Data: ${JSON.stringify(r.rows)}

Return JSON array: [{"productId": number, "title": "string", "expectedDemand": "high|medium|low", "recommendation": "brief action"}]
Only include products that need attention (low stock + high orders, or high recent demand).
You MUST write the "recommendation" field exclusively in ${forecastLang}. Do not use any other language.`;

    const forecast = await generateJSON<any[]>('store_owner', prompt, { storeId: user.id });
    return res.json({ forecast: Array.isArray(forecast) ? forecast : [] });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/analytics/churn-warning
 * Warns if store revenue shows a declining trend.
 */
router.post('/analytics/churn-warning', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { revenueHistory, locale: churnLocale } = req.body; // [{ date, revenue }]

    if (!revenueHistory || !Array.isArray(revenueHistory) || revenueHistory.length < 3) {
      return res.json({ warning: null });
    }

    const churnLangMap: Record<string, string> = { ar: 'Arabic', fr: 'French', en: 'English' };
    const churnLang = churnLangMap[String(churnLocale || 'ar').slice(0, 2)] || 'Arabic';

    const prompt = `Analyze this daily revenue trend for an Algerian online store (DZD):
${JSON.stringify(revenueHistory.slice(-14))}

If there is a clear downward trend (3+ consecutive declining days or significant revenue drop), return a JSON warning.
Otherwise return null warning.
Return JSON: {"warning": "friendly 1-sentence warning with a specific tip, or null if trend is fine"}
You MUST write the warning text exclusively in ${churnLang}. Do not use any other language.`;

    const result = await generateJSON<{ warning: string | null }>('store_owner', prompt, { storeId: user.id });
    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/analyze-behavior
 * Builds a structured Omni behavior analysis with deterministic metrics plus an AI-written brief.
 * Body: { days?: number }
 */
router.post('/analyze-behavior', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const requestedDays = Number(req.body?.days ?? 30);
    const days = Number.isFinite(requestedDays) ? Math.min(3650, Math.max(1, Math.round(requestedDays))) : 30;
    const snapshot = await getOmniOverview(user.id, days);

    const toxicSuccessFlags = snapshot.creativeComparison
      .filter((creative) => creative.toxicSuccess)
      .slice(0, 5)
      .map((creative) => ({
        key: creative.key,
        creativeName: creative.creativeName || creative.campaignName || creative.platform || 'Unknown creative',
        platform: creative.platform,
        bookedRevenue: creative.bookedRevenue,
        spend: creative.spend,
        netProfit: creative.netProfit,
        poas: creative.poas,
        returnRate: creative.returnRate,
        deliveredRate: creative.deliveredRate,
        topFriction: creative.topFriction,
      }));

    const retentionCandidates = snapshot.creativeComparison
      .filter((creative) => creative.deliveredOrders >= 2 && creative.netProfit > 0)
      .slice(0, 3)
      .map((creative) => ({
        segment: creative.creativeName || creative.campaignName || creative.platform || 'Winning audience',
        reason: `${creative.deliveredOrders} delivered orders with ${creative.netProfit.toLocaleString()} DZD net profit in the selected period.`,
        suggestedMessage: `Follow up with delivered buyers from ${creative.creativeName || creative.campaignName || creative.platform || 'this audience'} using a post-purchase upsell or review request.`,
      }));

    const RECOMMENDATION_LABELS: Record<string, { title: string; type: string; detail: string; action: string }> = {
      toxic_creatives:   { title: 'Toxic Success Creatives',  type: 'review_creative',      detail: 'Some creatives appear profitable on the surface but have high return/failure rates.',       action: 'Review flagged creatives and pause under-performers.' },
      checkout_friction:  { title: 'Checkout Friction',        type: 'audit_checkout',       detail: 'Visitors are reaching checkout but not completing their purchase.',                         action: 'Simplify the checkout form and review delivery pricing.' },
      price_trust:        { title: 'Price / Trust Issues',     type: 'improve_landing_page', detail: 'Engaged visitors are leaving without adding to cart — possible price or trust barrier.',     action: 'Add social proof, reviews, or adjust pricing on key products.' },
      ad_mismatch:        { title: 'Ad–Landing Page Mismatch', type: 'improve_landing_page', detail: 'Traffic is bouncing quickly — the ad promise may not match the landing experience.',        action: 'Align ad creatives with landing page content and offer.' },
      missing_economics:  { title: 'Missing Product Costs',    type: 'fill_product_costs',   detail: 'Product cost data is incomplete, making profit calculations unreliable.',                  action: 'Fill in buy cost, packaging, and handling for all products.' },
      missing_spend:      { title: 'Missing Ad Spend Data',    type: 'add_spend_data',       detail: 'No ad spend entries found — POAS and net profit cannot be calculated.',                    action: 'Add daily ad spend data in the creative catalog.' },
    };

    const optimizationCommands = snapshot.recommendations.map((recommendation, index) => {
      const meta = RECOMMENDATION_LABELS[recommendation.key] || {
        title: recommendation.key.replace(/_/g, ' '),
        type: 'general_review',
        detail: '',
        action: '',
      };

      return {
        id: `cmd-${index + 1}`,
        type: meta.type,
        priority: recommendation.severity,
        label: meta.title,
        rationale: meta.detail,
        nextStep: meta.action,
      };
    });

    const fallbackSummary = [
      `In the last ${snapshot.periodDays} days, Omni tracked ${snapshot.overview.sessions} sessions, ${snapshot.overview.purchases} purchases, and ${snapshot.overview.bookedRevenue.toLocaleString()} DZD in booked revenue.`,
      `Realized profit is ${snapshot.overview.grossProfit.toLocaleString()} DZD before ads and ${snapshot.overview.netProfit.toLocaleString()} DZD after ${snapshot.overview.adSpend.toLocaleString()} DZD in spend.`,
      `${snapshot.overview.toxicCreativeCount} creative segments are currently flagged as toxic success, and the top friction cluster is ${snapshot.frictionClusters[0]?.label || 'not available yet'}.`,
    ].join(' ');

    let summary = fallbackSummary;
    try {
      const locale = req.body?.locale || 'ar';
      const isArabic = locale === 'ar';
      const languageInstruction = isArabic ? 'أكتب الرد بالعربية (Arabic). ' : '';
      
      const aiPrompt = `You are preparing a short optimization brief for a store owner.
Use this sanitized Omni summary JSON and write exactly 4 short sentences in plain business language.
Mention: the strongest opportunity, the biggest friction, whether creatives are profitable, and the most important next action.
Do not invent numbers.
${languageInstruction}

JSON:
${JSON.stringify({
  periodDays: snapshot.periodDays,
  overview: snapshot.overview,
  topFriction: snapshot.frictionClusters.slice(0, 3),
  topCreatives: snapshot.creativeComparison.slice(0, 5).map((creative) => ({
    creativeName: creative.creativeName,
    platform: creative.platform,
    bookedRevenue: creative.bookedRevenue,
    spend: creative.spend,
    netProfit: creative.netProfit,
    poas: creative.poas,
    toxicSuccess: creative.toxicSuccess,
  })),
  recommendations: snapshot.recommendations,
})}`;

      const aiSummary = await generateText('store_owner', aiPrompt, { storeId: user.id, clientId: user.id, userType: 'owner' });
      if (aiSummary && aiSummary.trim()) {
        summary = aiSummary.trim();
      }
    } catch {
      // Fall back to deterministic summary when AI text generation is unavailable.
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      periodDays: snapshot.periodDays,
      overview: snapshot.overview,
      summary,
      frictionClusters: snapshot.frictionClusters,
      toxicSuccessFlags,
      retentionCandidates,
      recommendations: snapshot.recommendations,
      optimizationCommands,
      creativeLeaders: snapshot.creativeComparison.slice(0, 8),
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 5 — Store Owner: Setup & Recommendations
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/store/setup-wizard
 * Guided store setup — answers a series of questions, returns config suggestions.
 * Body: { answers: { businessType, targetCustomers, mainProducts, priceRange, city } }
 */
router.post('/store/setup-wizard', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ error: 'answers is required' });

    const prompt = `Help set up a new Algerian e-commerce store based on these answers:
${JSON.stringify(answers)}

Return JSON with store setup recommendations:
{
  "storeName": "suggested name",
  "storeDescription": "2-sentence store bio",
  "categories": ["cat1", "cat2"],
  "deliveryTip": "tip about which Wilayas to cover first",
  "firstProductIdeas": ["product idea 1", "product idea 2", "product idea 3"],
  "welcomeMessage": "short WhatsApp-style welcome message for first customers"
}`;

    const config = await generateJSON<any>('store_owner', prompt, { storeId: user.id });
    return res.json({ config });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/store/delivery-zones
 * Recommends Wilayas to add based on past order locations.
 */
router.post('/store/delivery-zones', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Fetch top order cities from DB (server-side, scoped to this store only)
    const r = await pool.query(
      `SELECT delivery_address, COUNT(*) as order_count
       FROM store_orders
       WHERE client_id = $1 AND created_at > NOW() - INTERVAL '60 days'
       GROUP BY delivery_address ORDER BY order_count DESC LIMIT 20`,
      [user.id]
    );

    if (r.rows.length === 0) {
      return res.json({ recommendations: ['Focus on major cities: Alger, Oran, Constantine, Annaba'] });
    }

    const prompt = `An Algerian online store has received orders from these locations (last 60 days):
${JSON.stringify(r.rows)}

Based on this data, recommend the top 5 Wilayas (Algerian provinces) to prioritize for delivery coverage.
Return JSON: {"recommendations": ["Wilaya name + brief reason"], "hotspots": ["city names"]}`;

    const result = await generateJSON<any>('store_owner', prompt, { storeId: user.id });
    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 6 — Customer: Public Storefront (NO AUTH — public endpoints)
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/storefront/qa
 * Answers customer questions about a specific product.
 * Body: { question, product: { title, description, price, variants?, category? } }
 * IMPORTANT: Only the public product data is passed to Gemini — no store financials.
 */
router.post('/storefront/qa', publicAiLimiter, async (req: Request, res: Response) => {
  try {
    const { question, product } = req.body;
    if (!question || !product?.title) return res.status(400).json({ error: 'question and product.title are required' });

    // Whitelist only public product fields — never pass internal data
    const safeProduct = {
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      variants: Array.isArray(product.variants)
        ? product.variants.map((v: any) => ({ name: v.name, price: v.price }))
        : [],
    };

    const prompt = `A customer is asking about this product:
${JSON.stringify(safeProduct)}

Customer question: "${question}"

Answer helpfully and concisely (max 3 sentences). If the answer is not in the product info, say you don't have that detail and suggest the customer contact the store. Respond in the same language as the question.`;

    const answer = await generateText('public', prompt);
    return res.json({ answer });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/storefront/recommend-variant
 * Recommends the best product variant based on customer description.
 * Body: { customerDescription, variants: [{ id, name, price }] }
 */
router.post('/storefront/recommend-variant', publicAiLimiter, async (req: Request, res: Response) => {
  try {
    const { customerDescription, variants, productTitle } = req.body;
    if (!customerDescription || !Array.isArray(variants)) {
      return res.status(400).json({ error: 'customerDescription and variants are required' });
    }

    const safeVariants = variants.map((v: any) => ({ id: v.id, name: v.name, price: v.price }));

    const prompt = `A customer described what they need: "${customerDescription}"
Available product variants for "${productTitle || 'this product'}": ${JSON.stringify(safeVariants)}

Which variant best matches? Return JSON: {"variantId": id_or_null, "variantName": "name or null", "reason": "1-sentence explanation in customer's language"}`;

    const result = await generateJSON<{ variantId: number | null; variantName: string | null; reason: string }>(
      'public', prompt
    );
    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/storefront/recommendations
 * Returns related product IDs from the same store.
 * Body: { currentProduct, storeProducts: [{ id, title, category }] }
 */
router.post('/storefront/recommendations', publicAiLimiter, async (req: Request, res: Response) => {
  try {
    const { currentProduct, storeProducts } = req.body;
    if (!currentProduct || !Array.isArray(storeProducts)) {
      return res.status(400).json({ error: 'currentProduct and storeProducts are required' });
    }

    // Only pass public-safe fields (id, title, category) — no stock/pricing strategy
    const safeProducts = storeProducts.slice(0, 30).map((p: any) => ({
      id: p.id,
      title: p.title,
      category: p.category,
    }));

    const prompt = `A customer is viewing: "${currentProduct.title}" (category: ${currentProduct.category || 'general'}).
Other available products in this store: ${JSON.stringify(safeProducts)}

Recommend up to 3 related products the customer might also like. Return JSON array of product IDs: [id1, id2, id3]`;

    const ids = await generateJSON<number[]>('public', prompt);
    return res.json({ productIds: Array.isArray(ids) ? ids.slice(0, 3) : [] });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/storefront/order-status
 * Explains an order's status in a friendly conversational way.
 * Body: { phone, orderId }
 * Security: only returns status/product info — no other personal data.
 */
router.post('/storefront/order-status', publicAiLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, orderId } = req.body;
    if (!orderId && !phone) return res.status(400).json({ error: 'orderId or phone is required' });

    // Query only safe order fields — never expose full customer details to AI
    let order: any = null;
    if (orderId) {
      const r = await pool.query(
        'SELECT id, status, created_at, total_price FROM store_orders WHERE id = $1 LIMIT 1',
        [Number(orderId)]
      );
      order = r.rows[0];
    } else if (phone) {
      const r = await pool.query(
        `SELECT id, status, created_at, total_price
         FROM store_orders WHERE customer_phone = $1 ORDER BY created_at DESC LIMIT 1`,

        [String(phone)]
      );
      order = r.rows[0];
    }

    if (!order) return res.json({ message: "We couldn't find an order with that information. Please check your order number or contact the store." });

    const prompt = `A customer is asking about their order. Here are the safe details:
Order #${order.id}, Status: "${order.status}", Product: "N/A", Placed: ${new Date(order.created_at).toLocaleDateString()}

Write a friendly 2-sentence explanation of what this status means and what happens next. Be encouraging. Respond in Arabic or French.`;

    const message = await generateText('public', prompt);
    return res.json({ message, orderId: order.id, status: order.status });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 7 — Admin Features
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/admin/draft-reply
 * Drafts a suggested admin reply to a store owner's message.
 * Body: { messageContent, clientName? }
 */
router.post('/admin/draft-reply', authenticate, requireAdmin, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const { messageContent, clientName } = req.body;
    if (!messageContent) return res.status(400).json({ error: 'messageContent is required' });

    const prompt = `You are a platform admin assistant for EcoPro (Algerian e-commerce platform).
A store owner${clientName ? ` (${clientName})` : ''} sent this message: "${messageContent}"

Draft a professional, helpful reply (2–4 sentences). Be supportive and solution-focused. Match the language of the store owner's message.`;

    const draft = await generateText('admin', prompt);
    return res.json({ draft });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * GET /api/ai/admin/platform-health
 * Generates a plain-language platform health summary.
 * Cached for 1 hour server-side.
 */
let healthCache: { summary: string; ts: number } | null = null;
const HEALTH_CACHE_MS = 60 * 60 * 1000; // 1 hour

router.get('/admin/platform-health', authenticate, requireAdmin, authAiLimiter, async (_req: Request, res: Response) => {
  try {
    if (healthCache && Date.now() - healthCache.ts < HEALTH_CACHE_MS) {
      return res.json({ summary: healthCache.summary, cached: true });
    }

    // Fetch platform metrics server-side — never expose raw DB to frontend via AI
    const [subR, orderR, storeR] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month
        FROM subscriptions`),
      pool.query(`SELECT COUNT(*) as total FROM store_orders WHERE created_at > NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*) as total FROM client_store_settings`),
    ]);

    const metrics = {
      activeSubscriptions: Number(subR.rows[0]?.active || 0),
      inactiveSubscriptions: Number(subR.rows[0]?.inactive || 0),
      newSubscriptionsThisMonth: Number(subR.rows[0]?.new_this_month || 0),
      ordersLast7Days: Number(orderR.rows[0]?.total || 0),
      totalStores: Number(storeR.rows[0]?.total || 0),
    };

    const prompt = `Summarize this platform health data in 3–4 sentences like a business analyst would for a monthly report. Include at least one actionable insight.
Metrics: ${JSON.stringify(metrics)}
Platform: EcoPro — Algerian e-commerce SaaS. Subscription price: $7/month.`;

    const summary = await generateText('admin', prompt);
    healthCache = { summary, ts: Date.now() };
    return res.json({ summary, cached: false });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * GET /api/ai/admin/churn-prediction
 * Identifies stores at risk of churning based on activity.
 */
router.get('/admin/churn-prediction', authenticate, requireAdmin, authAiLimiter, async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT css.client_id, css.store_name,
              COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '30 days') as orders_30d,
              MAX(o.created_at) as last_order,
              s.is_active as subscription_active
       FROM client_store_settings css
       LEFT JOIN store_orders o ON o.client_id = css.client_id
       LEFT JOIN subscriptions s ON s.user_id = css.client_id
       GROUP BY css.client_id, css.store_name, s.is_active
       ORDER BY orders_30d ASC
       LIMIT 30`
    );

    if (r.rows.length === 0) return res.json({ atRiskStores: [] });

    // Sanitize: pass store_name and metrics, not private info
    const safeData = r.rows.map((row) => ({
      storeId: row.client_id,
      storeName: row.store_name,
      ordersLast30d: Number(row.orders_30d || 0),
      daysSinceLastOrder: row.last_order
        ? Math.floor((Date.now() - new Date(row.last_order).getTime()) / 86400000)
        : 999,
      subscriptionActive: row.subscription_active,
    }));

    const prompt = `Analyze these store activity metrics and identify which stores are at risk of churning:
${JSON.stringify(safeData)}

Criteria for at-risk: 0 orders in 30 days, or inactive subscription, or no orders in >14 days.
Return JSON: [{"storeId": number, "storeName": "string", "reason": "brief reason"}]
Only include genuinely at-risk stores.`;

    const atRiskStores = await generateJSON<any[]>('admin', prompt);
    return res.json({ atRiskStores: Array.isArray(atRiskStores) ? atRiskStores : [] });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/admin/moderate-content
 * Scans product title + description for inappropriate content.
 * Body: { title, description }
 */
router.post('/admin/moderate-content', authenticate, requireAdmin, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const prompt = `Review this product listing for an Algerian e-commerce platform and check if it violates content policies (illegal goods, counterfeit products, explicit content, misinformation, prohibited categories).
Title: "${title}"
Description: "${description || ''}"

Return JSON: {"safe": boolean, "reason": "explanation if not safe, null if safe", "flags": ["flag1","flag2"]}`;

    const result = await generateJSON<{ safe: boolean; reason: string | null; flags: string[] }>('admin', prompt);
    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * GET /api/ai/admin/fraud-detection
 * Flags suspicious order patterns.
 */
router.get('/admin/fraud-detection', authenticate, requireAdmin, authAiLimiter, async (_req: Request, res: Response) => {
  try {
    // Aggregate patterns — no individual PII passed to AI
    const r = await pool.query(
      `SELECT
        o.id,
        o.total_price,
        o.status,
        o.created_at,
        COUNT(*) OVER (PARTITION BY o.customer_phone) as orders_by_phone,
        COUNT(*) OVER (PARTITION BY o.delivery_address) as orders_by_address
       FROM store_orders o
       WHERE o.created_at > NOW() - INTERVAL '7 days'
       ORDER BY orders_by_phone DESC, o.total_price DESC
       LIMIT 50`
    );

    if (r.rows.length === 0) return res.json({ flaggedOrders: [] });

    const safeData = r.rows.map((row) => ({
      id: row.id,
      total_price: row.total_price,
      status: row.status,
      ordersByPhone: Number(row.orders_by_phone),
      ordersByAddress: Number(row.orders_by_address),
      created_at: row.created_at,
    }));

    const prompt = `Analyze these order patterns for potential fraud or abuse in an Algerian e-commerce platform:
${JSON.stringify(safeData)}

Flag orders that show suspicious patterns: same phone many orders all cancelled, unusual order volume, extreme price outliers.
Return JSON: [{"id": number, "reason": "brief reason"}]
Only flag genuinely suspicious orders.`;

    const flaggedOrders = await generateJSON<any[]>('admin', prompt);
    return res.json({ flaggedOrders: Array.isArray(flaggedOrders) ? flaggedOrders : [] });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 8 — Staff Features
// ════════════════════════════════════════════════════════════

/**
 * GET /api/ai/staff/order-digest
 * Returns a morning briefing of pending orders for the staff member's store.
 */
router.get('/staff/order-digest', authenticateStaff, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const staff = (req as any).staff;
    const storeClientId = staff?.client_id;
    if (!storeClientId) return res.status(401).json({ error: 'Unauthorized' });

    const r = await pool.query(
      `SELECT id, status, created_at, total_price
       FROM store_orders WHERE client_id = $1 AND status IN ('pending','confirmed') ORDER BY created_at ASC LIMIT 30`,
      [storeClientId]
    );

    if (r.rows.length === 0) {
      return res.json({ briefing: "Great news — no pending orders right now. You're all caught up!" });
    }

    const safeOrders = r.rows.map((o) => ({
      id: o.id,
      status: o.status,
      product: 'order',

      price: o.total_price,
      hoursAgo: Math.round((Date.now() - new Date(o.created_at).getTime()) / 3600000),
    }));

    const prompt = `Write a concise morning briefing (2–3 sentences) for a store staff member about these pending/confirmed orders:
${JSON.stringify(safeOrders)}
Mention total count, how many are overdue (>24h), and the highest-priority action. Be direct and practical. Use Arabic or French.`;

    const briefing = await generateText('staff', prompt, { storeId: storeClientId });
    return res.json({ briefing });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/staff/suggest-action
 * Suggests the next best action for a specific order.
 * Body: { orderId }
 */
router.post('/staff/suggest-action', authenticateStaff, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const staff = (req as any).staff;
    const storeClientId = staff?.client_id;
    const { orderId } = req.body;
    if (!orderId || !storeClientId) return res.status(400).json({ error: 'orderId is required' });

    // Verify this order belongs to the staff's store
    const r = await pool.query(
      'SELECT id, status, created_at, total_price FROM store_orders WHERE id = $1 AND client_id = $2 LIMIT 1',
      [Number(orderId), storeClientId]
    );
    const order = r.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const hoursAgo = Math.round((Date.now() - new Date(order.created_at).getTime()) / 3600000);

    const prompt = `A staff member is handling this order:
ID: ${order.id}, Status: "${order.status}", Product: "N/A", Price: ${order.total_price} DZD, Placed: ${hoursAgo}h ago

Suggest the single best next action (1 sentence, action-oriented). Examples: "Confirm the order and notify the customer", "Call the customer to verify delivery address". Use Arabic or French.`;

    const action = await generateText('staff', prompt, { storeId: storeClientId });
    return res.json({ action });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 9 — Cross-Platform Features
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/admin/announcement
 * Turns a rough idea into a polished platform announcement.
 * Body: { idea }
 */
router.post('/admin/announcement', authenticate, requireAdmin, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const { idea } = req.body;
    if (!idea) return res.status(400).json({ error: 'idea is required' });

    const prompt = `Write a professional platform announcement for EcoPro store owners based on this idea:
"${idea}"

Requirements:
- Friendly but professional tone
- Max 4 sentences
- Clear headline and body
- In Arabic and French (bilingual, Arabic first)
Return JSON: {"title": "announcement title", "body": "announcement body (bilingual)"}`;

    const announcement = await generateJSON<{ title: string; body: string }>('admin', prompt);
    return res.json(announcement);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/faq
 * Answers platform FAQ questions for any user type.
 * Body: { question, userType? }
 */
router.post('/faq', publicAiLimiter, async (req: Request, res: Response) => {
  try {
    const { question, userType } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    const context = `
Sahla4Eco is an Algerian e-commerce SaaS platform (sahla4eco.com). Store owners create professional storefronts in minutes — no coding required.
- Pricing: $7/month after a 30-day free trial
- 8 storefront templates, all mobile-first (99% of traffic is mobile), with dynamic colors/themes
- Products: unlimited products, variants (size/color), stock management, bulk import
- Delivery: COD (Cash on Delivery) with delivery zones/prices per wilaya (58 wilayas)
- Orders: managed via dashboard, auto-confirmed via Telegram/Messenger/WhatsApp bots
- AI assistant: built-in AI helps manage orders, products, analytics, and answers customer questions
- Staff: add staff with specific permissions
- Affiliates: refer new stores, earn commissions
- Marketing: Facebook & TikTok pixel tracking, promo codes, image split for product showcases
- Integrations: Telegram bot, Facebook Messenger, WhatsApp Cloud API
    `.trim();

    const prompt = `${context}

A ${userType || 'user'} asked: "${question}"

Answer helpfully in 2–3 sentences. If the answer is not about EcoPro, say "I can only answer questions about the EcoPro platform." Respond in the language of the question.`;

    const answer = await generateText('public', prompt);
    return res.json({ answer });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// FLOATING CHAT BUBBLE — Role-aware conversational AI
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/chat
 * Role-aware chat endpoint for the floating bubble.
 * - Authenticated store owner → uses store_owner role + fetches their real store/order data
 * - Authenticated admin → uses admin role
 * - Unauthenticated → uses public/faq mode
 * Body: { question }
 */
router.post('/chat', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    // Accept last 20 prior turns for context (client sends [{role, content}])
    type HistoryMsg = { role: string; content: string };
    const prevHistory: HistoryMsg[] = Array.isArray(history) ? history.slice(-20) : [];

    // Try to identify user from cookie (optional auth — don't reject if not logged in)
    const user = extractAiUser(req);

    // ── Store owner (role: user / seller / client) ──
    if (user && (user.role === 'user' || user.role === 'seller' || user.role === 'client' || user.user_type === 'client')) {
      const clientId = user.id || user.clientId;

      // Convert history to Gemini format
      const geminiHistory = prevHistory.map((m: HistoryMsg) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));

      // Use clean owner AI
      const { answer, action } = await handleOwnerMessage(clientId, question, geminiHistory);

      // Save conversation (non-blocking)
      saveOwnerHistory(clientId, question, answer).catch(() => {});

      return res.json({ answer, ...(action ? { action } : {}) });
    }

    // ── Admin ──
    if (user && user.role === 'admin') {
      let totalStores = 0, activeStores = 0, totalUsers = 0, totalOrders = 0, totalRevenue = 0;
      let recentStores: any[] = [];
      try {
        const [storesRes, usersRes, ordersRes, recentStoresRes] = await Promise.all([
          pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_public = true) as active FROM client_store_settings`),
          pool.query(`SELECT COUNT(*) as count FROM clients`),
          pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(total_price),0) as revenue FROM store_orders WHERE deleted_at IS NULL`),
          pool.query(`SELECT store_name, store_slug, created_at FROM client_store_settings ORDER BY created_at DESC LIMIT 5`),
        ]);
        totalStores = parseInt(storesRes.rows[0]?.total || '0');
        activeStores = parseInt(storesRes.rows[0]?.active || '0');
        totalUsers = parseInt(usersRes.rows[0]?.count || '0');
        totalOrders = parseInt(ordersRes.rows[0]?.count || '0');
        totalRevenue = parseFloat(ordersRes.rows[0]?.revenue || '0');
        recentStores = recentStoresRes.rows;
      } catch { /* non-critical */ }

      const adminContext = `
=== PLATFORM ADMIN CONTEXT ===
Total stores: ${totalStores} | Public/active: ${activeStores}
Total registered users: ${totalUsers}
Total orders across platform: ${totalOrders}
Total platform revenue (non-cancelled): ${totalRevenue.toLocaleString()} DA
Recent 5 new stores: ${recentStores.map(s => `"${s.store_name}" (${new Date(s.created_at).toLocaleDateString()})`).join(', ') || 'none'}

EcoPro: Algerian e-commerce SaaS. Subscription $7/month. Store owners manage their own storefronts independently.
      `.trim();

      const adminHistoryText = prevHistory.length > 0
        ? '\n\n=== PRIOR CONVERSATION ===\n' +
          prevHistory.map((m: HistoryMsg) => `${m.role === 'user' ? 'Admin' : 'AI'}: ${m.content}`).join('\n')
        : '';
      const prompt = `${adminContext}${adminHistoryText}\n\nCurrent question: "${question}"\n\nAnswer concisely. Respond in the language of the question.`;
      const answer = await generateText('admin', prompt);
      return res.json({ answer });
    }

    // ── Public / unauthenticated — same as /faq ──
    const context = `Sahla4Eco is an Algerian e-commerce SaaS platform (sahla4eco.com). Store owners create mobile-first storefronts with 8 templates, dynamic colors, AI assistant, delivery to 58 wilayas, COD payment, Telegram/Messenger/WhatsApp bots, pixel tracking, and staff management. $7/month after 30-day free trial.`;
    const prompt = `${context}\n\nUser asked: "${question}"\n\nAnswer in 2-3 sentences. Respond in the language of the question.`;
    const answer = await generateText('public', prompt);
    return res.json({ answer });

  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// AI ORDER ACTION — POST /api/ai/order-action
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/order-action
 * Executes a store-owner-confirmed order status update proposed by the AI.
 * Authentication: JWT cookie. Body: { orderId: number, newStatus: string }
 */
router.post('/order-action', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);

    if (!user || !(user.role === 'user' || user.role === 'seller' || user.role === 'client' || user.user_type === 'client')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const clientId = user.id || user.clientId;
    if (!await checkAIActionPermission(clientId, 'action_order_status')) {
      return res.status(403).json({ error: 'AI order status change is disabled in AI settings.' });
    }
    const { orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
      return res.status(400).json({ error: 'orderId and newStatus are required.' });
    }
    const allowedStatuses = [
      'pending', 'confirmed', 'processing', 'shipped', 'delivered',
      'cancelled', 'refunded', 'completed', 'failed', 'in_delivery', 'at_delivery',
      'no_answer_1', 'no_answer_2', 'no_answer_3', 'waiting_callback',
      'postponed', 'line_closed', 'fake', 'duplicate', 'returned',
    ];
    if (!allowedStatuses.includes(String(newStatus))) {
      return res.status(400).json({ error: `"${newStatus}" is not a valid order status.` });
    }
    const result = await pool.query(
      `UPDATE store_orders
         SET status = $1, updated_at = NOW()
       WHERE id = $2 AND client_id = $3 AND deleted_at IS NULL
       RETURNING id, status, customer_name`,
      [newStatus, Number(orderId), clientId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or does not belong to your store.' });
    }
    const order = result.rows[0];
    return res.json({
      success: true,
      message: `Order #${order.id} (${order.customer_name || 'customer'}) updated to "${newStatus}".`,
      order,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// AI PRODUCT ACTION — POST /api/ai/product-action
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/product-action
 * Executes a store-owner-confirmed product create/edit/delete action.
 * Body: { type: 'create_product'|'edit_product'|'delete_product', ...fields }
 */
router.post('/product-action', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);

    if (!user || !(user.role === 'user' || user.role === 'seller' || user.role === 'client' || user.user_type === 'client')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const clientId = user.id || user.clientId;
    const { type } = req.body;

    if (type === 'create_product') {
      if (!await checkAIActionPermission(clientId, 'action_create_product')) {
        return res.status(403).json({ error: 'AI product creation is disabled in AI settings.' });
      }
      const { title, price, stock, category, description } = req.body;
      if (!title || price === undefined) return res.status(400).json({ error: 'title and price are required.' });
      const result = await pool.query(
        `INSERT INTO client_store_products (client_id, title, price, stock_quantity, category, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW()) RETURNING id, title`,
        [clientId, String(title).slice(0, 255), Number(price), Number(stock) || 0, String(category || 'General').slice(0, 100), String(description || '').slice(0, 2000)]
      );
      const p = result.rows[0];
      return res.json({ success: true, message: `Product "${p.title}" created successfully (ID: #${p.id}).`, product: p });
    }

    if (type === 'edit_product') {
      if (!await checkAIActionPermission(clientId, 'action_edit_product')) {
        return res.status(403).json({ error: 'AI product editing is disabled in AI settings.' });
      }
      const { productId, field, value } = req.body;
      if (!productId || !field || value === undefined) return res.status(400).json({ error: 'productId, field, and value are required.' });
      const allowedFields = ['price', 'stock_quantity', 'status', 'title', 'description', 'category'];
      const mappedField = String(field) === 'stock' ? 'stock_quantity' : String(field);
      if (!allowedFields.includes(mappedField)) return res.status(400).json({ error: `Field "${field}" cannot be edited via AI.` });
      const result = await pool.query(
        `UPDATE client_store_products SET ${mappedField} = $1, updated_at = NOW()
         WHERE id = $2 AND client_id = $3 RETURNING id, title`,
        [mappedField === 'price' || mappedField === 'stock_quantity' ? Number(value) : String(value).slice(0, 2000), Number(productId), clientId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found or does not belong to your store.' });
      return res.json({ success: true, message: `Product "${result.rows[0].title}" — ${field} updated to "${value}".`, product: result.rows[0] });
    }

    if (type === 'delete_product') {
      if (!await checkAIActionPermission(clientId, 'action_delete_product')) {
        return res.status(403).json({ error: 'AI product deletion is disabled in AI settings.' });
      }
      const { productId, title } = req.body;
      if (!productId) return res.status(400).json({ error: 'productId is required.' });
      const result = await pool.query(
        `UPDATE client_store_products SET status = 'inactive', updated_at = NOW()
         WHERE id = $1 AND client_id = $2 RETURNING id, title`,
        [Number(productId), clientId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found or does not belong to your store.' });
      return res.json({ success: true, message: `Product "${result.rows[0].title || title}" has been deactivated.`, product: result.rows[0] });
    }

    return res.status(400).json({ error: `Unknown product action type: "${type}"` });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// AI STORE ACTION — POST /api/ai/store-action
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/store-action
 * Executes a store-owner-confirmed store settings update.
 * Supports single-field: { type: 'update_store_settings', field: string, value: string }
 * Supports multi-field:  { type: 'update_store_design', changes: Record<string, string|number|boolean> }
 */
router.post('/store-action', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);

    if (!user || !(user.role === 'user' || user.role === 'seller' || user.role === 'client' || user.user_type === 'client')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const clientId = user.id || user.clientId;
    if (!await checkAIActionPermission(clientId, 'action_store_design')) {
      return res.status(403).json({ error: 'AI store design changes are disabled in AI settings.' });
    }
    const { field, value, changes } = req.body;

    // ── Whitelist of AI-modifiable fields ──
    // Direct DB columns
    const allowedDirectCols = new Set([
      'store_name', 'store_description', 'currency_code',
      'primary_color', 'secondary_color', 'text_color', 'secondary_text_color',
      'template_accent_color', 'template_bg_color',
      'template_hero_heading', 'template_hero_subtitle', 'template_button_text',
      'template_hero_title_color', 'template_hero_subtitle_color',
      'template_hero_kicker',
      'template_button2_text',
      'template_featured_title', 'template_featured_subtitle',
      'template_section_title_color', 'template_section_subtitle_color',
      'template_card_bg', 'template_product_title_color', 'template_product_price_color',
      'template_copyright', 'template_footer_text', 'template_footer_bg',
      'template_font_family',
      'template_border_radius', 'template_card_border_radius', 'template_button_border_radius',
      'template_add_to_cart_label',
      'template_text_color', 'template_muted_color',
      'template_header_bg', 'template_header_text',
      'font_family',
      'meta_title', 'meta_description', 'meta_keywords',
      'featured_section_title', 'newsletter_title', 'newsletter_subtitle',
      'footer_about',
      'template_seasonal_title', 'template_seasonal_subtitle',
      'template_grid_title',
      'template_custom_css',
    ]);

    // Keys that go into template_settings JSONB (template-prefixed)
    const allowedJsonbPatterns = [
      /^[a-z]+_hero_title$/,
      /^[a-z]+_hero_subtitle$/,
      /^[a-z]+_tagline$/,
      /^[a-z]+_brand_name$/,
      /^[a-z]+_accent_color$/,
      /^[a-z]+_bg_color$/,
      /^[a-z]+_text_color$/,
      /^[a-z]+_cta_text$/,
      /^[a-z]+_heading$/,
      /^[a-z]+_subheading$/,
      /^[a-z]+_badge_text$/,
      /^[a-z]+_footer_text$/,
      /^[a-z]+_section_title$/,
      /^[a-z]+_button_text$/,
    ];

    const isAllowedJsonb = (key: string) => allowedJsonbPatterns.some(p => p.test(key));

    // ── Single-field update (legacy) ──
    if (field && !changes) {
      const f = String(field);
      if (!allowedDirectCols.has(f) && !isAllowedJsonb(f)) {
        return res.status(400).json({ error: `Field "${f}" cannot be changed via AI.` });
      }

      if (allowedDirectCols.has(f)) {
        const result = await pool.query(
          `UPDATE client_store_settings SET ${f} = $1, updated_at = NOW()
           WHERE client_id = $2 RETURNING store_name`,
          [String(value).slice(0, 500), clientId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Store settings not found.' });
      } else {
        // JSONB update
        await pool.query(
          `UPDATE client_store_settings
           SET template_settings = COALESCE(template_settings, '{}'::jsonb) || $1::jsonb,
               updated_at = NOW()
           WHERE client_id = $2`,
          [JSON.stringify({ [f]: value }), clientId]
        );
      }
      return res.json({ success: true, message: `Store setting "${f}" updated to "${value}".` });
    }

    // ── Multi-field update (design overhaul) ──
    if (changes && typeof changes === 'object') {
      const directUpdates: Record<string, any> = {};
      const jsonbUpdates: Record<string, any> = {};
      const rejected: string[] = [];

      for (const [key, val] of Object.entries(changes)) {
        if (allowedDirectCols.has(key)) {
          directUpdates[key] = String(val).slice(0, 500);
        } else if (isAllowedJsonb(key)) {
          jsonbUpdates[key] = val;
        } else {
          rejected.push(key);
        }
      }

      if (Object.keys(directUpdates).length === 0 && Object.keys(jsonbUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update.', rejected });
      }

      // Build direct column update query
      if (Object.keys(directUpdates).length > 0) {
        const setClauses: string[] = [];
        const params: any[] = [];
        let pi = 1;
        for (const [col, val] of Object.entries(directUpdates)) {
          setClauses.push(`${col} = $${pi}`);
          params.push(val);
          pi++;
        }
        setClauses.push('updated_at = NOW()');
        params.push(clientId);
        await pool.query(
          `UPDATE client_store_settings SET ${setClauses.join(', ')} WHERE client_id = $${pi}`,
          params
        );
      }

      // Merge JSONB updates
      if (Object.keys(jsonbUpdates).length > 0) {
        await pool.query(
          `UPDATE client_store_settings
           SET template_settings = COALESCE(template_settings, '{}'::jsonb) || $1::jsonb,
               updated_at = NOW()
           WHERE client_id = $2`,
          [JSON.stringify(jsonbUpdates), clientId]
        );
      }

      const updatedCount = Object.keys(directUpdates).length + Object.keys(jsonbUpdates).length;
      const summary = Object.entries({ ...directUpdates, ...jsonbUpdates })
        .slice(0, 5)
        .map(([k, v]) => `${k.replace(/^template_/, '').replace(/_/g, ' ')}: "${v}"`)
        .join(', ');
      return res.json({
        success: true,
        message: `Updated ${updatedCount} store settings: ${summary}${updatedCount > 5 ? '...' : ''}.`,
        ...(rejected.length > 0 ? { rejected } : {}),
      });
    }

    return res.status(400).json({ error: 'Either field+value or changes object is required.' });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// AI GUARDIAN ALERTS — GET /api/ai/alerts + mark endpoints
// ════════════════════════════════════════════════════════════

/**
 * GET /api/ai/alerts
 * Returns Guardian-generated store health alerts for the authenticated store owner.
 * Alerts are pre-computed by the Guardian worker and stored in ai_alerts.
 * Only non-dismissed alerts are returned.
 */
router.get('/alerts', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);

    if (!user || !(user.role === 'user' || user.role === 'seller' || user.role === 'client' || user.user_type === 'client')) {
      return res.json({ alerts: [] });
    }
    const clientId = user.id || user.clientId;

    const stored = await getClientAlerts(pool, clientId);
    const alerts = stored.map(a => ({
      id:       a.id,
      type:     a.severity as 'urgent' | 'warning' | 'info',
      message:  a.message,
      link:     a.link,
      status:   a.status,
    }));

    return res.json({ alerts });
  } catch (err) {
    console.error('[AI alerts error]', err);
    return res.json({ alerts: [] });
  }
});

/**
 * POST /api/ai/alerts/dismiss-all
 * Dismiss ALL alerts for the authenticated store owner.
 * Must be defined BEFORE :id routes so Express doesn't match "dismiss-all" as :id.
 */
router.post('/alerts/dismiss-all', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);
    if (!user || !(user.role === 'client' || user.user_type === 'client')) return res.status(401).json({ error: 'Unauthorized' });
    const clientId = user.id || user.clientId;
    await pool.query(
      `INSERT INTO alert_tracking (alert_id, client_id, status)
       SELECT a.id, $1, 'dismissed'
       FROM ai_alerts a
       LEFT JOIN alert_tracking t ON t.alert_id = a.id AND t.client_id = $1
       WHERE a.client_id = $1 AND COALESCE(t.status, 'unread') NOT IN ('dismissed')
       ON CONFLICT (alert_id, client_id) DO UPDATE SET status = 'dismissed'`,
      [clientId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[alerts/dismiss-all]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/ai/alerts/:id/read
 * Mark an alert as read by the store owner.
 */
router.post('/alerts/:id/read', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);
    if (!user || !(user.role === 'client' || user.user_type === 'client')) return res.status(401).json({ error: 'Unauthorized' });
    const clientId = user.id || user.clientId;
    const alertId = parseInt(req.params.id);
    if (isNaN(alertId)) return res.status(400).json({ error: 'Invalid alert id' });
    if (!await verifyAlertOwnership(pool, alertId, clientId)) return res.status(404).json({ error: 'Alert not found' });
    await markAlertRead(pool, alertId, clientId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[alerts/read]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/ai/alerts/:id/dismiss
 * Dismiss an alert — it will no longer appear in the store owner's feed.
 */
router.post('/alerts/:id/dismiss', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);
    if (!user || !(user.role === 'client' || user.user_type === 'client')) return res.status(401).json({ error: 'Unauthorized' });
    const clientId = user.id || user.clientId;
    const alertId = parseInt(req.params.id);
    if (isNaN(alertId)) return res.status(400).json({ error: 'Invalid alert id' });
    if (!await verifyAlertOwnership(pool, alertId, clientId)) return res.status(404).json({ error: 'Alert not found' });
    await markAlertDismissed(pool, alertId, clientId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[alerts/dismiss]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/ai/alerts/:id/follow
 * Record that the store owner followed the alert's suggested action.
 * Body: { actionTaken?: string }  — e.g. "clicked", "restocked", "paused_ad"
 * This data feeds the future "I saved you $X this month" report.
 */
router.post('/alerts/:id/follow', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);
    if (!user || !(user.role === 'client' || user.user_type === 'client')) return res.status(401).json({ error: 'Unauthorized' });
    const clientId = user.id || user.clientId;
    const alertId = parseInt(req.params.id);
    if (isNaN(alertId)) return res.status(400).json({ error: 'Invalid alert id' });
    if (!await verifyAlertOwnership(pool, alertId, clientId)) return res.status(404).json({ error: 'Alert not found' });
    const actionTaken = typeof req.body?.actionTaken === 'string' ? req.body.actionTaken.slice(0, 100) : 'clicked';
    await markAlertFollowed(pool, alertId, clientId, actionTaken);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[alerts/follow]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════
// PHASE 10 — AI Bot Control
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/bot/toggle
 * AI decides whether to enable or disable the bot based on a plain-language intent.
 * Body: { intent: string }  e.g. "enable the bot", "turn off notifications"
 */
router.post('/bot/toggle', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    if (!await checkAIActionPermission(clientId, 'action_bot_control')) {
      return res.status(403).json({ error: 'AI bot control is disabled in AI settings.' });
    }
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ error: 'intent is required' });

    const decision = await generateJSON<{ enable: boolean; reason: string }>(
      'store_owner',
      `Based on this store owner intent: "${intent}"
Decide whether to enable or disable their messaging bot.
Return JSON: {"enable": true/false, "reason": "one short sentence explaining the decision"}`
    );

    const enable = decision?.enable === true;

    // Check subscription access before enabling
    if (enable) {
      const subRes = await pool.query(
        `SELECT status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] }));
      const subStatus = subRes.rows[0]?.status;
      if (subStatus === 'expired' || subStatus === 'cancelled') {
        return res.status(403).json({ error: 'Subscription required to enable the bot.' });
      }
    }

    await pool.query(
      `UPDATE bot_settings SET enabled = $2, updated_at = NOW() WHERE client_id = $1`,
      [clientId, enable]
    );

    return res.json({ enabled: enable, reason: decision?.reason || '' });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/bot/compose-message
 * AI drafts or rewrites a single bot message template.
 * Body: { templateType: 'greeting'|'instant_order'|'pin_instructions'|'order_confirmation'|'payment'|'shipping', context?: string, tone?: string, language?: 'ar'|'fr'|'en' }
 */
router.post('/bot/compose-message', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    const { templateType, context, tone, language } = req.body;

    const validTypes = ['greeting', 'instant_order', 'pin_instructions', 'order_confirmation', 'payment', 'shipping'];
    if (!templateType || !validTypes.includes(templateType)) {
      return res.status(400).json({ error: `templateType must be one of: ${validTypes.join(', ')}` });
    }

    // Fetch store name for personalisation
    const storeRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    ).catch(() => ({ rows: [] as any[] }));
    const storeName = storeRes.rows[0]?.store_name || 'our store';

    const descriptions: Record<string, string> = {
      greeting: 'A welcome message sent when a customer first contacts the bot. Should be warm and invite them to shop.',
      instant_order: 'Sent immediately when a new order is placed. Should confirm receipt and give next steps.',
      pin_instructions: 'Explains how to confirm an order by replying with a PIN code. Should be clear and simple.',
      order_confirmation: 'Sent after the store owner confirms the order. Should be celebratory and include delivery info.',
      payment: 'Sent when payment/COD is confirmed. Should reassure the customer.',
      shipping: 'Sent when the order is shipped. Should include a tracking nudge and ETA expectation.',
    };

    const availableVars = `Available placeholder variables (use these exactly): {storeName}, {customerName}, {orderId}, {productName}, {totalPrice}, {quantity}, {address}, {trackingNumber}, {companyName}, {customerPhone}`;

    const prompt = `Write a bot message template for store "${storeName}".
Template type: ${templateType} — ${descriptions[templateType]}
${context ? `Additional context from store owner: "${context}"` : ''}
Tone: ${tone || 'friendly and professional'}
Language: ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : language === 'en' ? 'English' : 'Arabic (Algerian dialect preferred)'}
${availableVars}
Write only the message template text. No explanation. Keep it under 200 words.`;

    const template = await generateText('store_owner', prompt, { storeId: clientId, storeName, clientId, userType: 'owner' });
    return res.json({ template: template.trim(), templateType });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/bot/update-templates
 * AI rewrites ALL 6 message templates and saves them directly.
 * Body: { tone?: string, language?: 'ar'|'fr'|'en', context?: string }
 */
router.post('/bot/update-templates', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    const { tone, language, context } = req.body;

    const storeRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    ).catch(() => ({ rows: [] as any[] }));
    const storeName = storeRes.rows[0]?.store_name || 'our store';

    const availableVars = `{storeName}, {customerName}, {orderId}, {productName}, {totalPrice}, {quantity}, {address}, {trackingNumber}, {companyName}, {customerPhone}`;

    const prompt = `Generate 6 bot message templates for an Algerian e-commerce store named "${storeName}".
Tone: ${tone || 'friendly and professional'}
Language: ${language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : language === 'en' ? 'English' : 'Arabic (Algerian dialect preferred)'}
${context ? `Store owner notes: "${context}"` : ''}
Available placeholder variables (use them naturally): ${availableVars}

Return ONLY valid JSON with this exact shape:
{
  "greeting": "...",
  "instantOrder": "...",
  "pinInstructions": "...",
  "orderConfirmation": "...",
  "payment": "...",
  "shipping": "..."
}
Each template under 200 words. No explanations outside the JSON.`;

    const templates = await generateJSON<{
      greeting: string;
      instantOrder: string;
      pinInstructions: string;
      orderConfirmation: string;
      payment: string;
      shipping: string;
    }>('store_owner', prompt, { storeId: clientId, storeName });

    if (!templates || typeof templates !== 'object') {
      return res.status(500).json({ error: 'AI returned invalid templates' });
    }

    await pool.query(
      `UPDATE bot_settings SET
        template_greeting = COALESCE($2, template_greeting),
        template_instant_order = COALESCE($3, template_instant_order),
        template_pin_instructions = COALESCE($4, template_pin_instructions),
        template_order_confirmation = COALESCE($5, template_order_confirmation),
        template_payment = COALESCE($6, template_payment),
        template_shipping = COALESCE($7, template_shipping),
        updated_at = NOW()
      WHERE client_id = $1`,
      [
        clientId,
        templates.greeting || null,
        templates.instantOrder || null,
        templates.pinInstructions || null,
        templates.orderConfirmation || null,
        templates.payment || null,
        templates.shipping || null,
      ]
    );

    return res.json({ success: true, templates });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/bot/set-schedule
 * AI reads a plain-language timing intent and sets the delay minutes.
 * Body: { intent: string }  e.g. "send messages 10 minutes after an order"
 */
router.post('/bot/set-schedule', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ error: 'intent is required' });

    const decision = await generateJSON<{ delayMinutes: number; explanation: string }>(
      'store_owner',
      `A store owner said: "${intent}"
Extract how many minutes to wait before sending a bot message after an order is placed.
Use a sensible default (5) if unclear. Minimum 1, maximum 1440.
Return JSON: {"delayMinutes": <number>, "explanation": "one sentence"}`
    );

    const delay = Math.max(1, Math.min(1440, Math.round(Number(decision?.delayMinutes) || 5)));

    await pool.query(
      `UPDATE bot_settings SET
        telegram_delay_minutes = $2,
        messenger_delay_minutes = $2,
        updated_at = NOW()
      WHERE client_id = $1`,
      [clientId, delay]
    );

    return res.json({ delayMinutes: delay, explanation: decision?.explanation || '' });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/bot/analyze
 * AI reviews the current bot configuration and provides actionable recommendations.
 */
router.post('/bot/analyze', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;

    const [botRes, storeRes, orderRes] = await Promise.all([
      pool.query(
        `SELECT enabled, provider, messenger_enabled,
                telegram_delay_minutes, messenger_delay_minutes, auto_expire_hours,
                template_greeting, template_instant_order, template_pin_instructions,
                template_order_confirmation, template_payment, template_shipping
         FROM bot_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
         FROM store_orders WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const bot = botRes.rows[0] || {};
    const storeName = storeRes.rows[0]?.store_name || 'this store';
    const orders = orderRes.rows[0] || {};

    const configSummary = {
      enabled: bot.enabled || false,
      provider: bot.provider || 'none',
      messengerEnabled: bot.messenger_enabled || false,
      telegramDelayMinutes: bot.telegram_delay_minutes || 5,
      messengerDelayMinutes: bot.messenger_delay_minutes || 5,
      autoExpireHours: bot.auto_expire_hours || 24,
      hasGreeting: !!bot.template_greeting,
      hasInstantOrder: !!bot.template_instant_order,
      hasPinInstructions: !!bot.template_pin_instructions,
      hasOrderConfirmation: !!bot.template_order_confirmation,
      hasPayment: !!bot.template_payment,
      hasShipping: !!bot.template_shipping,
      missingTemplates: [
        !bot.template_greeting && 'greeting',
        !bot.template_instant_order && 'instant_order',
        !bot.template_pin_instructions && 'pin_instructions',
        !bot.template_order_confirmation && 'order_confirmation',
        !bot.template_payment && 'payment',
        !bot.template_shipping && 'shipping',
      ].filter(Boolean),
    };

    const orderStats = {
      totalOrders30d: parseInt(orders.total || '0'),
      deliveredOrders30d: parseInt(orders.delivered || '0'),
      cancelledOrders30d: parseInt(orders.cancelled || '0'),
    };

    const prompt = `Analyze this bot configuration for store "${storeName}" and give actionable recommendations.
Bot config: ${JSON.stringify(configSummary)}
Recent order stats (30 days): ${JSON.stringify(orderStats)}

Return JSON:
{
  "score": <0-100 config quality score>,
  "summary": "2-sentence overall assessment",
  "recommendations": [
    {"priority": "high|medium|low", "action": "what to do", "reason": "why it matters"}
  ]
}
Give 3-5 recommendations. Be specific. Respond in Arabic or French.`;

    const analysis = await generateJSON<{
      score: number;
      summary: string;
      recommendations: Array<{ priority: string; action: string; reason: string }>;
    }>('store_owner', prompt, { storeId: clientId, storeName });

    return res.json(analysis);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/bot/auto-configure
 * AI reads all store data and sets all bot settings optimally in one shot.
 * Body: { language?: 'ar'|'fr'|'en', tone?: string }
 */
router.post('/bot/auto-configure', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    const { language, tone } = req.body;

    const [storeRes, orderRes] = await Promise.all([
      pool.query(
        `SELECT store_name, language FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT COUNT(*) as total FROM store_orders WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const storeName = storeRes.rows[0]?.store_name || 'our store';
    const storeLanguage = language || storeRes.rows[0]?.language || 'ar';
    const ordersLast30d = parseInt(orderRes.rows[0]?.total || '0');

    const availableVars = `{storeName}, {customerName}, {orderId}, {productName}, {totalPrice}, {quantity}, {address}, {trackingNumber}, {companyName}, {customerPhone}`;

    const prompt = `Auto-configure ALL messaging bot settings for an Algerian e-commerce store named "${storeName}".
Store language: ${storeLanguage === 'ar' ? 'Arabic' : storeLanguage === 'fr' ? 'French' : 'English'}
Tone: ${tone || 'friendly and professional'}
Orders last 30 days: ${ordersLast30d}
Available template variables: ${availableVars}

Return ONLY valid JSON:
{
  "telegramDelayMinutes": <1-60, recommended based on store activity>,
  "messengerDelayMinutes": <1-60>,
  "autoExpireHours": <12-72>,
  "templates": {
    "greeting": "...",
    "instantOrder": "...",
    "pinInstructions": "...",
    "orderConfirmation": "...",
    "payment": "...",
    "shipping": "..."
  },
  "configReason": "one sentence explaining the delay choice"
}`;

    const config = await generateJSON<{
      telegramDelayMinutes: number;
      messengerDelayMinutes: number;
      autoExpireHours: number;
      templates: Record<string, string>;
      configReason: string;
    }>('store_owner', prompt, { storeId: clientId, storeName });

    if (!config?.templates) return res.status(500).json({ error: 'AI returned invalid configuration' });

    const tDelay = Math.max(1, Math.min(1440, Math.round(Number(config.telegramDelayMinutes) || 5)));
    const mDelay = Math.max(1, Math.min(1440, Math.round(Number(config.messengerDelayMinutes) || 5)));
    const expireHours = Math.max(1, Math.min(168, Math.round(Number(config.autoExpireHours) || 24)));

    await pool.query(
      `UPDATE bot_settings SET
        telegram_delay_minutes = $2,
        messenger_delay_minutes = $3,
        auto_expire_hours = $4,
        template_greeting = COALESCE($5, template_greeting),
        template_instant_order = COALESCE($6, template_instant_order),
        template_pin_instructions = COALESCE($7, template_pin_instructions),
        template_order_confirmation = COALESCE($8, template_order_confirmation),
        template_payment = COALESCE($9, template_payment),
        template_shipping = COALESCE($10, template_shipping),
        updated_at = NOW()
      WHERE client_id = $1`,
      [
        clientId,
        tDelay,
        mDelay,
        expireHours,
        config.templates.greeting || null,
        config.templates.instantOrder || null,
        config.templates.pinInstructions || null,
        config.templates.orderConfirmation || null,
        config.templates.payment || null,
        config.templates.shipping || null,
      ]
    );

    return res.json({
      success: true,
      telegramDelayMinutes: tDelay,
      messengerDelayMinutes: mDelay,
      autoExpireHours: expireHours,
      templates: config.templates,
      configReason: config.configReason || '',
    });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/bot/send-message
 * AI composes and queues a bot message for a specific order immediately.
 * Body: { orderId: number, intent?: string, templateType?: 'greeting'|'instant_order'|'order_confirmation'|'payment'|'shipping', customText?: string }
 */
router.post('/bot/send-message', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    const { orderId, intent, templateType, customText } = req.body;

    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    // Fetch order — must belong to this client
    const orderRes = await pool.query(
      `SELECT o.id, o.customer_name, o.customer_phone, o.total_price, o.status,
              o.delivery_address, o.notes,
              p.title as product_name
       FROM store_orders o
       LEFT JOIN client_store_products p ON p.id = o.product_id
       WHERE o.id = $1 AND o.client_id = $2 AND o.deleted_at IS NULL LIMIT 1`,
      [Number(orderId), clientId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!orderRes.rows.length) {
      return res.status(404).json({ error: 'Order not found or does not belong to your store.' });
    }
    const order = orderRes.rows[0];

    if (!order.customer_phone) {
      return res.status(400).json({ error: 'This order has no customer phone number on file.' });
    }

    // Fetch store name and bot settings (provider for routing)
    const [storeRes, botRes] = await Promise.all([
      pool.query(`SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId])
        .catch(() => ({ rows: [] as any[] })),
      pool.query(`SELECT provider, enabled FROM bot_settings WHERE client_id = $1 LIMIT 1`, [clientId])
        .catch(() => ({ rows: [] as any[] })),
    ]);

    const storeName = storeRes.rows[0]?.store_name || 'our store';
    const provider = botRes.rows[0]?.provider || 'telegram';
    const botEnabled = botRes.rows[0]?.enabled ?? true;

    if (!botEnabled) {
      return res.status(400).json({ error: 'Bot is currently disabled. Enable it first.' });
    }

    // Compose the message text — use customText, or AI-generate from intent, or use templateType hint
    let messageText: string;

    if (customText) {
      messageText = String(customText).trim();
    } else {
      const typeDescriptions: Record<string, string> = {
        greeting: 'A warm welcome message for the customer',
        instant_order: 'An order received confirmation with product/price details',
        order_confirmation: 'A confirmation request asking customer to confirm their order',
        payment: 'A payment/COD confirmation message',
        shipping: 'A shipping notification message',
      };
      const requested = templateType ? typeDescriptions[templateType] || templateType : (intent || 'a helpful order update');
      const prompt = `Write a single bot message to send to a customer for an Algerian e-commerce store called "${storeName}".

Order details:
- Order ID: #${order.id}
- Customer: ${order.customer_name || 'Valued Customer'}
- Product: ${order.product_name || 'N/A'}
- Total: ${order.total_price} DZD
- Status: ${order.status}
- Address: ${order.delivery_address || 'N/A'}

Message purpose: ${requested}

Write a professional, friendly message in Arabic (Algerian dialect preferred). Keep it concise (under 150 words). Use actual order values — do NOT use placeholder variables.`;

      messageText = await generateText('store_owner', prompt, { storeId: clientId, storeName, clientId, userType: 'owner' });
    }

    if (!messageText) return res.status(500).json({ error: 'AI failed to generate message text.' });

    // Insert into bot_messages queue (send immediately = send_at = NOW())
    const msgType = provider === 'messenger' ? 'messenger' : provider === 'whatsapp_cloud' ? 'whatsapp' : 'telegram';
    await pool.query(
      `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [Number(orderId), clientId, order.customer_phone, msgType, messageText.trim()]
    );

    return res.json({
      queued: true,
      provider: msgType,
      orderId: order.id,
      customerPhone: order.customer_phone,
      message: messageText.trim(),
    });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// BOT ACTION EXECUTOR — POST /api/ai/bot-action
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/bot-action
 * Executes a bot control action proposed by the AI chat.
 * Body: { type, ...params }
 * Types: bot_toggle | bot_set_schedule | bot_update_templates | bot_auto_configure | bot_send_message
 */
router.post('/bot-action', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = extractAiUser(req);

    if (!user || !(user.role === 'user' || user.role === 'seller' || user.role === 'client' || user.user_type === 'client')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const clientId = user.id || user.clientId;
    const { type } = req.body;

    // ── Toggle bot on/off ──────────────────────────────────────
    if (type === 'bot_toggle') {
      const enable = req.body.enable === true;
      if (enable) {
        const subRes = await pool.query(
          `SELECT status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
          [clientId]
        ).catch(() => ({ rows: [] as any[] }));
        const subStatus = subRes.rows[0]?.status;
        if (subStatus === 'expired' || subStatus === 'cancelled') {
          return res.status(403).json({ error: 'Subscription required to enable the bot.' });
        }
      }
      await pool.query(
        `UPDATE bot_settings SET enabled = $2, updated_at = NOW() WHERE client_id = $1`,
        [clientId, enable]
      );
      return res.json({ success: true, message: `Bot ${enable ? 'enabled' : 'disabled'} successfully.` });
    }

    // ── Set message delay ──────────────────────────────────────
    if (type === 'bot_set_schedule') {
      const delay = Math.max(1, Math.min(1440, Math.round(Number(req.body.delayMinutes) || 5)));
      await pool.query(
        `UPDATE bot_settings SET telegram_delay_minutes = $2, messenger_delay_minutes = $2, updated_at = NOW() WHERE client_id = $1`,
        [clientId, delay]
      );
      return res.json({ success: true, message: `Message delay set to ${delay} minutes.` });
    }

    // ── Rewrite all templates ──────────────────────────────────
    if (type === 'bot_update_templates') {
      const storeRes = await pool.query(
        `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] }));
      const storeName = storeRes.rows[0]?.store_name || 'our store';
      const lang = String(req.body.language || 'ar');
      const tone = String(req.body.tone || 'friendly and professional');
      const availableVars = `{storeName}, {customerName}, {orderId}, {productName}, {totalPrice}, {quantity}, {address}, {trackingNumber}, {companyName}, {customerPhone}`;
      const prompt = `Generate 6 bot message templates for "${storeName}".
Language: ${lang === 'ar' ? 'Arabic (Algerian dialect)' : lang === 'fr' ? 'French' : 'English'}
Tone: ${tone}
Variables available: ${availableVars}
Return JSON only: {"greeting":"...","instantOrder":"...","pinInstructions":"...","orderConfirmation":"...","payment":"...","shipping":"..."}`;
      const templates = await generateJSON<Record<string, string>>('store_owner', prompt, { storeId: clientId, storeName });
      if (!templates) return res.status(500).json({ error: 'AI failed to generate templates.' });
      await pool.query(
        `UPDATE bot_settings SET
          template_greeting = COALESCE($2, template_greeting),
          template_instant_order = COALESCE($3, template_instant_order),
          template_pin_instructions = COALESCE($4, template_pin_instructions),
          template_order_confirmation = COALESCE($5, template_order_confirmation),
          template_payment = COALESCE($6, template_payment),
          template_shipping = COALESCE($7, template_shipping),
          updated_at = NOW()
        WHERE client_id = $1`,
        [clientId, templates.greeting || null, templates.instantOrder || null, templates.pinInstructions || null,
         templates.orderConfirmation || null, templates.payment || null, templates.shipping || null]
      );
      return res.json({ success: true, message: 'All 6 message templates rewritten and saved.' });
    }

    // ── Auto-configure everything ──────────────────────────────
    if (type === 'bot_auto_configure') {
      const storeRes = await pool.query(
        `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [clientId]
      ).catch(() => ({ rows: [] as any[] }));
      const storeName = storeRes.rows[0]?.store_name || 'our store';
      const ordersRes = await pool.query(
        `SELECT COUNT(*) as total FROM store_orders WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [clientId]
      ).catch(() => ({ rows: [{ total: 0 }] }));
      const ordersLast30d = parseInt(ordersRes.rows[0]?.total || '0');
      const lang = String(req.body.language || 'ar');
      const tone = String(req.body.tone || 'friendly and professional');
      const prompt = `Auto-configure all messaging bot settings for "${storeName}".
Language: ${lang === 'ar' ? 'Arabic (Algerian dialect)' : lang === 'fr' ? 'French' : 'English'}
Tone: ${tone}
Orders last 30 days: ${ordersLast30d}
Variables: {storeName}, {customerName}, {orderId}, {productName}, {totalPrice}, {quantity}, {address}, {trackingNumber}, {companyName}, {customerPhone}
Return JSON only:
{"telegramDelayMinutes":<1-60>,"messengerDelayMinutes":<1-60>,"autoExpireHours":<12-72>,"templates":{"greeting":"...","instantOrder":"...","pinInstructions":"...","orderConfirmation":"...","payment":"...","shipping":"..."},"configReason":"one sentence"}`;
      const config = await generateJSON<any>('store_owner', prompt, { storeId: clientId, storeName });
      if (!config?.templates) return res.status(500).json({ error: 'AI failed to generate configuration.' });
      const tDelay = Math.max(1, Math.min(1440, Math.round(Number(config.telegramDelayMinutes) || 5)));
      const mDelay = Math.max(1, Math.min(1440, Math.round(Number(config.messengerDelayMinutes) || 5)));
      const expHours = Math.max(1, Math.min(168, Math.round(Number(config.autoExpireHours) || 24)));
      const t = config.templates;
      await pool.query(
        `UPDATE bot_settings SET
          telegram_delay_minutes = $2, messenger_delay_minutes = $3, auto_expire_hours = $4,
          template_greeting = COALESCE($5, template_greeting), template_instant_order = COALESCE($6, template_instant_order),
          template_pin_instructions = COALESCE($7, template_pin_instructions), template_order_confirmation = COALESCE($8, template_order_confirmation),
          template_payment = COALESCE($9, template_payment), template_shipping = COALESCE($10, template_shipping),
          updated_at = NOW()
        WHERE client_id = $1`,
        [clientId, tDelay, mDelay, expHours,
         t.greeting || null, t.instantOrder || null, t.pinInstructions || null,
         t.orderConfirmation || null, t.payment || null, t.shipping || null]
      );
      return res.json({ success: true, message: config.configReason || 'Bot fully configured and saved.' });
    }

    // ── Send message to customer ───────────────────────────────
    if (type === 'bot_send_message') {
      const orderId = Number(req.body.orderId);
      const intent = String(req.body.intent || '');
      const channelOverride = req.body.channel ? String(req.body.channel).toLowerCase() : null;
      if (!orderId) return res.status(400).json({ error: 'orderId is required.' });
      const orderRes = await pool.query(
        `SELECT o.id, o.customer_name, o.customer_phone, o.total_price, o.status, o.delivery_address,
                p.title as product_name
         FROM store_orders o
         LEFT JOIN client_store_products p ON p.id = o.product_id
         WHERE o.id = $1 AND o.client_id = $2 AND o.deleted_at IS NULL LIMIT 1`,
        [orderId, clientId]
      ).catch(() => ({ rows: [] as any[] }));
      const order = orderRes.rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found or does not belong to your store.' });
      if (!order.customer_phone) return res.status(400).json({ error: 'This order has no customer phone number.' });
      const storeRes = await pool.query(
        `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]
      ).catch(() => ({ rows: [] as any[] }));
      const storeName = storeRes.rows[0]?.store_name || 'our store';
      const botRes = await pool.query(
        `SELECT provider, enabled FROM bot_settings WHERE client_id = $1 LIMIT 1`, [clientId]
      ).catch(() => ({ rows: [] as any[] }));
      if (!botRes.rows[0]?.enabled) return res.status(400).json({ error: 'Bot is currently disabled.' });
      const provider = botRes.rows[0]?.provider || 'telegram';
      const resolvedChannel = channelOverride === 'messenger' ? 'messenger'
        : channelOverride === 'whatsapp' ? 'whatsapp'
        : channelOverride === 'telegram' ? 'telegram'
        : provider === 'messenger' ? 'messenger'
        : provider === 'whatsapp_cloud' ? 'whatsapp'
        : 'telegram';
      const msgType = resolvedChannel;
      const msgPrompt = `Write a bot message for store "${storeName}" to send to customer ${order.customer_name || 'the customer'}.
Order #${order.id} | Product: ${order.product_name || 'N/A'} | Total: ${order.total_price} DZD | Status: ${order.status} | Address: ${order.delivery_address || 'N/A'}
Purpose: ${intent || 'a helpful order update'}
Write in Arabic (Algerian dialect). Be direct and friendly. Under 150 words. Use actual values, not placeholders.`;
      const messageText = await generateText('store_owner', msgPrompt, { storeId: clientId, storeName, clientId, userType: 'owner' });
      await pool.query(
        `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [orderId, clientId, order.customer_phone, msgType, messageText.trim()]
      );
      return res.json({ success: true, message: `Message queued via ${msgType} for order #${orderId}.`, preview: messageText.trim() });
    }

    return res.status(400).json({ error: `Unknown bot action type: "${type}"` });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// AI CHAT HISTORY — persistent per-user conversation storage
// ════════════════════════════════════════════════════════════

function extractUserForHistory(req: Request): { userId: number; userType: string } | null {
  try {
    const decoded = extractAiUser(req);
    if (!decoded) return null;
    const userId = Number(decoded?.id || decoded?.clientId || 0);
    if (!userId) return null;
    const userType =
      decoded?.role === 'admin' || decoded?.user_type === 'admin' ? 'admin' : 'client';
    return { userId, userType };
  } catch { return null; }
}

/**
 * GET /api/ai/chat-history
 * Returns the last 60 messages for the authenticated user.
 */
router.get('/chat-history', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const who = extractUserForHistory(req);
    if (!who) return res.status(401).json({ error: 'Authentication required.' });

    const result = await pool.query(
      `SELECT role, content
         FROM ai_chat_history
        WHERE user_id = $1 AND user_type = $2
        ORDER BY id ASC
        LIMIT 60`,
      [who.userId, who.userType]
    );
    const messages = result.rows.map(r => ({ role: r.role, content: r.content }));
    return res.json({ messages });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/chat-history/save
 * Appends one or more messages to the authenticated user's history.
 * Body: { messages: Array<{ role: 'user'|'assistant', content: string }> }
 * Also trims the history to keep only the latest 200 rows per user.
 */
router.post('/chat-history/save', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const who = extractUserForHistory(req);
    if (!who) return res.status(401).json({ error: 'Authentication required.' });

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const msg of messages) {
        if (
          (msg.role !== 'user' && msg.role !== 'assistant') ||
          typeof msg.content !== 'string' ||
          !msg.content.trim()
        ) continue;
        await client.query(
          `INSERT INTO ai_chat_history (user_id, user_type, role, content) VALUES ($1, $2, $3, $4)`,
          [who.userId, who.userType, msg.role, msg.content.slice(0, 8000)]
        );
      }
      // Keep only latest 200 rows per user to avoid unbounded growth
      await client.query(
        `DELETE FROM ai_chat_history
          WHERE user_id = $1 AND user_type = $2
            AND id NOT IN (
              SELECT id FROM ai_chat_history
               WHERE user_id = $1 AND user_type = $2
               ORDER BY created_at DESC LIMIT 200
            )`,
        [who.userId, who.userType]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * DELETE /api/ai/chat-history
 * Wipes all history for the authenticated user (Clear button).
 */
router.delete('/chat-history', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const who = extractUserForHistory(req);
    if (!who) return res.status(401).json({ error: 'Authentication required.' });

    await pool.query(
      `DELETE FROM ai_chat_history WHERE user_id = $1 AND user_type = $2`,
      [who.userId, who.userType]
    );
    return res.json({ ok: true });
  } catch (err) {
    return serverError(res, err);
  }
});

// ════════════════════════════════════════════════════════════
// VISION — Image Analysis Endpoints
// ════════════════════════════════════════════════════════════

/** Rate limiter for vision endpoints (heavier than text) */
const visionAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many image analysis requests. Please wait a moment.' },
});

/**
 * POST /api/ai/vision/analyze-product
 * Analyze a product image and return title, description, category, price suggestions.
 * Body: { imageUrl: string } — accepts an already-uploaded image URL
 */
router.post('/vision/analyze-product', authenticate, requireClient, visionAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Validate URL format (only allow our uploads or common image hosts)
    const url = new URL(imageUrl);
    const allowedHosts = [
      'res.cloudinary.com', 'i.imgur.com', 'images.unsplash.com',
      'upload.wikimedia.org', 'placehold.co',
    ];
    const isSameOrigin = url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/api/');
    const isAllowedHost = allowedHosts.some(h => url.hostname.endsWith(h));
    if (!isSameOrigin && !isAllowedHost) {
      // For other hosts, attempt anyway but with a size guard
    }

    // Fetch the image as base64
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(400).json({ error: 'Could not fetch the image' });
    }
    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'URL does not point to an image' });
    }
    const arrayBuffer = await imgResponse.arrayBuffer();
    const maxSize = 4 * 1024 * 1024; // 4MB limit for Gemini inline
    if (arrayBuffer.byteLength > maxSize) {
      return res.status(400).json({ error: 'Image too large (max 4MB)' });
    }
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Fetch store context
    let storeName = '';
    try {
      const r = await pool.query('SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1', [user.id]);
      storeName = r.rows[0]?.store_name || '';
    } catch { /* non-critical */ }

    const result = await analyzeProductImage(base64, contentType, { storeId: user.id, storeName, clientId: user.id, userType: 'owner' }, String(req.body.language || 'ar'));

    // Track vision usage
    try {
      await pool.query(
        `INSERT INTO ai_vision_usage (client_id, feature, tokens_estimated, created_at)
         VALUES ($1, 'analyze_product', 258, NOW())`,
        [user.id]
      );
    } catch { /* tracking is non-critical */ }

    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/vision/chat
 * AI chat with an image attachment. Used by the floating chat bubble.
 * Body: { question: string, imageUrl: string, history?: [...] }
 */
router.post('/vision/chat', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const { question, imageUrl, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Fetch image as base64
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(400).json({ error: 'Could not fetch the image' });
    }
    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'URL does not point to an image' });
    }
    const arrayBuffer = await imgResponse.arrayBuffer();
    if (arrayBuffer.byteLength > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 4MB)' });
    }
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const user = extractAiUser(req);
    const role = user?.role === 'admin' ? 'admin' as const : 'store_owner' as const;
    const ctx = user ? { storeId: user.id, storeName: '' } : {};

    // Map prior history
    type HistoryMsg = { role: string; content: string };
    const prevHistory: HistoryMsg[] = Array.isArray(history) ? history.slice(-20) : [];
    const geminiHistory = prevHistory.map(m => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }],
    }));

    const answer = await generateText(
      role,
      question,
      ctx,
      geminiHistory,
      [{ mimeType: contentType, base64 }]
    );

    // Track vision usage
    if (user?.id) {
      try {
        await pool.query(
          `INSERT INTO ai_vision_usage (client_id, feature, tokens_estimated, created_at)
           VALUES ($1, 'vision_chat', 258, NOW())`,
          [user.id]
        );
      } catch { /* non-critical */ }
    }

    return res.json({ answer });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/vision/quality-check
 * Quick image quality assessment — flags blurry, dark, or low-res images.
 * Body: { imageUrl: string }
 */
router.post('/vision/quality-check', authenticate, requireClient, visionAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) return res.status(400).json({ error: 'Could not fetch image' });
    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imgResponse.arrayBuffer();
    if (arrayBuffer.byteLength > 4 * 1024 * 1024) return res.status(400).json({ error: 'Image too large' });
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `Evaluate this product image quality for an e-commerce store. Return JSON:
{
  "score": 1-10,
  "is_suitable": true/false (is it good enough to sell products?),
  "issues": ["list of issues if any"],
  "suggestions": ["list of improvement suggestions"],
  "has_text_overlay": true/false,
  "extracted_text": "any text visible in the image",
  "is_stock_photo": true/false,
  "background_type": "white/studio/lifestyle/messy/outdoor"
}
IMPORTANT: Respond ONLY with valid JSON.`;

    const result = await generateJSON('store_owner', prompt, { storeId: user.id, clientId: user.id, userType: 'owner' }, [{ mimeType: contentType, base64 }]);
    return res.json(result);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * GET /api/ai/vision/usage-stats
 * Returns vision usage stats for the current user (for Cortex/analytics page).
 */
router.get('/vision/usage-stats', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await pool.query(`
      SELECT
        feature,
        COUNT(*) as count,
        SUM(tokens_estimated) as total_tokens,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM ai_vision_usage
      WHERE client_id = $1
      GROUP BY feature
      ORDER BY count DESC
    `, [user.id]);

    const totalResult = await pool.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(tokens_estimated) as total_tokens,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM ai_vision_usage
      WHERE client_id = $1
    `, [user.id]);

    const dailyResult = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as requests,
        SUM(tokens_estimated) as tokens
      FROM ai_vision_usage
      WHERE client_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [user.id]);

    return res.json({
      byFeature: result.rows,
      totals: totalResult.rows[0] || { total_requests: 0, total_tokens: 0, active_days: 0 },
      daily: dailyResult.rows,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/marketing/broadcast-compose
 * AI composes a broadcast marketing message for all platforms.
 * Checks broadcast_composer toggle. Requires subscription.
 * Body: { segment: 'all'|'customers'|'abandoned', campaignType: 'promo'|'new_product'|'restock', tone?: 'friendly'|'urgent'|'professional', language?: 'ar'|'fr'|'en' }
 */
router.post('/marketing/broadcast-compose', authenticate, requireClient, authAiLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clientId = user?.id;
    const { segment, campaignType, tone, language, productName, discount } = req.body;

    // Check if broadcast composer is enabled
    const aiSettingsRes = await pool.query(
      `SELECT broadcast_composer, omni_intelligence FROM ai_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    if (aiSettingsRes.rows[0]?.broadcast_composer === false) {
      return res.status(403).json({ error: 'Broadcast composer is disabled. Enable it in AI Settings.' });
    }

    // Verify subscription
    const subRes = await pool.query(
      `SELECT status FROM client_subscriptions WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [clientId]
    );
    const subStatus = subRes.rows[0]?.status;
    if (subStatus === 'expired' || subStatus === 'cancelled') {
      return res.status(403).json({ error: 'Subscription required to use AI broadcast composer.' });
    }

    // Get store info
    const storeRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    const storeName = storeRes.rows[0]?.store_name || 'متجرنا';

    const segmentDesc: Record<string, string> = {
      all: 'جميع العملاء',
      customers: 'العملاء السابقين',
      abandoned: 'عملاء سلة التسوق المتروكة',
    };

    const campaignDesc: Record<string, string> = {
      promo: 'عرض ترويجي خاص',
      new_product: 'منتج جديد وصل للتو',
      restock: 'عودة المنتجات المنتهية للمخزون',
    };

    const langMap: Record<string, string> = { ar: 'Arabic', fr: 'French', en: 'English' };
    const lang = langMap[String(language || 'ar').slice(0, 2)] || 'Arabic';

    const toneDesc: Record<string, string> = {
      friendly: 'ودي ومحادث',
      urgent: 'عاجل ومحفز للعمل الآن',
      professional: 'مهني ورسمي',
    };

    const prompt = `Write a compelling broadcast marketing message for an Algerian online store.
Store: "${storeName}"
Target: ${segmentDesc[segment] || segment}
Campaign: ${campaignDesc[campaignType] || campaignType}${productName ? ` featuring "${productName}"` : ''}${discount ? ` with discount "${discount}"` : ''}
Tone: ${toneDesc[tone] || 'friendly'}
Language: ${lang}

Requirements:
- 2-4 sentences maximum
- Include a clear call-to-action
- Algerian market context (cash on delivery, local appeal)
- Make it irresistible to click
- No emojis unless appropriate for the tone

Write only the message text, no explanations.`;

    const message = await generateText('store_owner', prompt, { storeId: clientId, storeName, clientId, userType: 'owner' });
    return res.json({ message: message.trim(), segment, campaignType, language: lang });
  } catch (err) {
    return serverError(res, err);
  }
});

// ═════════════════════════════════════════════════════════════
// AI CUSTOMER FLOW TEST — POST /api/ai/test-customer
// ═════════════════════════════════════════════════════
// Simulates how the AI talks to customers (WhatsApp/Telegram/Messenger)
// For multi-turn testing, pass the same chatId each time.
// Body: { message: string, clientId?: number, chatId?: string }
router.post('/test-customer', authAiLimiter, async (req: Request, res: Response) => {
  try {
    const { message, clientId, chatId } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Use logged-in user's store, or the provided clientId
    const user = extractAiUser(req);
    const effectiveClientId = clientId || (user?.id || user?.clientId);
    if (!effectiveClientId) {
      return res.status(401).json({ error: 'Store owner authentication required' });
    }

    // Import the customer handler
    const { handleCustomerMessage } = await import('../services/customer-ai');
    
    // Use provided chatId for multi-turn, or create a new one
    const uniqueChatId = chatId || `test_${effectiveClientId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Test mode: prefix with /test tells the handler this is the store owner testing
    const testMessage = '/test ' + message;
    const response = await handleCustomerMessage(effectiveClientId, 'whatsapp', uniqueChatId, testMessage);
    
    if (!response) {
      return res.json({ 
        answer: 'AI auto-reply is disabled for this store. Enable it in AI Settings.',
        info: 'Customer AI auto-reply is turned off for this store or platform.'
      });
    }
    
    return res.json({ answer: response, chatId: uniqueChatId });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * GET /api/ai/persona
 * Load the AI persona configuration for the authenticated store owner.
 */
router.get('/persona', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id;
    const result = await pool.query(
      `SELECT * FROM ai_personas WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    if (!result.rows.length) {
      return res.json({
        persona_name: 'المساعد الافتراضي',
        tone: 'friendly',
        personality_note: '',
        business_type: '',
        expertise_areas: [],
        primary_language: 'ar',
        use_emojis: true,
        emoji_style: 'minimal',
        store_story: '',
        product_philosophy: '',
        unique_selling_points: [],
        forbidden_topics: [],
        competitor_policy: 'ignore',
        upsell_enabled: true,
        cross_sell_enabled: true,
        discount_policy: '',
        urgency_enabled: false,
        response_length: 'medium',
        greeting_template: '',
        closing_template: '',
        faq_entries: [],
        common_objections: [],
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * PUT /api/ai/persona
 * Save the AI persona configuration.
 */
router.put('/persona', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id;
    const {
      persona_name, tone, personality_note, business_type, expertise_areas,
      primary_language, use_emojis, emoji_style,
      store_story, product_philosophy, unique_selling_points,
      forbidden_topics, competitor_policy,
      upsell_enabled, cross_sell_enabled, discount_policy, urgency_enabled,
      response_length, greeting_template, closing_template,
      faq_entries, common_objections,
    } = req.body;

    await pool.query(
      `INSERT INTO ai_personas (
        client_id, persona_name, tone, personality_note, business_type, expertise_areas,
        primary_language, use_emojis, emoji_style,
        store_story, product_philosophy, unique_selling_points,
        forbidden_topics, competitor_policy,
        upsell_enabled, cross_sell_enabled, discount_policy, urgency_enabled,
        response_length, greeting_template, closing_template,
        faq_entries, common_objections
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT (client_id) DO UPDATE SET
        persona_name = COALESCE($2, ai_personas.persona_name),
        tone = COALESCE($3, ai_personas.tone),
        personality_note = $4,
        business_type = $5,
        expertise_areas = COALESCE($6, ai_personas.expertise_areas),
        primary_language = COALESCE($7, ai_personas.primary_language),
        use_emojis = COALESCE($8, ai_personas.use_emojis),
        emoji_style = COALESCE($9, ai_personas.emoji_style),
        store_story = $10,
        product_philosophy = $11,
        unique_selling_points = COALESCE($12, ai_personas.unique_selling_points),
        forbidden_topics = COALESCE($13, ai_personas.forbidden_topics),
        competitor_policy = COALESCE($14, ai_personas.competitor_policy),
        upsell_enabled = COALESCE($15, ai_personas.upsell_enabled),
        cross_sell_enabled = COALESCE($16, ai_personas.cross_sell_enabled),
        discount_policy = $17,
        urgency_enabled = COALESCE($18, ai_personas.urgency_enabled),
        response_length = COALESCE($19, ai_personas.response_length),
        greeting_template = $20,
        closing_template = $21,
        faq_entries = COALESCE($22, ai_personas.faq_entries),
        common_objections = COALESCE($23, ai_personas.common_objections),
        updated_at = NOW()`,
      [
        clientId,
        persona_name || 'المساعد الافتراضي',
        tone || 'friendly',
        personality_note || null,
        business_type || null,
        JSON.stringify(expertise_areas || []),
        primary_language || 'ar',
        use_emojis !== false,
        emoji_style || 'minimal',
        store_story || null,
        product_philosophy || null,
        JSON.stringify(unique_selling_points || []),
        JSON.stringify(forbidden_topics || []),
        competitor_policy || 'ignore',
        upsell_enabled !== false,
        cross_sell_enabled !== false,
        discount_policy || null,
        urgency_enabled === true,
        response_length || 'medium',
        greeting_template || null,
        closing_template || null,
        JSON.stringify(faq_entries || []),
        JSON.stringify(common_objections || []),
      ]
    );

    res.json({ success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/persona/test
 * Test the customer AI with a message, using the current persona.
 */
router.post('/persona/test', authenticate, requireClient, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Load store context
    const storeRes = await pool.query(
      `SELECT store_name, store_description, store_slug FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    if (!storeRes.rows.length) return res.status(404).json({ error: 'Store not found' });
    const { store_name, store_description, store_slug } = storeRes.rows[0];

    // Load products
    const productsRes = await pool.query(
      `SELECT title, price, original_price, description, category, stock_quantity
       FROM client_store_products WHERE client_id = $1 AND status = 'active' ORDER BY is_featured DESC NULLS LAST LIMIT 10`,
      [clientId]
    );
    const products = productsRes.rows.map((p: any) => ({
      title: p.title, price: Number(p.price),
      originalPrice: p.original_price ? Number(p.original_price) : undefined,
      description: p.description?.slice(0, 200), category: p.category,
      inStock: (p.stock_quantity ?? 1) > 0,
    }));

    // Load delivery
    const delRes = await pool.query(
      `SELECT COUNT(*) as zones, MIN(home_delivery_price) as min_p, MAX(home_delivery_price) as max_p
       FROM delivery_prices WHERE client_id = $1 AND is_active = true`,
      [clientId]
    );
    const d = delRes.rows[0];
    const deliveryInfo = d?.zones > 0
      ? `التوصيل متاح إلى ${d.zones} ولاية. سعر التوصيل من ${d.min_p} إلى ${d.max_p} دج.`
      : 'معلومات التوصيل غير متوفرة حالياً.';

    // Load persona
    const personaRes = await pool.query(`SELECT * FROM ai_personas WHERE client_id = $1 LIMIT 1`, [clientId]);
    let personaObj: any = undefined;
    if (personaRes.rows.length) {
      const p = personaRes.rows[0];
      personaObj = {
        personaName: p.persona_name,
        tone: p.tone,
        personalityNote: p.personality_note,
        businessType: p.business_type,
        primaryLanguage: p.primary_language,
        useEmojis: p.use_emojis,
        emojiStyle: p.emoji_style,
        storeStory: p.store_story,
        productPhilosophy: p.product_philosophy,
        uniqueSellingPoints: p.unique_selling_points || [],
        discountPolicy: p.discount_policy,
        greetingTemplate: p.greeting_template,
        closingTemplate: p.closing_template,
        faqEntries: p.faq_entries || [],
        commonObjections: p.common_objections || [],
        upsellEnabled: p.upsell_enabled,
        crossSellEnabled: p.cross_sell_enabled,
        urgencyEnabled: p.urgency_enabled,
        forbiddenTopics: p.forbidden_topics || [],
        competitorPolicy: p.competitor_policy,
        responseLength: p.response_length,
      };
    }

    const catalog = products.map((p: any, i: number) =>
      `${i + 1}. ${p.title} — ${p.price} دج${p.inStock ? '' : ' (غير متوفر)'}`
    ).join('\n');

    const storeLink = store_slug ? `https://www.sahla4eco.com/store/${store_slug}` : '';
    const prompt = `[متجر: ${store_name}]
${store_description ? store_description + '\n' : ''}
═══ المنتجات المتوفرة ═══
${catalog}

═══ التوصيل ═══
${deliveryInfo}
الدفع عند الاستلام (COD).
رابط المتجر: ${storeLink}

═══ رسالة الزبون ═══
${message}`;

    const response = await generateText(
      'customer',
      prompt,
      { storeId: clientId, storeName: store_name, clientId, userType: 'customer', persona: personaObj },
    );

    res.json({ answer: response });
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * POST /api/ai/catch-up-unanswered
 * Finds all conversations where the customer sent a message but the AI never responded,
 * then processes each through handleCustomerMessage() to generate and send a response.
 *
 * Query params: clientId (optional, defaults to authenticated client)
 * Body: { dryRun?: boolean } — if true, only returns what would be processed without sending
 */
router.post('/catch-up-unanswered', authenticate, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user?.id || Number(req.query.clientId);
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const dryRun = req.body?.dryRun === true;

    // Find conversations where the latest message is from the customer (unanswered)
    const unanswered = await pool.query(
      `WITH latest_messages AS (
        SELECT
          client_id,
          platform,
          platform_chat_id,
          role,
          message,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY client_id, platform, platform_chat_id
            ORDER BY created_at DESC
          ) as rn
        FROM customer_conversations
        WHERE client_id = $1
      )
      SELECT platform, platform_chat_id, message, created_at
      FROM latest_messages
      WHERE rn = 1 AND role = 'customer'
      ORDER BY created_at DESC`,
      [clientId]
    );

    if (unanswered.rows.length === 0) {
      return res.json({ processed: 0, message: 'No unanswered conversations found.' });
    }

    if (dryRun) {
      return res.json({
        processed: 0,
        found: unanswered.rows.length,
        conversations: unanswered.rows.map((r: any) => ({
          platform: r.platform,
          platformChatId: r.platform_chat_id,
          lastMessage: r.message?.substring(0, 100),
          lastMessageAt: r.created_at,
        })),
      });
    }

    const results: { platform: string; chatId: string; success: boolean; response?: string; error?: string }[] = [];

    for (const row of unanswered.rows) {
      const { platform, platform_chat_id, message } = row;
      try {
        // Generate AI response (this also saves history)
        const response = await handleCustomerMessage(clientId, platform, platform_chat_id, message);

        if (!response) {
          results.push({ platform, chatId: platform_chat_id, success: false, error: 'AI returned null (disabled or owner)' });
          continue;
        }

        // Send response via the appropriate platform
        let sendOk = false;
        try {
          if (platform === 'telegram') {
            const settings = await pool.query(
              `SELECT telegram_bot_token FROM bot_settings WHERE client_id = $1 LIMIT 1`,
              [clientId]
            );
            const token = settings.rows[0]?.telegram_bot_token;
            if (token) {
              const r = await sendTelegramMessage(token, platform_chat_id, response);
              sendOk = r.success;
            }
          } else if (platform === 'whatsapp') {
            const settings = await pool.query(
              `SELECT whatsapp_token, whatsapp_phone_id FROM bot_settings WHERE client_id = $1 LIMIT 1`,
              [clientId]
            );
            const token = settings.rows[0]?.whatsapp_token;
            const phoneId = settings.rows[0]?.whatsapp_phone_id;
            if (token && phoneId) {
              const r = await sendWhatsAppTextMessage(token, phoneId, platform_chat_id, response);
              sendOk = r.success;
            }
          } else if (platform === 'messenger') {
            const settings = await pool.query(
              `SELECT fb_page_access_token FROM bot_settings WHERE client_id = $1 LIMIT 1`,
              [clientId]
            );
            const token = settings.rows[0]?.fb_page_access_token;
            if (token) {
              const r = await sendMessengerMessageDirect(token, platform_chat_id, response);
              sendOk = r.success;
            }
          } else if (platform === 'instagram') {
            // Instagram uses the same Messenger API
            const settings = await pool.query(
              `SELECT fb_page_access_token FROM bot_settings WHERE client_id = $1 LIMIT 1`,
              [clientId]
            );
            const token = settings.rows[0]?.fb_page_access_token;
            if (token) {
              const r = await sendMessengerMessageDirect(token, platform_chat_id, response);
              sendOk = r.success;
            }
          }
        } catch (sendErr: any) {
          results.push({ platform, chatId: platform_chat_id, success: false, response, error: `Send failed: ${sendErr.message}` });
          continue;
        }

        results.push({ platform, chatId: platform_chat_id, success: sendOk, response: sendOk ? response.substring(0, 100) : undefined, error: sendOk ? undefined : 'Send function returned false' });
      } catch (err: any) {
        results.push({ platform, chatId: platform_chat_id, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) {
    return serverError(res, err);
  }
});

export default router;
