/**
 * WhatsApp Cloud API Integration Routes
 *
 * Handles:
 * - Webhook verification (GET /api/whatsapp/webhook)
 * - Incoming messages (POST /api/whatsapp/webhook)
 * - Sending messages via WhatsApp Cloud API
 *
 * Config env vars (platform-level):
 *   WHATSAPP_PHONE_NUMBER_ID   — The phone number ID from Meta
 *   WHATSAPP_ACCESS_TOKEN      — Permanent system user token
 *   WHATSAPP_VERIFY_TOKEN      — Webhook verification token
 *   WHATSAPP_BUSINESS_ACCOUNT_ID — WABA ID (for status display)
 */

import { Router, RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';
import crypto from 'crypto';
import { handleCustomerMessage } from '../services/customer-ai';
import { logSecurityEvent } from '../utils/security';

const router = Router();

// ─── Env (read lazily) ──────────────────────────────────────────
function getWaPhoneNumberId() { return String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(); }
function getWaAccessToken() { return String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(); }
function getWaVerifyToken() { return String(process.env.WHATSAPP_VERIFY_TOKEN || 'sahla4eco_wa_verify').trim(); }
function getWaBusinessAccountId() { return String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim(); }
function getFbAppSecret() { return String(process.env.FB_APP_SECRET || '').trim(); }

/**
 * Verify request signature from Meta (same HMAC as Messenger)
 */
function verifyWaSignature(req: any): boolean {
  if (!getFbAppSecret()) return true;

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const signatureValue = Array.isArray(signature) ? signature[0] : signature;
  if (typeof signatureValue !== 'string' || !signatureValue.startsWith('sha256=')) return false;

  const rawBody: Buffer = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(JSON.stringify(req.body ?? {}));

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', getFbAppSecret())
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(signatureValue);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Webhook Verification ───────────────────────────────────────
const verifyWebhook: RequestHandler = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[WhatsApp] Webhook verification attempt:', { mode, hasToken: !!token, hasChallenge: !!challenge });

  const tokenStr = typeof token === 'string' ? token : Array.isArray(token) ? token[0] : '';

  if (mode === 'subscribe' && tokenStr === getWaVerifyToken()) {
    console.log('[WhatsApp] Webhook verified successfully');
    res.set('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp] Webhook verification failed');
  return res.sendStatus(403);
};

// ─── Webhook Handler (Incoming Messages) ────────────────────────
const handleWebhook: RequestHandler = async (req, res) => {
  // Always respond 200 immediately to prevent retries
  res.sendStatus(200);

  // Verify signature
  if (getFbAppSecret() && !verifyWaSignature(req)) {
    console.warn('[WhatsApp] Invalid signature, ignoring');
    return;
  }

  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    return;
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = value?.messages || [];
      const contacts = value?.contacts || [];
      const statuses = value?.statuses || [];

      // Handle status updates (delivered, read, etc.)
      for (const status of statuses) {
        console.log(`[WhatsApp] Status update: ${status.id} → ${status.status}`);
      }

      // Handle incoming messages
      for (const msg of messages) {
        const from = msg.from; // Sender's phone number (e.g. "213555123456")
        const msgType = msg.type;
        const contactName = contacts.find((c: any) => c.wa_id === from)?.profile?.name || '';

        // Only handle text messages for now
        if (msgType === 'text' && msg.text?.body) {
          await handleWhatsAppMessage(phoneNumberId, from, msg.text.body, contactName);
        } else if (msgType === 'interactive') {
          // Handle button replies
          const buttonId = msg.interactive?.button_reply?.id || '';
          const buttonTitle = msg.interactive?.button_reply?.title || '';
          if (buttonId) {
            await handleWhatsAppButton(phoneNumberId, from, buttonId, buttonTitle);
          }
        } else {
          console.log(`[WhatsApp] Unsupported message type: ${msgType} from ${from}`);
        }
      }
    }
  }
};

/**
 * Handle incoming WhatsApp text message.
 * Resolves the client (store) from the phone number ID, then uses AI auto-reply.
 */
async function handleWhatsAppMessage(phoneNumberId: string, from: string, text: string, contactName: string) {
  console.log(`[WhatsApp] Message from ${from} (${contactName}): ${text}`);

  try {
    const pool = await ensureConnection();

    // Resolve client: check bot_settings for whatsapp_phone_id match, 
    // or fall back to platform-level phone number
    let clientId: number | null = null;
    let accessToken = getWaAccessToken(); // platform-level token

    // Priority 1: per-store phone number ID match
    const storeRes = await pool.query(
      `SELECT client_id, whatsapp_token FROM bot_settings
       WHERE whatsapp_phone_id = $1 AND enabled = true
       LIMIT 1`,
      [phoneNumberId]
    );
    if (storeRes.rows.length) {
      clientId = Number(storeRes.rows[0].client_id);
      // Use per-store token if available
      const storeToken = String(storeRes.rows[0].whatsapp_token || '').trim();
      if (storeToken) accessToken = storeToken;
    }

    if (!accessToken) {
      console.warn('[WhatsApp] No access token configured (neither env var nor store DB)');
      return;
    }

    // Priority 2: platform phone number — customer_messaging_ids (customers with orders)
    // Checked BEFORE subscribers so a customer who ordered from a store gets routed there,
    // not to a different store they casually messaged earlier.
    if (!clientId && phoneNumberId === getWaPhoneNumberId()) {
      const custRes = await pool.query(
        `SELECT client_id FROM customer_messaging_ids
         WHERE customer_phone LIKE $1
         ORDER BY updated_at DESC LIMIT 1`,
        [`%${from.slice(-9)}`]
      );
      if (custRes.rows.length) {
        clientId = Number(custRes.rows[0].client_id);
      }
    }

    // Priority 3: subscriber mapping (last casual interaction)
    if (!clientId) {
      const subRes = await pool.query(
        `SELECT client_id FROM whatsapp_subscribers
         WHERE wa_phone = $1
         ORDER BY last_interaction DESC
         LIMIT 1`,
        [from]
      );
      if (subRes.rows.length) {
        clientId = Number(subRes.rows[0].client_id);
      }
    }

    if (!clientId) {
      console.log(`[WhatsApp] No client mapping for phone ${from} on number ${phoneNumberId}`);
      // Send a generic reply
      await sendWhatsAppTextMessage(accessToken, phoneNumberId, from,
        'مرحباً! 👋 شكراً لتواصلك معنا. سيتم الرد عليك قريباً.');
      return;
    }

    // Save/update subscriber record
    await pool.query(
      `INSERT INTO whatsapp_subscribers (client_id, wa_phone, customer_name, last_interaction)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (client_id, wa_phone)
       DO UPDATE SET customer_name = COALESCE(NULLIF($3, ''), whatsapp_subscribers.customer_name),
                     last_interaction = NOW()`,
      [clientId, from, contactName]
    );

    // Mark message as read
    await markWhatsAppRead(accessToken, phoneNumberId, from);

    // Try AI auto-reply
    const aiResponse = await handleCustomerMessage(clientId, 'whatsapp', from, text);
    if (aiResponse) {
      await sendWhatsAppTextMessage(accessToken, phoneNumberId, from, aiResponse);
      return;
    }

    // Fallback
    const nameRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    const storeName = nameRes.rows[0]?.store_name || 'المتجر';

    await sendWhatsAppTextMessage(accessToken, phoneNumberId, from,
      `مرحباً بك في ${storeName}! 👋\n\nسيتم الرد عليك في أقرب وقت.`);
  } catch (err) {
    console.error('[WhatsApp] Message handler error:', err);
  }
}

/**
 * Handle WhatsApp interactive button replies
 */
async function handleWhatsAppButton(phoneNumberId: string, from: string, buttonId: string, buttonTitle: string) {
  console.log(`[WhatsApp] Button reply from ${from}: ${buttonId} (${buttonTitle})`);

  try {
    const pool = await ensureConnection();
    const accessToken = getWaAccessToken();
    if (!accessToken) return;

    // Handle order confirmation/cancellation buttons
    if (buttonId.startsWith('confirm_order_') || buttonId.startsWith('cancel_order_')) {
      const orderId = parseInt(buttonId.replace(/^(confirm|cancel)_order_/, ''), 10);
      if (!Number.isFinite(orderId) || orderId <= 0) return;

      const orderRes = await pool.query(
        `SELECT id, client_id, status FROM store_orders WHERE id = $1 LIMIT 1`,
        [orderId]
      );
      if (!orderRes.rows.length) return;

      const order = orderRes.rows[0];
      if (order.status !== 'pending') {
        await sendWhatsAppTextMessage(accessToken, phoneNumberId, from,
          `هذا الطلب تمت معالجته مسبقاً (الحالة: ${order.status}).`);
        return;
      }

      const newStatus = buttonId.startsWith('confirm_') ? 'confirmed' : 'cancelled';
      const upd = await pool.query(
        `UPDATE store_orders SET status = $1, updated_at = NOW()
         WHERE id = $2 AND status = 'pending' RETURNING *`,
        [newStatus, orderId]
      );

      if (upd.rows.length) {
        const responseType = newStatus === 'confirmed' ? 'approved' : 'declined';
        await pool.query(
          `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
           SELECT $1, $2, $3, 'whatsapp', NOW()
           WHERE NOT EXISTS (SELECT 1 FROM order_confirmations WHERE order_id = $1 AND client_id = $2)`,
          [orderId, order.client_id, responseType]
        );

        if ((global as any).broadcastOrderUpdate) {
          (global as any).broadcastOrderUpdate(upd.rows[0]);
        }

        const emoji = newStatus === 'confirmed' ? '✅' : '❌';
        const msg = newStatus === 'confirmed'
          ? `${emoji} تم تأكيد طلبك #${orderId}. شكراً لك!`
          : `${emoji} تم إلغاء طلبك #${orderId}.`;
        await sendWhatsAppTextMessage(accessToken, phoneNumberId, from, msg);
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Button handler error:', err);
  }
}

// ─── WhatsApp Cloud API Send Functions ──────────────────────────

/**
 * Send a text message via WhatsApp Cloud API
 */
export async function sendWhatsAppTextMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
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

    const data: any = await response.json();
    if (!response.ok || data.error) {
      console.error('[WhatsApp] Send failed:', data.error || data);
      return { success: false, error: data.error?.message || `Send failed (${response.status})` };
    }

    const msgId = data.messages?.[0]?.id;
    console.log(`[WhatsApp] Message sent to ${to}: ${msgId}`);
    return { success: true, messageId: msgId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WhatsApp] Failed to send: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send an interactive button message (for order confirmations)
 */
export async function sendWhatsAppOrderConfirmation(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  orderDetails: {
    orderId: number;
    customerName: string;
    storeName: string;
    productName: string;
    price: number;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { orderId, customerName, storeName, productName, price } = orderDetails;

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `مرحباً ${customerName}! 👋\n\nتم استلام طلبك من ${storeName}:\n\n📦 طلب #${orderId}\n🛍️ ${productName}\n💰 ${price} دج\n\nيرجى تأكيد طلبك:`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `confirm_order_${orderId}`, title: '✅ تأكيد' } },
            { type: 'reply', reply: { id: `cancel_order_${orderId}`, title: '❌ إلغاء' } },
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

    const data: any = await response.json();
    if (!response.ok || data.error) {
      console.error('[WhatsApp] Order confirmation send failed:', data.error || data);
      return { success: false, error: data.error?.message || `Send failed (${response.status})` };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Mark a message as read
 */
async function markWhatsAppRead(accessToken: string, phoneNumberId: string, from: string): Promise<void> {
  try {
    // WhatsApp Cloud API doesn't have a direct "mark read" by phone — it uses message_id.
    // We send a "typing" action instead to show presence.
  } catch {
    // Non-critical
  }
}

/**
 * GET /api/whatsapp/config — Status of WhatsApp Cloud API configuration
 */
const getConfig: RequestHandler = (_req, res) => {
  const configured = !!getWaPhoneNumberId() && !!getWaAccessToken();
  res.json({
    configured,
    phoneNumberId: getWaPhoneNumberId() ? '••••' + getWaPhoneNumberId().slice(-4) : null,
    businessAccountId: getWaBusinessAccountId() ? '••••' + getWaBusinessAccountId().slice(-4) : null,
    verifyTokenSet: !!getWaVerifyToken(),
  });
};

/**
 * POST /api/whatsapp/test-connection — Test user-provided WhatsApp credentials
 */
const testConnection: RequestHandler = async (req, res) => {
  try {
    const { phoneId, token } = req.body;
    
    if (!phoneId || !token) {
      return res.status(400).json({ success: false, error: 'Missing phoneId or token' });
    }

    // Test by fetching phone number info from WhatsApp Cloud API
    const response = await fetch(`https://graph.facebook.com/v25.0/${phoneId}?fields=verified_name,display_phone_number`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('[WhatsApp] Test connection response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      return res.json({ 
        success: true, 
        phoneNumberName: data.verified_name || data.display_phone_number 
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      return res.status(400).json({ 
        success: false, 
        error: errorData.error?.message || 'Invalid credentials' 
      });
    }
  } catch (error) {
    console.error('[WhatsApp] Test connection error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to test connection' 
    });
  }
};

// Register routes
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);
router.get('/config', getConfig);
router.post('/test-connection', testConnection);

export default router;
