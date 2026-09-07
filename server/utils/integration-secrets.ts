/**
 * Delivery integration secrets helper.
 *
 * Problem it solves: some integrations were saved with the API key stored
 * as PLAINTEXT in `api_key_encrypted` (e.g. via the AI assistant), so every
 * later decryptData() call blows up with
 * "Unsupported state or unable to authenticate data", silently breaking
 * tracking polls, label generation and price imports for that client.
 *
 * - Legacy plaintext rows are used as-is AND re-encrypted in the background
 *   (self-healing — next use reads proper ciphertext).
 * - Genuinely undecryptable ciphertext (encryption-key mismatch) still
 *   throws, so callers can surface "reconnect needed" instead of looping.
 */
import { ensureConnection } from './database';
import { decryptData, encryptData } from './encryption';

export interface IntegrationSecrets {
  apiKey: string;
  apiSecret?: string;
  accountNumber?: string;
  merchantId?: string;
}

/** True when the value looks like our `iv:authtag:ciphertext` hex format. */
export function isEncryptedSecretFormat(v: any): boolean {
  if (!v || typeof v !== 'string' || !v.includes(':')) return false;
  const parts = v.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0 && /^[0-9a-fA-F]+$/.test(p));
}

function healInBackground(clientId: number, companyId: number, column: 'api_key_encrypted' | 'api_secret_encrypted', plaintext: string) {
  setImmediate(async () => {
    try {
      const pool = await ensureConnection();
      await pool.query(
        `UPDATE delivery_integrations SET ${column} = $1, updated_at = NOW() WHERE client_id = $2 AND delivery_company_id = $3`,
        [encryptData(plaintext), clientId, companyId]
      );
      console.log(`[Secrets] Healed legacy plaintext ${column} for client ${clientId}, company ${companyId}`);
    } catch (e: any) {
      console.warn('[Secrets] Heal failed:', e?.message || e);
    }
  });
}

async function decryptField(
  stored: any,
  clientId: number,
  companyId: number,
  column: 'api_key_encrypted' | 'api_secret_encrypted'
): Promise<string> {
  const s = String(stored || '');
  if (!s) throw new Error('Missing stored secret');
  if (!isEncryptedSecretFormat(s)) {
    // Legacy plaintext row — use it, and re-encrypt for next time.
    healInBackground(clientId, companyId, column, s);
    return s;
  }
  return decryptData(s);
}

/** Load + decrypt an enabled integration. Null when none configured. */
export async function getIntegrationSecrets(clientId: number, companyId: number): Promise<IntegrationSecrets | null> {
  const pool = await ensureConnection();
  const r = await pool.query(
    `SELECT api_key_encrypted, api_secret_encrypted, account_number, merchant_id
     FROM delivery_integrations
     WHERE client_id = $1 AND delivery_company_id = $2 AND is_enabled = true
     LIMIT 1`,
    [clientId, companyId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  const apiKey = await decryptField(row.api_key_encrypted, clientId, companyId, 'api_key_encrypted');
  const apiSecret = row.api_secret_encrypted
    ? await decryptField(row.api_secret_encrypted, clientId, companyId, 'api_secret_encrypted')
    : undefined;
  return {
    apiKey,
    apiSecret,
    accountNumber: row.account_number || undefined,
    merchantId: row.merchant_id || undefined,
  };
}

/** Same, looked up by integration row id (for webhook flows). */
export async function getIntegrationSecretsById(
  integrationId: number,
  clientId: number
): Promise<(IntegrationSecrets & { companyId: number }) | null> {
  const pool = await ensureConnection();
  const r = await pool.query(
    `SELECT delivery_company_id, api_key_encrypted, api_secret_encrypted, account_number, merchant_id
     FROM delivery_integrations
     WHERE id = $1 AND client_id = $2 AND is_enabled = true
     LIMIT 1`,
    [integrationId, clientId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  const companyId = Number(row.delivery_company_id);
  const apiKey = await decryptField(row.api_key_encrypted, clientId, companyId, 'api_key_encrypted');
  const apiSecret = row.api_secret_encrypted
    ? await decryptField(row.api_secret_encrypted, clientId, companyId, 'api_secret_encrypted')
    : undefined;
  return {
    apiKey,
    apiSecret,
    accountNumber: row.account_number || undefined,
    merchantId: row.merchant_id || undefined,
    companyId,
  };
}
