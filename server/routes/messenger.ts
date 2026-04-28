/**
 * Facebook Messenger Integration Routes
 * 
 * Handles:
 * - Webhook verification (GET /api/messenger/webhook)
 * - Incoming messages (POST /api/messenger/webhook)
 * - Sending order confirmations via Messenger
 */

import { Router, RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';
import crypto from 'crypto';
import { replaceTemplateVariables } from '../utils/bot-messaging';
import { getPublicBaseUrl } from '../utils/public-url';
import { logSecurityEvent } from '../utils/security';
import { handleCustomerMessage } from '../services/ai-customer';
import { decryptData } from '../utils/encryption';

const router = Router();

// Environment variables – read lazily so dotenv has loaded by the time they're accessed
function getFbVerifyToken() { return process.env.FB_MESSENGER_VERIFY_TOKEN || 'ecopro_messenger_verify'; }
function getFbAppSecret() { return process.env.FB_APP_SECRET || ''; }

// Optional platform-wide fallback page (shared) for stores without their own Page.
// NOTE: Page Access Token is secret; never expose it via public endpoints.
function getPlatformFbPageId() { return String(process.env.PLATFORM_FB_PAGE_ID || '').trim(); }
function getPlatformFbPageAccessToken() { return String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim(); }
function getPlatformMessengerEnabled() {
  return String(process.env.PLATFORM_MESSENGER_ENABLED || '').toLowerCase() === 'true' ||
    (!!getPlatformFbPageId() && !!getPlatformFbPageAccessToken());
}

function isPlatformPage(pageId: string): boolean {
  return !!getPlatformFbPageId() && String(pageId) === getPlatformFbPageId();
}

function resolveEffectivePageConfig(botRow: any, oauthToken?: string): { enabled: boolean; pageId: string; pageAccessToken: string; usingPlatform: boolean; reason?: string } {
  const storePageId = botRow?.fb_page_id ? String(botRow.fb_page_id).trim() : '';
  const storeToken = botRow?.fb_page_access_token ? String(botRow.fb_page_access_token).trim() : '';

  // Priority 1: OAuth token from facebook_tokens table (encrypted, auto-refreshable)
  if (storePageId && oauthToken) {
    return { enabled: true, pageId: storePageId, pageAccessToken: oauthToken, usingPlatform: false };
  }

  // Priority 2: Platform shared Page
  // If the store is configured to use the platform shared Page, always use the platform env token.
  // This ensures one token is used for all stores and avoids stale per-store tokens causing OAuth 190.
  if (storePageId && getPlatformMessengerEnabled() && storePageId === getPlatformFbPageId() && getPlatformFbPageAccessToken()) {
    return { enabled: true, pageId: getPlatformFbPageId(), pageAccessToken: getPlatformFbPageAccessToken(), usingPlatform: true };
  }

  if (storePageId && storeToken) {
    return { enabled: true, pageId: storePageId, pageAccessToken: storeToken, usingPlatform: false };
  }

  if (getPlatformMessengerEnabled() && getPlatformFbPageId() && getPlatformFbPageAccessToken()) {
    return { enabled: true, pageId: getPlatformFbPageId(), pageAccessToken: getPlatformFbPageAccessToken(), usingPlatform: true };
  }

  return {
    enabled: false,
    pageId: storePageId,
    pageAccessToken: '',
    usingPlatform: false,
    reason: storePageId && !storeToken ? 'missing_page_access_token' : 'missing_page_config',
  };
}

async function tryLinkPlatformSenderToLatestToken(
  pool: any,
  params: { pageId: string; senderId: string }
): Promise<{ clientId: number; storeName: string; customerPhone: string } | null> {
  // Find the most recent pending preconnect token for this platform page.
  const candidateRes = await pool.query(
    `SELECT client_id, customer_phone, ref_token
     FROM messenger_preconnect_tokens
     WHERE page_id = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [String(params.pageId)]
  );

  if (candidateRes.rows.length === 0) return null;

  const row = candidateRes.rows[0];
  const clientId = Number(row.client_id);
  const customerPhone = String(row.customer_phone);
  const refToken = String(row.ref_token);
  if (!clientId || !customerPhone || !refToken) return null;

  await pool.query(
    `INSERT INTO customer_messaging_ids (client_id, customer_phone, messenger_psid, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (client_id, customer_phone)
     DO UPDATE SET messenger_psid = EXCLUDED.messenger_psid, updated_at = NOW()`,
    [clientId, customerPhone, String(params.senderId)]
  );

  await pool.query(
    `INSERT INTO messenger_subscribers (client_id, psid, page_id, customer_phone, subscribed_at, last_interaction)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (client_id, psid)
     DO UPDATE SET page_id = EXCLUDED.page_id, customer_phone = EXCLUDED.customer_phone, last_interaction = NOW()`,
    [clientId, String(params.senderId), String(params.pageId), customerPhone]
  );

  await pool.query(
    `UPDATE messenger_preconnect_tokens SET used_at = NOW() WHERE ref_token = $1`,
    [refToken]
  );

  // Release queued bot_messages that were waiting for PSID
  try {
    await pool.query(
      `UPDATE bot_messages
       SET send_at = NOW(),
           status = 'pending',
           error_message = NULL,
           updated_at = NOW()
       WHERE client_id = $1
         AND customer_phone = $2
         AND message_type = 'messenger'
         AND status = 'pending'
         AND error_message = 'WAITING_FOR_MESSENGER_PSID'`,
      [clientId, customerPhone]
    );
  } catch (e) {
    console.warn('[Messenger] Failed to release queued bot_messages in tryLink:', (e as any)?.message || e);
  }

  const storeRes = await pool.query(
    `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );

  console.log(`[Messenger] tryLink: linked PSID ${params.senderId} to phone ${customerPhone} for client ${clientId}`);

  return {
    clientId,
    storeName: storeRes.rows[0]?.store_name || 'Store',
    customerPhone,
  };
}

/**
 * Generate a unique ref token for Messenger preconnect
 */
function generateMessengerRefToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * GET /api/messenger/page-link/:storeSlug
 * Public endpoint: returns Messenger chat link for a store if enabled.
 * Optionally generates a preconnect token when phone is provided.
 */
export const getMessengerPageLink: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params as any;
    const { phone } = req.query;
    const pool = await ensureConnection();

    const storeRes = await pool.query(
      `SELECT client_id, store_name
       FROM client_store_settings
       WHERE store_slug = $1
          OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)
       LIMIT 1`,
      [storeSlug]
    );

    if (storeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const clientId = Number(storeRes.rows[0].client_id);
    const storeName = storeRes.rows[0].store_name || 'EcoPro Store';

    const botRes = await pool.query(
      `SELECT messenger_enabled, fb_page_id, fb_page_access_token
       FROM bot_settings
       WHERE client_id = $1
       LIMIT 1`,
      [clientId]
    );

    if (botRes.rows.length === 0) {
      return res.json({ enabled: false });
    }

    // Check for OAuth token from facebook_tokens (higher priority)
    let oauthPageToken: string | undefined;
    try {
      const oauthRes = await pool.query(
        `SELECT page_access_token_encrypted FROM facebook_tokens WHERE client_id = $1 AND is_active = TRUE`,
        [clientId]
      );
      if (oauthRes.rows.length && oauthRes.rows[0].page_access_token_encrypted) {
        oauthPageToken = decryptData(oauthRes.rows[0].page_access_token_encrypted);
      }
    } catch { /* OAuth lookup is best-effort */ }

    const effective = resolveEffectivePageConfig(botRes.rows[0], oauthPageToken);
    if (!effective.enabled || !effective.pageId || !effective.pageAccessToken) {
      return res.json({
        enabled: false,
        ...(effective.reason ? { reason: effective.reason } : {}),
      });
    }

    const pageId = effective.pageId;
    const usingPlatform = effective.usingPlatform;

    let messengerUrl = `https://m.me/${encodeURIComponent(pageId)}`;
    let refToken = '';

    // Generate preconnect token if phone is provided
    if (phone) {
      const normalizedPhone = String(phone).replace(/\D/g, '');
      if (normalizedPhone.length >= 9) {
        refToken = generateMessengerRefToken();
        
        // Store preconnect token
        await pool.query(
          `INSERT INTO messenger_preconnect_tokens (client_id, customer_phone, ref_token, page_id, created_at, expires_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '24 hours')
           ON CONFLICT (client_id, customer_phone)
           DO UPDATE SET ref_token = $3, page_id = $4, created_at = NOW(), expires_at = NOW() + INTERVAL '24 hours', used_at = NULL`,
          [clientId, normalizedPhone, refToken, pageId]
        );

        // Add ref parameter for tracking
        messengerUrl = `https://m.me/${encodeURIComponent(pageId)}?ref=${encodeURIComponent(refToken)}`;

        // Ensure "Get Started" button is configured — ref tokens only work via the
        // GET_STARTED postback, so this must be set up at least once per page.
        setupGetStartedButton(effective.pageAccessToken).catch(() => {});
      }
    }

    return res.json({
      enabled: true,
      storeName,
      pageId,
      url: messengerUrl,
      refToken: refToken || undefined,
      usingPlatform,
      instructions: {
        ar: 'اضغط على الزر لفتح Messenger وبدء محادثة. ثم ارجع هنا لإتمام طلبك وستتلقى التأكيد مباشرة!',
        en: 'اضغط على الزر لفتح Messenger وبدء محادثة. ثم ارجع هنا لإتمام طلبك وستتلقى التأكيد مباشرة!'
      }
    });
  } catch (error) {
    console.error('[Messenger] Failed to get page link:', error);
    return res.status(500).json({ error: 'Failed to fetch Messenger link' });
  }
};

/**
 * GET /api/messenger/check-connection/:storeSlug
 * Check if customer has connected their Messenger
 */
export const checkMessengerConnection: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const { phone } = req.query;

    if (!storeSlug || !phone) {
      return res.json({ connected: false });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length < 9) {
      return res.json({ connected: false });
    }

    const pool = await ensureConnection();

    // Get client_id from store slug
    const storeRes = await pool.query(
      `SELECT client_id
       FROM client_store_settings
       WHERE store_slug = $1
         OR LOWER(REGEXP_REPLACE(store_name, '[^a-zA-Z0-9]', '', 'g')) = LOWER($1)
       LIMIT 1`,
      [storeSlug]
    );

    if (!storeRes.rows.length) {
      return res.json({ connected: false });
    }

    const clientId = storeRes.rows[0].client_id;

    // Check if we have a messenger_psid for this phone
    const psidRes = await pool.query(
      `SELECT messenger_psid FROM customer_messaging_ids 
       WHERE client_id = $1 AND customer_phone = $2 AND messenger_psid IS NOT NULL
       LIMIT 1`,
      [clientId, normalizedPhone]
    );

    res.json({
      connected: psidRes.rows.length > 0,
      psid: psidRes.rows[0]?.messenger_psid || null
    });
  } catch (error) {
    console.error('[Messenger] Check connection error:', error);
    res.json({ connected: false });
  }
};

/**
 * Verify request signature from Facebook
 */
function verifyFBSignature(req: any): boolean {
  if (!getFbAppSecret()) return true; // Skip verification if not configured
  
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

/**
 * Send message via Facebook Messenger API
 */
export async function sendMessengerMessage(
  pageAccessToken: string,
  recipientId: string,
  message: string,
  quickReplies?: Array<{ title: string; payload: string }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!pageAccessToken) {
      return { success: false, error: 'Page access token missing' };
    }
    if (!recipientId) {
      return { success: false, error: 'Recipient PSID missing' };
    }

    const payload: any = {
      recipient: { id: recipientId },
      message: { text: message },
      messaging_type: 'RESPONSE',
    };

    // Add quick reply buttons if provided
    if (quickReplies && quickReplies.length > 0) {
      payload.message.quick_replies = quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload,
      }));
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json();
    
    if (!response.ok || data.error) {
      console.error('[Messenger] Send failed:', data.error);
      return { 
        success: false, 
        error: data.error?.message || `Send failed (${response.status})` 
      };
    }

    console.log(`[Messenger] Message sent to ${recipientId}: ${data.message_id}`);
    return { success: true, messageId: data.message_id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Messenger] Failed to send message: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

function hashPsid(psid: string): string {
  try {
    return crypto.createHash('sha256').update(String(psid)).digest('hex').slice(0, 12);
  } catch {
    return 'hash_error';
  }
}

async function sendMessengerAction(
  pageAccessToken: string,
  recipientId: string,
  action: 'typing_on' | 'typing_off' | 'mark_seen'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pageAccessToken) return { success: false, error: 'Page access token missing' };
    if (!recipientId) return { success: false, error: 'Recipient PSID missing' };

    const payload: any = {
      recipient: { id: recipientId },
      sender_action: action,
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
      return { success: false, error: data?.error?.message || `Action failed (${response.status})` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as any)?.message || String(e) };
  }
}

async function sendMessengerTextWithRetry(
  pageAccessToken: string,
  recipientId: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string; attempts: number }> {
  const first = await sendMessengerMessage(pageAccessToken, recipientId, message);
  if (first.success) return { ...first, attempts: 1 };
  await new Promise((r) => setTimeout(r, 500));
  const second = await sendMessengerMessage(pageAccessToken, recipientId, message);
  return { ...second, attempts: 2 };
}

/**
 * Send order confirmation with buttons
 */
export async function sendMessengerOrderConfirmation(
  pageAccessToken: string,
  recipientId: string,
  orderDetails: {
    orderId: number;
    customerName: string;
    storeName: string;
    productName: string;
    price: number;
    confirmationLink: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { orderId, customerName, storeName, productName, price, confirmationLink } = orderDetails;

    // Send structured template with buttons
    const payload = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: `مرحباً ${customerName}! 👋\n\nتم استلام طلبك من ${storeName}:\n\n📦 طلب #${orderId}\n🛍️ المنتج: ${productName}\n💰 المجموع: ${price} دج\n\nيرجى تأكيد طلبك:`,
            buttons: [
              {
                type: 'postback',
                title: '✅ تأكيد',
                payload: `CONFIRM_ORDER_${orderId}`,
              },
              {
                type: 'postback',
                title: '❌ إلغاء',
                payload: `DECLINE_ORDER_${orderId}`,
              },
            ],
          },
        },
      },
      messaging_type: 'RESPONSE',
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json();
    
    if (!response.ok || data.error) {
      console.error('[Messenger] Template send failed:', data.error);
      return { 
        success: false, 
        error: data.error?.message || `Send failed (${response.status})` 
      };
    }

    return { success: true, messageId: data.message_id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Messenger] Failed to send order confirmation: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * GET /api/messenger/webhook - Facebook webhook verification
 */
const verifyWebhook: RequestHandler = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Messenger] Webhook verification attempt:', { mode, token: token ? '***' : 'missing', challenge: challenge ? 'present' : 'missing' });

  const tokenStr = typeof token === 'string' ? token : Array.isArray(token) ? token[0] : '';
  const tokenOk = tokenStr === getFbVerifyToken() || tokenStr === '';

  if (mode === 'subscribe' && tokenOk) {
    console.log('[Messenger] Webhook verified successfully');
    // Facebook requires plain text response with the challenge
    res.set('Content-Type', 'text/plain');
    res.status(200).send(challenge);
  } else {
    console.warn('[Messenger] Webhook verification failed - token mismatch or wrong mode');
    res.sendStatus(403);
  }
};

/**
 * POST /api/messenger/webhook - Handle incoming messages
 */
const handleWebhook: RequestHandler = async (req, res) => {
  // Verify signature
  if (getFbAppSecret() && !verifyFBSignature(req)) {
    console.warn('[Messenger] Invalid signature');
    return res.sendStatus(403);
  }

  const body = req.body;

  // Handle Instagram DMs (same webhook, different object type)
  if (body.object === 'instagram') {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        if (event.message?.text) {
          await handleInstagramMessage(entry.id, senderId, event.message);
        }
      }
    }
    return res.sendStatus(200);
  }

  if (body.object !== 'page') {
    return res.sendStatus(404);
  }

  // Process each entry
  for (const entry of body.entry || []) {
    const pageId = entry.id;
    
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;

      // Handle referral (preconnect from m.me link with ref parameter)
      if (event.referral) {
        await handleReferral(pageId, senderId, event.referral);
      }

      // Handle postback (button clicks) - may also contain referral
      if (event.postback) {
        await handlePostback(pageId, senderId, event.postback);
      }

      // Handle message
      if (event.message) {
        await handleMessage(pageId, senderId, event.message);
      }

      // Handle message read
      if (event.read) {
        console.log(`[Messenger] Message read by ${senderId}`);
      }

      // Handle delivery confirmation
      if (event.delivery) {
        console.log(`[Messenger] Message delivered to ${senderId}`);
      }
    }
  }

  // Always respond with 200 OK quickly
  res.sendStatus(200);
};

/**
 * Handle referral events (from m.me links with ref parameter)
 * This is triggered when a user clicks a link like m.me/PAGE_ID?ref=TOKEN
 */
async function handleReferral(pageId: string, senderId: string, referral: any) {
  const refToken = referral.ref || '';
  console.log(`[Messenger] Referral from ${senderId} with ref: ${refToken}`);

  if (!refToken) return;

  try {
    const pool = await ensureConnection();

    // Look up the preconnect token
    const preconnectRes = await pool.query(
      `SELECT client_id, customer_phone, page_id FROM messenger_preconnect_tokens
       WHERE ref_token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [refToken]
    );

    if (!preconnectRes.rows.length) {
      console.log(`[Messenger] Preconnect token not found or expired: ${refToken}`);
      return;
    }

    const preconnect = preconnectRes.rows[0];
    const client_id = Number(preconnect.client_id);
    const customer_phone = String(preconnect.customer_phone);

    // Owner connect flow — save PSID as owner_messenger_psid and skip customer flow
    if (customer_phone === '__owner__' || String(refToken).startsWith('OWNER_')) {
      await pool.query(
        `UPDATE bot_settings SET owner_messenger_psid = $1, updated_at = NOW() WHERE client_id = $2`,
        [senderId, client_id]
      );
      await pool.query(`UPDATE messenger_preconnect_tokens SET used_at = NOW() WHERE ref_token = $1`, [refToken]);
      const botRes = await pool.query(`SELECT fb_page_access_token FROM bot_settings WHERE client_id = $1 LIMIT 1`, [client_id]);
      const tok = botRes.rows[0]?.fb_page_access_token ? String(botRes.rows[0].fb_page_access_token).trim() : getPlatformFbPageAccessToken();
      if (tok) await sendMessengerMessage(tok, senderId, '✅ تم ربط حسابك كصاحب المتجر. لن يرد عليك الذكاء الاصطناعي.');
      console.log(`[Messenger] Owner PSID saved for client ${client_id}: ${senderId}`);
      return;
    }

    // Ensure the token was created for the page that is receiving this event.
    // This matters a lot when platform page is shared.
    const tokenPageId = preconnect.page_id ? String(preconnect.page_id) : '';
    if (tokenPageId && String(tokenPageId) !== String(pageId)) {
      console.warn(`[Messenger] Referral token page mismatch. tokenPageId=${tokenPageId} eventPageId=${pageId}`);
      return;
    }

    // Get store settings
    const settingsRes = await pool.query(
      `SELECT fb_page_access_token, template_greeting, messenger_enabled
       FROM bot_settings
       WHERE client_id = $1
       LIMIT 1`,
      [client_id]
    );

    if (!settingsRes.rows.length) return;

    const { fb_page_access_token, template_greeting } = settingsRes.rows[0];

    const pageAccessToken = fb_page_access_token
      ? String(fb_page_access_token).trim()
      : isPlatformPage(pageId)
        ? getPlatformFbPageAccessToken()
        : '';

    if (!pageAccessToken) {
      console.warn(`[Messenger] Missing page access token for referral client ${client_id} page ${pageId}`);
      return;
    }

    // Save the phone->PSID mapping
    await pool.query(
      `INSERT INTO customer_messaging_ids (client_id, customer_phone, messenger_psid, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (client_id, customer_phone)
       DO UPDATE SET messenger_psid = EXCLUDED.messenger_psid, updated_at = NOW()`,
      [client_id, customer_phone, senderId]
    );

    // Also store in messenger_subscribers
    await pool.query(
      `INSERT INTO messenger_subscribers (client_id, psid, page_id, customer_phone, subscribed_at, last_interaction)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (client_id, psid) DO UPDATE SET customer_phone = $4, last_interaction = NOW()`,
      [client_id, senderId, pageId, customer_phone]
    );

    // Mark token as used
    await pool.query(
      `UPDATE messenger_preconnect_tokens SET used_at = NOW() WHERE ref_token = $1`,
      [refToken]
    );

    // Get store name
    const storeRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [client_id]
    );
    const storeName = storeRes.rows[0]?.store_name || 'Store';

    // Send welcome message
    const defaultGreeting = `مرحباً بك في ${storeName}! 🎉\n\n✅ تم ربط حسابك بنجاح.\n\nيمكنك الآن العودة لإتمام طلبك وستتلقى التأكيد هنا مباشرة! 📦`;
    
    let greeting = template_greeting || defaultGreeting;
    greeting = replaceTemplateVariables(greeting, { storeName, customerName: '' });
    
    await sendMessengerMessage(
      pageAccessToken,
      senderId,
      greeting
    );

    // Late-connect fix: if the customer already placed an order, there may be queued bot_messages
    // waiting for a PSID. Release those immediately now that we have linked the PSID.
    try {
      await pool.query(
        `UPDATE bot_messages
         SET send_at = NOW(),
             status = 'pending',
             error_message = NULL,
             updated_at = NOW()
         WHERE client_id = $1
           AND customer_phone = $2
           AND message_type = 'messenger'
           AND status = 'pending'
           AND error_message = 'WAITING_FOR_MESSENGER_PSID'`,
        [client_id, customer_phone]
      );
    } catch (e) {
      console.warn('[Messenger] Failed to release queued bot_messages after referral:', (e as any)?.message || e);
    }

    console.log(`[Messenger] Successfully linked PSID ${senderId} to phone ${customer_phone} for client ${client_id}`);
  } catch (error) {
    console.error('[Messenger] Referral handler error:', error);
  }
}

/**
 * Handle postback events (button clicks)
 */
async function handlePostback(pageId: string, senderId: string, postback: any) {
  const payload = postback.payload || '';
  const referral = postback.referral; // Get Started can include referral
  console.log(`[Messenger] Postback from ${senderId}: ${payload}`);

  try {
    const pool = await ensureConnection();

    // Order-specific postbacks should resolve by order_id (not only by pageId),
    // so confirmations always update the correct order even in platform/shared-page setups.
    if (
      payload.startsWith('CONFIRM_ORDER_') ||
      payload.startsWith('DECLINE_ORDER_') ||
      payload.startsWith('CANCEL_ORDER_') ||
      payload.startsWith('CONTACT_STORE_')
    ) {
      const parseOrderId = (raw: string): number | null => {
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      const orderId = payload.startsWith('CONFIRM_ORDER_')
        ? parseOrderId(payload.replace('CONFIRM_ORDER_', ''))
        : payload.startsWith('DECLINE_ORDER_')
          ? parseOrderId(payload.replace('DECLINE_ORDER_', ''))
          : payload.startsWith('CANCEL_ORDER_')
            ? parseOrderId(payload.replace('CANCEL_ORDER_', ''))
            : payload.startsWith('CONTACT_STORE_')
              ? parseOrderId(payload.replace('CONTACT_STORE_', ''))
              : null;

      if (!orderId) {
        console.warn('[Messenger] Invalid orderId in postback payload:', payload);
        return;
      }

      const orderRes = await pool.query(
        `SELECT id, client_id, customer_phone, status
         FROM store_orders
         WHERE id = $1
         LIMIT 1`,
        [orderId]
      );

      if (!orderRes.rows.length) {
        console.warn(`[Messenger] Order not found for postback: ${orderId}`);
        return;
      }

      const orderRow = orderRes.rows[0];
      const client_id = Number(orderRow.client_id);
      const customer_phone = String(orderRow.customer_phone || '').trim();
      const currentStatus = String(orderRow.status || '').trim();

      // Basic authorization: sender must match stored PSID for this order or for this customer phone.
      let authorized = false;
      try {
        const orderChatRes = await pool.query(
          `SELECT messenger_psid FROM order_messenger_chats WHERE order_id = $1 AND client_id = $2 LIMIT 1`,
          [orderId, client_id]
        );
        const orderPsid = orderChatRes.rows[0]?.messenger_psid ? String(orderChatRes.rows[0].messenger_psid) : '';
        if (orderPsid && orderPsid === senderId) authorized = true;
      } catch {}

      if (!authorized && customer_phone) {
        try {
          const idRes = await pool.query(
            `SELECT messenger_psid FROM customer_messaging_ids WHERE client_id = $1 AND customer_phone = $2 LIMIT 1`,
            [client_id, customer_phone]
          );
          const phonePsid = idRes.rows[0]?.messenger_psid ? String(idRes.rows[0].messenger_psid) : '';
          if (phonePsid && phonePsid === senderId) authorized = true;
        } catch {}
      }

      if (!authorized) {
        console.warn(`[Messenger] Unauthorized postback for order ${orderId} (client ${client_id}) from sender ${senderId}`);
        return;
      }

      // Resolve a token to reply back (optional; order update should still happen even if we cannot reply).
      let pageAccessToken = '';
      let store_name = 'Store';
      try {
        const storeRes = await pool.query(
          `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
          [client_id]
        );
        store_name = storeRes.rows[0]?.store_name || store_name;
      } catch {}

      if (isPlatformPage(pageId)) {
        pageAccessToken = getPlatformFbPageAccessToken();
      } else {
        // Prefer matching pageId first.
        const byPageRes = await pool.query(
          `SELECT fb_page_access_token
           FROM bot_settings
           WHERE fb_page_id = $1 AND client_id = $2
           LIMIT 1`,
          [pageId, client_id]
        );
        pageAccessToken = byPageRes.rows[0]?.fb_page_access_token ? String(byPageRes.rows[0].fb_page_access_token).trim() : '';

        // Fallback: client-level token if the page mapping is missing.
        if (!pageAccessToken) {
          const byClientRes = await pool.query(
            `SELECT fb_page_access_token
             FROM bot_settings
             WHERE client_id = $1
             LIMIT 1`,
            [client_id]
          );
          pageAccessToken = byClientRes.rows[0]?.fb_page_access_token ? String(byClientRes.rows[0].fb_page_access_token).trim() : '';
        }
      }

      const safeReply = async (text: string) => {
        if (!pageAccessToken) return;
        await sendMessengerMessage(pageAccessToken, senderId, text);
      };

      if (payload.startsWith('CONTACT_STORE_')) {
        const storeResult = await pool.query(
          `SELECT cs.phone, cs.store_name FROM client_store_settings cs
           JOIN store_orders so ON so.client_id = cs.client_id
           WHERE so.id = $1`,
          [orderId]
        );

        const phone = storeResult.rows[0]?.phone || 'غير متوفر';
        const storeName = storeResult.rows[0]?.store_name || store_name;
        await safeReply(`للتواصل مع ${storeName}:\n📞 ${phone}\n\nسنرد عليك في أقرب وقت! 💬`);
        return;
      }

      // Confirm / Decline are idempotent: only pending can change.
      if (payload.startsWith('CONFIRM_ORDER_')) {
        if (currentStatus !== 'pending') {
          await safeReply(`هذا الطلب تمت معالجته مسبقاً (الحالة الحالية: ${currentStatus}).`);
          return;
        }

        const upd = await pool.query(
          `UPDATE store_orders
           SET status = 'confirmed', updated_at = NOW()
           WHERE id = $1 AND client_id = $2 AND status = 'pending'
           RETURNING *`,
          [orderId, client_id]
        );

        if (upd.rows.length) {
          await pool.query(
            `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
             SELECT $1, $2, 'approved', 'messenger', NOW()
             WHERE NOT EXISTS (
               SELECT 1 FROM order_confirmations WHERE order_id = $1 AND client_id = $2
             )`,
            [orderId, client_id]
          );
          if ((global as any).broadcastOrderUpdate) {
            (global as any).broadcastOrderUpdate(upd.rows[0]);
          }
          await safeReply(`✅ تم تأكيد طلبك #${orderId}. شكراً لك!`);
        } else {
          await safeReply(`تمت معالجة هذا الطلب مسبقاً.`);
        }
        return;
      }

      // Decline/Cancellation
      if (payload.startsWith('DECLINE_ORDER_') || payload.startsWith('CANCEL_ORDER_')) {
        if (currentStatus !== 'pending') {
          await safeReply(`هذا الطلب تمت معالجته مسبقاً (الحالة الحالية: ${currentStatus}).`);
          return;
        }

        const upd = await pool.query(
          `UPDATE store_orders
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1 AND client_id = $2 AND status = 'pending'
           RETURNING *`,
          [orderId, client_id]
        );

        if (upd.rows.length) {
          await pool.query(
            `INSERT INTO order_confirmations (order_id, client_id, response_type, confirmed_via, confirmed_at)
             SELECT $1, $2, 'declined', 'messenger', NOW()
             WHERE NOT EXISTS (
               SELECT 1 FROM order_confirmations WHERE order_id = $1 AND client_id = $2
             )`,
            [orderId, client_id]
          );
          if ((global as any).broadcastOrderUpdate) {
            (global as any).broadcastOrderUpdate(upd.rows[0]);
          }
          await safeReply(`❌ تم إلغاء طلبك #${orderId}. شكراً لتواصلك مع ${store_name}.`);
        } else {
          await safeReply(`تمت معالجة هذا الطلب مسبقاً.`);
        }
        return;
      }
    }

    let client_id: number | null = null;
    let store_name = 'Store';
    let postbackGreeting: string | null = null;
    let pageAccessToken = '';

    // Get client_id and page access token
    const settingsResult = await pool.query(
      `SELECT fb_page_access_token, client_id, template_greeting FROM bot_settings 
       WHERE fb_page_id = $1
       LIMIT 1`,
      [pageId]
    );

    if (settingsResult.rows.length > 0) {
      client_id = Number(settingsResult.rows[0].client_id);
      postbackGreeting = settingsResult.rows[0].template_greeting || null;
      
      // Prefer platform env token when this event is for the shared platform Page.
      pageAccessToken = isPlatformPage(pageId)
        ? getPlatformFbPageAccessToken()
        : (settingsResult.rows[0].fb_page_access_token
            ? String(settingsResult.rows[0].fb_page_access_token).trim()
            : '');
    } else if (isPlatformPage(pageId)) {
      // Platform page: resolve client by existing subscriber mapping, or by uniquely claiming
      // the latest pending preconnect token (safe fallback).
      const subRes = await pool.query(
        `SELECT client_id FROM messenger_subscribers
         WHERE psid = $1 AND page_id = $2
         ORDER BY last_interaction DESC
         LIMIT 1`,
        [senderId, pageId]
      );
      client_id = subRes.rows[0]?.client_id ? Number(subRes.rows[0].client_id) : null;

      pageAccessToken = getPlatformFbPageAccessToken();

      if (!client_id) {
        const linked = await tryLinkPlatformSenderToLatestToken(pool, { pageId, senderId });
        if (!linked) {
          console.warn(`[Messenger] No client mapping found for platform page ${pageId} sender ${senderId}`);
          return;
        }
        client_id = linked.clientId;
        store_name = linked.storeName;
      } else {
        const storeRes = await pool.query(
          `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
          [client_id]
        );
        store_name = storeRes.rows[0]?.store_name || store_name;
      }
    } else {
      // Fallback: if platform token is configured but fb_page_id isn't stored in bot_settings,
      // do not silently ignore the webhook. Try to resolve the store by subscriber mapping or
      // by claiming the latest pending token; otherwise still respond with a generic welcome.
      if (getPlatformFbPageAccessToken()) {
        pageAccessToken = getPlatformFbPageAccessToken();

        const subRes = await pool.query(
          `SELECT client_id FROM messenger_subscribers
           WHERE psid = $1 AND page_id = $2
           ORDER BY last_interaction DESC
           LIMIT 1`,
          [senderId, pageId]
        );
        client_id = subRes.rows[0]?.client_id ? Number(subRes.rows[0].client_id) : null;

        if (client_id) {
          const storeRes = await pool.query(
            `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
            [client_id]
          );
          store_name = storeRes.rows[0]?.store_name || store_name;
        } else {
          const linked = await tryLinkPlatformSenderToLatestToken(pool, { pageId, senderId });
          if (linked) {
            client_id = linked.clientId;
            store_name = linked.storeName;
          }
        }
      } else {
        console.warn(`[Messenger] No settings found for page ${pageId}`);
        return;
      }
    }

    if (!pageAccessToken) {
      console.warn(`[Messenger] Missing page access token for postback page ${pageId}`);
      return;
    }

    // Handle GET_STARTED - this fires when user clicks m.me link or Get Started button
    if (payload === 'GET_STARTED') {
      // Improve perceived responsiveness on the very first interaction.
      // Some Messenger clients occasionally don't render the first bot message until refresh;
      // sending sender actions + one retry makes this much less likely.
      await sendMessengerAction(pageAccessToken, senderId, 'mark_seen');
      await sendMessengerAction(pageAccessToken, senderId, 'typing_on');

      // Check for ref in referral (from m.me link)
      if (referral?.ref) {
        await handleReferral(pageId, senderId, referral);
        return; // handleReferral sends its own message
      }

      // If we couldn't resolve the store/client, still reply (avoid "nothing happens" UX).
      if (!client_id) {
        const sendRes = await sendMessengerTextWithRetry(
          pageAccessToken,
          senderId,
          `مرحباً بك! 👋\n\nتم فتح المحادثة بنجاح.\n\nارجع الآن لصفحة الدفع لإتمام ربط الحساب واستلام تأكيدات الطلبات. 📦`
        );
        await sendMessengerAction(pageAccessToken, senderId, 'typing_off');
        void logSecurityEvent({
          event_type: 'messenger_get_started',
          severity: sendRes.success ? 'info' : 'warn',
          method: 'POST',
          path: '/api/messenger/webhook',
          status_code: 200,
          metadata: {
            pageId,
            sender: hashPsid(senderId),
            resolvedClientId: null,
            sendSuccess: sendRes.success,
            attempts: sendRes.attempts,
            error: sendRes.error || null,
          },
        });
        return;
      }

      // Check for pending preconnect token
      const pendingToken = await pool.query(
        `SELECT customer_phone, ref_token FROM messenger_preconnect_tokens 
         WHERE client_id = $1 AND page_id = $2 AND used_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [client_id, String(pageId)]
      );

      if (pendingToken.rows.length > 0) {
        const { customer_phone, ref_token } = pendingToken.rows[0];
        
        // Link PSID to phone
        await pool.query(
          `INSERT INTO customer_messaging_ids (client_id, customer_phone, messenger_psid, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (client_id, customer_phone)
           DO UPDATE SET messenger_psid = EXCLUDED.messenger_psid, updated_at = NOW()`,
          [client_id, customer_phone, senderId]
        );

        await pool.query(
          `UPDATE messenger_preconnect_tokens SET used_at = NOW() WHERE ref_token = $1`,
          [ref_token]
        );

        // Late-connect fix: release queued Messenger messages now that PSID is known.
        try {
          await pool.query(
            `UPDATE bot_messages
             SET send_at = NOW(),
                 status = 'pending',
                 error_message = NULL,
                 updated_at = NOW()
             WHERE client_id = $1
               AND customer_phone = $2
               AND message_type = 'messenger'
               AND status = 'pending'
               AND error_message = 'WAITING_FOR_MESSENGER_PSID'`,
            [client_id, customer_phone]
          );
        } catch (e) {
          console.warn('[Messenger] Failed to release queued bot_messages after GET_STARTED:', (e as any)?.message || e);
        }

        console.log(`[Messenger] Linked PSID ${senderId} to phone ${customer_phone} via GET_STARTED`);

        const sendRes = await sendMessengerTextWithRetry(
          pageAccessToken,
          senderId,
          `✅ تم ربط حسابك بنجاح!\n\nيمكنك الآن العودة لإتمام طلبك. ستتلقى تأكيدات الطلبات هنا! 📦`
        );
        await sendMessengerAction(pageAccessToken, senderId, 'typing_off');
        void logSecurityEvent({
          event_type: 'messenger_get_started',
          severity: sendRes.success ? 'info' : 'warn',
          method: 'POST',
          path: '/api/messenger/webhook',
          status_code: 200,
          metadata: {
            pageId,
            sender: hashPsid(senderId),
            resolvedClientId: client_id,
            sendSuccess: sendRes.success,
            attempts: sendRes.attempts,
            error: sendRes.error || null,
          },
        });
        return;
      }

      // Fallback: link PSID to most recent pending order for this client
      try {
        const recentOrder = await pool.query(
          `SELECT id, customer_phone, customer_name, total_price, product_snapshot
           FROM store_orders
           WHERE client_id = $1
           ORDER BY created_at DESC LIMIT 1`,
          [client_id]
        );
        if (recentOrder.rows.length > 0) {
          const { customer_phone, customer_name, total_price, product_snapshot, id: orderId } = recentOrder.rows[0];
          const product_name = product_snapshot?.title || product_snapshot?.name || `#${orderId}`;
          await pool.query(
            `INSERT INTO customer_messaging_ids (client_id, customer_phone, messenger_psid, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (client_id, customer_phone)
             DO UPDATE SET messenger_psid = EXCLUDED.messenger_psid, updated_at = NOW()`,
            [client_id, customer_phone, senderId]
          );
          // Release instant/pin messages now, keep confirmation on its scheduled delay
          await pool.query(
            `UPDATE bot_messages SET send_at = NOW(), status = 'pending', error_message = NULL, updated_at = NOW()
             WHERE client_id = $1 AND customer_phone = $2 AND message_type = 'messenger'
             AND status = 'pending' AND error_message = 'WAITING_FOR_MESSENGER_PSID'
             AND confirmation_link IS NULL`,
            [client_id, customer_phone]
          );
          await pool.query(
            `UPDATE bot_messages SET status = 'pending', error_message = NULL, updated_at = NOW()
             WHERE client_id = $1 AND customer_phone = $2 AND message_type = 'messenger'
             AND status = 'pending' AND error_message = 'WAITING_FOR_MESSENGER_PSID'
             AND confirmation_link IS NOT NULL`,
            [client_id, customer_phone]
          );
          // Queue order messages if none exist yet for this order
          const existing = await pool.query(
            `SELECT id FROM bot_messages WHERE order_id = $1 AND message_type = 'messenger' LIMIT 1`,
            [orderId]
          );
          if (existing.rows.length === 0) {
            const botSettingsRes = await pool.query(
              `SELECT template_instant_order, template_pin_instructions, template_order_confirmation, messenger_delay_minutes
               FROM bot_settings WHERE client_id = $1 LIMIT 1`,
              [client_id]
            );
            const bs = botSettingsRes.rows[0] || {};
            const vars = { customerName: customer_name || '', storeName: store_name, productName: product_name || '', totalPrice: total_price || '', orderId, price: total_price || '' };
            const confirmLink = `${process.env.BASE_URL || ''}/order-confirmation/${orderId}`;
            const instantMsg = replaceTemplateVariables(bs.template_instant_order || `✅ تم استلام طلبك!\n\nطلب #${orderId}\nالمجموع: ${total_price} دج`, vars);
            const pinMsg = replaceTemplateVariables(bs.template_pin_instructions || `📌 قم بتثبيت هذه المحادثة لتتبع طلبك.`, vars);
            const confirmMsg = replaceTemplateVariables(bs.template_order_confirmation || `مرحباً ${customer_name}! هل تؤكد طلبك؟`, vars);
            const delay = bs.messenger_delay_minutes || 5;
            const now = new Date();
            const sendAt = new Date(Date.now() + delay * 60 * 1000);
            await pool.query(`INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at) VALUES ($1,$2,$3,'messenger',$4,$5)`, [orderId, client_id, customer_phone, instantMsg, now]);
            await pool.query(`INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, send_at) VALUES ($1,$2,$3,'messenger',$4,$5)`, [orderId, client_id, customer_phone, pinMsg, now]);
            await pool.query(`INSERT INTO bot_messages (order_id, client_id, customer_phone, message_type, message_content, confirmation_link, send_at) VALUES ($1,$2,$3,'messenger',$4,$5,$6)`, [orderId, client_id, customer_phone, confirmMsg, confirmLink, sendAt]);
            console.log(`[Messenger] Queued order messages for order ${orderId} after GET_STARTED`);
          }
          console.log(`[Messenger] Fallback: linked PSID ${senderId} to phone ${customer_phone} via recent order`);
        }
      } catch (e) {
        console.warn('[Messenger] Fallback PSID link failed:', (e as any)?.message || e);
      }

      // Default welcome if no preconnect
      const storeNameRes = await pool.query(`SELECT store_name, store_slug FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [client_id]);
      const resolvedStoreName = storeNameRes.rows[0]?.store_name || storeNameRes.rows[0]?.store_slug || store_name;
      const welcomeText = postbackGreeting || `مرحباً بك في ${resolvedStoreName}! 🎉\n\n✅ تم ربط حسابك بنجاح.\n\nيمكنك الآن العودة لإتمام طلبك وستتلقى التأكيد هنا مباشرة! 📦`;
      const sendRes = await sendMessengerTextWithRetry(
        pageAccessToken,
        senderId,
        welcomeText
      );
      await sendMessengerAction(pageAccessToken, senderId, 'typing_off');
      void logSecurityEvent({
        event_type: 'messenger_get_started',
        severity: sendRes.success ? 'info' : 'warn',
        method: 'POST',
        path: '/api/messenger/webhook',
        status_code: 200,
        metadata: {
          pageId,
          sender: hashPsid(senderId),
          resolvedClientId: client_id,
          sendSuccess: sendRes.success,
          attempts: sendRes.attempts,
          error: sendRes.error || null,
        },
      });
      return;
    }

    // Other postback payloads are handled above (order actions) or here (non-order actions).
  } catch (error) {
    console.error('[Messenger] Postback handler error:', error);
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(pageId: string, senderId: string, message: any) {
  const text = message.text?.toLowerCase() || '';
  console.log(`[Messenger] Message from ${senderId} to page ${pageId}: ${text}`);

  try {
    const pool = await ensureConnection();

    let client_id: number | null = null;
    let store_name = 'Store';
    let pageAccessToken = '';

    // Get page access token (must match the exact page id)
    const settingsResult = await pool.query(
      `SELECT fb_page_access_token, client_id, template_greeting FROM bot_settings 
       WHERE fb_page_id = $1
       LIMIT 1`,
      [pageId]
    );

    if (settingsResult.rows.length > 0) {
      client_id = Number(settingsResult.rows[0].client_id);
      const fetchedGreeting: string | null = settingsResult.rows[0].template_greeting || null;
      
      // Prefer platform env token when this event is for the shared platform Page.
      pageAccessToken = isPlatformPage(pageId)
        ? getPlatformFbPageAccessToken()
        : (settingsResult.rows[0].fb_page_access_token
            ? String(settingsResult.rows[0].fb_page_access_token).trim()
            : '');
    } else if (isPlatformPage(pageId)) {
      // Platform page: resolve client by previously stored mapping
      const subRes = await pool.query(
        `SELECT client_id FROM messenger_subscribers
         WHERE psid = $1 AND page_id = $2
         ORDER BY last_interaction DESC
         LIMIT 1`,
        [senderId, pageId]
      );
      client_id = subRes.rows[0]?.client_id ? Number(subRes.rows[0].client_id) : null;
      if (!client_id) {
        // Fallback: if there is exactly one recent pending token for this page,
        // auto-link so the store can receive confirmations.
        const linked = await tryLinkPlatformSenderToLatestToken(pool, { pageId, senderId });
        if (!linked) {
          console.log(`[Messenger] No client mapping found for platform page ${pageId} sender ${senderId}`);
          return;
        }
        client_id = linked.clientId;
        store_name = linked.storeName;
      }
      pageAccessToken = getPlatformFbPageAccessToken();

      const storeRes = await pool.query(
        `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
        [client_id]
      );
      store_name = storeRes.rows[0]?.store_name || store_name;
    } else {
      if (getPlatformFbPageAccessToken()) {
        pageAccessToken = getPlatformFbPageAccessToken();

        const subRes = await pool.query(
          `SELECT client_id FROM messenger_subscribers
           WHERE psid = $1 AND page_id = $2
           ORDER BY last_interaction DESC
           LIMIT 1`,
          [senderId, pageId]
        );
        client_id = subRes.rows[0]?.client_id ? Number(subRes.rows[0].client_id) : null;

        if (!client_id) {
          const linked = await tryLinkPlatformSenderToLatestToken(pool, { pageId, senderId });
          if (linked) {
            client_id = linked.clientId;
            store_name = linked.storeName;
          }
        } else {
          const storeRes = await pool.query(
            `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
            [client_id]
          );
          store_name = storeRes.rows[0]?.store_name || store_name;
        }
      } else {
        console.log(`[Messenger] No settings found for page ${pageId}`);
        return;
      }
    }

    if (!pageAccessToken) {
      console.warn(`[Messenger] Missing page access token for message page ${pageId}`);
      return;
    }

    if (!client_id) {
      await sendMessengerMessage(
        pageAccessToken,
        senderId,
        `مرحباً بك! 👋\n\nارجع الآن لصفحة الدفع لإتمام ربط الحساب واستلام تأكيدات الطلبات. 📦`
      );
      return;
    }

    console.log(`[Messenger] Found client ${client_id} for page ${pageId}`);

    let linkedViaToken = false;

    // Check if there's a pending preconnect token for this PSID (user just clicked m.me link)
    // First check if we have any unexpired token for this client where the user might be connecting
    const pendingToken = await pool.query(
      `SELECT customer_phone, ref_token FROM messenger_preconnect_tokens 
       WHERE client_id = $1 AND page_id = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
        [client_id, String(pageId)]
    );

    if (pendingToken.rows.length > 0) {
      const { customer_phone, ref_token } = pendingToken.rows[0];
      
      // Link this PSID to the phone
      await pool.query(
        `INSERT INTO customer_messaging_ids (client_id, customer_phone, messenger_psid, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (client_id, customer_phone)
         DO UPDATE SET messenger_psid = EXCLUDED.messenger_psid, updated_at = NOW()`,
        [client_id, customer_phone, senderId]
      );

      // Mark token as used
      await pool.query(
        `UPDATE messenger_preconnect_tokens SET used_at = NOW() WHERE ref_token = $1`,
        [ref_token]
      );

      console.log(`[Messenger] Linked PSID ${senderId} to phone ${customer_phone} via message`);

      // Also store in messenger_subscribers
      await pool.query(
        `INSERT INTO messenger_subscribers (client_id, psid, page_id, customer_phone, subscribed_at, last_interaction)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (client_id, psid) DO UPDATE SET customer_phone = $4, last_interaction = NOW()`,
        [client_id, senderId, pageId, customer_phone]
      );

      // Release queued bot_messages that were waiting for PSID
      try {
        await pool.query(
          `UPDATE bot_messages
           SET send_at = NOW(),
               status = 'pending',
               error_message = NULL,
               updated_at = NOW()
           WHERE client_id = $1
             AND customer_phone = $2
             AND message_type = 'messenger'
             AND status = 'pending'
             AND error_message = 'WAITING_FOR_MESSENGER_PSID'`,
          [client_id, customer_phone]
        );
      } catch (e) {
        console.warn('[Messenger] Failed to release queued bot_messages after message link:', (e as any)?.message || e);
      }

      // Send welcome/confirmation
      await sendMessengerMessage(
        pageAccessToken,
        senderId,
        `✅ تم ربط حسابك بنجاح!\n\nستتلقى تأكيدات الطلبات هنا مباشرة! 📦`
      );

      linkedViaToken = true;
    }

    // Store/update customer's PSID for future messaging
    await pool.query(
      `INSERT INTO messenger_subscribers (client_id, psid, page_id, subscribed_at, last_interaction)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (client_id, psid) DO UPDATE SET last_interaction = NOW()`,
      [client_id, senderId, pageId]
    );

    // If the user just linked via token, don't spam additional menu replies.
    if (linkedViaToken) return;

    // Handle help command
    if (text.includes('مساعدة') || text.includes('help')) {
      await sendMessengerMessage(
        pageAccessToken,
        senderId,
        `كيف يمكنني مساعدتك؟ 🤔\n\n• للاستفسار عن طلب، أرسل رقم الطلب\n• للتواصل مع الدعم، اكتب "دعم"\n• لمعرفة حالة طلبك، اكتب "طلباتي"`
      );
    } else if (text.includes('دعم') || text.includes('support')) {
      let phone = '';
      try {
        const storeRes = await pool.query(
          `SELECT phone FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
          [client_id]
        );
        phone = storeRes.rows[0]?.phone ? String(storeRes.rows[0].phone) : '';
      } catch {
        // ignore
      }

      await sendMessengerMessage(
        pageAccessToken,
        senderId,
        phone
          ? `📞 للتواصل مع ${store_name}: ${phone}\n\nاكتب أيضاً رقم الطلب إن وجد.`
          : `اكتب رقم الطلب إن وجد، وسيتواصل معك ${store_name} قريباً. ✅`
      );
    } else if (text.includes('طلباتي') || text.includes('orders')) {
      // Get orders for THIS customer only (matched by their linked phone)
      const phoneRes = await pool.query(
        `SELECT customer_phone FROM customer_messaging_ids WHERE client_id = $1 AND messenger_psid = $2 LIMIT 1`,
        [client_id, senderId]
      );
      const customerPhone = phoneRes.rows[0]?.customer_phone;
      if (!customerPhone) {
        await sendMessengerMessage(pageAccessToken, senderId, 'لم نتمكن من العثور على طلباتك. تأكد من ربط حسابك أولاً.');
      } else {
        const ordersResult = await pool.query(
          `SELECT id, status, total_price, created_at FROM store_orders
           WHERE client_id = $1 AND customer_phone = $2
           ORDER BY created_at DESC LIMIT 5`,
          [client_id, customerPhone]
        );

        if (ordersResult.rows.length === 0) {
          await sendMessengerMessage(pageAccessToken, senderId, 'لا توجد طلبات حالياً.');
        } else {
          const ordersList = ordersResult.rows
            .map(o => `📦 #${o.id} - ${o.status} - ${o.total_price} دج`)
            .join('\n');
          await sendMessengerMessage(
            pageAccessToken,
            senderId,
            `طلباتك الأخيرة:\n\n${ordersList}`
          );
        }
      }
    } else {
      // AI auto-reply: try intelligent response, fall back to menu
      if (client_id && message.text) {
        try {
          const aiResponse = await handleCustomerMessage(client_id, 'messenger', senderId, String(message.text));
          if (aiResponse) {
            await sendMessengerMessage(pageAccessToken, senderId, aiResponse);
            return;
          }
        } catch (err) {
          console.error('[Messenger] AI auto-reply error:', err);
        }
      }
      // Fallback: default menu reply
      await sendMessengerMessage(
        pageAccessToken,
        senderId,
        `مرحباً 👋\n\nاكتب "help" أو "مساعدة" لعرض الخيارات.\nاكتب "طلباتي" لعرض آخر الطلبات.\nاكتب "دعم" للتواصل مع المتجر.`
      );
    }
  } catch (error) {
    console.error('[Messenger] Message handler error:', error);
  }
}

/**
 * Setup "Get Started" button for a page - call this once per page
 */
export async function setupGetStartedButton(
  pageAccessToken: string
): Promise<{ ok: true } | { ok: false; error: string; details?: any; status?: number }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          get_started: { payload: 'GET_STARTED' }
        }),
      }
    );
    const data: any = await response.json().catch(() => ({}));
    console.log('[Messenger] Get Started button setup:', data);

    if (!response.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        `Facebook API error (HTTP ${response.status})`;
      return { ok: false, error: msg, details: data?.error || data, status: response.status };
    }

    if (data?.result === 'success') return { ok: true };
    if (data?.error?.message) return { ok: false, error: data.error.message, details: data.error };
    return { ok: false, error: 'Failed to setup Get Started (unknown response)', details: data };
  } catch (error) {
    console.error('[Messenger] Failed to setup Get Started:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to setup Get Started',
    };
  }
}

/**
 * POST /api/messenger/setup-get-started/:storeSlug - Setup Get Started button for store's page
 */
const setupGetStarted: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params as any;
    const pool = await ensureConnection();

    const storeRes = await pool.query(
      `SELECT client_id FROM client_store_settings WHERE store_slug = $1 LIMIT 1`,
      [storeSlug]
    );
    if (storeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const botRes = await pool.query(
      `SELECT fb_page_access_token, messenger_enabled FROM bot_settings WHERE client_id = $1 LIMIT 1`,
      [storeRes.rows[0].client_id]
    );

    if (botRes.rows.length === 0) {
      return res.status(400).json({ error: 'Messenger not configured' });
    }

    const storeToken = botRes.rows[0].fb_page_access_token ? String(botRes.rows[0].fb_page_access_token).trim() : '';
    const effectiveToken = storeToken || (getPlatformMessengerEnabled() ? getPlatformFbPageAccessToken() : '');
    if (!effectiveToken) {
      return res.status(400).json({ error: 'Messenger not configured' });
    }

    const result = await setupGetStartedButton(effectiveToken);
    if (result.ok === false) {
      const status = typeof result.status === 'number' ? result.status : 400;
      return res.status(status).json({ success: false, error: result.error, details: result.details });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[Messenger] Setup Get Started error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
};

/**
 * GET /api/messenger/config - Get Messenger configuration status
 */
const getConfig: RequestHandler = async (req, res) => {
  res.json({
    enabled: !!process.env.FB_APP_SECRET,
    webhookUrl: `${getPublicBaseUrl(req)}/api/messenger/webhook`,
    platformAvailable: getPlatformMessengerEnabled() && !!getPlatformFbPageId() && !!getPlatformFbPageAccessToken(),
    // Intentionally do NOT expose verify token or platform Page ID publicly.
    verifyTokenSet: !!getFbVerifyToken(),
  });
};

/**
 * Handle incoming Instagram DM messages.
 * Instagram messages arrive via the same Page webhook with object='instagram'.
 * The Instagram account ID maps to a client via facebook_tokens.instagram_account_id.
 */
async function handleInstagramMessage(igAccountId: string, senderId: string, message: any) {
  const text = message.text || '';
  if (!text.trim()) return;

  console.log(`[Instagram] DM from ${senderId} on IG account ${igAccountId}: ${text}`);

  try {
    const pool = await ensureConnection();

    // Resolve client by Instagram account ID stored during Facebook OAuth
    const tokenRes = await pool.query(
      `SELECT client_id, page_access_token_encrypted FROM facebook_tokens
       WHERE instagram_account_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [igAccountId]
    );

    if (!tokenRes.rows.length) {
      console.log(`[Instagram] No client found for IG account ${igAccountId}`);
      return;
    }

    const clientId = Number(tokenRes.rows[0].client_id);
    let pageAccessToken = '';
    try {
      pageAccessToken = decryptData(tokenRes.rows[0].page_access_token_encrypted);
    } catch {
      console.warn(`[Instagram] Failed to decrypt token for client ${clientId}`);
      return;
    }

    if (!pageAccessToken) return;

    // Try AI auto-reply
    const aiResponse = await handleCustomerMessage(clientId, 'messenger', `ig_${senderId}`, text);
    if (aiResponse) {
      await sendInstagramMessage(pageAccessToken, senderId, aiResponse);
      return;
    }

    // Fallback
    const storeRes = await pool.query(
      `SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    const storeName = storeRes.rows[0]?.store_name || 'المتجر';

    await sendInstagramMessage(
      pageAccessToken,
      senderId,
      `مرحباً! 👋 شكراً لتواصلك مع ${storeName}.\n\nسيتم الرد عليك في أقرب وقت.`
    );
  } catch (err) {
    console.error('[Instagram] DM handler error:', err);
  }
}

/**
 * Send a message via Instagram Messaging API.
 * Uses the same Graph API endpoint with the page access token.
 */
export async function sendInstagramMessage(
  pageAccessToken: string,
  recipientId: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload = {
      recipient: { id: recipientId },
      message: { text: message },
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data: any = await response.json();
    if (!response.ok || data.error) {
      console.error('[Instagram] Send failed:', data.error);
      return { success: false, error: data.error?.message || `Send failed (${response.status})` };
    }

    console.log(`[Instagram] Message sent to ${recipientId}: ${data.message_id}`);
    return { success: true, messageId: data.message_id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Instagram] Failed to send message: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * GET /api/messenger/owner-link/:storeSlug
 * Authenticated: generates a special m.me link for the store owner to connect their Messenger.
 * When they click it, their PSID is saved as owner_messenger_psid so AI won't reply to them.
 */
const getOwnerMessengerLink: RequestHandler = async (req, res) => {
  try {
    const { storeSlug } = req.params as any;
    const pool = await ensureConnection();

    const storeRes = await pool.query(
      `SELECT client_id FROM client_store_settings WHERE store_slug = $1 LIMIT 1`,
      [storeSlug]
    );
    if (!storeRes.rows.length) return res.status(404).json({ error: 'Store not found' });
    const clientId = Number(storeRes.rows[0].client_id);

    const botRes = await pool.query(
      `SELECT fb_page_id, fb_page_access_token FROM bot_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    if (!botRes.rows.length) return res.status(400).json({ error: 'Messenger not configured' });

    const pageId = String(botRes.rows[0].fb_page_id || '').trim() || getPlatformFbPageId();
    if (!pageId) return res.status(400).json({ error: 'No page configured' });

    const refToken = 'OWNER_' + generateMessengerRefToken();
    await pool.query(
      `INSERT INTO messenger_preconnect_tokens (client_id, customer_phone, ref_token, page_id, created_at, expires_at)
       VALUES ($1, '__owner__', $2, $3, NOW(), NOW() + INTERVAL '24 hours')
       ON CONFLICT (client_id, customer_phone)
       DO UPDATE SET ref_token = $2, page_id = $3, created_at = NOW(), expires_at = NOW() + INTERVAL '24 hours', used_at = NULL`,
      [clientId, refToken, pageId]
    );

    return res.json({
      url: `https://m.me/${encodeURIComponent(pageId)}?ref=${encodeURIComponent(refToken)}`,
      refToken,
    });
  } catch (error) {
    console.error('[Messenger] Owner link error:', error);
    return res.status(500).json({ error: 'Failed to generate owner link' });
  }
};

// Register routes
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);
router.get('/page-link/:storeSlug', getMessengerPageLink);
router.get('/owner-link/:storeSlug', getOwnerMessengerLink);
router.get('/check-connection/:storeSlug', checkMessengerConnection);
router.post('/setup-get-started/:storeSlug', setupGetStarted);
router.get('/config', getConfig);
router.get('/version', (_req, res) => res.json({ v: '2026-04-28-v4-trylink-fix' }));

export default router;
