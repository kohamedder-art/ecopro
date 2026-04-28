import { randomBytes } from 'crypto';
import https from 'https';
import { ensureConnection } from "./database";
import { ensureBotSettingsRow } from './client-provisioning';

function getPlatformFbPageAccessToken() { return String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim(); }

function getPlatformTelegramBotToken() { return String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim(); }
function getPlatformTelegramBotUsername() { return String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim(); }
function isPlatformTelegramAvailable() { return !!getPlatformTelegramBotToken() && !!getPlatformTelegramBotUsername(); }

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
              whatsapp_enabled, telegram_enabled, viber_enabled, messenger_enabled
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
      order_id: String(orderId),
      event_label: eventLabel,
      description: description || '',
      location_line: locationLine,
      tracking_number: trackingNumber,
      event_type: eventType,
    });

    const channels: Array<'whatsapp' | 'telegram' | 'viber' | 'messenger'> = [];
    if (bs.whatsapp_enabled) channels.push('whatsapp');
    if (bs.telegram_enabled) channels.push('telegram');
    if (bs.viber_enabled) channels.push('viber');
    if (bs.messenger_enabled) channels.push('messenger');

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
  options?: { skipTelegram?: boolean }
): Promise<void> {
  try {
    const pool = await ensureConnection();

    // Historical issue: some clients never get a bot_settings row unless they open Bot Settings.
    // Many bot codepaths expect a row to exist, so ensure one here.
    try {
      await ensureBotSettingsRow(Number(clientId), { enabled: true });
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
      confirmationLink
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
        console.log(`[Bot] Telegram enabled but customer ${customerPhone} hasn't connected - skipping Telegram messages`);
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
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at)
           VALUES ($1, $2, $3, 'messenger', $4, $5)`,
          [orderId, clientId, customerPhone, pinMessage, now]
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
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at, error_message)
           VALUES ($1, $2, $3, 'messenger', $4, $5, 'WAITING_FOR_MESSENGER_PSID')`,
          [orderId, clientId, customerPhone, pinMessage, now]
        );
        await pool.query(
          `INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at, error_message)
           VALUES ($1, $2, $3, 'messenger', $4, $5, $6, 'WAITING_FOR_MESSENGER_PSID')`,
          [orderId, clientId, customerPhone, confirmationMessage, confirmationLink, sendAt]
        );
        console.log(`[Bot] Messenger messages queued with WAITING_FOR_MESSENGER_PSID for order ${orderId}`);
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
  try {
    const pool = await ensureConnection();
    // Get all messages that are due to be sent
    const result = await pool.query(
      `SELECT * FROM bot_messages 
       WHERE status = 'pending' 
       AND send_at <= NOW()
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
          const settingsResult = await pool.query(
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
          const settingsResult = await pool.query(
            `SELECT telegram_bot_token FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );
          const token = String(settingsResult.rows[0]?.telegram_bot_token || '').trim() || (isPlatformTelegramAvailable() ? getPlatformTelegramBotToken() : '');
          const chatRes = await pool.query(
            `SELECT telegram_chat_id FROM order_telegram_chats WHERE order_id = $1 AND client_id = $2 LIMIT 1`,
            [message.order_id, message.client_id]
          );
          const chatId = chatRes.rows[0]?.telegram_chat_id;
          if (token && chatId) {
            // If this message has a confirmation link, attach inline buttons + keep link in text.
            let replyMarkup: any = undefined;
            if (message.confirmation_link) {
              const linkRes = await pool.query(
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
              ? `${message.message_content}\n\n🔗 If buttons don’t work, open:\n${message.confirmation_link}`
              : message.message_content;

            sendResult = await sendTelegramMessage(token, chatId, contentWithLink, replyMarkup ? { reply_markup: replyMarkup } : undefined);
          } else {
            // Customer hasn't linked Telegram yet; retry later instead of failing.
            await pool.query(
              `UPDATE bot_messages SET send_at = NOW() + INTERVAL '5 minutes', error_message = $1, updated_at = NOW() WHERE id = $2`,
              ['WAITING_FOR_TELEGRAM_CHAT', message.id]
            );
            continue;
          }
        } else if (message.message_type === 'viber') {
          const settingsResult = await pool.query(
            `SELECT viber_auth_token, viber_sender_name FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );
          const token = settingsResult.rows[0]?.viber_auth_token;
          const senderName = settingsResult.rows[0]?.viber_sender_name;
          const idRes = await pool.query(
            `SELECT viber_user_id FROM customer_messaging_ids WHERE client_id = $1 AND customer_phone = $2`,
            [message.client_id, message.customer_phone]
          );
          const receiverId = idRes.rows[0]?.viber_user_id;
          if (token && receiverId) {
            sendResult = await sendViberMessage(token, receiverId, message.message_content, senderName);
          }
        } else if (message.message_type === 'messenger') {
          // Facebook Messenger handling
          const settingsResult = await pool.query(
            `SELECT fb_page_access_token FROM bot_settings WHERE client_id = $1`,
            [message.client_id]
          );
          const pageAccessToken = String(settingsResult.rows[0]?.fb_page_access_token || '').trim() || getPlatformFbPageAccessToken();

          if (!pageAccessToken) {
            await pool.query(
              `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
              ['MISSING_MESSENGER_PAGE_ACCESS_TOKEN', message.id]
            );
            continue;
          }
          
          // Try to get PSID from order_messenger_chats first, then customer_messaging_ids
          let psid: string | null = null;
          
          const orderChatRes = await pool.query(
            `SELECT messenger_psid FROM order_messenger_chats WHERE order_id = $1 AND client_id = $2 LIMIT 1`,
            [message.order_id, message.client_id]
          );
          psid = orderChatRes.rows[0]?.messenger_psid;
          
          if (!psid) {
            const idRes = await pool.query(
              `SELECT messenger_psid FROM customer_messaging_ids WHERE client_id = $1 AND customer_phone = $2`,
              [message.client_id, message.customer_phone]
            );
            psid = idRes.rows[0]?.messenger_psid;
          }
          
          if (pageAccessToken && psid) {
            if (message.confirmation_link) {
              sendResult = await sendMessengerOrderConfirmationDirect(pageAccessToken, psid, {
                text: String(message.message_content || ''),
                orderId: Number(message.order_id),
              });
            } else {
              sendResult = await sendMessengerMessageDirect(pageAccessToken, psid, message.message_content);
            }
          } else {
            // Customer hasn't connected Messenger yet; retry later
            await pool.query(
              `UPDATE bot_messages SET send_at = NOW() + INTERVAL '5 minutes', error_message = $1, updated_at = NOW() WHERE id = $2`,
              ['WAITING_FOR_MESSENGER_PSID', message.id]
            );
            continue;
          }
        }

        // Update message status
        if (sendResult?.success) {
          await pool.query(
            `UPDATE bot_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [message.id]
          );
        } else {
          // If we cannot reach the provider (transient network/DNS issue), retry later instead of failing permanently.
          if (message.message_type === 'messenger' && isRetryableNetworkError(sendResult?.error)) {
            await pool.query(
              `UPDATE bot_messages
               SET send_at = NOW() + INTERVAL '5 minutes',
                   status = 'pending',
                   error_message = $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [sendResult?.error || 'NETWORK_ERROR', message.id]
            );
          } else {
            await pool.query(
              `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
              [sendResult?.error || "Unknown error", message.id]
            );
          }
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        const pool = await ensureConnection();
        await pool.query(
          `UPDATE bot_messages SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
          [error instanceof Error ? error.message : String(error), message.id]
        );
      }
    }

    console.log(`[Bot] Processed ${result.rows.length} pending messages`);
  } catch (error) {
    console.error("Error in processPendingMessages:", error);
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
