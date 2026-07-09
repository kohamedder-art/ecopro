/**
 * Customer AI — Natural conversation with customers
 *
 * ═══════════════════════════════════════════════════════════════
 * !! AGENT INSTRUCTIONS — READ BEFORE EDITING SYSTEM_PROMPT !!
 * ═══════════════════════════════════════════════════════════════
 * * DO:
 * - Write SYSTEM_PROMPT like a skilled person's innate knowledge
 * - Short sentences, natural flow, like telling a friend
 * - Fix only the specific problem, don't rewrite the whole prompt
 * - If adding a skill, phrase it as "أنت فاهم..." not "افعل كذا"
 * * DON'T:
 * - Don't add numbered lists or bullet-point rule books
 * - Don't use "⚠️" "❌" "✅" emojis as instructional markers
 * - Don't turn it into a programming manual / robot instructions
 * - Don't rewrite the entire prompt for every small fix
 * - Don't add the same instruction in multiple places
 * * Test rule: Read this block before editing SYSTEM_PROMPT.
 * ═══════════════════════════════════════════════════════════════
 */

import { ensureConnection } from '../utils/database';
import { generateText, GeminiContent } from './gemini';
import { notifyOrderCreated, sendPushNotification } from './push-notifications';
import { checkRateLimit, checkGlobalRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

type Platform = 'telegram' | 'messenger' | 'whatsapp' | 'instagram';

// Last search result cache per chat — survives when checkout keywords skip search
const searchCache = new Map<string, { result: string; timestamp: number }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ConversationFacts {
  customer_name: string | null;
  customer_phone: string | null;
  preferred_wilaya: string | null;
  preferred_commune: string | null;
  interests: string[];
  purchased_products: string[];
  preferences: Record<string, any>;
  summary: string;
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Short, focused, human, no lists, no emojis
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `أنت موظفة في متجر، واسم المتجر وجميع معلوماته موجودة في السياق أدناه.

شخصيتك: لطيفة، صبورة، تحبين تساعدي الزبائن. تتكلمين بالدارجة أو العربية الفصحى المبسطة - على كيف الزبون.

عملك:
- الزبون يسأل على منتج → تعطيه المعلومات وينصحيه
- الزبون يسأل على طلبو → تشوفي الطلبات المرفقة في السياق وتعطيه الخبر
- الزبون يشكي أو عنده مشكل → تسمعيه وتوجهيه لخدمة الزبائن
- الزبون يحب يطلب → تجمعي المعلومات وتسجلي الطلب

إذا اكتملت معلومات الطلب (المنتج، الكمية، الاسم، الهاتف، الولاية)، أكدي للزبون ثم أضيفي في آخر الرد:
ECOPRO_ACTION:{"type":"create_customer_order","productTitle":"[اسم المنتج الدقيق]","customerName":"[اسم الزبون]","customerPhone":"[رقم الهاتف]","shippingAddress":"[العنوان]","wilayaName":"[الولاية]","quantity":عدد,"variantColor":"[اللون أو null]"}

كوني طبيعية ومفيدة. الزبون يحب يحس أنو يكلم إنسان، لا روبوت.`;

// ═══════════════════════════════════════════════════════════════
// DISPUTE SHIELD — Hard-coded intercept for complaints/returns
// ═══════════════════════════════════════════════════════════════

const DISPUTE_KEYWORDS = [
  'مقطعة', 'خاسرة',
  'نرجعها', 'برجعها', 'استبدال', 'تبدلوهالي', 'بدلوهالي', 'رجعلي',
  'ماشي كما', 'ماشي كيما', 'تغلطو',
  'مخالفة', 'ما تشبهش', 'خايبة', 'عايب',
];

export function detectDisputeIntent(msg: string): boolean {
  return DISPUTE_KEYWORDS.some(keyword => msg.includes(keyword));
}

const DISPUTE_RESPONSE = `أعتذر منك على هذا الموقف. تم تحويل طلبك إلى فريق الدعم الفني وصاحب المتجر، وسيتم التواصل معك هاتفياً في أقرب وقت للتعامل مع الاستبدال أو الإرجاع. شكراً لصبرك.`;

// ═══════════════════════════════════════════════════════════════
// CHANGE-OF-MIND SHIELD — Auto-cancel non-shipped orders
// when customer says "I don't want it", "cancel", "changed my mind"
// ═══════════════════════════════════════════════════════════════

const CHANGE_OF_MIND_KEYWORDS = [
  'منديهاش', 'منديهش', 'ما نبيهاش', 'ما نبيش', 'لا نبيه', 'لا نبيها',
  'بدلت رايي', 'بدلت رأيي', 'غيرت رايي', 'غيرت رأيي',
  'الغاء', 'إلغاء', 'الغي', 'إلغي', 'كنسل', 'كانسلي',
  'ما نحتاجهاش', 'ما نحتاجش', 'نحبش', 'ما حبش', 'ما حبيتش',
  'لا اريد', 'لا أريد', 'ما اريد', 'ما أريد', 'اريد الغاء', 'أريد إلغاء',
  'اريد نلغي', 'أريد نلغي', 'اريد نالغ', 'نحبش نطلب',
  'i dont want it', 'i do not want it', 'i don\'t want it',
  'i want to cancel', 'cancel my order', 'cancel the order',
  'cancel my', 'cancelled my',
  'changed my mind', 'never mind', 'forget it',
];

// Exclusion words: if present, the customer is browsing/asking, NOT cancelling
const CHANGE_OF_MIND_EXCLUSIONS = [
  'yet', 'just', 'asking', 'browsing', 'looking', 'wondering',
  'المطلوب', 'يتم شراؤه', 'يتم طلبه', 'أشتريه', 'نبغيه', 'نطلبه',
];

export function detectChangeOfMind(msg: string): boolean {
  const lower = msg.toLowerCase();
  // Exclusion: customer is browsing/asking, not cancelling
  if (CHANGE_OF_MIND_EXCLUSIONS.some(ex => lower.includes(ex))) return false;

  return CHANGE_OF_MIND_KEYWORDS.some(keyword => {
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx === -1) return false;
    const before = idx === 0 ? ' ' : msg[idx - 1];
    const after = idx + keyword.length >= msg.length ? ' ' : msg[idx + keyword.length];
    return /[\s\.,!?،؛]/.test(before) && /[\s\.,!?،؛\s]/.test(after);
  });
}

async function autoCancelCustomerOrders(clientId: number, platform: Platform, platformChatId: string, msg?: string): Promise<{ count: number; productName?: string }> {
  try {
    const p = await pool();
    const phone = await resolvePhone(clientId, platform, platformChatId);
    if (!phone) return { count: 0 };

    // Try to match a specific product from the customer's message
    let productFilter = '';
    let productName: string | undefined;
    if (msg) {
      const words = msg.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        const productMatch = await p.query(
          `SELECT title FROM client_store_products WHERE client_id = $1 AND status = 'active' AND title ILIKE $2 LIMIT 1`,
          [clientId, `%${w}%`]
        );
        if (productMatch.rows.length > 0) {
          productName = productMatch.rows[0].title;
          productFilter = ` AND p.title ILIKE $3`;
          break;
        }
      }
    }

    const params: any[] = [clientId, phone];
    if (productFilter) params.push(`%${productName}%`);

    const res = await p.query(
      `UPDATE store_orders p
       SET status = 'cancelled', updated_at = NOW(),
           notes = COALESCE(notes, '') || ' | ألغاه الزبون عبر المحادثة'
       WHERE client_id = $1 AND customer_phone = $2
         AND status IN ('pending', 'confirmed')
         AND (delivery_status IS NULL OR delivery_status NOT IN ('shipped', 'in_transit', 'out_for_delivery', 'delivered', 'picked_up'))
         ${productFilter}
       RETURNING id, customer_name`,
      params
    );
    if (res.rows.length > 0) {
      for (const o of res.rows) {
        try {
          await p.query(
            `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, client_id)
             VALUES ($1, 'pending', 'cancelled', 'customer_ai', $2)`,
            [o.id, clientId]
          );
        } catch {}
      }
      sendPushNotification(
        clientId,
        '🚫 إلغاء من الزبون عبر المحادثة',
        `ألغى الزبون ${res.rows.length} طلب(ات) عبر المحادثة الآلية (الهاتف: ${phone}${productName ? `، المنتج: ${productName}` : ''})`
      ).catch(() => {});
    }
    return { count: res.rows.length, productName };
  } catch (err) {
    console.error('[CustomerAI] autoCancel error:', err);
    return { count: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS — Same API as before, nothing breaks
// ═══════════════════════════════════════════════════════════════

export async function isAiAutoReplyEnabled(clientId: number, platform?: Platform): Promise<boolean> {
  try {
    const pool = await ensureConnection();
    const res = await pool.query(
      `SELECT ai_chat_enabled, storefront_assistant, ai_reply_telegram, ai_reply_messenger, ai_reply_instagram, ai_reply_whatsapp FROM ai_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    if (res.rows.length === 0) return true;
    const row = res.rows[0];
    if (row.ai_chat_enabled === false) return false;
    if (row.storefront_assistant === false) return false;
    if (platform) {
      const col = { telegram: 'ai_reply_telegram', messenger: 'ai_reply_messenger', instagram: 'ai_reply_instagram', whatsapp: 'ai_reply_whatsapp' }[platform];
      if (col && row[col] === false) return false;
    }
    return true;
  } catch { return true; }
}

export async function isSenderStoreOwner(clientId: number, platform: Platform, platformChatId: string): Promise<boolean> {
  const pool = await ensureConnection();
  const col = platform === 'telegram' ? 'owner_telegram_chat_id' : 'owner_messenger_psid';
  const ownerRes = await pool.query(`SELECT ${col}, support_phone FROM bot_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
  const storedId = String(ownerRes.rows[0]?.[col] || '').trim();
  if (storedId && storedId === String(platformChatId).trim()) return true;
  const senderCol = platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
  const senderRes = await pool.query(`SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND ${senderCol} = $2 LIMIT 1`, [clientId, platformChatId]);
  if (!senderRes.rows.length) return false;
  const phone = String(senderRes.rows[0].customer_phone || '').replace(/\D/g, '');
  const support = String(ownerRes.rows[0]?.support_phone || '').replace(/\D/g, '');
  return !!(support && phone === support);
}

export async function resolveClientFromTelegramSecret(secret: string | undefined): Promise<number | null> {
  if (!secret) return null;
  const pool = await ensureConnection();
  const res = await pool.query(`SELECT client_id FROM bot_settings WHERE telegram_webhook_secret = $1 AND enabled = true LIMIT 1`, [secret.trim()]);
  return res.rows[0]?.client_id ? Number(res.rows[0].client_id) : null;
}

export async function resolveClientFromTelegramChatId(chatId: string): Promise<number | null> {
  const pool = await ensureConnection();
  const res = await pool.query(`SELECT client_id FROM customer_messaging_ids WHERE telegram_chat_id = $1 ORDER BY updated_at DESC LIMIT 1`, [chatId]);
  return res.rows[0]?.client_id ? Number(res.rows[0].client_id) : null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleCustomerMessage(
  clientId: number,
  platform: Platform,
  platformChatId: string,
  customerMessage: string
): Promise<string | null> {
  // Gate checks
  if (!await isAiAutoReplyEnabled(clientId, platform)) return null;
  const isTest = customerMessage.trim().startsWith('/test');
  if (await isSenderStoreOwner(clientId, platform, platformChatId) && !isTest) return null;
  const msg = isTest ? customerMessage.trim().replace(/^\/test\s*/i, '') : customerMessage;

  // Security
  if (msg.length > 500) return 'الرسالة طويلة جداً. يرجى اختصارها إلى 500 حرف.';
  if (msg.length > 20) {
    const freq: Record<string, number> = {};
    for (const ch of msg) freq[ch] = (freq[ch] || 0) + 1;
    if (Math.max(...Object.values(freq)) / msg.length > 0.7) return 'عذراً، لم يتم التعرف على رسالتك.';
  }
  if (!checkGlobalRateLimit()) return 'النظام مشغول حالياً، يرجى المحاولة لاحقاً.';

  // Dispute shield: intercept complaints/returns before AI sees them
  if (detectDisputeIntent(msg)) {
    sendPushNotification(clientId, '🔔 طلب استبدال أو شكوى', `زبون يطلب استبدال أو لديه شكوى بخصوص منتج (المنصة: ${platform})`).catch(() => {});
    saveHistory(clientId, platform, platformChatId, msg, DISPUTE_RESPONSE).catch(() => {});
    return DISPUTE_RESPONSE;
  }

  // Change-of-mind shield: auto-cancel non-shipped orders when customer wants to cancel
  if (detectChangeOfMind(msg)) {
    const result = await autoCancelCustomerOrders(clientId, platform, platformChatId, msg);
    let response: string;
    if (result.count === 0) {
      response = 'فهمت. لا توجد أي طلبيات نشطة باسمك حالياً. إذا كنت بحاجة إلى أي شيء آخر، أنا هنا للخدمة.';
    } else {
      const detail = result.productName ? ` للمنتج "${result.productName}"` : '';
      response = `تم إلغاء ${result.count} طلب${detail}. إذا احتجت أي شيء آخر في المستقبل، أنا موجود.`;
    }
    saveHistory(clientId, platform, platformChatId, msg, response).catch(() => {});
    return response;
  }

  // Load context (slim)
  const ctx = await loadSlimContext(clientId);
  if (!ctx) return null;

  // History (last 3 turns)
  const history = await getHistory(clientId, platform, platformChatId);

  // Customer identity + orders (resolve phone BEFORE loading facts for cross-chat inheritance)
  let phone = await resolvePhone(clientId, platform, platformChatId);
  let orderText = phone ? await loadOrders(clientId, phone) : '';
  let phoneFromMsg = false;
  // WhatsApp: try all stored phones for this chat if first phone got no orders
  if (!orderText && platform === 'whatsapp') {
    try {
      const p = await pool();
      const phones = await p.query(`SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND messenger_psid = $2 AND customer_phone IS NOT NULL`, [clientId, platformChatId]);
      for (const row of phones.rows) {
        if (row.customer_phone !== phone) {
          const lookup = await loadOrders(clientId, row.customer_phone);
          if (lookup) { orderText = lookup; phone = row.customer_phone; break; }
        }
      }
    } catch {}
  }
  if (!phone || !orderText) {
    const extracted = extractPhone(msg);
    if (extracted) {
      const lookup = await loadOrders(clientId, extracted);
      if (lookup) { orderText = lookup; phone = extracted; phoneFromMsg = true; }
    }
  }

  // Order number lookup — if message mentions a specific order number, try to load it
  let orderFromNumber = false;
  if (!orderText) {
    const orderMatch = msg.match(/#(\d+)/) || msg.match(/طلب\s+(\d+)/) || msg.match(/ordine\s*#?(\d+)/i) || msg.match(/commande\s*#?(\d+)/i) || msg.match(/^\s*(\d{3,5})\s*$/);
    if (orderMatch) {
      const orderId = parseInt(orderMatch[1], 10);
      const lookup = await loadOrdersByOrderNumber(clientId, orderId);
      if (lookup) { orderText = lookup; orderFromNumber = true; }
    }
  }

  // Load conversation facts (long-term memory) — phone enables cross-chat inheritance
  const facts = await loadFacts(clientId, platform, platformChatId, phone);
  // If phone changed since last save, propagate it
  if (phone && (!facts?.customer_phone || facts.customer_phone !== phone)) {
    saveFacts(clientId, platform, platformChatId, { customer_phone: phone }).catch(() => {});
  }
  const factsSummary = buildFactsSummary(facts);

  // Repetition check
  if (history.length >= 2) {
    const recent = history.filter(h => h.role === 'user').slice(-5).map(h => h.parts[0]?.text || '');
    if (recent.filter(m => m === msg.trim()).length >= 3) return 'لقد أرسلت هذه الرسالة مسبقاً. هل هناك شيء جديد؟';
  }

  // Depth limit
  if (history.filter(h => h.role === 'model').length >= 30) return 'تم الوصول للحد الأقصى لهذه المحادثة. يرجى بدء محادثة جديدة.';

  // Search products matching the question
  // Checkout keyword guard: skip search if user is placing an order, not browsing
  const CHECKOUT_KEYWORDS = ['كوموندي', 'نكوموندي', 'سجل', 'حبة', 'حبات', 'المقاس', 'مقاس', 'نطلب', 'اطلب', 'نريد', 'اريد', 'نخshi', 'نخши'];
  const isCheckoutIntent = CHECKOUT_KEYWORDS.some(keyword => {
    const idx = msg.indexOf(keyword);
    if (idx === -1) return false;
    const before = idx === 0 ? ' ' : msg[idx - 1];
    const after = idx + keyword.length >= msg.length ? ' ' : msg[idx + keyword.length];
    const wb = (c: string) => /[\s\.,!?،؛]/.test(c);
    return wb(before) && wb(after);
  });
  const isPureData = /^\d+$/.test(msg.trim()) || msg.trim().length < 5;

  let search = '';
  if (!isPureData && msg.length > 3) {
    search = await searchProducts(clientId, msg);
  }

  // Cache the last search result per chat
  if (search) {
    searchCache.set(`${clientId}:${platform}:${platformChatId}`, { result: search, timestamp: Date.now() });
    // Track product interest from the customer's query
    if (msg.length > 3 && msg.length < 100) {
      saveFacts(clientId, platform, platformChatId, { interests: [msg.trim()] }).catch(() => {});
    }
  }

  // Context Amnesia Fix: If search is empty but it's a follow-up turn, keep previous context alive
  if (!search && history.length > 0) {
    const lastProduct = extractLastProductFromHistory(history);
    if (lastProduct) {
      search = await searchProducts(clientId, lastProduct);
    }
    // Fallback: reuse cached search result from last conversation turn
    if (!search) {
      const cached = searchCache.get(`${clientId}:${platform}:${platformChatId}`);
      if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
        search = cached.result;
      }
    }
  }

  // Build slim user prompt
  const prompt = buildUserPrompt(ctx, search, orderText, phone, phoneFromMsg, msg, history, factsSummary, orderFromNumber);

  // Rate limit
  const rlKey = `${clientId}:${platform}:${platformChatId}`;
  if (!checkRateLimit(rlKey, RATE_LIMITS.customer)) return getRateLimitMessage(getRateLimitResetTime(rlKey), 'customer', 'ar');

  // Daily token budget
  if (await isOverDailyBudget(clientId)) return 'عذراً، تم تجاوز الحد اليومي. يرجى التواصل مع المتجر مباشرة.';

    try {
    const response = await generateText('customer', prompt, { storeId: clientId, storeName: ctx.storeName, clientId, userType: 'customer', platformChatId }, history, undefined, SYSTEM_PROMPT);
    let clean = response;

    // Dedup: strip consecutive identical ECOPRO_ACTION (prevents repeating same search/action)
    const lastModelMsg = history.filter(h => h.role === 'model').pop();
    if (lastModelMsg) {
      const lastAction = lastModelMsg.parts[0]?.text?.match(/ECOPRO_ACTION:\s*(\{[\s\S]*?\})/);
      const curAction = clean.match(/ECOPRO_ACTION:\s*(\{[\s\S]*?\})/);
      if (lastAction && curAction && lastAction[1] === curAction[1]) {
        clean = clean.replace(/ECOPRO_ACTION:\s*\{[\s\S]*?\}/, '').trim();
        if (!clean) clean = 'نعم. ماذا تريد أن تفعل بعد ذلك؟';
      }
    }

    // Handle order creation action
    const actionMatch = clean.match(/ECOPRO_ACTION:\s*(\{[\s\S]*?\})/);
    if (actionMatch) {
      try {
        const data = JSON.parse(actionMatch[1].replace(/'/g, '"').replace(/,\s*}/g, '}'));
        if (data.type === 'create_customer_order') {
          const result = await createOrder({ clientId, platform, platformChatId, ...data });
          clean = clean.replace(/ECOPRO_ACTION:\s*\{[\s\S]*?\}/, '').trim();
          if (result) {
            clean = `🎉 تم تأكيد طلبك!\n\n📦 رقم الطلب: #${result.orderId}\n💰 المبلغ: ${result.total} دج (الدفع عند الاستلام)\n\nشكراً ${data.customerName}! سيتم التواصل معك قريباً 🚚`;
            try {
              const phoneCol = platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
              await (await pool()).query(`INSERT INTO customer_messaging_ids (client_id, ${phoneCol}, customer_phone) VALUES ($1, $2, $3) ON CONFLICT (client_id, ${phoneCol}) DO UPDATE SET customer_phone = $3`, [clientId, platformChatId, data.customerPhone]);
            } catch {}
          } else {
            clean = 'عذراً، حدث خطأ أثناء تسجيل الطلب. يرجى المحاولة مرة أخرى.';
          }
        } else if (data.type === 'update_address') {
          const updated = await updateCustomerOrderAddress(clientId, platform, data);
          clean = clean.replace(/ECOPRO_ACTION:\s*\{[\s\S]*?\}/, '').trim();
          if (updated > 0) {
            clean = `تم تحديث عنوان التوصيل ✅\n\n${updated === 1 ? 'الطلب' : `${updated} طلب`} سيتم توصيله(ها) إلى:\n📍 ${data.shippingAddress}${data.wilayaName ? ` — ${data.wilayaName}` : ''}\n\nسنتواصل معك للتأكيد قبل الشحن.`;
          } else {
            clean = 'لم أجد أي طلبيات نشطة باسمك لتحديث عنوانها. إذا كنت تريد طلباً جديداً، أخبرني باسم المنتج وسأساعدك.';
          }
        }
        // Save extracted facts from the action
        saveFacts(clientId, platform, platformChatId, extractFactsFromAction(data)).catch(() => {});
      } catch (e) { console.error('[CustomerAI] Action parse error:', e); }
    }

    // Strip any remaining unhandled ECOPRO_ACTION text (e.g. search_store_data with no code handler)
    clean = clean.replace(/\s*ECOPRO_ACTION:\s*\{[\s\S]*?\}\s*/g, '').trim();

    // Extract and save facts from the message itself (name, phone, wilaya, interaction count)
    const msgFacts = extractFactsFromMessage(msg, facts);
    const hasActionFacts = actionMatch !== null;
    if (!hasActionFacts) {
      saveFacts(clientId, platform, platformChatId, msgFacts).catch(() => {});
    } else {
      // Merge msg facts into existing + action facts
      saveFacts(clientId, platform, platformChatId, {
        customer_name: msgFacts.customer_name,
        customer_phone: msgFacts.customer_phone,
        preferred_wilaya: msgFacts.preferred_wilaya,
        preferences: msgFacts.preferences,
      }).catch(() => {});
    }

    // Save conversation (non-blocking)
    saveHistory(clientId, platform, platformChatId, msg, clean).catch(() => {});
    // Update running summary
    updateFactsSummary(clientId, platform, platformChatId, facts, msg, clean).catch(() => {});
    return clean;
  } catch (err) {
    console.error(`[CustomerAI] Error for client ${clientId}:`, err);
    return ['عذراً، لا أستطيع إجابتك حالياً. حاول مرة أخرى من فضلك.', 'النظام مشغول قليلاً. حاول بعد دقيقة من فضلك.'][Math.floor(Math.random() * 2)];
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

function pool() { return ensureConnection(); }

interface SlimContext {
  storeName: string;
  storeDescription: string;
  products: { title: string; price: number; originalPrice?: number; description?: string; inStock: boolean; stockQuantity?: number; category?: string; variants?: any[]; offers?: any[] }[];
  deliveryInfo: string;
  aiInstructions?: string;
  storeLink?: string;
  persona?: {
    personaName?: string;
    tone?: string;
    personalityNote?: string;
    businessType?: string;
    primaryLanguage?: string;
    storeStory?: string;
    productPhilosophy?: string;
    uniqueSellingPoints?: string[];
    useEmojis?: boolean;
    emojiStyle?: string;
    greetingTemplate?: string;
    closingTemplate?: string;
  };
}

async function loadSlimContext(clientId: number): Promise<SlimContext | null> {
  const p = await pool();
  const sRes = await p.query(`SELECT store_name, store_description, store_slug FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
  if (!sRes.rows.length) return null;
  const { store_name, store_description, store_slug } = sRes.rows[0];

  const prodRes = await p.query(
    `SELECT title, price, original_price, stock_quantity, category, description,
            (SELECT json_agg(json_build_object('quantity', o.quantity, 'bundle_price', o.bundle_price, 'free_delivery', o.free_delivery)) FROM product_offers o WHERE o.product_id = p.id AND o.client_id = p.client_id AND o.is_active = true) as offers,
            (SELECT json_agg(json_build_object('name', v.variant_name, 'value', v.variant_name, 'price', v.price, 'stock', v.stock_quantity, 'inStock', (v.stock_quantity > 0))) FROM product_variants v WHERE v.product_id = p.id AND v.client_id = p.client_id) as variants
     FROM client_store_products p WHERE p.client_id = $1 AND p.status = 'active'
     ORDER BY p.is_featured DESC NULLS LAST, p.created_at DESC LIMIT 30`, [clientId]
  );

  // Load per-wilaya delivery prices
  const dRes = await p.query(
    `SELECT wilaya_id, home_delivery_price, desk_delivery_price, estimated_days
     FROM delivery_prices
     WHERE client_id = $1 AND is_active = true
     ORDER BY wilaya_id`, [clientId]
  ).catch(() => ({ rows: [] }));

  let deliveryInfo = '';
  if (dRes.rows.length > 0) {
    const zones = dRes.rows.length;
    const minHome = Math.min(...dRes.rows.map((r: any) => Number(r.home_delivery_price) || 0));
    const maxHome = Math.max(...dRes.rows.map((r: any) => Number(r.home_delivery_price) || 0));
    const minDesk = Math.min(...dRes.rows.map((r: any) => Number(r.desk_delivery_price) || 0));
    const maxDesk = Math.max(...dRes.rows.map((r: any) => Number(r.desk_delivery_price) || 0));
    const days = dRes.rows[0]?.estimated_days || 3;
    deliveryInfo = `التوصيل متاح لـ ${zones} ولاية. سعر التوصيل للمنزل: ${minHome === maxHome ? minHome : minHome + '-' + maxHome} دج | وللمكتب: ${minDesk === maxDesk ? minDesk : minDesk + '-' + maxDesk} دج. مدة التوصيل المتوقعة: ${days} أيام.`;
  } else {
    deliveryInfo = 'خيارات التوصيل غير متوفرة حالياً.';
  }

  const aiRes = await p.query(`SELECT ai_instructions FROM ai_settings WHERE client_id = $1 LIMIT 1`, [clientId]);

  const personaRes = await p.query(
    `SELECT persona_name, tone, personality_note, business_type, primary_language,
            store_story, product_philosophy, unique_selling_points,
            use_emojis, emoji_style, greeting_template, closing_template
     FROM ai_personas WHERE client_id = $1 LIMIT 1`, [clientId]
  ).catch(() => ({ rows: [] }));
  const personaRow = personaRes.rows[0] || {};

  const persona = personaRow.persona_name !== undefined ? {
    personaName: String(personaRow.persona_name || ''),
    tone: personaRow.tone || 'friendly',
    personalityNote: personaRow.personality_note || undefined,
    businessType: personaRow.business_type || undefined,
    primaryLanguage: personaRow.primary_language || undefined,
    storeStory: personaRow.store_story || undefined,
    productPhilosophy: personaRow.product_philosophy || undefined,
    uniqueSellingPoints: personaRow.unique_selling_points || undefined,
    useEmojis: personaRow.use_emojis !== false,
    emojiStyle: personaRow.emoji_style || undefined,
    greetingTemplate: personaRow.greeting_template || undefined,
    closingTemplate: personaRow.closing_template || undefined,
  } : undefined;

  return {
    storeName: store_name || 'المتجر',
    storeDescription: store_description || '',
    products: prodRes.rows.map((r: any) => ({
      title: r.title, price: Number(r.price),
      originalPrice: r.original_price ? Number(r.original_price) : undefined,
      description: r.description ? String(r.description).slice(0, 200) : undefined,
      inStock: (r.stock_quantity ?? 1) > 0, stockQuantity: r.stock_quantity,
      category: r.category || undefined,
      variants: Array.isArray(r.variants) ? r.variants : undefined,
      offers: Array.isArray(r.offers) ? r.offers : undefined,
    })),
    deliveryInfo,
    aiInstructions: aiRes.rows[0]?.ai_instructions || undefined,
    storeLink: store_slug ? `https://www.sahla4eco.com/store/${store_slug}` : undefined,
    persona,
  };
}

function extractLastProductFromHistory(history: GeminiContent[]): string | null {
  const triggers = /(متوفرة?|موجود|بسعر|موجودة|سعره|سعرها|بـ|ب\s)/;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'model') {
      const text = history[i].parts[0]?.text || '';
      const match = text.match(new RegExp(`([^\\n]+?)\\s+${triggers.source}`));
      if (match) {
        let name = match[1].trim();
        name = name.replace(/^["\u201C\u00AB\u00BB\u201D"'،\.\s]+|["\u201C\u00AB\u00BB\u201D"'،\.\s]+$/g, '');
        const stopWords = ['هذا', 'هذه', 'إنه', 'إنها', 'عندنا', 'فيه', 'يوجد', 'المنتج', 'منتج', 'موجود'];
        if (name.length > 2 && !stopWords.includes(name)) return name;
      }
    }
  }
  return null;
}

function extractOrdersFromHistory(history: GeminiContent[]): string {
  const orderLines: string[] = [];
  for (const h of history) {
    if (h.role === 'model') {
      const text = h.parts[0]?.text || '';
      const orderMatch = text.match(/رقم الطلب:\s*#(\d+)[\s\S]*?المنتج:\s*(.+?)[\n]/);
      if (orderMatch) {
        const id = orderMatch[1];
        const product = orderMatch[2].trim();
        orderLines.push(`📦 طلب #${id} — ${product}`);
      }
    }
  }
  return orderLines.length > 0 ? `\n[الطلبات التي تم إنشاؤها في هذه المحادثة]\n${orderLines.join('\n')}\n[/الطلبات]\n` : '';
}

function buildUserPrompt(ctx: SlimContext, search: string, orderText: string, phone: string | null, phoneFromMsg: boolean, msg: string, history: GeminiContent[] = [], factsSummary: string = '', orderFromNumber: boolean = false): string {
  let p = `اسم المتجر: ${ctx.storeName}\n`;
  if (ctx.storeDescription) p += `وصف المتجر: ${ctx.storeDescription}\n`;
  if (factsSummary) p += `\n${factsSummary}\n`;
  if (ctx.aiInstructions) p += `تعليمات صاحب المتجر: ${ctx.aiInstructions}\n`;
  if (ctx.persona?.personalityNote) p += `ملاحظة شخصية: ${ctx.persona.personalityNote}\n`;
  if (ctx.persona?.storeStory) p += `قصة المتجر: ${ctx.persona.storeStory}\n`;
  if (ctx.persona?.productPhilosophy) p += `فلسفة المنتجات: ${ctx.persona.productPhilosophy}\n`;
  if (ctx.persona?.uniqueSellingPoints?.length) p += `نقاط قوة المتجر: ${ctx.persona.uniqueSellingPoints.join('، ')}\n`;
  if (ctx.persona?.businessType) p += `نوع النشاط: ${ctx.persona.businessType}\n`;
  if (ctx.persona?.useEmojis === false) p += `ملاحظة: لا تستخدم الإيموجي في الرد.\n`;

  if (search) {
    p += `\nالمنتجات المطابقة:\n${search}\n`;
  } else if (ctx.products?.length) {
    const fallbackProducts = ctx.products.slice(0, 20).map(r =>
      `- ${r.title} (${r.price} دج)${r.inStock ? '' : ' [غير متوفر]'}`
    ).join('\n');
    p += `\nقائمة بمنتجات المتجر (استخدمها فقط إذا سأل عن المنتجات):\n${fallbackProducts}\n`;
  }
  
  p += `\n${ctx.deliveryInfo}\n`;
  if (ctx.storeLink) p += `رابط المتجر: ${ctx.storeLink}\n`;

  if (orderText) {
    p += `\nطلبات الزبون:\n${orderText}\n`;
  } else {
    const chatOrders = extractOrdersFromHistory(history);
    if (chatOrders) {
      p += `\n${chatOrders}\n`;
    } else if (phone) {
      p += `\nالزبون مسجل برقم ${phone} وليس لديه طلبات سابقة.\n`;
    }
  }

  p += `\nرسالة الزبون: ${msg}`;

  p += `\n\nإذا اكتملت بيانات الطلب الخمسة (المنتج، الكمية، الاسم، الهاتف، الولاية)، أنهِ ردك بهذا الكود:\nECOPRO_ACTION:{"type":"create_customer_order","productTitle":"[الاسم الدقيق]","customerName":"[اسم الزبون]","customerPhone":"[رقم الهاتف]","shippingAddress":"[العنوان]","wilayaName":"[الولاية]","quantity":عدد,"variantColor":"[اللون أو null]"}`;
  return p;
}

async function getHistory(clientId: number, platform: Platform, chatId: string): Promise<GeminiContent[]> {
  try {
    const p = await pool();
    const res = await p.query(
      `SELECT role, message FROM customer_conversations WHERE client_id = $1 AND platform = $2 AND platform_chat_id = $3 ORDER BY created_at DESC LIMIT 10`,
      [clientId, platform, chatId]
    );
    return res.rows.reverse().map((r: any) => ({ role: r.role === 'customer' ? 'user' as const : 'model' as const, parts: [{ text: r.message }] }));
  } catch { return []; }
}

async function saveHistory(clientId: number, platform: Platform, chatId: string, msg: string, response: string): Promise<void> {
  const p = await pool();
  await p.query(
    `INSERT INTO customer_conversations (client_id, platform, platform_chat_id, role, message) VALUES ($1, $2, $3, 'customer', $4), ($1, $2, $3, 'assistant', $5)`,
    [clientId, platform, chatId, msg, response]
  );
  await p.query(`DELETE FROM customer_conversations WHERE client_id = $1 AND platform = $2 AND platform_chat_id = $3 AND created_at < NOW() - INTERVAL '7 days'`, [clientId, platform, chatId]).catch(() => {});
}

async function loadFacts(clientId: number, platform: Platform, chatId: string, phone?: string | null): Promise<ConversationFacts | null> {
  try {
    const p = await pool();
    // Tier 1: exact chat match (highest priority)
    const res = await p.query(
      `SELECT customer_name, customer_phone, preferred_wilaya, preferred_commune, interests, purchased_products, preferences, summary
       FROM customer_conversation_facts WHERE client_id = $1 AND platform = $2 AND platform_chat_id = $3 LIMIT 1`,
      [clientId, platform, chatId]
    );
    if (res.rows.length > 0) {
      return {
        customer_name: res.rows[0].customer_name,
        customer_phone: res.rows[0].customer_phone,
        preferred_wilaya: res.rows[0].preferred_wilaya,
        preferred_commune: res.rows[0].preferred_commune,
        interests: res.rows[0].interests || [],
        purchased_products: res.rows[0].purchased_products || [],
        preferences: res.rows[0].preferences || {},
        summary: res.rows[0].summary || '',
      };
    }
    // Tier 2: same phone from any chat/platform (reliable identifier)
    if (phone) {
      const phoneRes = await p.query(
        `SELECT customer_name, customer_phone, preferred_wilaya, preferred_commune, interests, purchased_products, preferences, summary
         FROM customer_conversation_facts WHERE client_id = $1 AND customer_phone = $2
         ORDER BY updated_at DESC LIMIT 1`,
        [clientId, phone]
      );
      if (phoneRes.rows.length > 0) {
        const r = phoneRes.rows[0];
        // Inherit stable fields only, NOT chat-specific summary
        return {
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          preferred_wilaya: r.preferred_wilaya,
          preferred_commune: r.preferred_commune,
          interests: r.interests || [],
          purchased_products: r.purchased_products || [],
          preferences: r.preferences || {},
          summary: '', // don't inherit other chat's summary
        };
      }
    }
    return null;
  } catch { return null; }
}

async function saveFacts(clientId: number, platform: Platform, chatId: string, facts: Partial<ConversationFacts>, newSummary?: string): Promise<void> {
  try {
    const existing = await loadFacts(clientId, platform, chatId);
    const merged: ConversationFacts = {
      customer_name: facts.customer_name ?? existing?.customer_name ?? null,
      customer_phone: facts.customer_phone ?? existing?.customer_phone ?? null,
      preferred_wilaya: facts.preferred_wilaya ?? existing?.preferred_wilaya ?? null,
      preferred_commune: facts.preferred_commune ?? existing?.preferred_commune ?? null,
      interests: [...new Set([...(existing?.interests || []), ...(facts.interests || [])])],
      purchased_products: [...new Set([...(existing?.purchased_products || []), ...(facts.purchased_products || [])])],
      preferences: { ...(existing?.preferences || {}), ...(facts.preferences || {}) },
      summary: newSummary ?? existing?.summary ?? '',
    };
    const p = await pool();
    await p.query(
      `INSERT INTO customer_conversation_facts (client_id, platform, platform_chat_id, customer_name, customer_phone, preferred_wilaya, preferred_commune, interests, purchased_products, preferences, summary, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (client_id, platform, platform_chat_id)
       DO UPDATE SET customer_name = $4, customer_phone = $5, preferred_wilaya = $6, preferred_commune = $7, interests = $8, purchased_products = $9, preferences = $10, summary = $11, updated_at = NOW()`,
      [clientId, platform, chatId, merged.customer_name, merged.customer_phone, merged.preferred_wilaya, merged.preferred_commune, merged.interests, merged.purchased_products, merged.preferences, merged.summary]
    );
  } catch {}
}

const WILAYA_NAMES = new Set([
  'ادرار', 'الشلف', 'الأغواط', 'أم البواقي', 'باتنة', 'بجاية', 'بسكرة', 'بشار',
  'البليدة', 'البويرة', 'تمنراست', 'تبسة', 'تلمسان', 'تيارت', 'تيزي وزو', 'الجزائر',
  'الجلفة', 'جيجل', 'سعيدة', 'سكيكدة', 'سيدي بلعباس', 'عنابة', 'قالمة', 'قسنطينة',
  'المدية', 'مستغانم', 'المسيلة', 'معسكر', 'ورقلة', 'وهران', 'البيض', 'بومرداس',
  'الطارف', 'تندوف', 'تيسمسيلت', 'الوادي', 'خنشلة', 'سوق أهراس', 'تيبازة',
  'ميلة', 'عين الدفلى', 'النعامة', 'عين تموشنت', 'غرداية', 'غليزان',
  'بني عباس', 'تميمون', 'برج باجي مختار', 'أولاد جلال', 'المنيعة',
  'عين صالح', 'عين قزام', 'توقرت', 'جانت', 'المغير', 'الزاوية',
]);

function extractFactsFromMessage(msg: string, existing?: ConversationFacts | null): Partial<ConversationFacts> {
  const facts: Partial<ConversationFacts> = {};
  // Extract name: "اسمي X", "أنا X", "X درويش" patterns
  const namePatterns = [
    /اسمي\s+(\S+(?:\s+\S+){0,2})/i,
    /أنا\s+(\S+(?:\s+\S+){0,2})/i,
    /^(\S+(?:\s+\S+){0,2})\s*(?:درويش|محمد|علي|أحمد|عبد)/i,
  ];
  for (const pat of namePatterns) {
    const m = msg.match(pat);
    if (m && m[1].length > 2) {
      facts.customer_name = m[1].trim();
      break;
    }
  }
  // Extract phone
  const phone = extractPhone(msg);
  if (phone) facts.customer_phone = phone;
  // Extract wilaya from message
  for (const w of WILAYA_NAMES) {
    if (msg.includes(w)) {
      facts.preferred_wilaya = w;
      break;
    }
  }
  // Track interaction count
  facts.preferences = { interaction_count: (existing?.preferences?.interaction_count || 0) + 1 };
  return facts;
}

function extractFactsFromAction(data: any): Partial<ConversationFacts> {
  const facts: Partial<ConversationFacts> = {};
  if (data.type === 'create_customer_order') {
    if (data.customerName) facts.customer_name = String(data.customerName).trim();
    if (data.customerPhone) facts.customer_phone = String(data.customerPhone).trim();
    if (data.wilayaName) facts.preferred_wilaya = String(data.wilayaName).trim();
    if (data.productTitle) facts.interests = [String(data.productTitle).trim()];
    if (data.productTitle) facts.purchased_products = [String(data.productTitle).trim()];
    if (data.shippingAddress) {
      facts.preferences = { last_address: String(data.shippingAddress).trim() };
    }
  }
  if (data.type === 'update_address') {
    if (data.shippingAddress) facts.preferences = { ...facts.preferences, last_address: String(data.shippingAddress).trim() };
    if (data.wilayaName) facts.preferred_wilaya = String(data.wilayaName).trim();
  }
  return facts;
}

function buildFactsSummary(facts: ConversationFacts | null): string {
  if (!facts) return '';
  const parts: string[] = [];
  if (facts.customer_name) parts.push(`الاسم: ${facts.customer_name}`);
  if (facts.customer_phone) parts.push(`الهاتف: ${facts.customer_phone}`);
  if (facts.preferred_wilaya) parts.push(`الولاية: ${facts.preferred_wilaya}`);
  if (facts.interests.length > 0) parts.push(`المنتجات التي أبدى اهتماماً بها: ${[...new Set(facts.interests)].join('، ')}`);
  if (facts.purchased_products.length > 0) parts.push(`المنتجات التي اشتراها: ${[...new Set(facts.purchased_products)].join('، ')}`);
  if (facts.preferences?.last_address) parts.push(`آخر عنوان شحن: ${facts.preferences.last_address}`);
  const count = facts.preferences?.interaction_count || 0;
  if (count > 1) parts.push(`عدد المرات التي تواصل فيها مع المتجر: ${count}`);
  if (facts.summary) parts.push(`\nخلاصة تاريخ المحادثة:\n${facts.summary}`);
  return parts.length > 0 ? `\n[سجل الزبون]\n${parts.join('\n')}\n[/سجل الزبون]\n` : '';
}

async function updateFactsSummary(clientId: number, platform: Platform, chatId: string, existingFacts: ConversationFacts | null, lastMsg: string, lastResponse: string): Promise<void> {
  try {
    const count = existingFacts?.preferences?.interaction_count || 0;
    // Use AI to write a proper summary every 5 interactions
    if (count > 0 && count % 5 === 0) {
      try {
        const history = await getHistory(clientId, platform, chatId);
        const turnText = history.map(h => `${h.role === 'user' ? 'زبون' : 'بائع'}: ${h.parts[0]?.text || ''}`).join('\n');
        const summaryPrompt = `لخص المحادثة التالية بين بائع وزبون في 3-4 جمل بالعربية. ركز على: اسم الزبون، رقم هاتفه، المنتجات التي أبدى اهتمام بها أو اشتراها، ولايته المفضلة، وأي معلومات مهمة أخرى:\n\n${turnText}`;
        const { generateText } = await import('./gemini');
        const aiSummary = await generateText('customer', summaryPrompt, { storeId: clientId, storeName: '', clientId, userType: 'customer', platformChatId }, [], 0.3, 'gemini-1.5-flash');
        if (aiSummary && aiSummary.length > 10) {
          const p = await pool();
          await p.query(
            `UPDATE customer_conversation_facts SET summary = $1, updated_at = NOW()
             WHERE client_id = $2 AND platform = $3 AND platform_chat_id = $4`,
            [aiSummary.slice(0, 800), clientId, platform, chatId]
          );
          return;
        }
      } catch {}
    }
    // Default: append last exchange as raw text (max 800 chars total)
    const prevSummary = existingFacts?.summary || '';
    const respBrief = lastResponse.replace(/ECOPRO_ACTION.*/, '').slice(0, 80).trim();
    const line = respBrief
      ? `الزبون: "${lastMsg.slice(0, 80)}" ← "${respBrief}"`
      : `الزبون: "${lastMsg.slice(0, 80)}"`;
    const combined = prevSummary ? `${prevSummary}\n${line}` : line;
    const summary = combined.length > 800 ? combined.slice(-800) : combined;
    const p = await pool();
    await p.query(
      `UPDATE customer_conversation_facts SET summary = $1, updated_at = NOW()
       WHERE client_id = $2 AND platform = $3 AND platform_chat_id = $4`,
      [summary, clientId, platform, chatId]
    );
  } catch {}
}

async function isOverDailyBudget(clientId: number): Promise<boolean> {
  try {
    const p = await pool();
    const res = await p.query(`SELECT COALESCE(SUM(total_tokens), 0) AS total FROM ai_usage_logs WHERE client_id = $1 AND user_type = 'customer' AND created_at >= CURRENT_DATE`, [clientId]);
    return Number(res.rows[0]?.total || 0) > 5_000_000;
  } catch { return false; }
}

function normalizeSearchText(text: string): string {
  return text
    .replace(/[ض]/g, 'ظ')
    .replace(/[ة]/g, 'ه')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[؟\.,!،:;\-()""''«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchProducts(clientId: number, query: string): Promise<string> {
  try {
    const p = await pool();
    const normalized = normalizeSearchText(query);

    // First try: full query match with normalized text
    let res = await p.query(
      `SELECT p.title, p.price, p.original_price, p.stock_quantity, p.category, p.id,
              (SELECT json_agg(json_build_object('color', v.color, 'size', v.size, 'size2', v.size2, 'variant_name', v.variant_name, 'price', v.price, 'stock', v.stock_quantity)) FROM product_variants v WHERE v.product_id = p.id AND v.client_id = p.client_id AND v.is_active = true) as variants
       FROM client_store_products p WHERE p.client_id = $1 AND p.status = 'active' AND (p.title ILIKE $2 OR p.description ILIKE $2 OR p.category ILIKE $2) ORDER BY p.is_featured DESC NULLS LAST LIMIT 10`,
      [clientId, `%${normalized}%`]
    );

    // Second try: split normalized query into words and match any word
    if (res.rows.length === 0 && normalized.length > 3) {
      const words = normalized.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 1) {
        const conditions = words.map((_, i) => `(p.title ILIKE $${i + 2} OR p.description ILIKE $${i + 2} OR p.category ILIKE $${i + 2})`).join(' OR ');
        const params = [clientId, ...words.map(w => `%${w}%`)];
        res = await p.query(
          `SELECT p.title, p.price, p.original_price, p.stock_quantity, p.category, p.id,
                  (SELECT json_agg(json_build_object('color', v.color, 'size', v.size, 'size2', v.size2, 'variant_name', v.variant_name, 'price', v.price, 'stock', v.stock_quantity)) FROM product_variants v WHERE v.product_id = p.id AND v.client_id = p.client_id AND v.is_active = true) as variants
           FROM client_store_products p WHERE p.client_id = $1 AND p.status = 'active' AND (${conditions}) ORDER BY p.is_featured DESC NULLS LAST LIMIT 10`,
          params
        );
      }
    }

    return res.rows.map((r: any) => {
      const price = Number(r.price);
      let l = `- المنتج: ${r.title} | السعر: ${price} دج`;
      if (r.original_price && Number(r.original_price) > price) l += ` (خصم ${Math.round((1 - price / Number(r.original_price)) * 100)}%)`;
      if (r.stock_quantity !== null && r.stock_quantity <= 0) l += ' | الحالة: غير متوفر';
      else l += ' | الحالة: متوفر';
      if (r.category) l += ` | القسم: ${r.category}`;
      if (r.description) l += ` | الوصف: ${String(r.description).slice(0, 120)}`;
      const variants = r.variants as Array<{color: string; size: string; size2: string; variant_name: string; price: number; stock: number}> | null;
      if (variants && variants.length > 0) {
        const colors = variants.filter((v: any) => v.stock > 0).map((v: any) => v.color);
        l += ` | الألوان: ${colors.join('، ')}`;
      }
      return l;
    }).join('\n');
  } catch { return ''; }
}

async function resolvePhone(clientId: number, platform: Platform, chatId: string): Promise<string | null> {
  // Normalize WhatsApp number (e.g. 212XXXXXXXXX → 05XXXXXXXX) to match DB format
  if (platform === 'whatsapp') {
    const digits = String(chatId).replace(/\D/g, '');
    // Try DB-stored mappings first
    try {
      const p = await pool();
      const res = await p.query(`SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND messenger_psid = $2 LIMIT 1`, [clientId, chatId]);
      if (res.rows[0]?.customer_phone) return res.rows[0].customer_phone;
    } catch {}
    // Normalize: 213XX... → 0XX..., or return as-is if already 0XX...
    if (digits.startsWith('213') && digits.length === 12) return '0' + digits.slice(3);
    if (digits.startsWith('00213') && digits.length === 14) return '0' + digits.slice(5);
    if (digits.length === 9) return '0' + digits;
    if (/^0[567]\d{8}$/.test(digits)) return digits;
    return null;
  }
  try {
    const p = await pool();
    const col = platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
    const res = await p.query(`SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND ${col} = $2 LIMIT 1`, [clientId, chatId]);
    if (res.rows[0]?.customer_phone) return res.rows[0].customer_phone;
    if (platform === 'messenger' || platform === 'instagram') {
      const sub = await p.query(`SELECT customer_phone FROM messenger_subscribers WHERE client_id = $1 AND psid = $2 AND customer_phone IS NOT NULL LIMIT 1`, [clientId, chatId]);
      if (sub.rows[0]?.customer_phone) return sub.rows[0].customer_phone;
    }
    return null;
  } catch { return null; }
}

function extractPhone(message: string): string | null {
  const patterns = [
    /(?:\+?213|00213)[\s.-]?([567])[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})/,
    /\b0[\s.-]?([567])[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})\b/,
    /(?:\+?213|00213)?[\s.-]*([567]\d{8})/,
  ];
  for (const pat of patterns) {
    const m = message.match(pat);
    if (m) {
      const digits = m[0].replace(/[^0-9]/g, '');
      let norm = digits;
      if (digits.startsWith('00213')) norm = '0' + digits.slice(5);
      else if (digits.startsWith('213')) norm = '0' + digits.slice(3);
      else if (!digits.startsWith('0') && digits.length === 9) norm = '0' + digits;
      if (/^0[567]\d{8}$/.test(norm)) return norm;
    }
  }
  return null;
}

async function loadOrders(clientId: number, phone: string): Promise<string> {
  try {
    const p = await pool();
    const res = await p.query(
      `SELECT o.id, o.total_price, o.created_at, o.quantity, o.delivery_status, o.tracking_number, o.delivery_type, o.customer_name, o.shipping_address,
              p.title as product_title, dc.name as delivery_company,
              (SELECT de.description FROM delivery_events de WHERE de.order_id = o.id ORDER BY de.created_at DESC LIMIT 1) as last_event,
              (SELECT de.event_type FROM delivery_events de WHERE de.order_id = o.id ORDER BY de.created_at DESC LIMIT 1) as event_type
       FROM store_orders o LEFT JOIN client_store_products p ON p.id = o.product_id LEFT JOIN delivery_companies dc ON dc.id = o.delivery_company_id
       WHERE o.client_id = $1 AND o.customer_phone = $2 ORDER BY o.created_at DESC LIMIT 5`, [clientId, phone]
    );
    if (!res.rows.length) return '';
    const labels: Record<string, string> = { pending: 'لم يُشحن بعد', assigned: 'تم تعيين شركة التوصيل', picked_up: 'تم الاستلام', in_transit: 'في الطريق', out_for_delivery: 'خرج للتوصيل', delivered: 'تم التسليم بالفعل', failed: 'فشلت محاولة التوصيل', returned: 'تم الإرجاع' };
    return res.rows.map((o: any) => {
      let l = `📦 طلب #${o.id} — ${o.product_title || 'منتج'} (×${o.quantity || 1}) — ${o.total_price} دج`;
      if (o.tracking_number) l += `\n   حالة الشحن: ${labels[o.delivery_status] || 'جاري المتابعة'} | رقم التتبع: ${o.tracking_number}${o.delivery_company ? ` (${o.delivery_company})` : ''}`;
      else l += `\n   حالة الشحن: قيد التحضير والتجهيز`;
      if (o.last_event) l += `\n   آخر تحديث: ${o.last_event}`;
      if (o.shipping_address) l += `\n   العنوان المسجل: ${o.shipping_address}`;
      l += `\n   تاريخ تسجيل الطلب: ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`;
      return l;
    }).join('\n\n');
  } catch { return ''; }
}

async function loadOrdersByOrderNumber(clientId: number, orderId: number): Promise<string> {
  try {
    const p = await pool();
    const res = await p.query(
      `SELECT o.id, o.total_price, o.created_at, o.quantity, o.delivery_status, o.tracking_number, o.delivery_type, o.customer_name, o.shipping_address, o.customer_phone,
              p.title as product_title, dc.name as delivery_company,
              (SELECT de.description FROM delivery_events de WHERE de.order_id = o.id ORDER BY de.created_at DESC LIMIT 1) as last_event,
              (SELECT de.event_type FROM delivery_events de WHERE de.order_id = o.id ORDER BY de.created_at DESC LIMIT 1) as event_type
       FROM store_orders o LEFT JOIN client_store_products p ON p.id = o.product_id LEFT JOIN delivery_companies dc ON dc.id = o.delivery_company_id
       WHERE o.client_id = $1 AND o.id = $2 LIMIT 1`, [clientId, orderId]
    );
    if (!res.rows.length) return '';
    const labels: Record<string, string> = { pending: 'لم يُشحن بعد', assigned: 'تم تعيين شركة التوصيل', picked_up: 'تم الاستلام', in_transit: 'في الطريق', out_for_delivery: 'خرج للتوصيل', delivered: 'تم التسليم بالفعل', failed: 'فشلت محاولة التوصيل', returned: 'تم الإرجاع' };
    const o = res.rows[0];
    let l = `📦 طلب #${o.id} — ${o.product_title || 'منتج'} (×${o.quantity || 1}) — ${o.total_price} دج`;
    if (o.tracking_number) l += `\n   حالة الشحن: ${labels[o.delivery_status] || 'جاري المتابعة'} | رقم التتبع: ${o.tracking_number}${o.delivery_company ? ` (${o.delivery_company})` : ''}`;
    else l += `\n   حالة الشحن: قيد التحضير والتجهيز`;
    if (o.last_event) l += `\n   آخر تحديث: ${o.last_event}`;
    if (o.shipping_address) l += `\n   العنوان المسجل: ${o.shipping_address}`;
    l += `\n   تاريخ تسجيل الطلب: ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`;
    return l;
  } catch { return ''; }
}

interface OrderData { clientId: number; platform: Platform; platformChatId: string; productTitle: string; customerName: string; customerPhone: string; shippingAddress: string; wilayaName?: string; quantity?: number; variantColor?: string; }

async function createOrder(data: OrderData): Promise<{ orderId: number; total: number } | null> {
  try {
    const p = await pool();
    const prodRes = await p.query(`SELECT id, price FROM client_store_products WHERE client_id = $1 AND status = 'active' AND title ILIKE $2 LIMIT 1`, [data.clientId, `%${data.productTitle}%`]);
    if (!prodRes.rows.length) return null;
    const productId = Number(prodRes.rows[0].id);
    const unitPrice = Number(prodRes.rows[0].price);

    let wilayaId: number | null = null;
    if (data.wilayaName) {
      try { const w = await p.query(`SELECT id FROM wilayas WHERE name_ar = $1 OR name = $1 LIMIT 1`, [data.wilayaName]); if (w.rows[0]) wilayaId = Number(w.rows[0].id); } catch {}
    }

    let deliveryFee = 0;
    if (wilayaId) {
      try { const d = await p.query(`SELECT home_delivery_price FROM delivery_prices WHERE client_id = $1 AND wilaya_id = $2 AND is_active = true LIMIT 1`, [data.clientId, wilayaId]); deliveryFee = Number(d.rows[0]?.home_delivery_price) || 0; } catch {}
    }

    const qty = data.quantity || 1;
    const total = (unitPrice * qty) + deliveryFee;

    const colRes = await p.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_orders'`);
    const cols = new Set(colRes.rows.map((r: any) => String(r.column_name)));
    const insertCols: string[] = []; const insertVals: any[] = [];
    const add = (c: string, v: any) => { if (cols.has(c)) { insertCols.push(c); insertVals.push(v); } };

    add('client_id', data.clientId); add('product_id', productId); add('quantity', qty);
    add('unit_price', unitPrice); add('total_price', total); add('delivery_fee', deliveryFee);
    add('customer_name', data.customerName); add('customer_phone', data.customerPhone);
    add('shipping_address', data.shippingAddress); add('shipping_wilaya_id', wilayaId);
    add('status', 'pending'); add('payment_status', 'unpaid');
    add('order_source', 'ai_chat'); add('source_platform', data.platform); add('created_at', new Date());
    add('variant_color', data.variantColor || null);
    add('variant_size', data.variantSize || null);
    add('variant_size2', data.variantSize2 || null);

    const ph = insertVals.map((_, i) => `$${i + 1}`).join(',');
    const result = await p.query(`INSERT INTO store_orders (${insertCols.join(',')}) VALUES (${ph}) RETURNING id, total_price`, insertVals);
    const orderId = result.rows[0].id;

    try {
      const phoneCol = data.platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
      await p.query(`INSERT INTO customer_messaging_ids (client_id, ${phoneCol}, customer_phone) VALUES ($1, $2, $3) ON CONFLICT (client_id, ${phoneCol}) DO UPDATE SET customer_phone = $3`, [data.clientId, data.platformChatId, data.customerPhone]);
    } catch {}

    try {
      await p.query(`INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at) VALUES ($1, $2, $3, 'telegram', $4, NOW())`, [orderId, data.clientId, data.customerPhone, `📦 طلب جديد!\nرقم: #${orderId}\nالمنتج: ${data.productTitle}\nالسعر: ${unitPrice} دج × ${qty}\nالمجموع: ${total} دج\nالاسم: ${data.customerName}\nالهاتف: ${data.customerPhone}`]);
    } catch {}
    notifyOrderCreated(data.clientId, orderId, data.customerName);

    return { orderId, total: Number(result.rows[0].total_price) };
  } catch (err) { console.error('[CustomerAI] createOrder error:', err); return null; }
}

interface AddressUpdateData { customerPhone?: string; shippingAddress: string; wilayaName?: string; }

async function updateCustomerOrderAddress(clientId: number, platform: Platform, data: AddressUpdateData): Promise<number> {
  try {
    const p = await pool();
    const phone = data.customerPhone || '';

    let wilayaId: number | null = null;
    if (data.wilayaName) {
      try { const w = await p.query(`SELECT id FROM wilayas WHERE name_ar = $1 OR name = $1 LIMIT 1`, [data.wilayaName]); if (w.rows[0]) wilayaId = Number(w.rows[0].id); } catch {}
    }

    const sets: string[] = [`shipping_address = $1`, `updated_at = NOW()`];
    const vals: any[] = [data.shippingAddress];
    let idx = 2;
    if (wilayaId) { sets.push(`shipping_wilaya_id = $${idx++}`); vals.push(wilayaId); }

    let where = `client_id = $${idx++} AND status IN ('pending', 'confirmed')`;
    vals.push(clientId);

    if (phone) {
      where += ` AND customer_phone = $${idx++}`;
      vals.push(phone);
    } else {
      const phoneCol = platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
      const phoneRes = await p.query(`SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND ${phoneCol} = $2 LIMIT 1`, [clientId, '']);
      const resolvedPhone = phoneRes.rows[0]?.customer_phone;
      if (!resolvedPhone) return 0;
      where += ` AND customer_phone = $${idx++}`;
      vals.push(resolvedPhone);
    }
    where += ` AND (delivery_status IS NULL OR delivery_status NOT IN ('shipped', 'in_transit', 'out_for_delivery', 'delivered', 'picked_up'))`;

    const res = await p.query(
      `UPDATE store_orders SET ${sets.join(', ')} WHERE ${where} RETURNING id, customer_name`,
      vals
    );
    if (res.rows.length > 0) {
      sendPushNotification(
        clientId,
        '📍 تحديث عنوان توصيل',
        `الزبون ${res.rows[0].customer_name} غيّر عنوان التوصيل لـ ${res.rows.length} طلب(ات) عبر المحادثة\nالعنوان الجديد: ${data.shippingAddress}${data.wilayaName ? ' — ' + data.wilayaName : ''}`
      ).catch(() => {});
    }
    return res.rows.length;
  } catch (err) {
    console.error('[CustomerAI] updateAddress error:', err);
    return 0;
  }
}
