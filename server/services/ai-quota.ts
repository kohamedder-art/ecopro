/**
 * AI Quota Management
 * 
 * Tracks per-store AI usage and enforces monthly limits.
 * Store owners have separate quotas from their customers.
 */

import { ensureConnection } from '../utils/database';

export type UserType = 'owner' | 'customer';

interface QuotaStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: Date;
  userType: UserType;
}

/**
 * Get or create a quota record for the current month.
 */
async function getOrCreateQuota(clientId: number): Promise<any> {
  const pool = await ensureConnection();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // First day of month

  // Try to get existing quota
  const existing = await pool.query(
    `SELECT * FROM ai_usage_quotas WHERE client_id = $1 AND period_start = $2`,
    [clientId, periodStart]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Create new quota record
  const created = await pool.query(
    `INSERT INTO ai_usage_quotas (client_id, period_start, owner_messages_limit, customer_messages_limit)
     VALUES ($1, $2, 200, 3000)
     RETURNING *`,
    [clientId, periodStart]
  );

  return created.rows[0];
}

/**
 * Check if a user has quota remaining for the current month.
 */
export async function checkQuota(clientId: number, userType: UserType): Promise<QuotaStatus> {
  const quota = await getOrCreateQuota(clientId);
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const usedField = userType === 'owner' ? 'owner_messages_used' : 'customer_messages_used';
  const limitField = userType === 'owner' ? 'owner_messages_limit' : 'customer_messages_limit';
  const used = Number(quota[usedField] || 0);
  const limit = Number(quota[limitField] || 0);
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    resetDate: nextMonth,
    userType,
  };
}

/**
 * Record an AI usage event.
 */
export async function recordUsage(params: {
  clientId: number;
  userType: UserType;
  platformChatId?: string;
  modelUsed: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  messagePreview: string;
}): Promise<void> {
  const pool = await ensureConnection();
  const quota = await getOrCreateQuota(params.clientId);

  // Update quota counters
  const usedField = params.userType === 'owner' ? 'owner_messages_used' : 'customer_messages_used';
  await pool.query(
    `UPDATE ai_usage_quotas
     SET ${usedField} = ${usedField} + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [quota.id]
  );

  // Log detailed usage
  await pool.query(
    `INSERT INTO ai_usage_logs
     (client_id, user_type, platform_chat_id, model_used, tokens_input, tokens_output, cost_usd, message_preview)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.clientId,
      params.userType,
      params.platformChatId || null,
      params.modelUsed,
      params.tokensInput,
      params.tokensOutput,
      params.costUsd,
      params.messagePreview.substring(0, 100),
    ]
  );
}

/**
 * Get quota usage summary for a store.
 */
export async function getQuotaSummary(clientId: number): Promise<{
  ownerUsed: number;
  ownerLimit: number;
  customerUsed: number;
  customerLimit: number;
  periodStart: Date;
}> {
  const quota = await getOrCreateQuota(clientId);
  return {
    ownerUsed: Number(quota.owner_messages_used || 0),
    ownerLimit: Number(quota.owner_messages_limit || 0),
    customerUsed: Number(quota.customer_messages_used || 0),
    customerLimit: Number(quota.customer_messages_limit || 0),
    periodStart: quota.period_start,
  };
}
