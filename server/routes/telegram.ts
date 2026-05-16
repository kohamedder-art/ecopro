import type { RequestHandler } from 'express';
import https from 'https';
import { ensureConnection, ensureMigrationsReady } from '../utils/database';
import { replaceTemplateVariables, sendTelegramMessage } from '../utils/bot-messaging';
import { registerTelegramWebhook, upsertTelegramWebhookSecret } from '../utils/telegram';
import { getPublicBaseUrl } from '../utils/public-url';
import { logSecurityEvent, getClientIp, computeFingerprint } from '../utils/security';
import { handleCustomerMessage, resolveClientFromTelegramSecret, resolveClientFromTelegramChatId } from '../services/ai-customer';
import crypto from 'crypto';

const PLATFORM_TELEGRAM_BOT_TOKEN = String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim();
const PLATFORM_TELEGRAM_BOT_USERNAME = String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim();
const PLATFORM_TELEGRAM_AVAILABLE = !!PLATFORM_TELEGRAM_BOT_TOKEN && !!PLATFORM_TELEGRAM_BOT_USERNAME;
const isProduction = process.env.NODE_ENV === 'production';

function normalizeTelegramUsername(username: string): string {
  return String(username || '').trim().replace(/^@/, '');
}

// Temporary endpoint to set webhook secret for testing
export const setWebhookSecret: RequestHandler = async (req, res) => {
  try {
    const { storeSlug, secret } = req.body;
    if (!storeSlug || !secret) {
      return res.status(400).json({ error: 'storeSlug and secret required' });
    }
    const pool = await ensureConnection();
    const result = await pool.query(
      `UPDATE bot_settings SET telegram_webhook_secret = $1, updated_at = NOW()
       WHERE client_id = (
         SELECT client_id
         FROM client_store_settings
         WHERE store_slug = $2
            OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER(REGEXP_REPLACE($2, '[^a-zA-Z0-9]', '', 'g'))
         LIMIT 1
       )
       RETURNING client_id`,
      [secret, storeSlug]
    );
    if (result.rows.length) {
      res.json({ ok: true, clientId: result.rows[0].client_id });
    } else {
      res.status(404).json({ error: 'Store not found or no bot settings' });
    }
  } catch (error) {
    console.error('[setWebhookSecret] error:', error);
    res.status(500).json({ error: 'Failed' });
  }
};

async function answerCallbackQuery(opts: { botToken: string; callbackQueryId: string; text?: string }): Promise<void> {
  if (!opts.botToken) return;
  const payload = JSON.stringify({ callback_query_id: opts.callbackQueryId, text: opts.text || '' });
  const req = https.request(
    `https://api.telegram.org/bot${opts.botToken}/answerCallbackQuery`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
    (res) => { res.resume(); }
  );
  req.on('error', () => null);
  req.write(payload);
  req.end();
}

function parseCallback(data: string | undefined | null): { action: 'approve' | 'decline'; token: string } | null {
  if (!data) return null;
  const trimmed = String(data).trim();
  const [actionRaw, token] = trimmed.split(':', 2);
  if (!token) return null;
  if (actionRaw === 'approve' || actionRaw === 'decline') {
    return { action: actionRaw, token };
  }
  return null;
}

// Parse simple callback format: confirm_order_ID_CLIENTID or cancel_order_ID_CLIENTID
export function parseSimpleCallback(data: string | undefined | null): { action: 'confirm' | 'cancel'; orderId: number; clientId: number } | null {
  if (!data) return null;
  const match = data.match(/^(confirm|cancel)_order_(\d+)_(\d+)$/);
  if (!match) return null;
  return {
    action: match[1] as 'confirm' | 'cancel',
    orderId: parseInt(match[2], 10),
    clientId: parseInt(match[3], 10)
  };
}

function parseStartPayload(text: string | undefined | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/start')) return null;
  const parts = trimmed.split(/\s+/);
  const payload = parts[1];
  if (!payload) return null;
  return payload.trim();
}

async function sendLateConnectOrderMessages(opts: {
  pool: any;
  botToken: string;
  chatId: string;
  clientId: number;
  orderId: number;
}): Promise<void> {
  const { pool, botToken, chatId, clientId, orderId } = opts;

  const orderRes = await pool.query(
    `SELECT o.id, o.customer_name, o.customer_phone, o.shipping_address, o.quantity, o.total_price,
            p.title AS product_title,
            s.store_name
     FROM store_orders o
     INNER JOIN client_store_settings s ON o.client_id = s.client_id
     LEFT JOIN client_store_products p ON o.product_id = p.id
     WHERE o.id = $1 AND o.client_id = $2
     LIMIT 1`,
    [orderId, clientId]
  );

  const row = orderRes.rows[0];
  if (!row) return;

  const storeName = String(row.store_name || 'Store');
  const customerName = String(row.customer_name || 'Customer');
  const customerPhone = String(row.customer_phone || '');
  const address = String(row.shipping_address || 'Not specified');
  const quantity = Number(row.quantity || 1);
  const totalPrice = Number(row.total_price || 0);
  const productName = String(row.product_title || 'Product');

  const botRes = await pool.query(
    `SELECT template_instant_order, template_pin_instructions
     FROM bot_settings
     WHERE client_id = $1 AND enabled = true
     LIMIT 1`,
    [clientId]
  );

  const defaultInstantOrder = `🎉 شكراً لك، {customerName}!

تم استلام طلبك بنجاح ✅

━━━━━━━━━━━━━━━━
📦 تفاصيل الطلب
━━━━━━━━━━━━━━━━
🔢 رقم الطلب: #{orderId}
📱 المنتج: {productName}
💰 السعر: {totalPrice} دج
📍 الكمية: {quantity}

━━━━━━━━━━━━━━━━
👤 معلومات التوصيل
━━━━━━━━━━━━━━━━
📛 الاسم: {customerName}
📞 الهاتف: {customerPhone}
🏠 العنوان: {address}

━━━━━━━━━━━━━━━━
🚚 حالة الطلب: قيد المعالجة
━━━━━━━━━━━━━━━━

سنتواصل معك قريباً للتأكيد 📞

⭐ من {storeName}`;

  const defaultPinInstructions = `📌 نصيحة مهمة:

اضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!

🔔 تأكد من:
• تفعيل الإشعارات للبوت
• عدم كتم المحادثة
• ستتلقى تحديثات حالة الطلب هنا مباشرة`;

  const instantOrderTemplate = botRes.rows[0]?.template_instant_order || defaultInstantOrder;
  const pinInstructionsTemplate = botRes.rows[0]?.template_pin_instructions || defaultPinInstructions;

  const orderMessage = replaceTemplateVariables(String(instantOrderTemplate), {
    customerName,
    productName,
    totalPrice: totalPrice.toLocaleString(),
    quantity,
    orderId,
    customerPhone,
    address,
    storeName,
    companyName: storeName,
  });

  await sendTelegramMessage(botToken, chatId, orderMessage);

  const pinMessage = replaceTemplateVariables(String(pinInstructionsTemplate), {
    customerName,
    productName,
    totalPrice: totalPrice.toLocaleString(),
    quantity,
    orderId,
    customerPhone,
    address,
    storeName,
    companyName: storeName,
  });
  await sendTelegramMessage(botToken, chatId, pinMessage);
}

/**
 * Get Telegram bot link for a store (public endpoint)
 * Used by checkout page to show "Connect with Telegram" button
 */
export const getTelegramBotLink: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const { phone } = req.query;
    
    if (!storeSlug) {
      return res.status(400).json({ error: 'Store slug required' });
    }
    
    const pool = await ensureConnection();
    
    // Get client_id from store slug OR store name (for backwards compatibility)
    const storeRes = await pool.query(
      `SELECT client_id, store_name, store_slug FROM client_store_settings 
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER(REGEXP_REPLACE($1, '[^a-zA-Z0-9]', '', 'g'))
       LIMIT 1`,
      [storeSlug]
    );
    
    if (!storeRes.rows.length) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const clientId = storeRes.rows[0].client_id;
    const storeName = storeRes.rows[0].store_name;
    const actualStoreSlug = storeRes.rows[0].store_slug;
    
    // Get bot settings - fetch row regardless of enabled flag.
    // Telegram availability is determined by credentials, not the main bot toggle.
    // This mirrors how Messenger works (checks messenger_enabled separately).
    const botRes = await pool.query(
      `SELECT enabled, provider, telegram_bot_username, telegram_bot_token
       FROM bot_settings
       WHERE client_id = $1
       LIMIT 1`,
      [clientId]
    );
    
    const botRow = botRes.rows[0];
    const dbBotUsername = botRow?.telegram_bot_username as string | undefined;
    const dbBotToken = botRow?.telegram_bot_token as string | undefined;

    const effectiveBotUsername = normalizeTelegramUsername(dbBotUsername || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_USERNAME : ''));
    const effectiveBotToken = String(dbBotToken || '').trim() || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_TOKEN : '');

    if (!effectiveBotUsername) {
      return res.json({ 
        enabled: false, 
        message: 'Telegram not configured for this store' 
      });
    }

    const botUsername = effectiveBotUsername;

    // Ensure webhook is registered. Don't retry too frequently to avoid rate limiting.
    // The webhook registration is smart enough to not re-register if already set up properly.
    if (effectiveBotToken && !isProduction) {
      try {
        const botToken = effectiveBotToken;
        const secretToken = await upsertTelegramWebhookSecret(clientId, botToken);
        const baseUrl = getPublicBaseUrl(req);
        const hook = await registerTelegramWebhook({ botToken, baseUrl, secretToken });
        if (!hook.ok) {
          if (!hook.error?.includes('Too Many Requests')) {
            console.warn('[Telegram] webhook registration issue:', hook.error);
          }
        } else {
          console.log('[Telegram] Webhook verified/registered');
        }
      } catch (e) {
        if (!isProduction) console.warn('[Telegram] webhook auto-register error:', (e as any)?.message);
      }
    }
    
    // Generate a pre-connect token based on phone (if provided)
    let startToken = '';
    let botUrl = `https://t.me/${botUsername}`;
    
    if (phone) {
      // Normalize phone
      const normalizedPhone = String(phone).replace(/\D/g, '');
      if (normalizedPhone.length >= 9) {
        // Generate unique token for this phone + store combo
        startToken = crypto.createHash('sha256')
          .update(`${clientId}:${normalizedPhone}:preconnect`)
          .digest('hex')
          .substring(0, 32);
        
        // Store the pre-connect mapping
        await pool.query(
          `INSERT INTO customer_preconnect_tokens (client_id, customer_phone, token, created_at, expires_at)
           VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '24 hours')
           ON CONFLICT (client_id, customer_phone) 
           DO UPDATE SET token = $3, created_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'`,
          [clientId, normalizedPhone, startToken]
        );
        
        botUrl = `https://t.me/${botUsername}?start=${startToken}`;
      }
    }
    
    res.json({
      enabled: true,
      botUsername,
      botUrl,
      storeName,
      instructions: {
        ar: 'اضغط على الزر لفتح تيليجرام وبدء محادثة مع البوت. ثم ارجع هنا لإتمام طلبك وستتلقى التأكيد مباشرة!',
        en: 'اضغط على الزر لفتح تيليجرام وبدء محادثة مع البوت. ثم ارجع هنا لإتمام طلبك وستتلقى التأكيد مباشرة!'
      }
    });
  } catch (error) {
    const isMissingSchemaError = (err: any): boolean => {
      const msg = String(err?.message || '').toLowerCase();
      return msg.includes('does not exist') && (msg.includes('relation') || msg.includes('column'));
    };
    if (isMissingSchemaError(error) && !(req as any).__migrationsRetried) {
      (req as any).__migrationsRetried = true;
      try {
        await ensureMigrationsReady('getTelegramBotLink missing schema');
        return getTelegramBotLink(req, res, () => undefined);
      } catch (e) {
        console.error('[getTelegramBotLink] Migration retry failed:', (e as any)?.message || e);
      }
    }
    console.error('[getTelegramBotLink] error:', error);
    res.status(200).json({ enabled: false, message: 'Telegram not available' });
  }
};

/**
 * Check if customer has connected their Telegram (public endpoint)
 */
export const checkTelegramConnection: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const { phone } = req.query;
    
    if (!storeSlug || !phone) {
      return res.status(400).json({ connected: false });
    }
    
    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length < 9) {
      return res.json({ connected: false });
    }
    
    const pool = await ensureConnection();
    
    // Get client_id from store slug OR store name
    const storeRes = await pool.query(
      `SELECT client_id FROM client_store_settings 
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER(REGEXP_REPLACE($1, '[^a-zA-Z0-9]', '', 'g'))
       LIMIT 1`,
      [storeSlug]
    );
    
    if (!storeRes.rows.length) {
      return res.json({ connected: false });
    }
    
    const clientId = storeRes.rows[0].client_id;
    
    // Check if we have a telegram_chat_id for this phone
    const chatRes = await pool.query(
      `SELECT telegram_chat_id FROM customer_messaging_ids 
       WHERE client_id = $1 AND customer_phone = $2 AND telegram_chat_id IS NOT NULL
       LIMIT 1`,
      [clientId, normalizedPhone]
    );
    
    res.json({ 
      connected: chatRes.rows.length > 0,
      chatId: chatRes.rows[0]?.telegram_chat_id || null
    });
  } catch (error) {
    const isMissingSchemaError = (err: any): boolean => {
      const msg = String(err?.message || '').toLowerCase();
      return msg.includes('does not exist') && (msg.includes('relation') || msg.includes('column'));
    };
    if (isMissingSchemaError(error) && !(req as any).__migrationsRetried) {
      (req as any).__migrationsRetried = true;
      try {
        await ensureMigrationsReady('checkTelegramConnection missing schema');
        return checkTelegramConnection(req, res, () => undefined);
      } catch (e) {
        console.error('[checkTelegramConnection] Migration retry failed:', (e as any)?.message || e);
      }
    }
    console.error('[checkTelegramConnection] error:', error);
    res.json({ connected: false });
  }
};

export const telegramWebhook: RequestHandler = async (req, res) => {
  // Telegram expects fast response.
  try {
    const pool = await ensureConnection();
    const update = req.body as any;
    
    // Log all incoming webhooks for debugging
    console.log('[TelegramWebhook] Received update:', JSON.stringify({
      update_id: update?.update_id,
      message_text: update?.message?.text,
      callback_data: update?.callback_query?.data,
      chat_id: update?.message?.chat?.id || update?.callback_query?.message?.chat?.id,
    }));

    const secret = (req.headers['x-telegram-bot-api-secret-token'] as string | undefined)?.trim();

    // Try to get bot token from the webhook secret (preferred).
    let botToken: string | undefined;
    if (secret) {
      const botRes = await pool.query(
        `SELECT telegram_bot_token
         FROM bot_settings
         WHERE telegram_webhook_secret = $1
           AND enabled = true
         LIMIT 1`,
        [secret]
      );
      botToken = String(botRes.rows[0]?.telegram_bot_token || '').trim() || undefined;
    }

    if (!botToken && PLATFORM_TELEGRAM_AVAILABLE) {
      botToken = PLATFORM_TELEGRAM_BOT_TOKEN;
    }

    // Inline button callbacks
    const cb = update?.callback_query;
    if (cb) {
      const callbackId = cb?.id != null ? String(cb.id) : null;
      const chatId = cb?.message?.chat?.id != null ? String(cb.message.chat.id) : null;
      const data = cb?.data as string | undefined;

      // Try simple callback format first (confirm_order_ID_CLIENTID)
      const simpleCallback = parseSimpleCallback(data);
      if (simpleCallback && callbackId && chatId) {
        const { action, orderId, clientId: cbClientId } = simpleCallback;

        // If the secret header is missing/incorrect, fall back to resolving the bot token from the client.
        if (!botToken) {
          const tokenRes = await pool.query(
            `SELECT telegram_bot_token
             FROM bot_settings
             WHERE client_id = $1
               AND enabled = true
             LIMIT 1`,
            [cbClientId]
          );
          botToken = String(tokenRes.rows[0]?.telegram_bot_token || '').trim() || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_TOKEN : undefined);
        }

        if (!botToken) {
          await answerCallbackQuery({ botToken: '', callbackQueryId: callbackId, text: 'البوت غير مهيأ' });
          return res.status(200).json({ ok: true });
        }

        if (action === 'confirm') {
          const upd = await pool.query(
            `UPDATE store_orders SET status = 'confirmed', updated_at = NOW()
             WHERE id = $1 AND client_id = $2 AND status IN ('pending')
             RETURNING *`,
            [orderId, cbClientId]
          );
          if (upd.rows.length) {
            await pool.query(
              `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
               VALUES ($1, $2, 'approved', 'telegram', NOW())
               ON CONFLICT DO NOTHING`,
              [orderId, cbClientId]
            );
            if ((global as any).broadcastOrderUpdate) {
              (global as any).broadcastOrderUpdate(upd.rows[0]);
            }
            await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تم التأكيد ✅' });
            await sendTelegramMessage(botToken, chatId, '✅ تم تأكيد طلبك!\n\nسنتواصل معك قريباً لترتيب التوصيل. شكراً لثقتك! 🙏');
          } else {
            await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تمت المعالجة مسبقاً' });
          }
        }

        if (action === 'cancel') {
          const upd = await pool.query(
            `UPDATE store_orders SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND client_id = $2 AND status IN ('pending')
             RETURNING *`,
            [orderId, cbClientId]
          );
          if (upd.rows.length) {
            await pool.query(
              `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
               VALUES ($1, $2, 'declined', 'telegram', NOW())
               ON CONFLICT DO NOTHING`,
              [orderId, cbClientId]
            );
            if ((global as any).broadcastOrderUpdate) {
              (global as any).broadcastOrderUpdate(upd.rows[0]);
            }
            await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تم الإلغاء ❌' });
            await sendTelegramMessage(botToken, chatId, '❌ تم إلغاء الطلب.\n\nإذا غيرت رأيك، يمكنك الطلب مجدداً من المتجر.');
          } else {
            await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تمت المعالجة مسبقاً' });
          }
        }

        return res.status(200).json({ ok: true });
      }

      // Fall back to old callback format (approve:token or decline:token)
      const parsed = parseCallback(data);
      if (!callbackId || !chatId || !parsed) {
        if (callbackId && botToken) await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'إجراء غير صالح' });
        return res.status(200).json({ ok: true });
      }

      // Resolve order by start token (unguessable)
      const linkRes = await pool.query(
        `SELECT order_id, client_id
         FROM order_telegram_links
         WHERE start_token = $1
         LIMIT 1`,
        [parsed.token]
      );

      if (!linkRes.rows.length) {
        if (botToken) await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'الرابط منتهي الصلاحية' });
        return res.status(200).json({ ok: true });
      }

      const orderId = Number(linkRes.rows[0].order_id);
      const clientId = Number(linkRes.rows[0].client_id);

      if (!botToken && clientId) {
        const tokenRes = await pool.query(
          `SELECT telegram_bot_token
           FROM bot_settings
           WHERE client_id = $1
             AND enabled = true
           LIMIT 1`,
          [clientId]
        );
        botToken = String(tokenRes.rows[0]?.telegram_bot_token || '').trim() || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_TOKEN : undefined);
      }

      if (!botToken) return res.status(200).json({ ok: true });

      // Bind chat to order if not already (safety)
      await pool.query(
        `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id, telegram_user_id, created_at)
         VALUES ($1,$2,$3,NULL,NOW())
         ON CONFLICT (order_id) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id`,
        [orderId, clientId, chatId]
      );

      if (parsed.action === 'approve') {
        const upd = await pool.query(
          `UPDATE store_orders SET status = 'confirmed', updated_at = NOW()
           WHERE id = $1 AND client_id = $2 AND status IN ('pending')
           RETURNING *`,
          [orderId, clientId]
        );
        if (upd.rows.length) {
          await pool.query(
            `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
             VALUES ($1, $2, 'approved', 'telegram', NOW())`,
            [orderId, clientId]
          );
          if ((global as any).broadcastOrderUpdate) {
            (global as any).broadcastOrderUpdate(upd.rows[0]);
          }
          await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تم التأكيد' });
          await sendTelegramMessage(botToken, chatId, '✅ تم تأكيد الطلب. شكراً لك!');
        } else {
          await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تمت المعالجة مسبقاً' });
        }
      }

      if (parsed.action === 'decline') {
        const upd = await pool.query(
          `UPDATE store_orders SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1 AND client_id = $2 AND status IN ('pending')
           RETURNING *`,
          [orderId, clientId]
        );
        if (upd.rows.length) {
          await pool.query(
            `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
             VALUES ($1, $2, 'declined', 'telegram', NOW())`,
            [orderId, clientId]
          );
          if ((global as any).broadcastOrderUpdate) {
            (global as any).broadcastOrderUpdate(upd.rows[0]);
          }
          await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تم الإلغاء' });
          await sendTelegramMessage(botToken, chatId, '❌ تم إلغاء الطلب.');
        } else {
          await answerCallbackQuery({ botToken, callbackQueryId: callbackId, text: 'تمت المعالجة مسبقاً' });
        }
      }

      return res.status(200).json({ ok: true });
    }

    const msg = update?.message;
    const text = msg?.text as string | undefined;
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
    const telegramUserId = msg?.from?.id != null ? String(msg.from.id) : null;

    if (!chatId) return res.status(200).json({ ok: true });

    const startToken = parseStartPayload(text);
    if (!String(text || '').trim().startsWith('/start')) {
      // AI auto-reply: respond to customer messages intelligently
      const trimmedText = String(text || '').trim();
      if (trimmedText && botToken && chatId) {
        // Resolve client_id: prefer chat_id mapping (accurate for shared bots),
        // fall back to webhook secret only if no chat mapping exists
        const clientIdFromChatMap = await resolveClientFromTelegramChatId(chatId);
        const clientIdFromSecret = !clientIdFromChatMap ? await resolveClientFromTelegramSecret(secret) : null;
        const clientId = clientIdFromChatMap || clientIdFromSecret;

        // If resolved ONLY via secret (no customer mapping exists for this chatId),
        // this is almost certainly the store owner messaging their own bot.
        // Save their chatId so isSenderStoreOwner() correctly silences the AI for them.
        if (!clientIdFromChatMap && clientIdFromSecret) {
          try {
            await pool.query(
              `UPDATE bot_settings SET owner_telegram_chat_id = $1 WHERE client_id = $2 AND (owner_telegram_chat_id IS NULL OR owner_telegram_chat_id = '')`,
              [chatId, clientIdFromSecret]
            );
            console.log(`[TelegramWebhook] Auto-saved owner chat_id=${chatId} for client=${clientIdFromSecret}`);
          } catch (e) {
            console.warn('[TelegramWebhook] Failed to save owner_telegram_chat_id:', e);
          }
        }
        
        console.log(`[TelegramWebhook] AI resolve: chatId=${chatId} → clientId=${clientId} (via ${clientIdFromChatMap ? 'chatMap' : 'secret'})`);
        
        if (clientId) {
          try {
            const aiResponse = await handleCustomerMessage(clientId, 'telegram', chatId, trimmedText);
            console.log(`[TelegramWebhook] AI response for client ${clientId}: ${aiResponse ? 'OK (' + aiResponse.length + ' chars)' : 'NULL'}`);
            if (aiResponse) {
              await sendTelegramMessage(botToken, chatId, aiResponse);
            } else {
              // AI disabled or returned null — send fallback
              await sendTelegramMessage(botToken, chatId, 'مرحباً! 👋\n\nسنرد عليك في أقرب وقت.');
            }
          } catch (err) {
            console.error('[TelegramWebhook] AI auto-reply error:', err);
            await sendTelegramMessage(botToken, chatId, 'مرحباً! 👋\n\nسنرد عليك في أقرب وقت.');
          }
        } else {
          console.warn(`[TelegramWebhook] No client resolved for chatId=${chatId}, secret=${secret ? 'present' : 'missing'}`);
        }
      }
      return res.status(200).json({ ok: true });
    }

    // If the user presses "Start" without a payload, Telegram sends plain `/start`.
    // Try to find their previous connection by chat_id to show pending orders.
    if (!startToken) {
      void logSecurityEvent({
        event_type: 'telegram_webhook',
        severity: 'info',
        method: req.method,
        path: req.path,
        ip: getClientIp(req),
        user_agent: String(req.get('user-agent') || ''),
        fingerprint: computeFingerprint({
          ip: getClientIp(req),
          userAgent: String(req.get('user-agent') || ''),
          cookie: String(req.headers.cookie || ''),
        }),
        status_code: 200,
        metadata: {
          kind: 'start_no_payload',
          hasSecretHeader: Boolean(secret),
          updateId: update?.update_id ?? null,
          chatId: chatId,
          telegramUserId,
        },
      });

      // Try to find if this chat_id has any previous connections
      try {
        const connectedRes = await pool.query(
          `SELECT DISTINCT client_id, customer_phone FROM customer_messaging_ids
           WHERE telegram_chat_id = $1 AND telegram_chat_id IS NOT NULL
           LIMIT 1`,
          [chatId]
        );

        if (connectedRes.rows.length > 0) {
          const connectedClientId = Number(connectedRes.rows[0].client_id);
          const connectedPhone = String(connectedRes.rows[0].customer_phone || '');

          // Found a previous connection - look up their pending orders
          const ordersRes = await pool.query(
            `SELECT id, total_price, customer_name, product_id, created_at
             FROM store_orders
             WHERE client_id = $1
               AND customer_phone = $2
               AND status IN ('pending', 'confirmed')
               AND created_at > NOW() - INTERVAL '7 days'
             ORDER BY created_at DESC
             LIMIT 5`,
            [connectedClientId, connectedPhone]
          );

          // Get bot token for this client
          if (!botToken) {
            const tokenRes = await pool.query(
              `SELECT telegram_bot_token FROM bot_settings
               WHERE client_id = $1 AND enabled = true AND telegram_bot_token IS NOT NULL
               LIMIT 1`,
              [connectedClientId]
            );
            botToken = String(tokenRes.rows[0]?.telegram_bot_token || '').trim() || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_TOKEN : undefined);
          }

          if (botToken && ordersRes.rows.length > 0) {
            const orders = ordersRes.rows;
            const ordersMsg = `🎉 مرحباً ${orders[0]?.customer_name || 'لديك'}!\n\n📦 طلباتك الحالية:\n\n${
              orders.map(o => `• الطلب #${o.id}\n  💰 ${o.total_price} دج\n  📊 الحالة: ${o.status === 'pending' ? '⏳ قيد الانتظار' : '✅ مؤكد'}`).join('\n\n')
            }\n\nسنرسل لك تحديثات قريباً! 🚚`;
            
            await sendTelegramMessage(botToken, chatId, ordersMsg);
            return res.status(200).json({ ok: true });
          }
        }
      } catch (err) {
        console.warn('[TelegramWebhook] Failed to find previous connection:', (err as any)?.message || err);
      }

      // Fallback: If we don't know which bot token to use (missing secret header), try the most recent enabled token.
      if (!botToken) {
        const anyTokenRes = await pool.query(
          `SELECT telegram_bot_token
           FROM bot_settings
           WHERE enabled = true
           ORDER BY updated_at DESC NULLS LAST
           LIMIT 1`
        );
        botToken = String(anyTokenRes.rows[0]?.telegram_bot_token || '').trim() || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_TOKEN : undefined);
      }

      if (botToken) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "مرحباً! ✅\n\nلربط طلباتك، يرجى العودة إلى صفحة الدفع في المتجر والضغط على زر ربط تيليجرام حتى نتمكن من ربط محادثتك بهاتفك/طلبك."
        );
      }
      return res.status(200).json({ ok: true });
    }

    // First try: Check if this is a preconnect token (customer connecting BEFORE placing order)
    const preconnectRes = await pool.query(
      `SELECT client_id, customer_phone
       FROM customer_preconnect_tokens
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [startToken]
    );

    if (preconnectRes.rows.length) {
      const resolvedClientId = Number(preconnectRes.rows[0]?.client_id);
      const customerPhone = String(preconnectRes.rows[0]?.customer_phone || '');
      if (!resolvedClientId || !customerPhone) {
        if (botToken) await sendTelegramMessage(botToken, chatId, 'الرابط غير صالح أو منتهي الصلاحية. يرجى العودة إلى المتجر والمحاولة مرة أخرى.');
        return res.status(200).json({ ok: true });
      }

      // CRITICAL: Ensure bot_settings exists and is enabled for pre-connection
      try {
        const { ensureBotSettingsRow } = await import('../utils/client-provisioning');
        await ensureBotSettingsRow(resolvedClientId);
      } catch (err) {
        console.warn('[TelegramWebhook] Failed to ensure bot_settings for preconnect:', (err as any)?.message || err);
      }

      if (!botToken) {
        const tokenRes = await pool.query(
          `SELECT telegram_bot_token
           FROM bot_settings
           WHERE client_id = $1
             AND enabled = true
             AND telegram_bot_token IS NOT NULL
           LIMIT 1`,
          [resolvedClientId]
        );
        botToken = tokenRes.rows[0]?.telegram_bot_token as string | undefined;
      }

      if (!botToken) return res.status(200).json({ ok: true });

      void logSecurityEvent({
        event_type: 'telegram_webhook',
        severity: 'info',
        method: req.method,
        path: req.path,
        ip: getClientIp(req),
        user_agent: String(req.get('user-agent') || ''),
        fingerprint: computeFingerprint({
          ip: getClientIp(req),
          userAgent: String(req.get('user-agent') || ''),
          cookie: String(req.headers.cookie || ''),
        }),
        status_code: 200,
        metadata: {
          kind: 'preconnect_start',
          hasSecretHeader: Boolean(secret),
          updateId: update?.update_id ?? null,
          chatId: chatId,
          telegramUserId,
          clientId: resolvedClientId,
        },
      });

      // This is a preconnect - customer is connecting before placing order
      
      
      // Save the phone->chat mapping
      await pool.query(
        `INSERT INTO customer_messaging_ids (client_id, customer_phone, telegram_chat_id, created_at, updated_at)
         VALUES ($1,$2,$3,NOW(),NOW())
         ON CONFLICT (client_id, customer_phone)
         DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = NOW()`,
        [resolvedClientId, customerPhone, chatId]
      );
      
      // Mark token as used
      await pool.query(
        `UPDATE customer_preconnect_tokens SET used_at = NOW() WHERE token = $1`,
        [startToken]
      );
      
      // RETROACTIVE: Send pending order confirmations they missed
      try {
        const pendingOrdersRes = await pool.query(
          `SELECT id, total_price, customer_name 
           FROM store_orders 
           WHERE client_id = $1 
             AND customer_phone = $2 
             AND status = 'pending'
             AND created_at > NOW() - INTERVAL '7 days'
           ORDER BY created_at DESC
           LIMIT 5`,
          [resolvedClientId, customerPhone]
        );
        
        if (pendingOrdersRes.rows.length > 0 && botToken) {
          const retroMsg = `📦 لديك طلبات سابقة قيد الانتظار:\n\n${pendingOrdersRes.rows.map(o => `• الطلب #${o.id} - ${o.total_price} دج`).join('\n')}\n\nسأرسل لك تفاصيل كل طلب الآن...`;
          await sendTelegramMessage(botToken, chatId, retroMsg);
          
          // Send confirmation for each pending order
          for (const order of pendingOrdersRes.rows) {
            const productRes = await pool.query(
              `SELECT csp.title FROM store_orders so 
               JOIN client_store_products csp ON so.product_id = csp.id 
               WHERE so.id = $1 LIMIT 1`,
              [order.id]
            );
            const productName = productRes.rows[0]?.title || 'Product';
            const storeRes2 = await pool.query(
              `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
              [resolvedClientId]
            );
            const storeName2 = storeRes2.rows[0]?.store_name || 'Store';
            
            const confirmMsg = `تفاصيل الطلب #${order.id}:\n💰 المجموع: ${order.total_price} دج\n🏪 المتجر: ${storeName2}\n\nهل تريد تأكيد هذا الطلب؟`;
            await sendTelegramMessage(botToken, chatId, confirmMsg);
          }
        }
      } catch (err) {
        console.warn('[TelegramWebhook] Failed to send retroactive order messages:', (err as any)?.message || err);
      }
      
      // Get store name
      const storeRes = await pool.query(
        `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [resolvedClientId]
      );
      const storeName = String(storeRes.rows[0]?.store_name || 'Store');

      const tmplRes = await pool.query(
        `SELECT template_greeting
         FROM bot_settings
         WHERE client_id = $1 AND enabled = true
         LIMIT 1`,
        [resolvedClientId]
      );
      const greetingTemplate = tmplRes.rows[0]?.template_greeting as string | undefined;
      
      // Send "bot connected" message (configurable via template_greeting)
      const defaultConnect = `مرحباً بك في {storeName}! 🎉

✅ تم ربط تيليجرام بنجاح.

يمكنك الآن العودة إلى صفحة الطلب وإتمام عملية الشراء.
سنرسل لك تأكيد الطلب مباشرة هنا! 📦`;

      const connectMsg = replaceTemplateVariables(
        String(greetingTemplate || defaultConnect),
        {
          storeName,
          customerName: 'Customer',
          orderId: 0,
        }
      );

      await sendTelegramMessage(botToken, chatId, connectMsg);
      
      return res.status(200).json({ ok: true });
    }

    // Second try: Check if this is an order-specific token (after order placed)
    const linkRes = await pool.query(
      `SELECT order_id, client_id, customer_phone, customer_name
       FROM order_telegram_links
       WHERE start_token = $1
       LIMIT 1`,
      [startToken]
    );

    if (!linkRes.rows.length) {
      if (botToken) {
        await sendTelegramMessage(botToken, chatId, 'الرابط غير صالح أو منتهي الصلاحية. يرجى العودة إلى صفحة الطلب والضغط على زر تيليجرام مرة أخرى.');
      }
      return res.status(200).json({ ok: true });
    }

    const orderId = Number(linkRes.rows[0].order_id);
    const clientId = Number(linkRes.rows[0].client_id);
    const customerPhone = String(linkRes.rows[0].customer_phone || '');
    const customerName = String(linkRes.rows[0].customer_name || '');
    if (!clientId) {
      if (botToken) await sendTelegramMessage(botToken, chatId, 'الرابط غير صالح أو منتهي الصلاحية. يرجى العودة إلى صفحة الطلب والمحاولة مرة أخرى.');
      return res.status(200).json({ ok: true });
    }

    // CRITICAL: Ensure bot_settings exists and is enabled when customer connects to receive order info
    try {
      const { ensureBotSettingsRow } = await import('../utils/client-provisioning');
      await ensureBotSettingsRow(clientId);
    } catch (err) {
      console.warn('[TelegramWebhook] Failed to ensure bot_settings enabled:', (err as any)?.message || err);
    }

    if (!botToken) {
      const tokenRes = await pool.query(
        `SELECT telegram_bot_token
         FROM bot_settings
         WHERE client_id = $1
           AND enabled = true
           AND telegram_bot_token IS NOT NULL
         LIMIT 1`,
        [clientId]
      );
      botToken = tokenRes.rows[0]?.telegram_bot_token as string | undefined;
    }

    if (!botToken) return res.status(200).json({ ok: true });

    void logSecurityEvent({
      event_type: 'telegram_webhook',
      severity: 'info',
      method: req.method,
      path: req.path,
      ip: getClientIp(req),
      user_agent: String(req.get('user-agent') || ''),
      fingerprint: computeFingerprint({
        ip: getClientIp(req),
        userAgent: String(req.get('user-agent') || ''),
        cookie: String(req.headers.cookie || ''),
      }),
      status_code: 200,
      metadata: {
        kind: 'order_start',
        hasSecretHeader: Boolean(secret),
        updateId: update?.update_id ?? null,
        chatId: chatId,
        telegramUserId,
        clientId,
        orderId,
      },
    });

    // Bind this Telegram chat to this order (order-scoped).
    await pool.query(
      `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id, telegram_user_id, created_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (order_id) DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, telegram_user_id = EXCLUDED.telegram_user_id`,
      [orderId, clientId, chatId, telegramUserId]
    );

    // Also keep a phone->chat mapping for convenience.
    await pool.query(
      `INSERT INTO customer_messaging_ids (client_id, customer_phone, telegram_chat_id, created_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT (client_id, customer_phone)
       DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = NOW()`,
      [clientId, customerPhone, chatId]
    );

    // RETROACTIVE: When customer connects, also send them any OTHER pending orders they placed
    try {
      const otherOrdersRes = await pool.query(
        `SELECT id, total_price, customer_name, product_id
         FROM store_orders 
         WHERE client_id = $1 
           AND customer_phone = $2 
           AND status = 'pending'
           AND id != $3
           AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC`,
        [clientId, customerPhone, orderId]
      );
      
      if (otherOrdersRes.rows.length > 0) {
        const otherMsg = `لديك أيضاً طلبات أخرى:\n${otherOrdersRes.rows.map(o => `• الطلب #${o.id} - ${o.total_price} دج`).join('\n')}`;
        await sendTelegramMessage(botToken, chatId, otherMsg);
      }
    } catch (err) {
      console.warn('[TelegramWebhook] Failed to send other pending orders:', (err as any)?.message || err);
    }

    await pool.query(
      `UPDATE order_telegram_links SET used_at = NOW() WHERE start_token = $1`,
      [startToken]
    );

    const storeRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    const storeName = String(storeRes.rows[0]?.store_name || 'EcoPro Store');

    const tmplRes = await pool.query(
      `SELECT template_greeting
       FROM bot_settings
       WHERE client_id = $1 AND enabled = true
       LIMIT 1`,
      [clientId]
    );
    const greetingTemplate = tmplRes.rows[0]?.template_greeting as string | undefined;

    const greeting = replaceTemplateVariables(
      greetingTemplate || 'شكراً لطلبك من {storeName}، {customerName}!\n\n✅ فعّل الإشعارات على تيليجرام لتلقي تأكيد الطلب وتحديثات التتبع.',
      { storeName, customerName, orderId }
    );

    await sendTelegramMessage(botToken, chatId, greeting);

    // Late-connect fix: send the missing immediate order info now, and release any queued Telegram bot messages.
    // This ensures customers who connect AFTER ordering still receive the full flow.
    try {
      await sendLateConnectOrderMessages({ pool, botToken, chatId, clientId, orderId });
    } catch (e) {
      console.warn('[Telegram] Late-connect order backfill failed:', (e as any)?.message || e);
    }

    try {
      await pool.query(
        `UPDATE bot_messages
         SET send_at = NOW(),
             status = 'pending',
             error_message = NULL,
             updated_at = NOW()
         WHERE order_id = $1
           AND client_id = $2
           AND message_type = 'telegram'
           AND status = 'pending'`,
        [orderId, clientId]
      );
    } catch (e) {
      console.warn('[Telegram] Failed to release queued Telegram bot_messages:', (e as any)?.message || e);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[TelegramWebhook] error:', (e as any)?.message || e);
    return res.status(200).json({ ok: true });
  }
};
