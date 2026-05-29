/**
 * Owner AI — Clean, Smart, Action-Oriented
 *
 * One file. One purpose: be the store owner's AI partner.
 * No context dumps. No platform docs. Just smart, data-driven responses.
 */

import { ensureConnection } from '../utils/database';
import { generateText, GeminiContent } from './gemini';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Short, focused, smart
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `أنت مساعد ذكي لصاحب متجر. أنت ترى بيانات المتجر الحية في كل سؤال. استخدم الأرقام كما هي — لا ت Invent أرقام.

مثال: إذا السياق يقول "الطلبات: 0" جاوب "0 طلب". إذا يقول "الدخل: 50000 دج" جاوب "50000 دج".

لا تقل "تحقق من لوحة التحكم" — أنت هو لوحة التحكم.

رد بلغة المستخدم. كن مختصراً.`;

// ═══════════════════════════════════════════════════════════════
// ACTIONS — Simple, reliable JSON
// ═══════════════════════════════════════════════════════════════

const ACTION_INSTRUCTIONS = `
الأدوات المتاحة (أضف ECOPRO_ACTION في النهاية إذا طلب إجراء):
- ECOPRO_ACTION:{"type":"search_store_data","dataType":"orders|products|customers","query":"<query>"}
- ECOPRO_ACTION:{"type":"create_product","title":"<t>","price":<n>,"stock":<n>,"category":"<c>"}
- ECOPRO_ACTION:{"type":"edit_product","productId":<n>,"field":"price|stock|title","value":"<v>"}
- ECOPRO_ACTION:{"type":"update_order_status","orderId":<n>,"newStatus":"<status>"}
Statuses: pending, confirmed, processing, shipped, delivered, cancelled, returned`;

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleOwnerMessage(
  clientId: number,
  question: string,
  prevHistory: GeminiContent[] = []
): Promise<{ answer: string; action: any | null }> {
  // Rate limit
  if (!checkRateLimit(`owner:${clientId}`, RATE_LIMITS.store_owner)) {
    return { answer: getRateLimitMessage(getRateLimitResetTime(`owner:${clientId}`), 'store_owner', 'ar'), action: null };
  }

  // Load slim context
  const ctx = await loadSlimContext(clientId);
  if (!ctx) return { answer: 'لم يتم العثور على بيانات المتجر.', action: null };

  // Build user prompt
  const prompt = buildUserPrompt(ctx, prevHistory, question);

  try {
    const response = await generateText('store_owner', prompt, { storeId: clientId, storeName: ctx.storeName, clientId, userType: 'owner' }, prevHistory, undefined, SYSTEM_PROMPT + '\n' + ACTION_INSTRUCTIONS);

    // Parse action
    let answer = response;
    let action: any = null;
    const actionMatch = response.match(/\nECOPRO_ACTION:(\{[\s\S]*?\})\s*$/);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        answer = response.replace(/\nECOPRO_ACTION:\{[\s\S]*?\}\s*$/, '').trim();
      } catch {}
    }

    // Handle search_store_data inline
    if (action?.type === 'search_store_data') {
      const toolResult = await executeSearch(clientId, action.dataType, action.query);
      const followUp = await generateText('store_owner', `البيانات المطلوبة:\n${toolResult}\n\nالسؤال الأصلي: "${question}"`, { storeId: clientId, storeName: ctx.storeName, clientId, userType: 'owner' }, prevHistory, undefined, SYSTEM_PROMPT);
      answer = followUp;
      action = null;
    }

    // Validate: if AI said "check dashboard" but we have actual data, override with direct answer
    answer = validateResponse(answer, question, ctx);

    return { answer, action };
  } catch (err) {
    console.error(`[OwnerAI] Error for client ${clientId}:`, err);
    return { answer: 'حدث خطأ. يرجى المحاولة مرة أخرى.', action: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE ACTIONS (called from routes/ai.ts)
// ═══════════════════════════════════════════════════════════════

export async function executeAction(clientId: number, action: any): Promise<{ success: boolean; message: string; data?: any }> {
  const p = await ensureConnection();
  try {
    switch (action.type) {
      case 'update_order_status': {
        const { orderId, newStatus } = action;
        if (!orderId || !newStatus) return { success: false, message: 'بيانات ناقصة' };
        await p.query(`UPDATE store_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3`, [newStatus, orderId, clientId]);
        return { success: true, message: `تم تغيير حالة الطلب #${orderId} إلى ${newStatus}` };
      }
      case 'create_product': {
        const { title, price, stock, category, description } = action;
        if (!title || !price) return { success: false, message: 'الاسم والسعر مطلوبان' };
        const res = await p.query(`INSERT INTO client_store_products (client_id, title, price, stock_quantity, category, description, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id`, [clientId, title, price, stock || 0, category || null, description || null]);
        return { success: true, message: `تم إضافة المنتج "${title}" (ID: ${res.rows[0].id})`, data: { productId: res.rows[0].id } };
      }
      case 'edit_product': {
        const { productId, field, value } = action;
        if (!productId || !field || value === undefined) return { success: false, message: 'بيانات ناقصة' };
        const allowed = ['price', 'stock_quantity', 'title', 'status'];
        if (!allowed.includes(field)) return { success: false, message: `الحقل "${field}" غير مدعوم` };
        const dbField = field === 'stock' ? 'stock_quantity' : field;
        await p.query(`UPDATE client_store_products SET ${dbField} = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3`, [value, productId, clientId]);
        return { success: true, message: `تم تعديل ${field} للمنتج #${productId}` };
      }
      default:
        return { success: false, message: `إجراء غير معروف: ${action.type}` };
    }
  } catch (err) {
    console.error('[OwnerAI] executeAction error:', err);
    return { success: false, message: 'حدث خطأ أثناء التنفيذ' };
  }
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE VALIDATION — Fix "check dashboard" responses
// ═══════════════════════════════════════════════════════════════

const DASHBOARD_PATTERNS = /تحقق|لوحة التحكم|يمكنك رؤية|يمكنك الاطلاع|تستطيع رؤية|يمكنك مراجعة|من خلال قسم|في قسم|صفحة.*الإعدادات|تقرير مفصل/i;

function validateResponse(answer: string, question: string, ctx: SlimContext): string {
  // Only override if the response is a "check dashboard" type AND we have actual data
  if (!DASHBOARD_PATTERNS.test(answer)) return answer;

  const q = question.toLowerCase();

  // Questions about orders
  if (q.includes('طلبات') || q.includes('طلب')) {
    if (q.includes('معلق') || q.includes('بانتظار')) {
      return `عندك ${ctx.pendingOrders} طلب معلق حالياً من أصل ${ctx.totalOrders} طلب إجمالي.`;
    }
    return `عندك ${ctx.totalOrders} طلب إجمالي.`;
  }

  // Questions about revenue/income
  if (q.includes('دخل') || q.includes('ارباح') || q.includes('أرباح') || q.includes('مبيعات') || q.includes('إيرادات')) {
    return `الدخل هاد الشهر: ${ctx.totalRevenue.toLocaleString('ar-DZ')} دج.`;
  }

  // Questions about products
  if (q.includes('منتج') || q.includes('منتجات')) {
    let response = `عندك ${ctx.totalProducts} منتج نشط.`;
    if (ctx.lowStockProducts.length) response += ` المخزون منخفض: ${ctx.lowStockProducts.join('، ')}.`;
    if (ctx.topProducts.length) response += ` الأكثر مبيعاً: ${ctx.topProducts.join('، ')}.`;
    return response;
  }

  // Questions about store name
  if (q.includes('اسم') && (q.includes('متجر') || q.includes('المتجر'))) {
    return `اسم متجرك: ${ctx.storeName}.`;
  }

  // If we can't match a specific question, return original answer
  return answer;
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

function pool() { return ensureConnection(); }

interface SlimContext {
  storeName: string;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  lowStockProducts: string[];
  topProducts: string[];
  subscriptionStatus: string;
}

async function loadSlimContext(clientId: number): Promise<SlimContext | null> {
  const p = await pool();

  const storeRes = await p.query(`SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
  if (!storeRes.rows.length) return null;
  const storeName = storeRes.rows[0].store_name || 'المتجر';

  // Key metrics only — not everything
  const [ordersRes, revenueRes, productsRes, lowStockRes, topRes, subRes] = await Promise.all([
    p.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'pending') as pending FROM store_orders WHERE client_id = $1`, [clientId]),
    p.query(`SELECT COALESCE(SUM(total_price), 0) as revenue FROM store_orders WHERE client_id = $1 AND status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`, [clientId]),
    p.query(`SELECT COUNT(*) as total FROM client_store_products WHERE client_id = $1 AND status = 'active'`, [clientId]),
    p.query(`SELECT title, stock_quantity FROM client_store_products WHERE client_id = $1 AND status = 'active' AND stock_quantity <= 5 AND stock_quantity > 0 ORDER BY stock_quantity ASC LIMIT 5`, [clientId]),
    p.query(`SELECT p.title, COUNT(o.id) as sales FROM client_store_products p JOIN store_orders o ON o.product_id = p.id WHERE p.client_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY p.title ORDER BY sales DESC LIMIT 5`, [clientId]),
    p.query(`SELECT subscription_status FROM subscriptions WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`, [clientId]).catch(() => ({ rows: [] })),
  ]);

  const or = ordersRes.rows[0];
  return {
    storeName,
    totalOrders: Number(or.total) || 0,
    pendingOrders: Number(or.pending) || 0,
    totalRevenue: Number(revenueRes.rows[0]?.revenue) || 0,
    totalProducts: Number(productsRes.rows[0]?.total) || 0,
    lowStockProducts: lowStockRes.rows.map((r: any) => `${r.title} (${r.stock_quantity})`),
    topProducts: topRes.rows.map((r: any) => `${r.title} (${r.sales} مبيعات)`),
    subscriptionStatus: subRes.rows[0]?.subscription_status || 'unknown',
  };
}

function buildUserPrompt(ctx: SlimContext, history: GeminiContent[], question: string): string {
  let p = `متجر: ${ctx.storeName}\n`;
  p += `\n=== البيانات الحالية ===`;
  p += `\nالطلبات: ${ctx.totalOrders} إجمالي، ${ctx.pendingOrders} معلقة`;
  p += `\nالدخل (30 يوم): ${ctx.totalRevenue.toLocaleString()} دج`;
  p += `\nالمنتجات: ${ctx.totalProducts} نشط`;
  if (ctx.lowStockProducts.length) p += `\nمخزون منخفض: ${ctx.lowStockProducts.join('، ')}`;
  if (ctx.topProducts.length) p += `\nالأكثر مبيعاً: ${ctx.topProducts.join('، ')}`;
  p += `\nالاشتراك: ${ctx.subscriptionStatus}`;

  // History
  if (history.length > 0) {
    p += `\n\n=== المحادثة السابقة ===`;
    for (const h of history.slice(-6)) {
      p += `\n${h.role === 'user' ? 'المستخدم' : 'أنت'}: ${h.parts[0]?.text || ''}`;
    }
  }

  p += `\n\n${ACTION_INSTRUCTIONS}`;
  p += `\n\nالسؤال: "${question}"`;
  p += `\n\nرد بلغة السؤال.`;
  return p;
}

async function searchStoreData(clientId: number, dataType: string, query: string): Promise<any[]> {
  const p = await pool();
  const q = `%${query || ''}%`;
  switch (dataType) {
    case 'orders': {
      const res = await p.query(`SELECT id, customer_name, customer_phone, total_price, status, delivery_status, created_at FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND (id::text ILIKE $2 OR customer_name ILIKE $2 OR customer_phone ILIKE $2 OR status ILIKE $2) ORDER BY created_at DESC LIMIT 10`, [clientId, q]);
      return res.rows;
    }
    case 'products': {
      const res = await p.query(`SELECT id, title, price, stock_quantity, category, status FROM client_store_products WHERE client_id = $1 AND (title ILIKE $2 OR category ILIKE $2) ORDER BY created_at DESC LIMIT 10`, [clientId, q]);
      return res.rows;
    }
    case 'customers': {
      const res = await p.query(`SELECT customer_name, customer_phone, COUNT(*) as order_count FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND (customer_name ILIKE $2 OR customer_phone ILIKE $2) GROUP BY customer_name, customer_phone ORDER BY order_count DESC LIMIT 10`, [clientId, q]);
      return res.rows;
    }
    default: return [];
  }
}

async function executeSearch(clientId: number, dataType: string, query: string): Promise<string> {
  const results = await searchStoreData(clientId, dataType, query);
  if (!results.length) return 'لا توجد نتائج.';
  if (dataType === 'orders') return results.map((o: any) => `#${o.id} | ${o.customer_name || 'N/A'} | ${o.total_price} دج | ${o.status} | ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`).join('\n');
  if (dataType === 'products') return results.map((p: any) => `#${p.id} | ${p.title} | ${p.price} دج | مخزون: ${p.stock_quantity ?? 'N/A'} | ${p.category || ''}`).join('\n');
  if (dataType === 'customers') return results.map((c: any) => `${c.customer_name || 'N/A'} | ${c.customer_phone || 'N/A'} | ${c.order_count} طلبات`).join('\n');
  return JSON.stringify(results);
}

// ═══════════════════════════════════════════════════════════════
// OWNER CONVERSATION HISTORY
// ═══════════════════════════════════════════════════════════════

export async function getOwnerHistory(clientId: number): Promise<GeminiContent[]> {
  try {
    const p = await pool();
    const res = await p.query(`SELECT role, message FROM store_owner_conversations WHERE client_id = $1 ORDER BY created_at DESC LIMIT 8`, [clientId]);
    return res.rows.reverse().map((r: any) => ({ role: r.role === 'owner' ? 'user' as const : 'model' as const, parts: [{ text: r.message }] }));
  } catch { return []; }
}

export async function saveOwnerHistory(clientId: number, message: string, response: string): Promise<void> {
  try {
    const p = await pool();
    await p.query(`INSERT INTO store_owner_conversations (client_id, role, message) VALUES ($1, 'owner', $2), ($1, 'assistant', $3)`, [clientId, message, response]);
    await p.query(`DELETE FROM store_owner_conversations WHERE client_id = $1 AND id NOT IN (SELECT id FROM store_owner_conversations WHERE client_id = $1 ORDER BY created_at DESC LIMIT 50)`, [clientId]).catch(() => {});
  } catch {}
}
