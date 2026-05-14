import crypto from 'crypto';
import { ensureConnection } from './database';

const PLATFORM_TELEGRAM_BOT_USERNAME = String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim();
const PLATFORM_TELEGRAM_BOT_TOKEN = String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim();
const PLATFORM_TELEGRAM_AVAILABLE = !!PLATFORM_TELEGRAM_BOT_TOKEN && !!PLATFORM_TELEGRAM_BOT_USERNAME;

function normalizeTelegramUsername(username: string): string {
  return String(username || '').trim().replace(/^@/, '');
}

export function generateTelegramStartToken(): string {
  // Telegram deep-link payload limit is 64 chars. Keep it simple and URL-safe.
  // 32 chars hex is safe: [0-9a-f].
  return crypto.randomBytes(16).toString('hex');
}

export async function upsertTelegramWebhookSecret(
  clientId: number | string,
  botToken?: string
): Promise<string> {
  const pool = await ensureConnection();

  // IMPORTANT: Telegram webhook secret is scoped to the BOT (token), not the store.
  // When multiple stores share the same platform bot token, they must share one secret
  // or the most recent store to setWebhook will break delivery for the others.
  const token = String(botToken || '').trim();
  if (token) {
    const existingForToken = await pool.query(
      `SELECT telegram_webhook_secret
       FROM bot_settings
       WHERE telegram_bot_token = $1
         AND telegram_webhook_secret IS NOT NULL
         AND length(telegram_webhook_secret) >= 16
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [token]
    );

    const existing = existingForToken.rows[0]?.telegram_webhook_secret as string | undefined;
    const secret = existing || crypto.randomBytes(24).toString('hex');

    await pool.query(
      `UPDATE bot_settings
       SET telegram_webhook_secret = $2, updated_at = NOW()
       WHERE telegram_bot_token = $1
         AND telegram_webhook_secret IS DISTINCT FROM $2`,
      [token, secret]
    );

    return secret;
  }

  const current = await pool.query(
    `SELECT telegram_webhook_secret FROM bot_settings WHERE client_id = $1`,
    [clientId]
  );

  const existing = current.rows[0]?.telegram_webhook_secret as string | undefined;
  if (existing && existing.length >= 16) return existing;

  const secret = crypto.randomBytes(24).toString('hex');
  await pool.query(
    `UPDATE bot_settings SET telegram_webhook_secret = $2, updated_at = NOW() WHERE client_id = $1`,
    [clientId, secret]
  );
  return secret;
}

export async function registerTelegramWebhook(opts: {
  botToken: string;
  baseUrl: string;
  secretToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${opts.botToken}/setWebhook`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${opts.baseUrl.replace(/\/$/, '')}/api/telegram/webhook`,
        secret_token: opts.secretToken,
        drop_pending_updates: true,
      }),
    });

    const data: any = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      return { ok: false, error: data?.description || `Telegram setWebhook failed (${resp.status})` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as any)?.message || String(e) };
  }
}

export async function deleteTelegramWebhook(botToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    });
    const data: any = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) {
      return { ok: false, error: data?.description || `deleteWebhook failed (${resp.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as any)?.message || String(e) };
  }
}

export async function createOrderTelegramLink(opts: {
  orderId: number;
  clientId: number;
  customerPhone: string;
  customerName: string;
}): Promise<{ startToken: string; startUrl: string | null }> {
  const pool = await ensureConnection();

  const settingsRes = await pool.query(
    `SELECT enabled, provider, telegram_bot_username FROM bot_settings WHERE client_id = $1`,
    [opts.clientId]
  );
  const settings = settingsRes.rows[0];

  // Only generate usable URLs when Telegram is configured for this store owner.
  const botUsernameRaw = settings?.telegram_bot_username as string | undefined;
  const botUsername = normalizeTelegramUsername(botUsernameRaw || (PLATFORM_TELEGRAM_AVAILABLE ? PLATFORM_TELEGRAM_BOT_USERNAME : ''));

  const startToken = generateTelegramStartToken();

  await pool.query(
    `INSERT INTO order_telegram_links (start_token, order_id, client_id, customer_phone, customer_name, created_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (start_token) DO NOTHING`,
    [startToken, opts.orderId, opts.clientId, opts.customerPhone, opts.customerName]
  );

  const canUseTelegram = !!settings?.enabled && !!botUsername;
  const startUrl = canUseTelegram ? `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(startToken)}` : null;

  return { startToken, startUrl };
}
