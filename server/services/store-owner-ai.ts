/**
 * Store Owner AI Service
 * 
 * Provides intelligent responses to store owner queries with real-time data access.
 * Includes: order stats, revenue, product performance, subscription info, delivery config
 */

import { ensureConnection } from '../utils/database';
import { generateText, generateJSON, GeminiContent } from './gemini';
import { storeOwnerChatHandler } from './store-owner-chat-handler';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

interface StoreOwnerContext {
  storeName: string;
  storeSlug: string;
  // Orders
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  pendingOrders: number;
  // Revenue
  todayRevenue: number;
  monthRevenue: number;
  // Products
  totalProducts: number;
  lowStockProducts: { title: string; stock: number }[];
  topProducts: { title: string; sales: number }[];
  // Subscription
  subscriptionStatus: string;
  subscriptionEndDate: Date | null;
  daysRemaining: number;
  // Delivery
  deliveryZonesCount: number;
  deliveryCompanies: string[];
}

/**
 * Load real-time store context for AI
 */
async function loadStoreOwnerContext(clientId: number): Promise<StoreOwnerContext | null> {
  const pool = await ensureConnection();

  // Store basic info
  const storeRes = await pool.query(
    `SELECT store_name, store_slug FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  if (!storeRes.rows.length) return null;
  const { store_name, store_slug } = storeRes.rows[0];

  // Orders stats
  const todayRes = await pool.query(
    `SELECT COUNT(*) as count FROM store_orders 
     WHERE client_id = $1 AND created_at >= CURRENT_DATE`,
    [clientId]
  );
  const weekRes = await pool.query(
    `SELECT COUNT(*) as count FROM store_orders 
     WHERE client_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
    [clientId]
  );
  const monthRes = await pool.query(
    `SELECT COUNT(*) as count FROM store_orders 
     WHERE client_id = $1 AND created_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
    [clientId]
  );
  const pendingRes = await pool.query(
    `SELECT COUNT(*) as count FROM store_orders 
     WHERE client_id = $1 AND status = 'pending'`,
    [clientId]
  );

  // Revenue stats
  const todayRevenueRes = await pool.query(
    `SELECT COALESCE(SUM(total_price), 0) as revenue FROM store_orders 
     WHERE client_id = $1 AND created_at >= CURRENT_DATE AND status != 'cancelled'`,
    [clientId]
  );
  const monthRevenueRes = await pool.query(
    `SELECT COALESCE(SUM(total_price), 0) as revenue FROM store_orders 
     WHERE client_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days' AND status != 'cancelled'`,
    [clientId]
  );

  // Product stats
  const totalProductsRes = await pool.query(
    `SELECT COUNT(*) as count FROM client_store_products WHERE client_id = $1 AND status = 'active'`,
    [clientId]
  );
  const lowStockRes = await pool.query(
    `SELECT title, stock_quantity FROM client_store_products 
     WHERE client_id = $1 AND status = 'active' AND stock_quantity <= 5 AND stock_quantity > 0
     ORDER BY stock_quantity ASC LIMIT 5`,
    [clientId]
  );
  const topProductsRes = await pool.query(
    `SELECT p.title, COUNT(o.id) as sales 
     FROM client_store_products p
     JOIN store_orders o ON o.product_id = p.id
     WHERE p.client_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY p.id, p.title
     ORDER BY sales DESC LIMIT 5`,
    [clientId]
  );

  // Subscription info
  const subscriptionRes = await pool.query(
    `SELECT subscription_status, subscription_ends_at, trial_ends_at 
     FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  const sub = subscriptionRes.rows[0] || {};
  let subscriptionEndDate = sub.subscription_ends_at || sub.trial_ends_at;
  let daysRemaining = 0;
  if (subscriptionEndDate) {
    daysRemaining = Math.max(0, Math.ceil((new Date(subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  // Delivery config
  const zonesRes = await pool.query(
    `SELECT COUNT(*) as count FROM delivery_prices WHERE client_id = $1 AND is_active = true`,
    [clientId]
  );
  const companiesRes = await pool.query(
    `SELECT DISTINCT dc.name FROM delivery_companies dc
     JOIN client_delivery_configs cdc ON cdc.delivery_company_id = dc.id
     WHERE cdc.client_id = $1 AND cdc.is_active = true`,
    [clientId]
  );

  return {
    storeName: store_name || 'متجرك',
    storeSlug: store_slug || '',
    todayOrders: parseInt(todayRes.rows[0]?.count) || 0,
    weekOrders: parseInt(weekRes.rows[0]?.count) || 0,
    monthOrders: parseInt(monthRes.rows[0]?.count) || 0,
    pendingOrders: parseInt(pendingRes.rows[0]?.count) || 0,
    todayRevenue: parseInt(todayRevenueRes.rows[0]?.revenue) || 0,
    monthRevenue: parseInt(monthRevenueRes.rows[0]?.revenue) || 0,
    totalProducts: parseInt(totalProductsRes.rows[0]?.count) || 0,
    lowStockProducts: lowStockRes.rows,
    topProducts: topProductsRes.rows,
    subscriptionStatus: sub.subscription_status || 'active',
    subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : null,
    daysRemaining,
    deliveryZonesCount: parseInt(zonesRes.rows[0]?.count) || 0,
    deliveryCompanies: companiesRes.rows.map((r: any) => r.name),
  };
}

/**
 * Detect intent from store owner message
 */
function detectIntent(message: string): 'orders' | 'revenue' | 'products' | 'delivery' | 'subscription' | 'help' | 'urgent' | 'general' {
  const lower = message.toLowerCase();
  
  // Urgent issues
  if (/مشكل|مشكلة|عاجل|urgent|problem|issue|error|bug|خطأ|واقع/i.test(lower) && 
      /كبير|big|serious|major|critical|Down|not working|ماشي/i.test(lower)) {
    return 'urgent';
  }
  
  // Orders
  if (/طلب|طلبات|order|orders|مبيعات|sales/i.test(lower)) {
    return 'orders';
  }
  
  // Revenue
  if (/فلوس|فلوس|فلوس|revenue|income|earnings|profit|دخل|مبيعات|فلوس/i.test(lower)) {
    return 'revenue';
  }
  
  // Products
  if (/منتج|منتجات|product|stock|مخزون|كمية|inventory/i.test(lower)) {
    return 'products';
  }
  
  // Delivery
  if (/توصيل|delivery|shipping|wilaya|ولاية|yalidine|bsr/i.test(lower)) {
    return 'delivery';
  }
  
  // Subscription
  if (/اشتراك|subscription|تجديد|renew|فلوس|payment|code|كود/i.test(lower)) {
    return 'subscription';
  }
  
  // Help
  if (/كيف|how|explain|شرح|help|مساعدة|what is|شنو/i.test(lower)) {
    return 'help';
  }
  
  return 'general';
}

/**
 * Build context-rich prompt for store owner
 */
function buildOwnerPrompt(ctx: StoreOwnerContext, intent: string, message: string): string {
  let contextSection = '';
  
  switch (intent) {
    case 'orders':
      contextSection = `
═══ طلبات المتجر ═══
• اليوم: ${ctx.todayOrders} طلب
• هذا الأسبوع: ${ctx.weekOrders} طلب
• هذا الشهر: ${ctx.monthOrders} طلب
• قيد الانتظار: ${ctx.pendingOrders} طلب`;
      break;
      
    case 'revenue':
      contextSection = `
═══ إحصائيات المبيعات ═══
• مبيعات اليوم: ${ctx.todayRevenue.toLocaleString()} دج
• مبيعات الشهر: ${ctx.monthRevenue.toLocaleString()} دج`;
      break;
      
    case 'products':
      contextSection = `
═══ المنتجات ═══
• إجمالي المنتجات النشطة: ${ctx.totalProducts}
• المنتجات منخفضة المخزون:
${ctx.lowStockProducts.map(p => `  - ${p.title}: ${p.stock} بقي`).join('\n') || '  لا يوجد'}
• الأكثر مبيعاً هذا الشهر:
${ctx.topProducts.map((p, i) => `  ${i + 1}. ${p.title} (${p.sales} مبيعة)`).join('\n') || '  لا توجد بيانات'}`;
      break;
      
    case 'subscription':
      contextSection = `
═══ الاشتراك ═══
• الحالة: ${ctx.subscriptionStatus}
• الأيام المتبقية: ${ctx.daysRemaining} يوم
• ينتهي في: ${ctx.subscriptionEndDate?.toLocaleDateString('ar-DZ') || 'غير محدد'}`;
      break;
      
    case 'delivery':
      contextSection = `
═══ التوصيل ═══
• عدد الولايات المفعلة: ${ctx.deliveryZonesCount}
• شركات التوصيل المتصلة: ${ctx.deliveryCompanies.join(', ') || 'لا يوجد'}`;
      break;
  }

  return `[متجر: ${ctx.storeName}]
${contextSection}

═══ رسالة صاحب المتجر ═══
${message}

[هام: هذه بيانات حقيقية من قاعدة البيانات. أجب بصراحة ودقة من هذه البيانات.]`;
}

/**
 * Handle urgent issues - create alert
 */
async function handleUrgentIssue(clientId: number, message: string): Promise<string> {
  const pool = await ensureConnection();
  
  // Log urgent alert
  try {
    await pool.query(
      `INSERT INTO bot_messages (client_id, message_type, message_content, send_at)
       VALUES ($1, 'urgent_support', $2, NOW())`,
      [clientId, `🚨 مشكل عاجل من صاحب المتجر #${clientId}:\n${message}`]
    );
  } catch {}
  
  return `🚨 تم تسجيل مشكلتك كأولوية عاجلة!

فريق الدعم سيتواصل معك خلال ساعة.

للتواصل المباشر:
• Telegram: @sahla4eco_support
• Email: support@sahla4eco.com`;
}

/**
 * Get conversation history for store owner
 */
async function getOwnerConversationHistory(
  clientId: number,
  limit = 10
): Promise<GeminiContent[]> {
  try {
    const pool = await ensureConnection();
    const res = await pool.query(
      `SELECT role, message, created_at FROM store_owner_conversations
       WHERE client_id = $1 
       ORDER BY created_at DESC
       LIMIT $2`,
      [clientId, limit]
    );
    
    // Reverse to chronological order and convert to Gemini format
    return res.rows.reverse().map((r: any) => ({
      role: r.role === 'owner' ? 'user' as const : 'model' as const,
      parts: [{ text: r.message }],
    }));
  } catch {
    return [];
  }
}

/**
 * Save conversation turn for store owner
 */
async function saveOwnerConversationTurn(
  clientId: number,
  ownerMessage: string,
  aiResponse: string
): Promise<void> {
  try {
    const pool = await ensureConnection();
    await pool.query(
      `INSERT INTO store_owner_conversations (client_id, role, message, created_at)
       VALUES ($1, 'owner', $2, NOW()), ($1, 'assistant', $3, NOW())`,
      [clientId, ownerMessage, aiResponse]
    );
    
    // Cleanup old messages (keep last 50)
    await pool.query(
      `DELETE FROM store_owner_conversations
       WHERE client_id = $1 AND id NOT IN (
         SELECT id FROM store_owner_conversations 
         WHERE client_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50
       )`,
      [clientId]
    );
  } catch (err) {
    console.error('[StoreOwnerAI] Failed to save conversation:', err);
  }
}

/**
 * Main handler for store owner AI queries
 */
export async function handleStoreOwnerMessage(
  clientId: number,
  message: string
): Promise<string> {
  // Check rate limit
  const rateLimitKey = `owner:${clientId}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMITS.store_owner)) {
    const resetTime = getRateLimitResetTime(rateLimitKey);
    return getRateLimitMessage(resetTime, 'store_owner', 'ar');
  }

  // First, try color intelligence handler
  const colorResponse = await storeOwnerChatHandler.processStoreOwnerMessage(clientId, clientId, message);
  if (colorResponse) {
    // Save this interaction
    await saveOwnerConversationTurn(clientId, message, colorResponse.content);
    return colorResponse.content;
  }

  // Detect intent
  const intent = detectIntent(message);
  
  // Handle urgent issues immediately
  if (intent === 'urgent') {
    const response = await handleUrgentIssue(clientId, message);
    await saveOwnerConversationTurn(clientId, message, response);
    return response;
  }

  // Load real context
  const ctx = await loadStoreOwnerContext(clientId);
  if (!ctx) {
    return 'عذراً، لم أتمكن من تحميل بيانات المتجر. جرب مرة أخرى.';
  }

  // Load conversation history
  const history = await getOwnerConversationHistory(clientId);

  // Build context-rich prompt
  const prompt = buildOwnerPrompt(ctx, intent, message);

  // Generate response
  try {
    const response = await generateText(
      'store_owner',
      prompt,
      { storeId: clientId, storeName: ctx.storeName },
      history // Pass history to AI!
    );
    
    // Save conversation turn
    await saveOwnerConversationTurn(clientId, message, response);
    
    return response;
  } catch (err: any) {
    console.error('[StoreOwnerAI] Error:', err);
    return 'عذراً، حصل خطأ تقني. جرب مرة أخرى بعد شوية.';
  }
}
