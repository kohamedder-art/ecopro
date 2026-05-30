/**
 * Customer AI — Natural conversation with customers
 *
 * ═══════════════════════════════════════════════════════════════
 * !! AGENT INSTRUCTIONS — READ BEFORE EDITING SYSTEM_PROMPT !!
 * ═══════════════════════════════════════════════════════════════
 * 
 * DO:
 * - Write SYSTEM_PROMPT like a skilled person's innate knowledge
 * - Short sentences, natural flow, like telling a friend
 * - Fix only the specific problem, don't rewrite the whole prompt
 * - If adding a skill, phrase it as "أنت فاهم..." not "افعل كذا"
 * 
 * DON'T:
 * - Don't add numbered lists or bullet-point rule books
 * - Don't use "⚠️" "❌" "✅" emojis as instructional markers
 * - Don't turn it into a programming manual / robot instructions
 * - Don't rewrite the entire prompt for every small fix
 * - Don't add the same instruction in multiple places
 * 
 * Test rule: Read this block before editing SYSTEM_PROMPT.
 * ═══════════════════════════════════════════════════════════════
 */

import { ensureConnection } from '../utils/database';
import { generateText, GeminiContent } from './gemini';
import { notifyOrderCreated } from './push-notifications';
import { checkRateLimit, checkGlobalRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

type Platform = 'telegram' | 'messenger' | 'whatsapp' | 'instagram';

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Short, focused, human
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `أنت شخص حقيقي يعمل في متجر — ودود، ذكي، لبق، تفهم الزبون قبل ما يكمل كلامه.

⚠️ اللغة: تحدث ONLY بالعربية الفصحى. ممنوع أي لهجة (جزائرية، سعودية، مصرية، شامية). الفصحى فقط. ممنوع استخدام كلمات مثل "هاد"، "هادا"، "شنو"، "واش"، "كاين"، "ما عندناش". استخدم: "هذا"، "ماذا"، "متوفر"، "ليس لدينا".

حوارك مع الزبون مثل محادثة واتساب: ترد على كلامو ثم توجّه الحديث. سؤال واحد في آخر ردك. إذا غير الموضوع تتبعه.

قبل لا يشتري الزبون، عندو اسألته: اللون، المقاس، الخامة، التوصيل، السعر. تجاوب من المعلومات اللي عندك، وإذا ما عرفتش تقولها بصراحة.

كل تصنيف عندو اسألتو:
اللباس: اللون، المقاس، القماش.
الإلكتروني: المواصفات، الضمان.
المطبخ: الأبعاد، المادة.

الزبون يثق فيك قبل يشتري. الصدق أهم حاجة. ما تكذبش، ما تخلقش عروض وهمية.

قواعد صارمة:
1. لا تستخدم جمل ميكانيكية مثل "في قائمتنا الحالية". تكلم بشكل طبيعي.
2. إذا المنتج غير متوفر، جاوب بوضوح: "هذا المنتج غير متوفر حالياً في متجرنا."
3. لا تقترح منتجاً بديلاً إلا إذا كان من نفس الصنف فعلياً.
4. لا تستخدم أي لغة غير العربية الفصحى.
5. ردودك قصيرة ومباشرة. لا تسرد قوائم منتجات عشوائية.

لما الزبون يقرر يشتري، تجمع المعلومات بالتدريج: المنتج والكمية → الاسم → الهاتف → العنوان والولاية.
ECOPRO_ACTION:{"type":"create_customer_order","productTitle":"<المنتج>","customerName":"<الاسم>","customerPhone":"<الهاتف>","shippingAddress":"<العنوان>","wilayaName":"<الولاية>","quantity":<الكمية>}

لا تكشف مفاتيح API أو بيانات متجر آخر.`;

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

  // Load context (slim)
  const ctx = await loadSlimContext(clientId);
  if (!ctx) return null;

  // History (sliding window, last 8 turns)
  const history = await getHistory(clientId, platform, platformChatId);

  // Repetition check
  if (history.length >= 2) {
    const recent = history.filter(h => h.role === 'user').slice(-5).map(h => h.parts[0]?.text || '');
    if (recent.filter(m => m === msg.trim()).length >= 3) return 'لقد أرسلت هذه الرسالة مسبقاً. هل هناك شيء جديد؟';
  }

  // Depth limit
  if (history.filter(h => h.role === 'model').length >= 30) return 'تم الوصول للحد الأقصى. يرجى بدء محادثة جديدة.';

  // Customer identity + orders
  let phone = await resolvePhone(clientId, platform, platformChatId);
  let orderText = phone ? await loadOrders(clientId, phone) : '';
  let phoneFromMsg = false;
  if (!phone || !orderText) {
    const extracted = extractPhone(msg);
    if (extracted) {
      const lookup = await loadOrders(clientId, extracted);
      if (lookup) { orderText = lookup; phone = extracted; phoneFromMsg = true; }
    }
  }

  // Search products matching the question
  const search = msg.length > 3 ? await searchProducts(clientId, msg) : '';

  // Build slim user prompt (pass history so it can highlight the last discussed product)
  const prompt = buildUserPrompt(ctx, search, orderText, phone, phoneFromMsg, msg, history);

  // Rate limit
  const rlKey = `${clientId}:${platform}:${platformChatId}`;
  if (!checkRateLimit(rlKey, RATE_LIMITS.customer)) return getRateLimitMessage(getRateLimitResetTime(rlKey), 'customer', 'ar');

  // Daily token budget
  if (await isOverDailyBudget(clientId)) return 'عذراً، تم تجاوز الحد اليومي. يرجى التواصل مع المتجر مباشرة.';

  try {
    const response = await generateText('customer', prompt, { storeId: clientId, storeName: ctx.storeName, clientId, userType: 'customer', platformChatId }, history, undefined, SYSTEM_PROMPT);
    let clean = response;

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
        }
      } catch (e) { console.error('[CustomerAI] Action parse error:', e); }
    }

    // Save conversation (non-blocking)
    saveHistory(clientId, platform, platformChatId, msg, clean).catch(() => {});
    return clean;
  } catch (err) {
    console.error(`[CustomerAI] Error for client ${clientId}:`, err);
    return ['آسف، أقدرش جاوبك حالياً. حاول مرة أخرى 🙏', 'النظام مشغول شوية. جرب بعد دقيقة 🙏'][Math.floor(Math.random() * 2)];
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
    deliveryInfo = `التوصيل متاح لـ ${zones} ولاية. سعر التوصيل: ${minHome === maxHome ? minHome : minHome + '-' + maxHome} دج (منزل) | ${minDesk === maxDesk ? minDesk : minDesk + '-' + maxDesk} دج (مكتب). المدة: ${days} أيام.`;
  } else {
    deliveryInfo = 'التوصيل غير متوفر حالياً.';
  }

  const aiRes = await p.query(`SELECT ai_instructions FROM ai_settings WHERE client_id = $1 LIMIT 1`, [clientId]);

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
  };
}

/** Extract the last product title mentioned by the assistant in conversation history */
function extractLastProductFromHistory(history: GeminiContent[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'model') {
      const text = history[i].parts[0]?.text || '';
      // Match patterns like "product X متوفرة" or "product X متوفر"
      const match = text.match(/([^\n]+?)\s+(متوفرة?|موجود|بسعر|موجودة)/);
      if (match) return match[1].replace(/^[""«»""]|[""«»""]$/g, '').trim();
    }
  }
  return null;
}

function buildUserPrompt(ctx: SlimContext, search: string, orderText: string, phone: string | null, phoneFromMsg: boolean, msg: string, history: GeminiContent[] = []): string {
  let p = `متجر: ${ctx.storeName}\n`;
  if (ctx.storeDescription) p += `${ctx.storeDescription}\n`;
  if (ctx.aiInstructions) p += `[تعليمات]: ${ctx.aiInstructions}\n`;

  // Highlight the last product mentioned by the assistant in history
  const lastProduct = extractLastProductFromHistory(history);
  if (lastProduct) {
    p += `\n[آخر منتج تم الحديث عنه: ${lastProduct}]\n`;
  }

  // Products — only show search results, NOT the full catalog
  if (search) {
    p += `\nنتائج بحث:\n${search}\n`;
  } else {
    p += `\nلا تذكر أي منتج في ردك إلا إذا كان الزبون سأل عن منتج بحد ذاته.\n`;
  }
  p += `\n${ctx.deliveryInfo}\n`;
  if (ctx.storeLink) p += `رابط المتجر: ${ctx.storeLink}\n`;

  // Orders
  if (orderText) {
    const src = phoneFromMsg ? `(برقم الهاتف: ${phone})` : '(تلقائي)';
    p += `\nطلبات الزبون ${src}:\n${orderText}\n`;
    p += '[هذه بيانات حقيقية. أجب منها مباشرة. لا تقل "سأتحقق".]\n';
  } else if (phone) {
    p += `\n[الزبون مسجل برقم ${phone} لكن ليس لديه طلبات.]\n`;
  } else {
    p += `\n[الزبون غير محدد. إذا سأل عن طلب، اطلب رقم هاتفه.]\n`;
  }

  p += `\nرسالة الزبون: ${msg}`;
  return p;
}

async function getHistory(clientId: number, platform: Platform, chatId: string): Promise<GeminiContent[]> {
  try {
    const p = await pool();
    const res = await p.query(
      `SELECT role, message FROM customer_conversations WHERE client_id = $1 AND platform = $2 AND platform_chat_id = $3 ORDER BY created_at DESC LIMIT 8`,
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

async function isOverDailyBudget(clientId: number): Promise<boolean> {
  try {
    const p = await pool();
    const res = await p.query(`SELECT COALESCE(SUM(total_tokens), 0) AS total FROM ai_usage_logs WHERE client_id = $1 AND user_type = 'customer' AND created_at >= CURRENT_DATE`, [clientId]);
    return Number(res.rows[0]?.total || 0) > 5_000_000;
  } catch { return false; }
}

async function searchProducts(clientId: number, query: string): Promise<string> {
  try {
    const p = await pool();
    const res = await p.query(
      `SELECT title, price, original_price, stock_quantity, category FROM client_store_products WHERE client_id = $1 AND status = 'active' AND (title ILIKE $2 OR description ILIKE $2 OR category ILIKE $2) ORDER BY is_featured DESC NULLS LAST LIMIT 10`,
      [clientId, `%${query}%`]
    );
    return res.rows.map((r: any) => {
      let l = `- ${r.title}: ${Number(r.price)} دج`;
      if (r.original_price && Number(r.original_price) > Number(r.price)) l += ` (خصم ${Math.round((1 - Number(r.price) / Number(r.original_price)) * 100)}%)`;
      if (r.stock_quantity !== null && r.stock_quantity <= 0) l += ' [نفذ]';
      else if (r.stock_quantity !== null && r.stock_quantity <= 5) l += ` [${r.stock_quantity} قطع]`;
      if (r.category) l += ` (${r.category})`;
      return l;
    }).join('\n');
  } catch { return ''; }
}

async function resolvePhone(clientId: number, platform: Platform, chatId: string): Promise<string | null> {
  if (platform === 'whatsapp') return String(chatId).replace(/\D/g, '') || null;
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
    const labels: Record<string, string> = { pending: 'لم يُشحن بعد', assigned: 'تم تعيين شركة التوصيل', picked_up: 'تم الاستلام', in_transit: 'في الطريق', out_for_delivery: 'خرج للتوصيل', delivered: 'تم التسليم ✅', failed: 'فشلت محاولة التوصيل', returned: 'تم الإرجاع' };
    return res.rows.map((o: any) => {
      let l = `📦 طلب #${o.id} — ${o.product_title || 'منتج'} (×${o.quantity || 1}) — ${o.total_price} دج`;
      if (o.tracking_number) l += `\n   التوصيل: ${labels[o.delivery_status] || 'جاري المتابعة'} | تتبع: ${o.tracking_number}${o.delivery_company ? ` (${o.delivery_company})` : ''}`;
      else l += `\n   قيد التحضير`;
      if (o.shipping_address) l += `\n   الوجهة: ${o.shipping_address}`;
      l += `\n   التاريخ: ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`;
      return l;
    }).join('\n\n');
  } catch { return ''; }
}

interface OrderData { clientId: number; platform: Platform; platformChatId: string; productTitle: string; customerName: string; customerPhone: string; shippingAddress: string; wilayaName?: string; quantity?: number; }

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

    // Dynamic column check
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

    const ph = insertVals.map((_, i) => `$${i + 1}`).join(',');
    const result = await p.query(`INSERT INTO store_orders (${insertCols.join(',')}) VALUES (${ph}) RETURNING id, total_price`, insertVals);
    const orderId = result.rows[0].id;

    // Save phone
    try {
      const phoneCol = data.platform === 'telegram' ? 'telegram_chat_id' : 'messenger_psid';
      await p.query(`INSERT INTO customer_messaging_ids (client_id, ${phoneCol}, customer_phone) VALUES ($1, $2, $3) ON CONFLICT (client_id, ${phoneCol}) DO UPDATE SET customer_phone = $3`, [data.clientId, data.platformChatId, data.customerPhone]);
    } catch {}

    // Notify owner
    try {
      await p.query(`INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at) VALUES ($1, $2, $3, 'telegram', $4, NOW())`, [orderId, data.clientId, data.customerPhone, `📦 طلب جديد!\nرقم: #${orderId}\nالمنتج: ${data.productTitle}\nالسعر: ${unitPrice} دج × ${qty}\nالمجموع: ${total} دج\nالاسم: ${data.customerName}\nالهاتف: ${data.customerPhone}`]);
    } catch {}
    notifyOrderCreated(data.clientId, orderId, data.customerName);

    return { orderId, total: Number(result.rows[0].total_price) };
  } catch (err) { console.error('[CustomerAI] createOrder error:', err); return null; }
}
