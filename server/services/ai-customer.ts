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

interface StoreContext {
  storeName: string;
  storeDescription: string;
  currency: string;
  products: { title: string; price: number; originalPrice?: number; description?: string; category?: string; inStock: boolean; offers?: { quantity: number; bundle_price: number; free_delivery: boolean }[] }[];
  deliveryInfo: string;
  aiInstructions?: string;
  storeLink?: string;
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

  // Active products with offers (limit to 50 to keep prompt size reasonable)
  const productsRes = await pool.query(
    `SELECT p.id, p.title, p.price, p.original_price, p.description, p.category, p.stock_quantity,
            (SELECT json_agg(json_build_object('quantity', o.quantity, 'bundle_price', o.bundle_price, 'free_delivery', o.free_delivery))
             FROM product_offers o WHERE o.product_id = p.id AND o.client_id = p.client_id AND o.is_active = true) as offers
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
    offers: Array.isArray(p.offers) ? p.offers : undefined,
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

  // Build store link
  const storeLink = store_slug ? `https://ecopro.dz/store/${store_slug}` : undefined;

  return {
    storeName: store_name || 'المتجر',
    storeDescription: store_description || '',
    currency: 'دج',
    products,
    deliveryInfo,
    aiInstructions: aiRes.rows[0]?.ai_instructions || undefined,
    storeLink,
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
 */
function buildProductCatalog(ctx: StoreContext): string {
  if (!ctx.products.length) return 'لا توجد منتجات حالياً في المتجر.';

  const lines = ctx.products.map((p, i) => {
    let line = `${i + 1}. ${p.title} — ${p.price} ${ctx.currency}`;
    if (p.originalPrice && p.originalPrice > p.price) {
      const discount = Math.round((1 - p.price / p.originalPrice) * 100);
      line += ` (خصم ${discount}%، كان: ${p.originalPrice} ${ctx.currency})`;
    }
    if (!p.inStock) line += ' [غير متوفر]';
    if (p.category) line += ` | ${p.category}`;
    if (p.description) line += `\n   ${p.description}`;
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

  return lines.join('\n');
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
 * Supports formats: 0551234567, 05 51 23 45 67, +213551234567, 213551234567, 0551-234-567
 * Returns normalized phone (digits only, with leading 0) or null.
 */
function extractPhoneFromMessage(message: string): string | null {
  // Match Algerian mobile numbers: 05/06/07 followed by 8 digits, with optional +213 prefix
  // Allow spaces, dots, dashes between digit groups
  const patterns = [
    /(?:\+?213|0)[\s.-]?([567])[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})/,
    /(?:\+?213|0)[\s.-]?([567]\d{8})/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      // Reconstruct the number: take all captured groups, strip non-digits
      const digits = match[0].replace(/[\s.\-+]/g, '');
      // Normalize: strip 213 prefix and add leading 0
      if (digits.startsWith('213') && digits.length >= 12) {
        return '0' + digits.slice(3);
      }
      if (digits.startsWith('0') && digits.length === 10) {
        return digits;
      }
      // Try to normalize from raw digits
      const raw = digits.replace(/^0+/, '');
      if (raw.length === 9 && /^[567]/.test(raw)) {
        return '0' + raw;
      }
    }
  }
  return null;
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

  // Don't auto-reply to the store owner
  const ownerTalking = await isSenderStoreOwner(clientId, platform, platformChatId);
  if (ownerTalking) {
    console.log(`[AI-Customer] Sender is store owner, skipping (client=${clientId}, chatId=${platformChatId})`);
    return null;
  }

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
    const extractedPhone = extractPhoneFromMessage(customerMessage);
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
    const orderIdMatch = customerMessage.match(/(?:#|طلب\s*#?\s*|order\s*#?\s*)(\d{1,8})/i);
    if (orderIdMatch) {
      const orderId = parseInt(orderIdMatch[1], 10);
      if (orderId > 0) {
        orderByIdInfo = await loadOrderById(clientId, orderId);
      }
    }
  }

  // Build the prompt — context-only, the system prompt handles personality and rules
  const catalog = buildProductCatalog(ctx);
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

  const prompt = `[متجر: ${ctx.storeName}]
${ctx.storeDescription ? ctx.storeDescription + '\n' : ''}${ctx.aiInstructions ? `\n[تعليمات خاصة من صاحب المتجر]: ${ctx.aiInstructions}\n` : ''}
═══ المنتجات المتوفرة ═══
${catalog}

═══ التوصيل ═══
${ctx.deliveryInfo}
الدفع عند الاستلام (COD).${storeOrderLink}
${orderSection}
═══ رسالة الزبون ═══
${customerMessage}`;

  try {
    const response = await generateText(
      'customer',
      prompt,
      { storeId: clientId, storeName: ctx.storeName },
      history
    );

    // Save the conversation turn (non-blocking — don't let a DB error kill the reply)
    saveConversationTurn(clientId, platform, platformChatId, customerMessage, response)
      .catch(err => console.error(`[AI-Customer] Failed to save conversation:`, err));

    return response;
  } catch (err) {
    console.error(`[AI-Customer] Error generating response for client ${clientId}:`, err);
    return null;
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
