/**
 * Unipile Proxy — bypass Meta App Review for Messenger/Instagram.
 *
 * Environment variables:
 *   PROXY_BASE_URL           — e.g. "https://api46.unipile.com:17683"
 *   PROXY_MASTER_SECRET_KEY  — the API key from Unipile dashboard
 */

import { Router, RequestHandler } from 'express';
import { ensureConnection } from '../utils/database';
import { handleCustomerMessage } from '../services/customer-ai';

const router = Router();

// ─── Env (lazy) ──────────────────────────────────────────
function getProxyBaseUrl() { return String(process.env.PROXY_BASE_URL || '').trim(); }
function getProxyMasterSecretKey() { return String(process.env.PROXY_MASTER_SECRET_KEY || '').trim(); }

// ─── Map Unipile account_type to our platform ────────────
function mapAccountTypeToPlatform(accountType: string): 'messenger' | 'instagram' | 'whatsapp' {
  const t = String(accountType || '').toUpperCase();
  if (t === 'INSTAGRAM') return 'instagram';
  if (t === 'WHATSAPP') return 'whatsapp';
  return 'messenger'; // MESSENGER, FACEBOOK, etc.
}

// ─── Find store owner by Unipile account_id ──────────────
async function resolveClientByAccountId(accountId: string): Promise<number | null> {
  const pool = await ensureConnection();

  // Priority 1: bot_settings.proxy_page_id (the Unipile account_id linked to this store)
  const bsRes = await pool.query(
    `SELECT client_id FROM bot_settings WHERE proxy_page_id = $1 AND proxy_enabled = true LIMIT 1`,
    [accountId]
  );
  if (bsRes.rows.length) return Number(bsRes.rows[0].client_id);

  return null;
}

// ─── Save Unipile chat/attendee mapping ──────────────────
async function saveUnipileMapping(
  clientId: number,
  chatId: string,
  attendeeId: string,
  accountId: string,
): Promise<void> {
  const pool = await ensureConnection();
  try {
    // Use messenger_subscribers: psid = attendee_provider_id, page_id = account_id
    await pool.query(
      `INSERT INTO messenger_subscribers (client_id, psid, page_id, unipile_chat_id, unipile_account_id, subscribed_at, last_interaction)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (client_id, psid) DO UPDATE SET
         page_id = EXCLUDED.page_id,
         unipile_chat_id = EXCLUDED.unipile_chat_id,
         unipile_account_id = EXCLUDED.unipile_account_id,
         last_interaction = NOW()`,
      [clientId, attendeeId, accountId, chatId, accountId]
    );
  } catch (e) {
    console.warn('[Unipile] Failed to save mapping:', (e as any)?.message || e);
  }
}

// ─── Find Unipile chat_id for a customer by phone ────────
async function findUnipileChatId(clientId: number, customerPhone: string): Promise<string | null> {
  const pool = await ensureConnection();
  try {
    const res = await pool.query(
      `SELECT unipile_chat_id FROM messenger_subscribers
       WHERE client_id = $1 AND customer_phone = $2 AND unipile_chat_id IS NOT NULL
       LIMIT 1`,
      [clientId, customerPhone]
    );
    return res.rows[0]?.unipile_chat_id || null;
  } catch {
    return null;
  }
}

// ─── Send message via Unipile API ────────────────────────
async function sendViaUnipile(
  chatId: string,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = getProxyBaseUrl();
  const token = getProxyMasterSecretKey();
  if (!baseUrl || !token) {
    return { success: false, error: 'Unipile not configured' };
  }

  try {
    const url = `${baseUrl}/api/v1/chats/${encodeURIComponent(chatId)}/messages`;
    const formData = new FormData();
    formData.append('text', text);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': token,
        'accept': 'application/json',
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Unipile ${res.status}: ${body}` };
    }

    const data: any = await res.json().catch(() => ({}));
    return { success: true, messageId: data?.message_id || data?.id };
  } catch (err) {
    return { success: false, error: (err as any)?.message || 'Unipile send error' };
  }
}

// ─── Webhook Verification (GET) ──────────────────────────
// Unipile doesn't use the Meta-style hub.mode verification.
// If they send a GET, just 200 OK.
const verifyWebhook: RequestHandler = (_req, res) => {
  res.sendStatus(200);
};

// ─── Incoming Messages (POST) ────────────────────────────
const handleWebhook: RequestHandler = async (req, res) => {
  // 200 immediately to prevent Unipile retries
  res.sendStatus(200);

  const body = req.body;

  const eventType = String(body.event || '').trim();
  const accountId = String(body.account_id || '').trim();
  const accountType = String(body.account_type || '').trim();

  // ── Account connected via hosted auth wizard ──────────
  if (eventType === 'account_connected' || eventType === 'account_reconnected') {
    const clientId = parseInt(String(body.name || ''), 10);
    if (!clientId || !accountId) {
      console.warn('[Unipile] account_connected missing client_id or account_id');
      return;
    }
    const pool = await ensureConnection();
    await pool.query(
      `UPDATE bot_settings SET
         proxy_enabled = true,
         proxy_page_id = $1,
         proxy_provider = $2,
         updated_at = NOW()
       WHERE client_id = $3`,
      [accountId, accountType, clientId]
    );
    console.log(`[Unipile] Account ${accountId} connected for client ${clientId}`);
    return;
  }

  // ── Incoming message ─────────────────────────────────
  const chatId = String(body.chat_id || '').trim();
  const messageText = String(body.message || '').trim();
  const senderId = String(body.sender?.attendee_provider_id || body.sender?.attendee_id || '').trim();

  if (eventType !== 'message_received') return;

  if (!accountId || !chatId || !messageText) {
    console.warn('[Unipile] Incomplete payload:', { accountId, chatId, messageText });
    return;
  }

  if (body.account_info?.user_id && senderId === body.account_info.user_id) return;

  const aiPlatform = mapAccountTypeToPlatform(accountType);

  try {
    const clientId = await resolveClientByAccountId(accountId);
    if (!clientId) {
      console.warn(`[Unipile] No store mapping for account: ${accountId}`);
      return;
    }

    await saveUnipileMapping(clientId, chatId, senderId, accountId);

    const aiReply = await handleCustomerMessage(clientId, aiPlatform, senderId, messageText);

    if (aiReply) {
      await sendViaUnipile(chatId, aiReply);
    }
  } catch (err) {
    console.error('[Unipile] webhook handler error:', err);
  }
};

/**
 * POST /api/proxy/test-connection
 * Test Unipile credentials from store owner dashboard
 */
const testConnection: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const { apiKey, dsn } = req.body;
    const effectiveDsn = dsn || getProxyBaseUrl();
    const effectiveKey = apiKey || getProxyMasterSecretKey();

    if (!effectiveDsn || !effectiveKey) {
      return res.status(400).json({ error: 'DSN and API key required' });
    }

    const baseUrl = effectiveDsn.startsWith('http') ? effectiveDsn : `https://${effectiveDsn}`;

    // Test by fetching connected accounts
    const r = await fetch(`${baseUrl}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': effectiveKey,
        'accept': 'application/json',
      },
    });

    if (r.ok) {
      const data: any = await r.json();
      const accounts = data?.items || data?.accounts || data || [];
      return res.json({
        success: true,
        accounts: Array.isArray(accounts)
          ? accounts.map((a: any) => ({ id: a.id, type: a.type || a.provider, name: a.name || a.display_name }))
          : [],
      });
    }

    const err = await r.json().catch(() => ({ error: 'Invalid credentials' }));
    return res.status(400).json({ success: false, error: err.error || 'Invalid DSN or API key' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as any)?.message || 'Connection test failed' });
  }
};

/**
 * GET /api/proxy/accounts
 * List connected Unipile accounts (for page picker in dashboard)
 */
const listAccounts: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const { apiKey, dsn } = req.query;
    const effectiveDsn = String(dsn || getProxyBaseUrl());
    const effectiveKey = String(apiKey || getProxyMasterSecretKey());

    if (!effectiveDsn || !effectiveKey) {
      return res.status(400).json({ error: 'DSN and API key required' });
    }

    const baseUrl = effectiveDsn.startsWith('http') ? effectiveDsn : `https://${effectiveDsn}`;

    const r = await fetch(`${baseUrl}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': effectiveKey,
        'accept': 'application/json',
      },
    });

    if (!r.ok) {
      return res.status(400).json({ error: 'Failed to fetch accounts' });
    }

    const data: any = await r.json();
    const accounts = data?.items || data?.accounts || data || [];
    return res.json({
      accounts: Array.isArray(accounts)
        ? accounts.map((a: any) => ({
            id: a.id,
            type: a.type || a.provider,
            name: a.name || a.display_name,
            status: a.status,
          }))
        : [],
    });
  } catch (err) {
    return res.status(500).json({ error: (err as any)?.message || 'Failed to list accounts' });
  }
};

/**
 * POST /api/proxy/connect-link
 * Generate a hosted auth wizard URL for the store owner to connect their Facebook/Instagram page.
 * Requires auth (store owner logged in).
 */
const generateConnectLink: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const baseUrl = getProxyBaseUrl();
    const secret = getProxyMasterSecretKey();
    if (!baseUrl || !secret) {
      return res.status(500).json({ error: 'Proxy not configured on server' });
    }

    const host = req.get('host') || 'localhost:8080';
    const protocol = req.protocol || 'http';
    const notifyUrl = `${protocol}://${host}/api/proxy/webhook`;

    const expiresOn = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const r = await fetch(`${baseUrl}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        'X-API-KEY': secret,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'create',
        providers: ['FACEBOOK_PAGE', 'INSTAGRAM'],
        api_url: baseUrl,
        expiresOn,
        notify_url: notifyUrl,
        name: String(clientId),
        success_redirect_url: `${protocol}://${host}/dashboard/bot?proxy=connected`,
        failure_redirect_url: `${protocol}://${host}/dashboard/bot?proxy=failed`,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'Unipile link generation failed' }));
      return res.status(400).json({ error: (err as any)?.title || (err as any)?.error || 'Failed to generate link' });
    }

    const data: any = await r.json();
    return res.json({ url: data.url });
  } catch (err) {
    return res.status(500).json({ error: (err as any)?.message || 'Failed to generate connect link' });
  }
};

/**
 * POST /api/proxy/disconnect
 * Remove the Unipile account link from a store.
 */
const disconnectAccount: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = await ensureConnection();
    await pool.query(
      `UPDATE bot_settings SET proxy_enabled = false, proxy_page_id = NULL, proxy_channel_id = NULL, proxy_api_key = NULL, proxy_provider = NULL WHERE client_id = $1`,
      [clientId]
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: (err as any)?.message || 'Failed to disconnect' });
  }
};

router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);
router.post('/connect-link', generateConnectLink);
router.post('/disconnect', disconnectAccount);
router.post('/test-connection', testConnection);
router.get('/accounts', listAccounts);

export default router;
