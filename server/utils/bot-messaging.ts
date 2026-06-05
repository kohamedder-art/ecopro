/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    BOT MESSAGING — ARCHITECTURE GUIDE                       ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  THIS FILE is the CORE of the bot system. Every platform sends messages    ║
 * ║  through this file. If you're reading this after running out of context,   ║
 * ║  HERE IS EVERYTHING YOU NEED TO KNOW:                                      ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  HOW THE BOT WORKS (same for ALL platforms):                               ║
 * ║                                                                            ║
 * ║  1. Customer places order on storefront                                    ║
 * ║  2. sendOrderConfirmationMessages() is called                              ║
 * ║     → Queues messages into `bot_messages` table with send_at delay         ║
 * ║     → Each platform gets: instant receipt, pin tip, delayed confirmation   ║
 * ║  3. processPendingMessages() runs every 30s (background worker)            ║
 * ║     → Picks up rows WHERE status='pending' AND send_at <= NOW()            ║
 * ║     → Routes to correct send function by message_type                      ║
 * ║     → Updates status to 'sent' or 'failed'                                ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  PER-PLATFORM DETAILS (Telegram is the gold standard):                     ║
 * ║                                                                            ║
 * ║  TELEGRAM (routes/telegram.ts):                                            ║
 * ║    Connection: t.me/Bot?start=TOKEN → webhook gets /start TOKEN            ║
 * ║    → saves customer_phone ↔ telegram_chat_id in customer_messaging_ids     ║
 * ║    Sending: sendTelegramMessage() via Bot API /sendMessage                 ║
 * ║    Buttons: inline_keyboard with approve:/decline: callback_data           ║
 * ║    AI reply: handleCustomerMessage(clientId, 'telegram', chatId, text)     ║
 * ║    Late-connect: sendLateConnectOrderMessages() + release queued msgs      ║
 * ║                                                                            ║
 * ║  MESSENGER (routes/messenger.ts):                                          ║
 * ║    Connection: m.me/PAGE?ref=TOKEN → referral event OR GET_STARTED         ║
 * ║    → saves customer_phone ↔ messenger_psid in customer_messaging_ids       ║
 * ║    ⚠️ KNOWN BUG: m.me ref tokens often DON'T work on mobile browsers      ║
 * ║    → Mobile opens Messenger app but loses the ref parameter                ║
 * ║    → Fallback: first message from user also checks pending preconnect      ║
 * ║      tokens and auto-links if there's exactly 1 recent token              ║
 * ║    Sending: sendMessengerMessageDirect() via Graph API /me/messages        ║
 * ║    Buttons: template type 'button' with postback CONFIRM_ORDER_/DECLINE_   ║
 * ║    AI reply: handleCustomerMessage(clientId, 'messenger', psid, text)      ║
 * ║    Uses MESSAGE_TAG: POST_PURCHASE_UPDATE for messages outside 24h window  ║
 * ║                                                                            ║
 * ║  WHATSAPP CLOUD (routes/whatsapp-cloud.ts):                                ║
 * ║    Connection: auto — phone number IS the identifier, no linking needed    ║
 * ║    → saves in whatsapp_subscribers table                                   ║
 * ║    Sending: sendWhatsAppCloudMessage() via Cloud API /{phoneNumberId}/msgs ║
 * ║    Buttons: interactive type 'button' with reply buttons                   ║
 * ║    AI reply: handleCustomerMessage(clientId, 'whatsapp', phone, text)      ║
 * ║    ⚠️ processPendingMessages uses sendWhatsAppCloudMessage (Cloud API)     ║
 * ║    ⚠️ sendWhatsAppMessage (Twilio) is LEGACY — only for old Twilio setups ║
 * ║                                                                            ║
 * ║  INSTAGRAM (handled inside routes/messenger.ts):                           ║
 * ║    Connection: none — DMs arrive via same webhook with object='instagram'  ║
 * ║    AI reply: handleCustomerMessage(clientId, 'instagram', igSenderId, txt) ║
 * ║    No order confirmation flow — AI chat only                               ║
 * ║                                                                            ║
 * ║  VIBER (no webhook file yet — send-only):                                  ║
 * ║    Connection: requires viber_user_id in customer_messaging_ids            ║
 * ║    Sending: sendViberMessage() via Viber REST API                          ║
 * ║    No AI reply, no buttons, no order confirmation scheduling               ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  KEY TABLES:                                                               ║
 * ║    bot_settings        — per-client config (tokens, templates, toggles)    ║
 * ║    bot_messages        — message queue (status: pending/sent/failed)        ║
 * ║    customer_messaging_ids — phone↔chatId mapping per platform              ║
 * ║    order_telegram_chats   — order-scoped Telegram chat binding             ║
 * ║    order_messenger_chats  — order-scoped Messenger PSID binding            ║
 * ║    confirmation_links     — web confirmation link tokens                   ║
 * ║    order_telegram_links   — Telegram /start tokens per order               ║
 * ║    messenger_preconnect_tokens — Messenger ref tokens per phone            ║
 * ║    customer_preconnect_tokens  — Telegram preconnect tokens per phone      ║
 * ║    whatsapp_subscribers        — WhatsApp subscriber tracking              ║
 * ║    messenger_subscribers       — Messenger subscriber tracking             ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  SENDING FUNCTIONS (one per platform):                                     ║
 * ║    sendTelegramMessage()          — Telegram Bot API (native https)        ║
 * ║    sendMessengerMessageDirect()   — Facebook Graph API (fetch)             ║
 * ║    sendWhatsAppCloudMessage()     — WhatsApp Cloud API (fetch)             ║
 * ║    sendWhatsAppMessage()          — Twilio (LEGACY, kept for old setups)   ║
 * ║    sendViberMessage()             — Viber REST API (fetch)                 ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  TEMPLATE VARIABLES (available in all message templates):                  ║
 * ║    {customerName}, {storeName}, {companyName}, {productName},              ║
 * ║    {price}, {totalPrice}, {orderId}, {confirmationLink},                   ║
 * ║    {quantity}, {customerPhone}, {address}                                  ║
 * ║                                                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { randomBytes } from 'crypto';
import https from 'https';
import { ensureConnection } from "./database";
import { ensureBotSettingsRow } from './client-provisioning';

function getPlatformFbPageAccessToken() { return String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim(); }

function getPlatformTelegramBotToken() { return String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim(); }
function getPlatformTelegramBotUsername() { return String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim(); }
function isPlatformTelegramAvailable() { return !!getPlatformTelegramBotToken() && !!getPlatformTelegramBotUsername(); }

function getWaPhoneNumberId() { return String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(); }
function getWaAccessToken() { return String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(); }

type SendResult = { success: boolean; messageId?: string; error?: string };

/**
 * Send WhatsApp message via Twilio (kept)
 */
export async function sendWhatsAppMessage(
  toPhoneNumber: string,
  message: string,
  mediaUrl?: string
): Promise<SendResult> {
  try {
    // Get Twilio credentials from environment or bot settings
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhoneNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error("Twilio credentials not configured");
      return { success: false, error: "Twilio not configured" };
    }

    const twilio = (await import('twilio')).default as any;
    const client = twilio(accountSid, authToken);

    const messageResponse = await client.messages.create({
      body: message,
      from: `whatsapp:${fromPhoneNumber}`,
      to: `whatsapp:${toPhoneNumber}`,
      ...(mediaUrl && { mediaUrl: [mediaUrl] })
    });

    console.log(`[WhatsApp] Message sent to ${toPhoneNumber}: ${messageResponse.sid}`);
    return { success: true, messageId: messageResponse.sid };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WhatsApp] Failed to send message: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send WhatsApp message via WhatsApp Cloud API (Meta).
 * This is the PRIMARY WhatsApp sender. The Twilio one above is LEGACY.
 * Used by processPendingMessages() for 'whatsapp_cloud' and 'whatsapp' message types.
 */
export async function sendWhatsAppCloudMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  message: string
): Promise<SendResult> {
  try {
    if (!accessToken) return { success: false, error: 'WhatsApp access token missing' };
    if (!phoneNumberId) return { success: false, error: 'WhatsApp phone number ID missing' };
    if (!to) return { success: false, error: 'WhatsApp recipient phone missing' };

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json().catch(() => null);
    if (!response.ok || data?.error) {
      console.error('[WhatsApp Cloud] Send failed:', data?.error || data);
      return { success: false, error: data?.error?.message || `Send failed (${response.status})` };
    }

    const msgId = data?.messages?.[0]?.id;
    console.log(`[WhatsApp Cloud] Message sent to ${to}: ${msgId}`);
    return { success: true, messageId: msgId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WhatsApp Cloud] Failed to send: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send WhatsApp Cloud order confirmation with interactive buttons.
 */
export async function sendWhatsAppCloudOrderConfirmation(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  params: { text: string; orderId: number }
): Promise<SendResult> {
  try {
    if (!accessToken || !phoneNumberId || !to) {
      return { success: false, error: 'WhatsApp Cloud credentials missing' };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: params.text },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `confirm_order_${params.orderId}`, title: '✅ تأكيد' } },
            { type: 'reply', reply: { id: `cancel_order_${params.orderId}`, title: '❌ إلغاء' } },
          ],
        },
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json().catch(() => null);
    if (!response.ok || data?.error) {
      console.error('[WhatsApp Cloud] Order confirmation failed:', data?.error || data);
      return { success: false, error: data?.error?.message || `Send failed (${response.status})` };
    }

    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send Telegram message via Telegram Bot API
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string,
  opts?: { reply_markup?: any; parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML' }
): Promise<SendResult> {
  return new Promise((resolve) => {
    if (!botToken) return resolve({ success: false, error: 'Telegram bot token missing' });
    if (!chatId) return resolve({ success: false, error: 'Telegram chat_id missing' });

    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      ...(opts?.parse_mode ? { parse_mode: opts.parse_mode } : {}),
      ...(opts?.reply_markup ? { reply_markup: opts.reply_markup } : {}),
    });

    const req = https.request(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed?.ok) {
              resolve({ success: true, messageId: String(parsed.result?.message_id || '') });
            } else {
              resolve({ success: false, error: parsed?.description || `Telegram send failed (${res.statusCode})` });
            }
          } catch {
            resolve({ success: false, error: 'Failed to parse Telegram response' });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

/**
 * Send Viber message via Viber REST API
 */
export async function sendViberMessage(
  authToken: string,
  receiverId: string,
  message: string,
  senderName?: string
): Promise<SendResult> {
  try {
    if (!authToken) return { success: false, error: 'Viber auth token missing' };
    if (!receiverId) return { success: false, error: 'Viber receiver id missing' };

    const resp = await fetch('https://chatapi.viber.com/pa/send_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viber-Auth-Token': authToken,
      },
      body: JSON.stringify({
        receiver: receiverId,
        min_api_version: 7,
        sender: { name: senderName || 'EcoPro' },
        type: 'text',
        text: message,
      }),
    });

    const data: any = await resp.json().catch(() => null);
    if (!resp.ok || data?.status !== 0) {
      return { success: false, error: data?.status_message || `Viber send failed (${resp.status})` };
    }
    return { success: true, messageId: data?.message_token ? String(data.message_token) : undefined };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Viber] Failed to send message: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send Facebook Messenger message via Graph API
 * Used by processPendingMessages for scheduled messenger notifications
 */
export async function sendMessengerMessageDirect(
  pageAccessToken: string,
  recipientPsid: string,
  message: string
): Promise<SendResult> {
  try {
    if (!pageAccessToken) return { success: false, error: 'Page access token missing' };
    if (!recipientPsid) return { success: false, error: 'Recipient PSID missing' };

    const payload = {
      recipient: { id: recipientPsid },
      message: { text: message },
      messaging_type: 'MESSAGE_TAG',
      tag: 'POST_PURCHASE_UPDATE',
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json().catch(() => null);
    
    if (!response.ok || data?.error) {
      console.error('[Messenger] Send failed:', data?.error);
      return { 
        success: false, 
        error: data?.error?.message || `Send failed (${response.status})` 
      };
    }

    console.log(`[Messenger] Message sent to ${recipientPsid}: ${data?.message_id}`);
    return { success: true, messageId: data?.message_id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Messenger] Failed to send message: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a Messenger button template with approve/decline postbacks.
 * Used for order confirmations.
 */
export async function sendMessengerOrderConfirmationDirect(
  pageAccessToken: string,
  recipientPsid: string,
  params: { text: string; orderId: number }
): Promise<SendResult> {
  try {
    if (!pageAccessToken) return { success: false, error: 'Page access token missing' };
    if (!recipientPsid) return { success: false, error: 'Recipient PSID missing' };

    const payload = {
      recipient: { id: recipientPsid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: params.text,
            buttons: [
              {
                type: 'postback',
                title: '✅ تأكيد',
                payload: `CONFIRM_ORDER_${params.orderId}`,
              },
              {
                type: 'postback',
                title: '❌ إلغاء',
                payload: `DECLINE_ORDER_${params.orderId}`,
              },
            ],
          },
        },
      },
      messaging_type: 'MESSAGE_TAG',
      tag: 'POST_PURCHASE_UPDATE',
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json().catch(() => null);
    if (!response.ok || data?.error) {
      console.error('[Messenger] Template send failed:', data?.error);
      return {
        success: false,
        error: data?.error?.message || `Send failed (${response.status})`,
      };
    }

    return { success: true, messageId: data?.message_id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Messenger] Failed to send order confirmation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Generate confirmation link token
 */
export function generateConfirmationToken(): string {
  // 32 bytes -> 43 chars base64url; fits confirmation_links.link_token VARCHAR(100)
  return randomBytes(32).toString('base64url');
}

/**
 * Create confirmation link in database
 */
export async function createConfirmationLink(
  orderId: number,
  clientId: number
): Promise<string> {
  const token = generateConfirmationToken();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
  const pool = await ensureConnection();

  await pool.query(
    `INSERT INTO confirmation_links (order_id, client_id, link_token, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [orderId, clientId, token, expiresAt]
  );

  return token;
}

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = String(template ?? '');

  for (const [key, rawValue] of Object.entries(variables || {})) {
    const value = String(rawValue);
    // Support both {key} and {{key}} styles.
    const p1 = `{${key}}`;
    const p2 = `{{${key}}}`;
    if (result.includes(p1)) result = result.split(p1).join(value);
    if (result.includes(p2)) result = result.split(p2).join(value);
  }

  return result;
}

/* ─── Delivery event labels (Arabic) ─────────────────────────── */
const DELIVERY_EVENT_LABELS: Record<string, string> = {
  pickup:            'تم استلام الطرد من البائع',
  in_transit:        'الطرد في الطريق إليك',
  out_for_delivery:  'الطرد خرج للتوصيل اليوم',
  delivered:         'تم التسليم بنجاح ✅',
  failed:            'محاولة توصيل فاشلة ❌',
  returned:          'تم إرجاع الطرد',
};

const DEFAULT_DELIVERY_STATUS_TEMPLATE = `🚚 تحديث حالة طلبك

مرحباً {customer_name}،
طلبك رقم *{order_id}* - {event_label}

{description}
{location_line}
رقم التتبع: {tracking_number}

شكراً لثقتك بنا 🙏`;

/**
 * Send a delivery status update notification to the customer via all enabled channels.
 * Called automatically when a courier webhook arrives.
 */
export async function sendDeliveryStatusNotification(params: {
  orderId: number;
  clientId: number;
  customerPhone: string;
  customerName: string;
  trackingNumber: string;
  eventType: string;
  description?: string;
  location?: string;
}): Promise<void> {
  const { orderId, clientId, customerPhone, customerName, trackingNumber, eventType, description, location } = params;

  try {
    const pool = await ensureConnection();

    // Check bot settings
    const settingsRes = await pool.query(
      `SELECT enabled, delivery_notifications_enabled, delivery_status_template,
              messenger_enabled, telegram_bot_token, fb_page_id
       FROM bot_settings WHERE client_id = $1`,
      [clientId]
    );
    if (!settingsRes.rows.length) return;
    const bs = settingsRes.rows[0];
    if (!bs.enabled || bs.delivery_notifications_enabled === false) return;

    const template: string = bs.delivery_status_template || DEFAULT_DELIVERY_STATUS_TEMPLATE;
    const eventLabel = DELIVERY_EVENT_LABELS[eventType] || eventType;
    const locationLine = location ? `📍 الموقع: ${location}` : '';

    const message = replaceTemplateVariables(template, {
      customer_name: customerName || 'العميل',
      customerName: customerName || 'العميل',
      order_id: String(orderId),
      orderId: String(orderId),
      event_label: eventLabel,
      eventLabel: eventLabel,
      description: description || '',
      location_line: locationLine,
      tracking_number: trackingNumber,
      trackingNumber: trackingNumber,
      event_type: eventType,
      eventType: eventType,
    });

    const channels: Array<'whatsapp' | 'telegram' | 'viber' | 'messenger'> = [];
    channels.push('telegram');
    if (bs.messenger_enabled && bs.fb_page_id) channels.push('messenger');

    if (channels.length === 0) return;

    // Queue messages via bot_messages table (reuses existing worker)
    for (const ch of channels) {
      await pool.query(
        `INSERT INTO bot_messages
         (order_id, client_id, customer_phone, message_type, message_content, send_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [orderId, clientId, customerPhone, ch, message]
      );
    }

    // Ensure order_telegram_chats has an entry so the bot worker can find the chat_id
    // Falls back to customer_messaging_ids for customers who ordered via storefront.
    // All clients share the same platform Telegram bot, so match phone across any client.
    try {
      await pool.query(
        `INSERT INTO order_telegram_chats (order_id, client_id, telegram_chat_id)
         SELECT $1, $2, cmi.telegram_chat_id
         FROM customer_messaging_ids cmi
         WHERE cmi.customer_phone = $3
           AND cmi.telegram_chat_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM order_telegram_chats otc
             WHERE otc.order_id = $1 AND otc.client_id = $2
           )
         LIMIT 1
         ON CONFLICT DO NOTHING`,
        [orderId, clientId, customerPhone]
      );
    } catch { /* non-blocking */ }

    console.log(`[DeliveryBot] Queued ${channels.length} notification(s) for order ${orderId} event=${eventType}`);
  } catch (err: any) {
    console.error('[DeliveryBot] sendDeliveryStatusNotification failed:', err?.message || err);
  }
}

/**
 * Send bot messages (WhatsApp + SMS) for an order
 */
export async function sendOrderConfirmationMessages(
  orderId: number,
  clientId: number,
  customerPhone: string,
  customerName: string,
  storeName: string,
  productName: string,
  price: number,
  confirmationLink: string,
  options?: { skipTelegram?: boolean; quantity?: number; address?: string }
): Promise<void> {
  try {
    const pool = await ensureConnection();

    // Historical issue: some clients never get a bot_settings row unless they open Bot Settings.
    // Many bot codepaths expect a row to exist, so ensure one here.
    try {
      await ensureBotSettingsRow(Number(clientId));
    } catch (e) {
      console.warn('[Bot] Failed to ensure bot_settings row:', (e as any)?.message || e);
    }

    // Stop bot completely if subscription ended or account is payment-locked.
    try {
      const lockRes = await pool.query(
        `SELECT is_locked, locked_reason, lock_type FROM clients WHERE id = $1`,
        [clientId]
      );
      if (lockRes.rows.length) {
        const row = lockRes.rows[0];
        const lockType = row.lock_type || (typeof row.locked_reason === 'string' && /(subscription|expired|payment|trial|billing)/i.test(row.locked_reason)
          ? 'payment'
          : 'critical');
        if (row.is_locked && lockType === 'payment') {
          await pool.query(
            `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = $1`,
            [clientId]
          );
          console.log(`[Bot] Client ${clientId} payment-locked; bot disabled`);
          return;
        }
      }

      // Check subscription_extended_until on clients table first (admin-granted extensions)
      let extensionOk = false;
      try {
        const extRes = await pool.query(
          `SELECT subscription_extended_until FROM clients WHERE id = $1`,
          [clientId]
        );
        if (extRes.rows.length) {
          const extRaw = extRes.rows[0].subscription_extended_until;
          if (extRaw) {
            const extensionEnds = new Date(extRaw);
            extensionOk = Number.isFinite(extensionEnds.getTime()) && new Date() < extensionEnds;
          }
        }
      } catch {
        // Column may not exist; fall through.
      }

      if (!extensionOk) {
        const subRes = await pool.query(
          `SELECT status, trial_ends_at, current_period_end FROM subscriptions WHERE user_id = $1`,
          [clientId]
        );
        if (subRes.rows.length) {
          const sub = subRes.rows[0];
          const now = new Date();
          const trialEndOk = sub.status === 'trial' && sub.trial_ends_at && now < new Date(sub.trial_ends_at);
          const activeEndOk = (sub.status === 'active' || sub.status === 'extended') && (!sub.current_period_end || now < new Date(sub.current_period_end));
          const hasAccess = trialEndOk || activeEndOk;

          if (!hasAccess) {
            await pool.query(
              `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = $1`,
              [clientId]
            );
            console.log(`[Bot] Client ${clientId} subscription ended; bot disabled`);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('[Bot] Access check failed; proceeding with enabled flag only:', (err as any)?.message || err);
    }

    // Get bot settings for this store owner
    const settingsResult = await pool.query(
      `SELECT * FROM bot_settings WHERE client_id = $1 AND enabled = true`,
      [clientId]
    );

    if (settingsResult.rows.length === 0) {
      console.log(`[Bot] Bot disabled for client ${clientId}, skipping message send`);
      return;
    }

    const settings = settingsResult.rows[0];
    const templateVariables = {
      customerName,
      storeName,
      companyName: storeName,
      productName,
      price,
      totalPrice: price,
      orderId,
      confirmationLink,
      quantity: options?.quantity || 1,
      customerPhone,
      address: options?.address || 'غير محدد',
    };

    // Telegram: schedule message if we have a token AND customer has connected to Telegram
    // Note: We no longer require provider === 'telegram' since stores may have both channels configured
    const provider = settings.provider || 'telegram';
    const effectiveTelegramToken = String(settings.telegram_bot_token || '').trim() || (isPlatformTelegramAvailable() ? getPlatformTelegramBotToken() : '');
    if (!options?.skipTelegram && effectiveTelegramToken) {
      // Check if customer has connected Telegram (has telegram_chat_id)
      const telegramConnectionRes = await pool.query(
        `SELECT telegram_chat_id FROM customer_messaging_ids 
         WHERE client_id = $1 AND customer_phone = $2 AND telegram_chat_id IS NOT NULL
         LIMIT 1`,
        [clientId, customerPhone]
      );
      
      if (telegramConnectionRes.rows.length > 0) {
        // Customer is connected to Telegram - schedule confirmation message
        const telegramMessage = replaceTemplateVariables(
          settings.template_order_confirmation || defaultWhatsAppTemplate(),
          templateVariables
        );
        const delayMinutes = settings.telegram_delay_minutes || 5;
        const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at)
           VALUES ($1, $2, $3, 'telegram', $4, $5, $6)`,
          [orderId, clientId, customerPhone, telegramMessage, confirmationLink, sendAt]
        );
        console.log(`[Bot] Telegram scheduled for ${customerPhone} at ${sendAt}`);
      } else {
        // Fallback: if the phone matches the store owner's support phone, notify the owner
        const ownerRes = await pool.query(
          `SELECT owner_telegram_chat_id, support_phone FROM bot_settings WHERE client_id = $1 LIMIT 1`,
          [clientId]
        );
        if (ownerRes.rows.length && ownerRes.rows[0].owner_telegram_chat_id) {
          const supportPhone = String(ownerRes.rows[0].support_phone || '').replace(/\D/g, '');
          if (supportPhone && supportPhone === customerPhone) {
            const telegramMessage = replaceTemplateVariables(
              settings.template_order_confirmation || defaultWhatsAppTemplate(),
              templateVariables
            );
            const delayMinutes = settings.telegram_delay_minutes || 5;
            const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
            await pool.query(
              `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at)
               VALUES ($1, $2, $3, 'telegram', $4, $5, $6)`,
              [orderId, clientId, customerPhone, telegramMessage, confirmationLink, sendAt]
            );
            console.log(`[Bot] Telegram scheduled for owner ${customerPhone} at ${sendAt}`);
          } else {
            console.log(`[Bot] Telegram enabled but customer ${customerPhone} hasn't connected - skipping Telegram messages`);
          }
        } else {
          console.log(`[Bot] Telegram enabled but customer ${customerPhone} hasn't connected - skipping Telegram messages`);
        }
      }
    }

    // Facebook Messenger: only schedule message if:
    // 1. Messenger is enabled for this store owner
    // 2. We have a valid page access token
    // 3. Customer has actually connected their Messenger account (has a messenger_psid)
    const effectiveMessengerToken = String(settings.fb_page_access_token || '').trim() || getPlatformFbPageAccessToken();
    if ((provider === 'facebook' || provider === 'messenger' || settings.messenger_enabled) && effectiveMessengerToken) {
      // Check if customer has connected Messenger (has messenger_psid)
      const messengerConnectionRes = await pool.query(
        `SELECT messenger_psid FROM customer_messaging_ids 
         WHERE client_id = $1 AND customer_phone = $2 AND messenger_psid IS NOT NULL
         LIMIT 1`,
        [clientId, customerPhone]
      );
      
      if (messengerConnectionRes.rows.length > 0) {
        // Customer is connected to Messenger - safe to create messages
        const defaultInstant = `✅ تم استلام الطلب!\n\nطلب #${orderId}\nالمنتج: {productName}\nالمجموع: {totalPrice} دج\n\nسنطلب منك التأكيد قريباً.`;
        const defaultPin = `📌 نصيحة: قم بتثبيت هذه المحادثة حتى لا تفوتك التحديثات.`;
        const defaultConfirmation = `مرحباً {customerName}!\n\nهل تؤكد طلبك من {storeName}؟\n\n📦 {productName}\n💰 {totalPrice} دج\n\nاستخدم الأزرار أدناه:`;

        const instantMessage = replaceTemplateVariables(
          String(settings.template_instant_order || defaultInstant),
          templateVariables
        );
        const pinMessage = replaceTemplateVariables(
          String(settings.template_pin_instructions || defaultPin),
          templateVariables
        );
        const confirmationMessage = replaceTemplateVariables(
          String(settings.template_order_confirmation || defaultConfirmation),
          templateVariables
        );

        const now = new Date();
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
           VALUES ($1, $2, $3, 'messenger', $4, $5)`,
          [orderId, clientId, customerPhone, instantMessage, now]
        );
        // Add 5 second delay for pin message so it arrives after the greeting
        const pinDelay = new Date(now.getTime() + 5000);
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
           VALUES ($1, $2, $3, 'messenger', $4, $5)`,
          [orderId, clientId, customerPhone, pinMessage, pinDelay]
        );

        const delayMinutes = settings.messenger_delay_minutes || 5;
        const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at)
           VALUES ($1, $2, $3, 'messenger', $4, $5, $6)`,
          [orderId, clientId, customerPhone, confirmationMessage, confirmationLink, sendAt]
        );
        console.log(`[Bot] Messenger scheduled for order ${orderId} at ${sendAt}`);
      } else {
        console.log(`[Bot] Messenger enabled but customer ${customerPhone} hasn't connected - queuing for later`);
        const defaultInstant = `✅ تم استلام الطلب!\n\nطلب #${orderId}\nالمنتج: {productName}\nالمجموع: {totalPrice} دج\n\nسنطلب منك التأكيد قريباً.`;
        const defaultPin = `📌 نصيحة: قم بتثبيت هذه المحادثة حتى لا تفوتك التحديثات.`;
        const defaultConfirmation = `مرحباً {customerName}!\n\nهل تؤكد طلبك من {storeName}؟\n\n📦 {productName}\n💰 {totalPrice} دج\n\nاستخدم الأزرار أدناه:`;

        const instantMessage = replaceTemplateVariables(String(settings.template_instant_order || defaultInstant), templateVariables);
        const pinMessage = replaceTemplateVariables(String(settings.template_pin_instructions || defaultPin), templateVariables);
        const confirmationMessage = replaceTemplateVariables(String(settings.template_order_confirmation || defaultConfirmation), templateVariables);

        const now = new Date();
        const delayMinutes = settings.messenger_delay_minutes || 5;
        const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at, error_message)
           VALUES ($1, $2, $3, 'messenger', $4, $5, 'WAITING_FOR_MESSENGER_PSID')`,
          [orderId, clientId, customerPhone, instantMessage, now]
        );
        // Add 5 second delay for pin message
        const pinDelay = new Date(now.getTime() + 5000);
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at, error_message)
           VALUES ($1, $2, $3, 'messenger', $4, $5, 'WAITING_FOR_MESSENGER_PSID')`,
          [orderId, clientId, customerPhone, pinMessage, pinDelay]
        );
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at, error_message)
           VALUES ($1, $2, $3, 'messenger', $4, $5, $6, 'WAITING_FOR_MESSENGER_PSID')`,
          [orderId, clientId, customerPhone, confirmationMessage, confirmationLink, sendAt]
        );
        console.log(`[Bot] Messenger messages queued with WAITING_FOR_MESSENGER_PSID for order ${orderId}`);
      }
    }

    // WhatsApp Cloud: schedule order confirmation messages (same pattern as Telegram/Messenger).
    // WhatsApp doesn't need pre-connect — the phone number IS the identifier.
    // We check provider (like Messenger does) OR whatsapp_enabled / whatsapp_cloud_enabled.
    const effectiveWaToken = String(settings.whatsapp_token || '').trim() || getWaAccessToken();
    const effectiveWaPhoneId = String(settings.whatsapp_phone_id || '').trim() || getWaPhoneNumberId();
    if ((provider === 'whatsapp_cloud' || provider === 'whatsapp' || settings.whatsapp_enabled || settings.whatsapp_cloud_enabled) && effectiveWaToken && effectiveWaPhoneId) {
      const defaultInstant = `✅ تم استلام الطلب!\n\nطلب #${orderId}\nالمنتج: {productName}\nالمجموع: {totalPrice} دج\n\nسنطلب منك التأكيد قريباً.`;
      const defaultConfirmation = `مرحباً {customerName}!\n\nهل تؤكد طلبك من {storeName}؟\n\n📦 {productName}\n💰 {totalPrice} دج\n\nاستخدم الأزرار أدناه:`;

      const instantMessage = replaceTemplateVariables(
        String(settings.template_instant_order || defaultInstant),
        templateVariables
      );
      const confirmationMessage = replaceTemplateVariables(
        String(settings.template_order_confirmation || defaultConfirmation),
        templateVariables
      );

      // Instant receipt — send now
      const now = new Date();
      await pool.query(
        `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
         VALUES ($1, $2, $3, 'whatsapp_cloud', $4, $5)`,
        [orderId, clientId, customerPhone, instantMessage, now]
      );

      // Delayed confirmation with buttons
      const delayMinutes = settings.whatsapp_delay_minutes || settings.telegram_delay_minutes || 5;
      const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      await pool.query(
        `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at)
         VALUES ($1, $2, $3, 'whatsapp_cloud', $4, $5, $6)`,
        [orderId, clientId, customerPhone, confirmationMessage, confirmationLink, sendAt]
      );
      console.log(`[Bot] WhatsApp Cloud scheduled for ${customerPhone} at ${sendAt}`);
    }

    // Viber: schedule order confirmation if enabled and customer has viber_user_id
    if (settings.viber_enabled && settings.viber_auth_token) {
      const viberConnectionRes = await pool.query(
        `SELECT viber_user_id FROM customer_messaging_ids
         WHERE client_id = $1 AND customer_phone = $2 AND viber_user_id IS NOT NULL
         LIMIT 1`,
        [clientId, customerPhone]
      );

      if (viberConnectionRes.rows.length > 0) {
        const defaultConfirmation = `مرحباً {customerName}!\n\nتم استلام طلبك من {storeName}:\n📦 {productName}\n💰 {totalPrice} دج\n\nرقم الطلب: #{orderId}\n\nرابط التأكيد:\n{confirmationLink}`;
        const confirmationMessage = replaceTemplateVariables(
          String(settings.template_order_confirmation || defaultConfirmation),
          templateVariables
        );
        const delayMinutes = settings.viber_delay_minutes || settings.telegram_delay_minutes || 5;
        const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at)
           VALUES ($1, $2, $3, 'viber', $4, $5, $6)`,
          [orderId, clientId, customerPhone, confirmationMessage, confirmationLink, sendAt]
        );
        console.log(`[Bot] Viber scheduled for ${customerPhone} at ${sendAt}`);
      }
    }
  } catch (error) {
    console.error("Error scheduling bot messages:", error);
    throw error;
  }
}

/**
 * Default WhatsApp/bot template (Arabic)
 */
function defaultWhatsAppTemplate(): string {
  return `مرحباً {customerName}! 🌟

شكراً لطلبك من {storeName}!

📦 تفاصيل الطلب:
• المنتج: {productName}
• السعر: {price} دج
• رقم الطلب: {orderId}

يرجى تأكيد طلبك من خلال الرابط أدناه:
{confirmationLink}

شكراً لك! 🎉`;
}

/**
 * Background job to send pending messages
 * Call this periodically (e.g., every 5 minutes)
 */
export async function processPendingMessages(): Promise<void> {
  // Use a single dedicated client for the entire batch to avoid pool exhaustion.
  // Previously each pool.query() in the loop checked out/returned a connection,
  // creating massive churn that starved other callers (e.g., getClientOrders).
  const pool = await ensureConnection();
  const client = await pool.connect();
  try {
    // Get all messages that are due to be sent (ordered by send_at and id for consistency)
    const result = await client.query(
      `SELECT * FROM bot_messages 
       WHERE status = 'pending' 
       AND send_at <= NOW()
       ORDER BY send_at ASC, id ASC
       LIMIT 100`
    );

    const isRetryableNetworkError = (err: unknown): boolean => {
      const msg = String(err || '').toLowerCase();
      return (
        msg.includes('fetch failed') ||
        msg.includes('etimedout') ||
        msg.includes('enotfound') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('socket hang up') ||
        msg.includes('network')
      );
    };

    for (const message of result.rows) {
      try {
        let sendResult;

        if (message.message_type === "whatsapp") {
          // Get WhatsApp token from bot settings (presence only; Twilio creds come from env)
          const settingsResult = await client.query(
            `SELECT whatsapp_token FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );

          if (settingsResult.rows.length > 0 && settingsResult.rows[0].whatsapp_token) {
            sendResult = await sendWhatsAppMessage(
              message.customer_phone,
              message.message_content
            );
          }
        } else if (message.message_type === 'telegram') {
          const settingsResult = await client.query(
            `SELECT telegram_bot_token FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );
          const token = String(settingsResult.rows[0]?.telegram_bot_token || '').trim() || (isPlatformTelegramAvailable() ? getPlatformTelegramBotToken() : '');
          const chatRes = await client.query(
            `SELECT telegram_chat_id FROM order_telegram_chats WHERE order_id = $1 AND client_id = $2 LIMIT 1`,
            [message.order_id, message.client_id]
          );
          const chatId = chatRes.rows[0]?.telegram_chat_id;
          if (token && chatId) {
            // If this message has a confirmation link, attach inline buttons + keep link in text.
            let replyMarkup: any = undefined;
            if (message.confirmation_link) {
              const linkRes = await client.query(
                `SELECT start_token FROM order_telegram_links WHERE order_id = $1 AND client_id = $2 ORDER BY created_at DESC LIMIT 1`,
                [message.order_id, message.client_id]
              );
              const startToken = linkRes.rows[0]?.start_token as string | undefined;
              if (startToken) {
                replyMarkup = {
                  inline_keyboard: [
                    [
                      { text: '✅ Confirm', callback_data: `approve:${startToken}` },
                      { text: '❌ Decline', callback_data: `decline:${startToken}` },
                    ],
                    [
                      { text: '✏️ Change details', url: String(message.confirmation_link) },
                      { text: '🔗 Open link', url: String(message.confirmation_link) },
                    ],
                  ],
                };
              }
            }

            const contentWithLink = message.confirmation_link
              ? `${message.message_content}\n\n🔗 If buttons don't work, open:\n${message.confirmation_link}`
              : message.message_content;

            sendResult = await sendTelegramMessage(token, chatId, contentWithLink, replyMarkup ? { reply_markup: replyMarkup } : undefined);
          } else {
            // Customer hasn't linked Telegram yet; retry later instead of failing.
            await client.query(
              `UPDATE bot_messages SET send_at = NOW() + INTERVAL '5 minutes', error_message = $1, updated_at = NOW() WHERE id = $2`,
              ['WAITING_FOR_TELEGRAM_CHAT', message.id]
            );
            continue;
          }
        } else if (message.message_type === 'viber') {
          const settingsResult = await client.query(
            `SELECT viber_auth_token, viber_sender_name FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );
          const token = settingsResult.rows[0]?.viber_auth_token;
          const senderName = settingsResult.rows[0]?.viber_sender_name;
          const idRes = await client.query(
            `SELECT viber_user_id FROM customer_messaging_ids WHERE client_id = $1 AND customer_phone = $2`,
            [message.client_id, message.customer_phone]
          );
          const receiverId = idRes.rows[0]?.viber_user_id;
          if (token && receiverId) {
            sendResult = await sendViberMessage(token, receiverId, message.message_content, senderName);
          }
        } else if (message.message_type === 'whatsapp_cloud') {
          // WhatsApp Cloud API handling — phone number IS the recipient
          const settingsResult = await client.query(
            `SELECT whatsapp_phone_id, whatsapp_token FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );
          const phoneNumberId = String(settingsResult.rows[0]?.whatsapp_phone_id || '').trim() || getWaPhoneNumberId();
          const accessToken = String(settingsResult.rows[0]?.whatsapp_token || '').trim() || getWaAccessToken();

          if (!accessToken || !phoneNumberId) {
            await client.query(
              `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
              ['MISSING_WHATSAPP_CLOUD_CREDENTIALS', message.id]
            );
            continue;
          }

          // If this is a confirmation message (has confirmation_link), send with interactive buttons
          if (message.confirmation_link) {
            sendResult = await sendWhatsAppCloudOrderConfirmation(accessToken, phoneNumberId, message.customer_phone, {
              text: String(message.message_content || ''),
              orderId: Number(message.order_id),
            });
          } else {
            sendResult = await sendWhatsAppCloudMessage(accessToken, phoneNumberId, message.customer_phone, message.message_content);
          }
    } else if (message.message_type === 'messenger') {
      // Facebook Messenger handling
      const settingsResult = await client.query(
        `SELECT fb_page_access_token FROM bot_settings WHERE client_id = $1`,
        [message.client_id]
      );
      const row = settingsResult.rows[0];
      const pageAccessToken = String(row?.fb_page_access_token || '').trim() || getPlatformFbPageAccessToken();

      if (pageAccessToken) {
        // Standard Graph API path
        let psid: string | null = null;
        const orderChatRes = await client.query(
          `SELECT messenger_psid FROM order_messenger_chats WHERE order_id = $1 AND client_id = $2 LIMIT 1`,
          [message.order_id, message.client_id]
        );
        psid = orderChatRes.rows[0]?.messenger_psid;
        if (!psid) {
          const idRes = await client.query(
            `SELECT messenger_psid FROM customer_messaging_ids WHERE client_id = $1 AND customer_phone = $2`,
            [message.client_id, message.customer_phone]
          );
          psid = idRes.rows[0]?.messenger_psid;
        }
        if (psid) {
          if (message.confirmation_link) {
            sendResult = await sendMessengerOrderConfirmationDirect(pageAccessToken, psid, {
              text: String(message.message_content || ''),
              orderId: Number(message.order_id),
            });
          } else {
            sendResult = await sendMessengerMessageDirect(pageAccessToken, psid, message.message_content);
          }
        } else {
          await client.query(
            `UPDATE bot_messages SET send_at = NOW() + INTERVAL '5 minutes', error_message = $1, updated_at = NOW() WHERE id = $2`,
            ['WAITING_FOR_MESSENGER_PSID', message.id]
          );
          continue;
        }
      } else {
        await client.query(
          `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
          ['MISSING_MESSENGER_PAGE_ACCESS_TOKEN', message.id]
        );
        continue;
      }
    }

        // Update message status
        if (sendResult?.success) {
          await client.query(
            `UPDATE bot_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [message.id]
          );
        } else {
          // If we cannot reach the provider (transient network/DNS issue), retry later instead of failing permanently.
          // Applies to ALL platforms, not just Messenger.
          if (isRetryableNetworkError(sendResult?.error)) {
            await client.query(
              `UPDATE bot_messages
               SET send_at = NOW() + INTERVAL '5 minutes',
                   status = 'pending',
                   error_message = $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [sendResult?.error || 'NETWORK_ERROR', message.id]
            );
          } else {
            await client.query(
              `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
              [sendResult?.error || "Unknown error", message.id]
            );
          }
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        try {
          await client.query(
            `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
            [error instanceof Error ? error.message : String(error), message.id]
          );
        } catch { /* ignore — client may be broken */ }
      }
    }

    console.log(`[Bot] Processed ${result.rows.length} pending messages`);
  } catch (error) {
    console.error("Error in processPendingMessages:", error);
  } finally {
    client.release();
  }
}

let botMessageWorkerInterval: ReturnType<typeof setInterval> | null = null;

export function startBotMessageWorker(options?: { intervalMs?: number }): void {
  if (botMessageWorkerInterval) {
    console.log('[BotMessages] Worker already running');
    return;
  }

  const intervalMs = Math.max(5_000, Number(options?.intervalMs ?? 30_000));
  console.log(`[BotMessages] Starting worker (${Math.round(intervalMs / 1000)}s interval)`);

  // Run immediately on start
  processPendingMessages().catch((err) => console.error('[BotMessages] Worker error:', err));

  botMessageWorkerInterval = setInterval(() => {
    processPendingMessages().catch((err) => console.error('[BotMessages] Worker error:', err));
  }, intervalMs);
}

export function stopBotMessageWorker(): void {
  if (!botMessageWorkerInterval) return;
  clearInterval(botMessageWorkerInterval);
  botMessageWorkerInterval = null;
  console.log('[BotMessages] Worker stopped');
}

/**
 * Background job to archive old declined orders and pending orders
 * - Declined orders → move to archived after 24 hours
 * - Pending orders (no response) → stay visible but marked as "awaiting response"
 * - Expired confirmation links → allow resending
 */
export async function cleanupOldOrders(): Promise<void> {
  try {
    const pool = await ensureConnection();
    // Archive declined orders older than 24 hours
    const declinedResult = await pool.query(
      `UPDATE store_orders 
       SET status = 'cancelled', updated_at = NOW()
       WHERE status = 'declined' 
       AND updated_at < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );

    console.log(`[Cleanup] Archived ${declinedResult.rows.length} declined orders`);

    // Extend/renew confirmation links for pending orders (optional - for resending messages)
    const expiredLinksResult = await pool.query(
      `SELECT COUNT(*) FROM confirmation_links 
       WHERE expires_at < NOW() AND accessed_at IS NULL`
    );

    console.log(`[Cleanup] Found ${expiredLinksResult.rows[0].count} expired unaccessed confirmation links`);
  } catch (error) {
    console.error("Error in cleanupOldOrders:", error);
  }
}
