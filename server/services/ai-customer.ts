/**
 * AI Customer Auto-Reply Service
 *
 * Handles incoming customer messages from Telegram/Messenger/WhatsApp.
 * Loads the store's product catalog and context, then generates an intelligent
 * AI response using Gemini.
 */

import { ensureConnection } from '../utils/database';
import { generateText } from './gemini';

type Platform = 'telegram' | 'messenger' | 'whatsapp' | 'instagram';

interface PendingOrderSession {
  clientId: number;
  platform: Platform;
  platformChatId: string;
  productId?: number;
  productTitle?: string;
  productPrice?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  wilayaId?: number;
  wilayaName?: string;
  deliveryType?: 'home' | 'desk';
  step: 'product' | 'name' | 'phone' | 'wilaya' | 'address' | 'confirm';
  createdAt: number;
}

// In-memory store for active AI order sessions (expires in 30 min)
const pendingOrderSessions = new Map<string, PendingOrderSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;

// Unified rate limiter
import { checkRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

function sessionKey(clientId: number, platform: Platform, chatId: string): string {
  return `${clientId}:${platform}:${chatId}`;
}

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [key, s] of pendingOrderSessions) {
    if (now - s.createdAt > SESSION_TTL_MS) pendingOrderSessions.delete(key);
  }
}

interface StoreContext {
  storeName: string;
  storeDescription: string;
  currency: string;
  products: { 
    title: string; 
    price: number; 
    originalPrice?: number; 
    description?: string; 
    category?: string; 
    inStock: boolean; 
    stockQuantity?: number;
    offers?: { quantity: number; bundle_price: number; free_delivery: boolean }[];
    variants?: { name: string; value: string; price?: number; stock?: number; inStock: boolean }[];
  }[];
  deliveryInfo: string;
  aiInstructions?: string;
  storeLink?: string;
  hasWholesale?: boolean;
}

/**
 * Check if AI auto-reply is enabled for a given client and platform.
 * Checks ai_chat_enabled (master), storefront_assistant toggle AND the per-platform toggle.
 */
export async function isAiAutoReplyEnabled(clientId: number, platform?: Platform): Promise<boolean> {
  try {
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT ai_chat_enabled, storefront_assistant, ai_reply_telegram, ai_reply_messenger, ai_reply_instagram, ai_reply_whatsapp, ai_reply_viber FROM ai_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  // Default to true if no row exists (matches ai_settings default behavior)
  if (res.rows.length === 0) return true;
  const row = res.rows[0];
  // Master global toggle must be on
  if (row.ai_chat_enabled === false) return false;
  // Storefront assistant toggle must be on
  if (row.storefront_assistant === false) return false;
  // Check per-platform toggle
  if (platform) {
    const platformCol: Record<string, string> = {
      telegram: 'ai_reply_telegram',
      messenger: 'ai_reply_messenger',
      instagram: 'ai_reply_instagram',
      whatsapp: 'ai_reply_whatsapp',
      viber: 'ai_reply_viber',
    };
    const col = platformCol[platform];
    if (col && row[col] === false) return false;
  }
  return true;
  } catch {
    return true; // Default to enabled if table missing
  }
}

/**
 * Load store context for AI prompt building.
 */
async function loadStoreContext(clientId: number): Promise<StoreContext | null> {
  const pool = await ensureConnection();

  // Store settings
  const settingsRes = await pool.query(
    `SELECT store_name, store_description, store_slug FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  if (!settingsRes.rows.length) return null;
  const { store_name, store_description, store_slug } = settingsRes.rows[0];

  // Active products with offers and variants (limit to 50 to keep prompt size reasonable)
  const productsRes = await pool.query(
    `SELECT p.id, p.title, p.price, p.original_price, p.description, p.category, p.stock_quantity,
            (SELECT json_agg(json_build_object('quantity', o.quantity, 'bundle_price', o.bundle_price, 'free_delivery', o.free_delivery))
             FROM product_offers o WHERE o.product_id = p.id AND o.client_id = p.client_id AND o.is_active = true) as offers,
            (SELECT json_agg(json_build_object('name', v.variant_name, 'value', v.variant_name, 'price', v.price, 'stock', v.stock_quantity, 'inStock', (v.stock_quantity > 0)))
             FROM product_variants v WHERE v.product_id = p.id AND v.client_id = p.client_id) as variants
     FROM client_store_products p
     WHERE p.client_id = $1 AND p.status = 'active'
     ORDER BY p.is_featured DESC NULLS LAST, p.created_at DESC
     LIMIT 50`,
    [clientId]
  );

  const products = productsRes.rows.map((p: any) => ({
    title: p.title,
    price: Number(p.price),
    originalPrice: p.original_price ? Number(p.original_price) : undefined,
    description: p.description ? String(p.description).slice(0, 200) : undefined,
    category: p.category || undefined,
    inStock: (p.stock_quantity ?? 1) > 0,
    stockQuantity: p.stock_quantity,
    offers: Array.isArray(p.offers) ? p.offers : undefined,
    variants: Array.isArray(p.variants) ? p.variants.filter((v: any) => v.name && v.value) : undefined,
  }));

  // Delivery summary (average price, active wilayas count)
  const deliveryRes = await pool.query(
    `SELECT COUNT(*) as zones, 
            MIN(home_delivery_price) as min_price, 
            MAX(home_delivery_price) as max_price
     FROM delivery_prices
     WHERE client_id = $1 AND is_active = true`,
    [clientId]
  );
  const d = deliveryRes.rows[0];
  const deliveryInfo = d?.zones > 0
    ? `التوصيل متاح إلى ${d.zones} ولاية. سعر التوصيل من ${d.min_price} إلى ${d.max_price} دج.`
    : 'معلومات التوصيل غير متوفرة حالياً.';

  // AI instructions from ai_settings
  const aiRes = await pool.query(
    `SELECT ai_instructions FROM ai_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );

  // Check for wholesale pricing availability
  const wholesaleRes = await pool.query(
    `SELECT 1 FROM product_offers o 
     JOIN client_store_products p ON p.id = o.product_id 
     WHERE p.client_id = $1 AND o.quantity >= 10 AND o.is_active = true 
     LIMIT 1`,
    [clientId]
  ).catch(() => ({ rows: [] }));
  const hasWholesale = wholesaleRes.rows.length > 0;

  // Build store link
  const storeLink = store_slug ? `https://www.sahla4eco.com/store/${store_slug}` : undefined;

  return {
    storeName: store_name || 'المتجر',
    storeDescription: store_description || '',
    currency: 'دج',
    products,
    deliveryInfo,
    aiInstructions: aiRes.rows[0]?.ai_instructions || undefined,
    storeLink,
    hasWholesale,
  };
}

/**
 * Get recent conversation history for context.
 * Returns last N messages in Gemini content format.
 */
async function getConversationHistory(
  clientId: number,
  platform: Platform,
  platformChatId: string,
  limit = 10
): Promise<{ role: 'user' | 'model'; parts: { text: string }[] }[]> {
  try {
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT role, message FROM customer_conversations
     WHERE client_id = $1 AND platform = $2 AND platform_chat_id = $3
     ORDER BY created_at DESC
     LIMIT $4`,
    [clientId, platform, platformChatId, limit]
  );

  // Reverse to chronological order, map to Gemini format
  return res.rows.reverse().map((r: any) => ({
    role: r.role === 'customer' ? 'user' as const : 'model' as const,
    parts: [{ text: r.message }],
  }));
  } catch {
    return [];
  }
}

/**
 * Save a conversation turn (both customer message and AI response).
 */
async function saveConversationTurn(
  clientId: number,
  platform: Platform,
  platformChatId: string,
  customerMessage: string,
  aiResponse: string
): Promise<void> {
  const pool = await ensureConnection();
  await pool.query(
    `INSERT INTO customer_conversations (client_id, platform, platform_chat_id, role, message)
     VALUES ($1, $2, $3, 'customer', $4), ($1, $2, $3, 'assistant', $5)`,
    [clientId, platform, platformChatId, customerMessage, aiResponse]
  );

  // Cleanup: delete messages older than 7 days for this conversation
  await pool.query(
    `DELETE FROM customer_conversations
     WHERE client_id = $1 AND platform = $2 AND platform_chat_id = $3
       AND created_at < NOW() - INTERVAL '7 days'`,
    [clientId, platform, platformChatId]
  ).catch(() => { /* non-critical */ });
}

/**
 * Build the product catalog section for the AI prompt.
 * ✅ FIX 6: Include variant-specific stock information
 */
function buildProductCatalog(ctx: StoreContext): string {
  if (!ctx.products.length) return 'لا توجد منتجات حالياً في المتجر.';

  const lines = ctx.products.map((p, i) => {
    let line = `${i + 1}. ${p.title} — ${p.price} ${ctx.currency}`;
    if (p.originalPrice && p.originalPrice > p.price) {
      const discount = Math.round((1 - p.price / p.originalPrice) * 100);
      line += ` (خصم ${discount}%，كان: ${p.originalPrice} ${ctx.currency})`;
    }
    // Enhanced stock information
    if (!p.inStock || (p.stockQuantity !== undefined && p.stockQuantity <= 0)) {
      line += ' [غير متوفر - نفذت الكمية]';
    } else if (p.stockQuantity !== undefined && p.stockQuantity <= 5) {
      line += ` [⚡ بقي ${p.stockQuantity} فقط]`;
    } else if (p.inStock) {
      line += ' [متوفر ✅]';
    }
    if (p.category) line += ` | ${p.category}`;
    if (p.description) line += `\n   ${p.description}`;
    
    // Include variant information
    if (p.variants && p.variants.length > 0) {
      const variantLines = p.variants.map(v => {
        const stockInfo = v.inStock ? (v.stock && v.stock <= 5 ? `(${v.stock} بقي)` : '✅') : '❌ نفذ';
        const priceInfo = v.price && v.price !== p.price ? `(${v.price} دج)` : '';
        return `     • ${v.name}: ${v.value} ${priceInfo} ${stockInfo}`;
      });
      line += '\n   التشكيلات:' + '\n' + variantLines.join('\n');
    }
    
    if (p.offers?.length) {
      const offerLines = p.offers.map(o => {
        let ol = `   🏷️ اشترِ ${o.quantity} بـ ${o.bundle_price} ${ctx.currency}`;
        if (o.free_delivery) ol += ' + توصيل مجاني';
        return ol;
      });
      line += '\n' + offerLines.join('\n');
    }
    return line;
  });

  // Add wholesale info if available
  if (ctx.hasWholesale) {
    lines.push('\n💼 متوفر أسعار الجملة للكميات - تواصل معنا للتفاصيل');
  }

  return lines.join('\n');
}

/**
 * Extract wilaya from message text.
 */
async function extractWilayaFromMessage(message: string): Promise<{ id: number; name: string } | null> {
  try {
    const pool = await ensureConnection();
    // Try to match wilaya name in message
    const words = message.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      const res = await pool.query(
        `SELECT id, name_ar as name FROM wilayas 
         WHERE lower(name_ar) LIKE lower($1) OR lower(name) LIKE lower($1) 
         LIMIT 1`,
        [`%${word}%`]
      );
      if (res.rows[0]) {
        return { id: res.rows[0].id, name: res.rows[0].name };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract address from message (anything after "عنوان" or "سكن" or long text after wilaya).
 */
function extractAddressFromMessage(message: string): string | null {
  // Try to find address markers
  const markers = ['عنوان', 'العنوان', 'سكن', 'السكن', 'اقامة', 'الاقامة', 'حي', 'الحي', 'شارع', 'الشارع'];
  for (const marker of markers) {
    const regex = new RegExp(`${marker}[\\s:]*(.{10,100})`, 'i');
    const match = message.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  // Try to get last long text segment (likely address)
  const segments = message.split(/[،,\\.\\n]/).map(s => s.trim()).filter(s => s.length > 10);
  if (segments.length > 0) {
    return segments[segments.length - 1];
  }
  return null;
}

/**
 * Resolve customer phone from their platform chat ID.
 */
async function resolveCustomerPhone(
  clientId: number,
  platform: Platform,
  platformChatId: string
): Promise<string | null> {
  try {
    // For WhatsApp, the platformChatId IS the phone number
    if (platform === 'whatsapp') {
      return String(platformChatId).replace(/\D/g, '') || null;
    }
    const pool = await ensureConnection();
    const col = platform === 'telegram' ? 'telegram_chat_id'
      : (platform === 'messenger' || platform === 'instagram') ? 'messenger_psid'
      : 'messenger_psid';
    const res = await pool.query(
      `SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND ${col} = $2 LIMIT 1`,
      [clientId, platformChatId]
    );
    if (res.rows[0]?.customer_phone) return res.rows[0].customer_phone;

    // Fallback: check messenger_subscribers / order_messenger_chats for Messenger/Instagram
    if (platform === 'messenger' || platform === 'instagram') {
      const subRes = await pool.query(
        `SELECT customer_phone FROM messenger_subscribers WHERE client_id = $1 AND psid = $2 AND customer_phone IS NOT NULL LIMIT 1`,
        [clientId, platformChatId]
      );
      if (subRes.rows[0]?.customer_phone) return subRes.rows[0].customer_phone;

      // Last resort: check if there's an order_messenger_chats record → get phone from order
      const orderRes = await pool.query(
        `SELECT so.customer_phone FROM order_messenger_chats omc
         JOIN store_orders so ON so.id = omc.order_id AND so.client_id = omc.client_id
         WHERE omc.client_id = $1 AND omc.messenger_psid = $2 AND so.customer_phone IS NOT NULL
         ORDER BY so.created_at DESC LIMIT 1`,
        [clientId, platformChatId]
      );
      if (orderRes.rows[0]?.customer_phone) return orderRes.rows[0].customer_phone;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract an Algerian phone number from a customer message.
 * Supports formats: 0551234567, 05 51 23 45 67, +213551234567, 00213551234567, 213551234567, 0551-234-567, 05.51.23.45.67
 * Returns normalized phone (digits only, with leading 0) or null.
 */
function extractPhoneFromMessage(message: string): string | null {
  // Match Algerian mobile numbers: 05/06/07 followed by 8 digits
  // Supports: +213, 00213, 213 prefixes, and various separators (space, dot, dash)
  const patterns = [
    // Format: +213 5/6/7 XX XX XX or +2135XXXXXXXX
    /(?:\+?213|00213)[\s.-]?([567])[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})/,
    // Format: 0 5/6/7 XX XX XX with various separators
    /\b0[\s.-]?([567])[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})\b/,
    // Format: consecutive digits with optional separators anywhere
    /(?:\+?213|00213)?[\s.-]*([567]\d{8})/,
    // Format: 0 followed by 9 digits with any separators
    /\b0([567]\d{8})\b/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract all digits from the matched string
      const fullMatch = match[0];
      const digits = fullMatch.replace(/[^0-9]/g, '');
      
      // Normalize to Algerian format with leading 0
      let normalized: string;
      
      if (digits.startsWith('00213')) {
        // 00213555123456 -> 0555123456
        normalized = '0' + digits.slice(5);
      } else if (digits.startsWith('213')) {
        // 213555123456 -> 0555123456
        normalized = '0' + digits.slice(3);
      } else if (digits.startsWith('0')) {
        // Already has leading 0
        normalized = digits;
      } else if (digits.length === 9 && /^[567]/.test(digits)) {
        // Missing leading 0, add it
        normalized = '0' + digits;
      } else {
        normalized = digits;
      }
      
      // Validate: must be exactly 10 digits starting with 05, 06, or 07
      if (/^0[567]\d{8}$/.test(normalized)) {
        return normalized;
      }
    }
  }
  return null;
}

/**
 * Validate if a string is a proper Algerian phone number.
 */
function isValidAlgerianPhone(phone: string): boolean {
  return /^0[567]\d{8}$/.test(phone.replace(/\D/g, ''));
}

/**
 * Load a single order by ID (for when customer provides order # but no phone).
 * Returns order info string or empty string.
 * NOTE: Does not reveal customer_phone for security — AI should verify identity first.
 */
async function loadOrderById(clientId: number, orderId: number): Promise<string> {
  try {
    const pool = await ensureConnection();
    const res = await pool.query(
      `SELECT o.id, o.total_price, o.created_at, o.quantity,
              o.delivery_status, o.tracking_number, o.delivery_type,
              o.customer_name, o.shipping_address,
              p.title as product_title,
              dc.name as delivery_company,
              (SELECT de.event_type FROM delivery_events de
               WHERE de.order_id = o.id ORDER BY de.created_at DESC LIMIT 1) as last_event_type
       FROM store_orders o
       LEFT JOIN client_store_products p ON p.id = o.product_id
       LEFT JOIN delivery_companies dc ON dc.id = o.delivery_company_id
       WHERE o.client_id = $1 AND o.id = $2
       LIMIT 1`,
      [clientId, orderId]
    );
    if (!res.rows.length) return '';

    const o = res.rows[0];
    // NOTE: internal order `status` is intentionally NOT shared with AI customer context.
    // Only courier delivery_status (from webhooks) is exposed to customers.
    const deliveryStatusLabels: Record<string, string> = {
      pending:          'لم يُشحن بعد',
      assigned:         'تم تعيين شركة التوصيل',
      picked_up:        'تم استلامه من المتجر',
      in_transit:       'في الطريق',
      out_for_delivery: 'خرج للتوصيل — المندوب في الطريق إليك',
      delivered:        'تم التسليم بنجاح ✅',
      failed:           'فشلت محاولة التوصيل',
      returned:         'تم إرجاعه للمرسل',
    };
    const date = new Date(o.created_at).toLocaleDateString('ar-DZ');
    let line = `📦 طلب #${o.id} — ${o.product_title || 'منتج'} (×${o.quantity || 1}) — ${o.total_price} دج\n`;
    if (o.tracking_number) {
      const dStatus = deliveryStatusLabels[o.delivery_status] || o.delivery_status || 'جاري المتابعة';
      line += `   حالة التوصيل: ${dStatus}`;
      line += ` | رقم التتبع: ${o.tracking_number}`;
      if (o.delivery_company) line += ` (${o.delivery_company})`;
    } else {
      line += `   الطلب قيد التحضير — لم يُشحن بعد`;
    }
    if (o.shipping_address) line += `\n   الوجهة: ${o.shipping_address}`;
    line += `\n   الاسم: ${o.customer_name || 'غير محدد'}`;
    line += `\n   تاريخ الطلب: ${date}`;
    return line;
  } catch {
    return '';
  }
}

/**
 * Load customer's recent orders with full tracking/delivery context.
 */
async function loadCustomerOrders(
  clientId: number,
  customerPhone: string
): Promise<string> {
  try {
    const pool = await ensureConnection();
    const res = await pool.query(
      `SELECT o.id, o.total_price, o.created_at, o.quantity,
              o.delivery_status, o.tracking_number, o.delivery_type,
              o.customer_name, o.shipping_address,
              p.title as product_title,
              dc.name as delivery_company,
              (SELECT de.description FROM delivery_events de
               WHERE de.order_id = o.id
               ORDER BY de.created_at DESC LIMIT 1) as last_tracking_update,
              (SELECT de.event_type FROM delivery_events de
               WHERE de.order_id = o.id
               ORDER BY de.created_at DESC LIMIT 1) as last_event_type,
              (SELECT de.created_at FROM delivery_events de
               WHERE de.order_id = o.id
               ORDER BY de.created_at DESC LIMIT 1) as last_event_date
       FROM store_orders o
       LEFT JOIN client_store_products p ON p.id = o.product_id
       LEFT JOIN delivery_companies dc ON dc.id = o.delivery_company_id
       WHERE o.client_id = $1 AND o.customer_phone = $2
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [clientId, customerPhone]
    );
    if (!res.rows.length) return '';

    // NOTE: internal order `status` is intentionally NOT included in the AI customer context.
    // Customers only see courier delivery_status (from webhooks) — never internal statuses.
    const deliveryStatusLabels: Record<string, string> = {
      pending:          'لم يُشحن بعد',
      assigned:         'تم تعيين شركة التوصيل',
      picked_up:        'تم استلامه من المتجر',
      in_transit:       'في الطريق',
      out_for_delivery: 'خرج للتوصيل — المندوب في الطريق إليك',
      delivered:        'تم التسليم بنجاح ✅',
      failed:           'فشلت محاولة التوصيل',
      returned:         'تم إرجاعه للمرسل',
    };

    const eventTypeLabels: Record<string, string> = {
      pickup:           'تم الاستلام من المتجر',
      in_transit:       'في الطريق إلى الوجهة',
      out_for_delivery: 'خرج للتوصيل — المندوب في الطريق',
      at_hub:           'وصل لمركز التوزيع',
      delivered:        'تم التسليم بنجاح',
      failed:           'محاولة توصيل فاشلة',
      returned:         'تم إرجاع الطرد',
    };

    const lines = res.rows.map((o: any) => {
      const date = new Date(o.created_at).toLocaleDateString('ar-DZ');
      const product = o.product_title || 'منتج';
      const qty = o.quantity || 1;

      let line = `📦 طلب #${o.id} — ${product} (×${qty}) — ${o.total_price} دج\n`;

      // Only courier delivery_status exposed — not internal order status
      if (o.tracking_number) {
        const dStatus = deliveryStatusLabels[o.delivery_status] || o.delivery_status || 'جاري المتابعة';
        line += `   حالة التوصيل: ${dStatus}`;
        if (o.delivery_company) line += ` (${o.delivery_company})`;
        line += `\n   رقم التتبع: ${o.tracking_number}`;
      } else {
        line += `   الطلب قيد التحضير — لم يُشحن بعد`;
      }

      // Latest courier tracking event
      if (o.last_event_type) {
        const eventLabel = eventTypeLabels[o.last_event_type] || o.last_tracking_update || o.last_event_type;
        const eventDate = o.last_event_date ? new Date(o.last_event_date).toLocaleDateString('ar-DZ') : '';
        line += `\n   آخر تحديث من شركة التوصيل: ${eventLabel}${eventDate ? ` (${eventDate})` : ''}`;
      }

      // Destination
      if (o.shipping_address) {
        line += `\n   الوجهة: ${o.shipping_address}`;
        if (o.delivery_type === 'desk') line += ' (استلام من المكتب)';
      }

      line += `\n   تاريخ الطلب: ${date}`;
      return line;
    });

    return lines.join('\n\n');
  } catch (err) {
    console.error('[AI-Customer] Failed to load orders:', err);
    return '';
  }
}

/**
 * Create an order from a completed AI chat session.
 */
async function createOrderFromChat(
  session: PendingOrderSession
): Promise<{ orderId: number; total: number } | null> {
  try {
    const pool = await ensureConnection();
    const storeOrderColumns = await (async () => {
      const res = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'store_orders'`
      );
      return new Set<string>(res.rows.map((r: any) => String(r.column_name)));
    })();

    const insertCols: string[] = [];
    const insertVals: any[] = [];
    const addCol = (col: string, val: any) => {
      if (!storeOrderColumns.has(col)) return;
      insertCols.push(col);
      insertVals.push(val);
    };

    const deliveryRes = session.wilayaId
      ? await pool.query(
          `SELECT home_delivery_price, desk_delivery_price FROM delivery_prices
           WHERE client_id = $1 AND wilaya_id = $2 AND is_active = true LIMIT 1`,
          [session.clientId, session.wilayaId]
        )
      : { rows: [] };
    const deliveryFee = deliveryRes.rows[0]
      ? Number(session.deliveryType === 'desk'
          ? deliveryRes.rows[0].desk_delivery_price
          : deliveryRes.rows[0].home_delivery_price) || 0
      : 0;
    const total = (session.productPrice || 0) + deliveryFee;

    addCol('client_id', session.clientId);
    addCol('product_id', session.productId || null);
    addCol('quantity', 1);
    addCol('unit_price', session.productPrice || 0);
    addCol('total_price', total);
    addCol('delivery_fee', deliveryFee);
    addCol('delivery_type', session.deliveryType || 'home');
    addCol('customer_name', session.customerName || '');
    addCol('customer_phone', session.customerPhone || '');
    addCol('shipping_address', session.wilayaName || null);
    addCol('shipping_wilaya_id', session.wilayaId || null);
    addCol('status', 'pending');
    addCol('payment_status', 'unpaid');
    addCol('order_source', 'ai_chat');
    addCol('source_platform', session.platform);
    addCol('created_at', new Date());

    const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `INSERT INTO store_orders (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id, total_price`,
      insertVals
    );

    // Send notification to store owner about new chat order
    const orderId = result.rows[0].id;
    try {
      await pool.query(
        `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
         VALUES ($1, $2, $3, 'telegram', $4, NOW())`,
        [orderId, session.clientId, session.customerPhone || '', `📦 طلب جديد من AI Chat!\n\nرقم الطلب: #${orderId}\nالمنتج: ${session.productTitle}\nالسعر: ${session.productPrice} دج\nالاسم: ${session.customerName}\nالهاتف: ${session.customerPhone}\nالولاية: ${session.wilayaName}\nالعنوان: ${session.customerAddress}`]
      );
    } catch (notifyErr) {
      console.error('[AI-Customer] Failed to send notification:', notifyErr);
    }

    return { orderId, total: Number(result.rows[0].total_price) };
  } catch (err) {
    console.error('[AI-Customer] createOrderFromChat error:', err);
    return null;
  }
}

/**
 * Main handler: generate an AI response for an incoming customer message.
 *
 * Returns the AI response text, or null if AI auto-reply is disabled or context is missing.
 */
export async function handleCustomerMessage(
  clientId: number,
  platform: Platform,
  platformChatId: string,
  customerMessage: string
): Promise<string | null> {
  // Check if AI is enabled (global + per-platform)
  const enabled = await isAiAutoReplyEnabled(clientId, platform);
  if (!enabled) {
    console.log(`[AI-Customer] AI disabled for client ${clientId} on ${platform}`);
    return null;
  }

  // Don't auto-reply to the store owner (unless they prefix with /test for testing the customer flow)
  const isTestMode = customerMessage.trim().startsWith('/test');
  const ownerTalking = await isSenderStoreOwner(clientId, platform, platformChatId);
  if (ownerTalking && !isTestMode) {
    console.log(`[AI-Customer] Sender is store owner, skipping (client=${clientId}, chatId=${platformChatId})`);
    return null;
  }
  // Strip /test prefix before processing so the actual message is clean
  const effectiveMessage = isTestMode ? customerMessage.trim().replace(/^\/test\s*/i, '') : customerMessage;

  // Load store context
  const ctx = await loadStoreContext(clientId);
  if (!ctx) {
    console.log(`[AI-Customer] No store context for client ${clientId}`);
    return null;
  }
  console.log(`[AI-Customer] Processing msg for client ${clientId} (${ctx.storeName}), platform=${platform}, chatId=${platformChatId}`);

  // Load conversation history
  const history = await getConversationHistory(clientId, platform, platformChatId);

  // Resolve customer identity and load their orders
  let customerPhone = await resolveCustomerPhone(clientId, platform, platformChatId);
  let orderHistory = customerPhone ? await loadCustomerOrders(clientId, customerPhone) : '';

  // If customer is NOT identified, check if their message contains a phone number.
  // This handles the case where customer is chatting from a different/unlinked session
  // and provides their phone to look up their order.
  let phoneProvidedInMessage = false;
  if (!customerPhone || !orderHistory) {
    const extractedPhone = extractPhoneFromMessage(effectiveMessage);
    if (extractedPhone) {
      const lookupOrders = await loadCustomerOrders(clientId, extractedPhone);
      if (lookupOrders) {
        orderHistory = lookupOrders;
        customerPhone = extractedPhone;
        phoneProvidedInMessage = true;
      }
    }
  }

  // Also check if the message contains an order ID like #1234 or "طلب 1234"
  let orderByIdInfo = '';
  if (!orderHistory) {
    const orderIdMatch = effectiveMessage.match(/(?:#|طلب\s*#?\s*|order\s*#?\s*)(\d{1,8})/i);
    if (orderIdMatch) {
      const orderId = parseInt(orderIdMatch[1], 10);
      if (orderId > 0) {
        orderByIdInfo = await loadOrderById(clientId, orderId);
      }
    }
  }

  // Build the prompt — context-only, the system prompt handles personality and rules
  const catalog = buildProductCatalog(ctx);
  const storeLinkSection = ctx.storeLink ? `\nرابط المتجر: ${ctx.storeLink}` : '';
  const storeOrderLink = ctx.storeLink ? `\nرابط الطلب: ${ctx.storeLink}` : '';

  // Build order section with clear instructions for the AI
  let orderSection = '';
  if (orderHistory) {
    const source = phoneProvidedInMessage
      ? `(تم البحث برقم الهاتف الذي قدمه الزبون: ${customerPhone})`
      : `(مرتبط تلقائياً)`;
    orderSection = `\n═══ طلبات هذا الزبون ${source} ═══\n${orderHistory}\n\n[هام: هذه بيانات حقيقية من النظام. إذا سأل الزبون عن طلبه أو الشحن أو التوصيل أو الحالة أو أي شيء له علاقة بطلباته، أجب من هذه البيانات مباشرة. لا تقل "سأتحقق" أو "لا أجد طلباتك" — البيانات أمامك.]\n`;
  } else if (orderByIdInfo) {
    orderSection = `\n═══ طلب تم البحث عنه برقم الطلب ═══\n${orderByIdInfo}\n\n[هام: هذه بيانات حقيقية. أجب من هذه البيانات. لكن تحقق أن الزبون هو فعلاً صاحب الطلب — اطلب منه تأكيد اسمه أو رقم هاتفه قبل إعطائه تفاصيل كاملة.]\n`;
  } else if (customerPhone) {
    orderSection = `\n[هذا الزبون مسجل برقم ${customerPhone} لكن ليس لديه طلبات حالياً.]\n`;
  } else {
    orderSection = `\n[لم نتمكن من تحديد هوية هذا الزبون بعد. إذا سأل عن طلب، اطلب منه رقم هاتفه اللي طلب بيه وتاريخ الطلب التقريبي باش نقدرو نلقاو الطلب تاعو.]\n`;
  }

  // ── Check for active order session ──────────────────────────────────────
  cleanExpiredSessions();
  const sKey = sessionKey(clientId, platform, platformChatId);
  const activeSession = pendingOrderSessions.get(sKey);

  // If we are in an active order collection session, handle it directly
  if (activeSession) {
    // ✅ FIX 7: Check if session is about to expire (warn at 25 min)
    const sessionAge = Date.now() - activeSession.createdAt;
    if (sessionAge > 25 * 60 * 1000 && sessionAge < 30 * 60 * 1000) {
      // Session about to expire, warn user
    }
    
    const msg = effectiveMessage.trim().toLowerCase();
    const isCancel = /إلغ|cancel|لا حاجة|مبقيتش|بطل|stop|ألغي|ألغى|cancel/i.test(effectiveMessage);
    if (isCancel) {
      pendingOrderSessions.delete(sKey);
      return 'حسناً، تم إلغاء الطلب. إذا غيرت رأيك، قولي وأساعدك 😊\n\nلو حاب تطلب منتج آخر، قولي شنو هو!';
    }
    
    // ✅ FIX 10: Handle change/modification requests
    const isChangeRequest = /بدل|غير|بدلة|تغيير|تبديل|modif|change/i.test(effectiveMessage);
    if (isChangeRequest && activeSession.step !== 'confirm') {
      return `ماشي مشكل! شنو تبي تبدل؟\n\n• المنتج: ${activeSession.productTitle}\n• الاسم: ${activeSession.customerName || 'مازال ما عطيتوش'}\n• الهاتف: ${activeSession.customerPhone || 'مازال ما عطيتوش'}\n• الولاية: ${activeSession.wilayaName || 'مازال ما عطيتهاش'}\n• العنوان: ${activeSession.customerAddress || 'مازال ما عطيتوش'}\n\nقلي شنو تبي تبدل ونعدله لك 👍`;
    }
    
    // ✅ FIX 8: Handle multi-product intent during session
    const multiProductIntent = /منتج.*ثاني|منتج.*آخر|كذلك|أيضا| aussi |also/i.test(effectiveMessage);
    if (multiProductIntent) {
      return `حالياً نقدر نسجل منتج واحد فقط في الطلب 😔\n\nلكن تقدر تطلب المنتج الثاني في طلب منفصل مباشرة بعد ما نكمل هذا الطلب!\n\nكمل معي هذا الطلب أولا: ${activeSession.productTitle}`;
    }

    const isConfirm = /نعم|أكيد|موافق|تأكيد|confirm|اطلب|أطلب|اتمام|أتمم|واه|ايه|اه|ok|oui/i.test(effectiveMessage);

    if (activeSession.step === 'confirm') {
      if (isConfirm) {
        const result = await createOrderFromChat(activeSession);
        pendingOrderSessions.delete(sKey);
        if (result) {
          return `✅ تم تسجيل طلبك بنجاح!\n\n📦 رقم الطلب: #${result.orderId}\n💰 المبلغ: ${result.total} دج (الدفع عند الاستلام)\n\nشكراً ${activeSession.customerName}! سنتواصل معك قريباً لتأكيد موعد التوصيل 🚚`;
        } else {
          return 'عذراً، حصل خطأ في تسجيل طلبك. يرجى المحاولة مجدداً أو تواصل معنا مباشرة.';
        }
      } else {
        return `عندك تعديل؟ قولي شو تبي تبدل، أو قل "تأكيد" باش نكمل.\n\n• الاسم: ${activeSession.customerName}\n• الهاتف: ${activeSession.customerPhone}\n• الولاية: ${activeSession.wilayaName || 'غير محددة'}\n• المنتج: ${activeSession.productTitle}\n• المبلغ: ${activeSession.productPrice} دج + توصيل`;
      }
    }

    if (activeSession.step === 'name') {
      // ✅ FIX 5: Handle all-at-once input - try to extract phone and wilaya too
      const name = effectiveMessage.trim();
      if (name.length < 2) return 'يرجى إدخال اسمك الكامل باش نقدر نسجل الطلب.';
      activeSession.customerName = name;
      
      // Try to extract phone from same message
      const extractedPhone = extractPhoneFromMessage(effectiveMessage);
      if (extractedPhone && isValidAlgerianPhone(extractedPhone)) {
        activeSession.customerPhone = extractedPhone;
        
        // Try to extract wilaya too
        const wilayaMatch = await extractWilayaFromMessage(effectiveMessage);
        if (wilayaMatch) {
          activeSession.wilayaId = wilayaMatch.id;
          activeSession.wilayaName = wilayaMatch.name;
          
          // Try to extract address
          const address = extractAddressFromMessage(effectiveMessage);
          if (address && address.length >= 5) {
            activeSession.customerAddress = address;
            activeSession.step = 'confirm';
            
            // Calculate delivery fee
            const pool = await ensureConnection();
            let deliveryFee = 0;
            if (activeSession.wilayaId) {
              const dRes = await pool.query(
                `SELECT home_delivery_price, desk_delivery_price FROM delivery_prices WHERE client_id = $1 AND wilaya_id = $2 AND is_active = true LIMIT 1`,
                [clientId, activeSession.wilayaId]
              ).catch(() => ({ rows: [] }));
              const homePrice = Number(dRes.rows[0]?.home_delivery_price) || 0;
              deliveryFee = homePrice;
            }
            const total = (activeSession.productPrice || 0) + deliveryFee;
            
            return `ممتاز! جمعت كل المعلومات دفعة واحدة 👏

تأكيد الطلب:
📦 المنتج: ${activeSession.productTitle}
💰 السعر: ${activeSession.productPrice} دج
🚚 التوصيل: ${deliveryFee} دج
💳 المجموع: ${total} دج
👤 الاسم: ${activeSession.customerName}
📱 الهاتف: ${activeSession.customerPhone}
📍 الولاية: ${activeSession.wilayaName}
🏠 العنوان: ${activeSession.customerAddress}

✅ الدفع عند الاستلام

اكتب "تأكيد" للتسجيل أو "إلغاء" للإلغاء`;
          }
          
          activeSession.step = 'address';
          return `تمام ${name}! لقيت رقمك (${extractedPhone}) والولاية (${wilayaMatch.name}) 👍

الآن أعطني عنوانك الكامل (الحي، الشارع، رقم المبنى) 🏠`;
        }
        
        activeSession.step = 'wilaya';
        return `شكراً ${name}! لقيت رقم هاتفك: ${extractedPhone} 👍

الآن أعطني اسم ولايتك للتوصيل 📍`;
      }
      
      activeSession.step = 'phone';
      return `شكراً ${name}! الآن أعطني رقم هاتفك (مثل: 0555123456) 📱`;
    }

    if (activeSession.step === 'phone') {
      const extractedPhone = extractPhoneFromMessage(effectiveMessage) || effectiveMessage.trim().replace(/\s/g, '');
      if (!/^0[5-7]\d{8}$/.test(extractedPhone)) {
        return 'رقم الهاتف غير صحيح. يرجى إدخال رقم جزائري صحيح (مثال: 0555123456)';
      }
      activeSession.customerPhone = extractedPhone;
      activeSession.step = 'wilaya';
      return `تمام! الآن أعطني اسم ولايتك للتوصيل 📍`;
    }

    if (activeSession.step === 'wilaya') {
      const pool = await ensureConnection();
      const wilayaMatch = await pool.query(
        `SELECT id, name_ar, name FROM wilayas WHERE lower(name_ar) LIKE lower($1) OR lower(name) LIKE lower($1) LIMIT 1`,
        [`%${effectiveMessage.trim()}%`]
      ).catch(() => ({ rows: [] }));
      let wilayaId: number | undefined;
      let wilayaName: string | undefined;
      if (wilayaMatch.rows[0]) {
        wilayaId = Number(wilayaMatch.rows[0].id);
        wilayaName = wilayaMatch.rows[0].name_ar || wilayaMatch.rows[0].name;
      } else {
        wilayaName = effectiveMessage.trim();
      }
      activeSession.wilayaId = wilayaId;
      activeSession.wilayaName = wilayaName;
      activeSession.step = 'address';
      return `تمام! الآن أعطني عنوانك الكامل (الحي، الشارع، رقم المبنى) 🏠`;
    }

    if (activeSession.step === 'address') {
      const address = effectiveMessage.trim();
      if (address.length < 5) return 'يرجى إدخال عنوانك الكامل باش نقدر نوصل الطلب.';
      activeSession.customerAddress = address;
      activeSession.step = 'confirm';

      // Calculate delivery fee if wilaya found
      const pool = await ensureConnection();
      let deliveryFee = 0;
      if (activeSession.wilayaId) {
        const dRes = await pool.query(
          `SELECT home_delivery_price, desk_delivery_price FROM delivery_prices WHERE client_id = $1 AND wilaya_id = $2 AND is_active = true LIMIT 1`,
          [clientId, activeSession.wilayaId]
        ).catch(() => ({ rows: [] }));
        const homePrice = Number(dRes.rows[0]?.home_delivery_price) || 0;
        const deskPrice = Number(dRes.rows[0]?.desk_delivery_price) || 0;
        deliveryFee = homePrice; // Default to home delivery
      }
      const total = (activeSession.productPrice || 0) + deliveryFee;

      return `تأكيد الطلب:\n\n📦 المنتج: ${activeSession.productTitle}\n💰 السعر: ${activeSession.productPrice} دج\n🚚 التوصيل: ${deliveryFee} دج\n💳 المجموع: ${total} دج\n👤 الاسم: ${activeSession.customerName}\n📱 الهاتف: ${activeSession.customerPhone}\n📍 الولاية: ${activeSession.wilayaName}\n🏠 العنوان: ${activeSession.customerAddress}\n\n✅ الدفع عند الاستلام\n\nاكتب "تأكيد" للتسجيل أو "إلغاء" للإلغاء`;
    }
  }

  // ── Detect new order intent from the message ──────────────────────────────
  const orderIntentRegex = /(?:حاب|حابة|بغيت|نطلب|أطلب|اطلب|نشري|أشري|بغيت نشري|حابة نطلب|نحب نطلب|انشاء|طلبية|طلب|نشاء|أريد|أريد|أريد طلب|أريد طلبية|اريد|اريد طلب|اريد طلبية|ابغى|يبغى|نشاء طلب|انشاء طلبية|أبغى|أبغى طلب|نشاء طلبية|نشاء طلب|طلب منك|طلب من عندك|حاب نطلب|حابة نشري|حابة نطلب|نحب نشري|نحب نطلب|je veux commander|je veux acheter|i want to order|i want to buy|i want to purchase|want to order|want to buy|want to purchase|أريد الشراء|اريد الشراء|أبغى الشراء)/i;
  // Don't trigger order flow if customer is asking about an existing order (tracking/follow-up)
  const trackingIntentRegex = /متابعة|تتبع|وين طلب|اين طلب|فين طلب|حالة الطلب|رقم.*#\d+|#\d+|طلبي رقم|track|suivi|وصل|شحن|وصلني/i;
  const isTrackingIntent = trackingIntentRegex.test(effectiveMessage);
  const hasOrderIntent = !isTrackingIntent && orderIntentRegex.test(effectiveMessage) && ctx.products.length > 0;
  let orderIntentInstructions = '';
  if (hasOrderIntent && !activeSession) {
    // Pick the most likely product if mentioned in current message
    let mentionedProduct = ctx.products.find(p => effectiveMessage.includes(p.title));

    // If not mentioned in current message, check conversation history for product context
    if (!mentionedProduct && history.length > 0) {
      const historyText = history.map(h => h.parts[0]?.text || '').join(' ').toLowerCase();
      mentionedProduct = ctx.products.find(p => historyText.includes(p.title.toLowerCase()));
    }

    // If still no product, use single product if only one exists
    if (!mentionedProduct && ctx.products.length === 1) {
      mentionedProduct = ctx.products[0];
    }

    if (mentionedProduct) {
      // ❌ CRITICAL FIX: Check stock before starting order session
      if (!mentionedProduct.inStock) {
        return `عذراً، المنتج "${mentionedProduct.title}" غير متوفر حالياً في المخزون 😔\n\nهل تبي منتج آخر؟ شوف الكتالوج: ${ctx.storeLink || 'الموقع'}`;
      }
      
      const newSession: PendingOrderSession = {
        clientId,
        platform,
        platformChatId,
        productId: undefined,
        productTitle: mentionedProduct.title,
        productPrice: mentionedProduct.price,
        step: 'name',
        createdAt: Date.now(),
      };
      // Try to find the product ID
      try {
        const pool = await ensureConnection();
        const pRes = await pool.query(
          `SELECT id FROM client_store_products WHERE client_id = $1 AND title = $2 LIMIT 1`,
          [clientId, mentionedProduct.title]
        );
        if (pRes.rows[0]) newSession.productId = Number(pRes.rows[0].id);
      } catch {}
      pendingOrderSessions.set(sKey, newSession);
      return `واو، خيار ممتاز! ${mentionedProduct.title} بـ ${mentionedProduct.price} دج 🙌\n\nباش نسجل طلبك، محتاج منك معلومات صغيرة:\n\nما هو اسمك الكامل؟`;
    } else if (ctx.products.length > 0) {
      orderIntentInstructions = `\n\n[الزبون يريد الطلب — اسأله عن المنتج الذي يريده من القائمة أعلاه، ثم قل له سنكمل باقي التفاصيل معه خطوة بخطوة]`;
    }
  }

  const prompt = `[متجر: ${ctx.storeName}]
${ctx.storeDescription ? ctx.storeDescription + '\n' : ''}${ctx.aiInstructions ? `\n[تعليمات خاصة من صاحب المتجر]: ${ctx.aiInstructions}\n` : ''}
═══ المنتجات المتوفرة ═══
${catalog}

═══ التوصيل ═══
${ctx.deliveryInfo}
الدفع عند الاستلام (COD).${storeLinkSection}${storeOrderLink}
${orderSection}${orderIntentInstructions}
═══ رسالة الزبون ═══
${effectiveMessage}`;

  // Check rate limit before calling AI
  const rateLimitKey = `${clientId}:${platform}:${platformChatId}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMITS.customer)) {
    const resetTime = getRateLimitResetTime(rateLimitKey);
    return getRateLimitMessage(resetTime, 'customer', 'ar');
  }

  try {
    const response = await generateText(
      'customer',
      prompt,
      { storeId: clientId, storeName: ctx.storeName },
      history
    );

    // Save the conversation turn (non-blocking — don't let a DB error kill the reply)
    saveConversationTurn(clientId, platform, platformChatId, effectiveMessage, response)
      .catch(err => console.error(`[AI-Customer] Failed to save conversation:`, err));

    return response;
  } catch (err: any) {
    console.error(`[AI-Customer] Error generating response for client ${clientId}:`, err);
    // ✅ CRITICAL FIX: Always return a fallback message instead of null
    const fallbacks = [
      `عذراً، حصل خطأ تقني. جرب تكلمني مرة أخرى بعد شوية ⏱️`,
      `المعذرة، النظام مشغول حالياً. حاول بعد دقيقة 🙏`,
      `راني عندي مشكل تقني صغير. رجاءً أرسل رسالتك مرة أخرى 😊`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

/**
 * Check if a platform sender is the store owner.
 * Prevents AI from auto-replying to the store owner's own messages.
 */
export async function isSenderStoreOwner(
  clientId: number,
  platform: Platform,
  platformChatId: string
): Promise<boolean> {
  const pool = await ensureConnection();

  // Check stored owner PSID/chat_id directly
  const col = platform === 'telegram' ? 'owner_telegram_chat_id' : 'owner_messenger_psid';
  const ownerRes = await pool.query(
    `SELECT ${col} FROM bot_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  const storedOwnerChatId = String(ownerRes.rows[0]?.[col] || '').trim();
  if (storedOwnerChatId && storedOwnerChatId === String(platformChatId).trim()) return true;

  // Fallback: check if sender phone matches support_phone
  const senderCol = platform === 'telegram' ? 'telegram_chat_id'
    : (platform === 'messenger' || platform === 'instagram') ? 'messenger_psid'
    : 'messenger_psid';
  const senderRes = await pool.query(
    `SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND ${senderCol} = $2 LIMIT 1`,
    [clientId, platformChatId]
  );
  if (!senderRes.rows.length) return false;
  const senderPhone = String(senderRes.rows[0].customer_phone || '').replace(/\D/g, '');
  if (!senderPhone) return false;

  const supportPhone = String(ownerRes.rows[0]?.support_phone || '').replace(/\D/g, '');
  return !!(supportPhone && senderPhone === supportPhone);
}

/**
 * Uses the webhook secret first (preferred), falls back to customer_messaging_ids lookup.
 */
export async function resolveClientFromTelegramSecret(secret: string | undefined): Promise<number | null> {
  if (!secret) return null;
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT client_id FROM bot_settings
     WHERE telegram_webhook_secret = $1 AND enabled = true
     LIMIT 1`,
    [secret.trim()]
  );
  return res.rows[0]?.client_id ? Number(res.rows[0].client_id) : null;
}

/**
 * Resolve client_id from a telegram chat_id via customer_messaging_ids.
 * Falls back when webhook secret doesn't identify the store.
 */
export async function resolveClientFromTelegramChatId(chatId: string): Promise<number | null> {
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT client_id FROM customer_messaging_ids
     WHERE telegram_chat_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [chatId]
  );
  return res.rows[0]?.client_id ? Number(res.rows[0].client_id) : null;
}
