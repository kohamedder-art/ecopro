/**
 * AI Quota Management
 *
 * With local AI models (opencode bridge), usage costs are effectively $0.
 * Quotas are lifted — all stores get unlimited access.
 * Usage is still logged for display purposes only.
 */

import { ensureConnection } from '../utils/database';

export type UserType = 'owner' | 'customer';

interface QuotaStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: Date | null;
  userType: UserType;
}

/**
 * Check if a store has remaining AI budget — always allowed with local AI.
 */
export async function checkQuota(_clientId: number, userType: UserType): Promise<QuotaStatus> {
  return {
    allowed: true,
    remaining: 999_999_999,
    limit: 999_999_999,
    resetDate: null,
    userType,
  };
}

/**
 * Record an AI usage event (for display/history only, no enforcement).
 */
export async function recordUsage(params: {
  clientId: number;
  userType: UserType;
  platformChatId?: string;
  modelUsed: string;
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  costUsd: number;
  messagePreview: string;
}): Promise<void> {
  const pool = await ensureConnection();

  await pool.query(
    `INSERT INTO ai_usage_logs
     (client_id, user_type, platform_chat_id, model_used, tokens_input, tokens_output, total_tokens, cost_usd, message_preview)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.clientId,
      params.userType,
      params.platformChatId || null,
      params.modelUsed,
      params.tokensInput,
      params.tokensOutput,
      params.totalTokens,
      params.costUsd,
      params.messagePreview.substring(0, 100),
    ]
  );
}

/**
 * Get quota usage summary for display.
 * Returns unlimited limits since AI is local/free.
 */
export async function getQuotaSummary(clientId: number): Promise<{
  ownerUsed: number;
  ownerLimit: number;
  customerUsed: number;
  customerLimit: number;
  periodStart: Date;
}> {
  const pool = await ensureConnection();

  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN user_type = 'owner' THEN total_tokens ELSE 0 END), 0) as owner_tokens,
       COALESCE(SUM(CASE WHEN user_type = 'customer' THEN total_tokens ELSE 0 END), 0) as customer_tokens
     FROM ai_usage_logs
     WHERE client_id = $1`,
    [clientId]
  );

  const ownerUsed = Number(result.rows[0].owner_tokens);
  const customerUsed = Number(result.rows[0].customer_tokens);

  return {
    ownerUsed,
    ownerLimit: 999_999_999,
    customerUsed,
    customerLimit: 999_999_999,
    periodStart: new Date(0),
  };
}


