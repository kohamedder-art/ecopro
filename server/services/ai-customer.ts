/**
 * AI Customer Auto-Reply Service
 *
 * Handles incoming customer messages from Telegram/Messenger/WhatsApp.
 * Loads the store's product catalog and context, then generates an intelligent
 * AI response using Gemini.
 */

import { ensureConnection } from '../utils/database';
import { generateText } from './gemini';

type Platform = 'telegram' | 'messenger' | 'whatsapp';

interface StoreContext {
  storeName: string;
  storeDescription: string;
  currency: string;
  products: { title: string; price: number; originalPrice?: number; description?: string; category?: string; inStock: boolean }[];
  deliveryInfo: string;
  aiInstructions?: string;
}

/**
 * Check if AI auto-reply is enabled for a given client.
 */
export async function isAiAutoReplyEnabled(clientId: number): Promise<boolean> {
  try {
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT storefront_assistant FROM ai_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  // Default to true if no row exists (matches ai_settings default behavior)
  return res.rows.length === 0 ? true : res.rows[0]?.storefront_assistant !== false;
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
    `SELECT store_name, store_description FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  if (!settingsRes.rows.length) return null;
  const { store_name, store_description } = settingsRes.rows[0];

  // Active products (limit to 50 to keep prompt size reasonable)
  const productsRes = await pool.query(
    `SELECT title, price, original_price, description, category, stock_quantity
     FROM client_store_products
     WHERE client_id = $1 AND status = 'active'
     ORDER BY is_featured DESC NULLS LAST, created_at DESC
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

  return {
    storeName: store_name || 'المتجر',
    storeDescription: store_description || '',
    currency: 'دج',
    products,
    deliveryInfo,
    aiInstructions: aiRes.rows[0]?.ai_instructions || undefined,
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
      line += ` (خصم ${discount}%، السعر الأصلي: ${p.originalPrice} ${ctx.currency})`;
    }
    if (!p.inStock) line += ' [نفذ من المخزون]';
    if (p.category) line += ` | فئة: ${p.category}`;
    if (p.description) line += `\n   ${p.description}`;
    return line;
  });

  return lines.join('\n');
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
  // Check if AI is enabled
  const enabled = await isAiAutoReplyEnabled(clientId);
  if (!enabled) return null;

  // Don't auto-reply to the store owner
  const ownerTalking = await isSenderStoreOwner(clientId, platform, platformChatId);
  if (ownerTalking) return null;

  // Load store context
  const ctx = await loadStoreContext(clientId);
  if (!ctx) return null;

  // Load conversation history
  const history = await getConversationHistory(clientId, platform, platformChatId);

  // Build the prompt
  const catalog = buildProductCatalog(ctx);
  const prompt = `أنت مساعد مبيعات لمتجر "${ctx.storeName}".
${ctx.storeDescription ? `وصف المتجر: ${ctx.storeDescription}` : ''}

${ctx.aiInstructions ? `تعليمات صاحب المتجر:\n${ctx.aiInstructions}\n` : ''}
المنتجات المتوفرة:
${catalog}

معلومات التوصيل:
${ctx.deliveryInfo}

قواعد مهمة:
- أنت تمثل المتجر وتساعد الزبائن في الشراء.
- أجب فقط عن المنتجات الموجودة في القائمة أعلاه.
- إذا سأل الزبون عن منتج غير موجود، قل له بلطف أنه غير متوفر حالياً.
- لا تختلق أسعاراً أو منتجات غير موجودة في القائمة.
- إذا أراد الزبون الطلب، أخبره بالتوجه لرابط المتجر لإتمام الطلب.
- كن مختصراً ومفيداً. لا تكتب رسائل طويلة.
- لا تذكر أنك ذكاء اصطناعي. تصرف كمساعد المتجر.
- العملة هي الدينار الجزائري (دج).
- لا تشارك أبداً أي معلومات تخص المتجر مثل عدد الطلبات أو الإيرادات أو بيانات العملاء الآخرين - أنت تتحدث مع زبون، ليس صاحب المتجر.

رسالة الزبون:
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
  const senderCol = platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
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
