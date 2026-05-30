/**
 * AI Quota Management
 *
 * Tracks per-store AI usage and enforces monthly dollar-based budgets.
 * Budget resets when the store owner pays for a new billing period
 * (tied to subscriptions.current_period_start, NOT calendar month).
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

const DEFAULT_MONTHLY_BUDGET = 2.00;

/**
 * Get the billing period start for a store owner from their subscription.
 * Falls back to first day of month if no subscription found.
 */
async function getBillingPeriodStart(clientId: number): Promise<Date> {
  const pool = await ensureConnection();
  const result = await pool.query(
    `SELECT current_period_start
     FROM subscriptions
     WHERE user_id = $1
     LIMIT 1`,
    [clientId]
  );

  if (result.rows.length > 0 && result.rows[0].current_period_start) {
    return new Date(result.rows[0].current_period_start);
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function getBillingPeriodEnd(clientId: number): Promise<Date | null> {
  const pool = await ensureConnection();
  const result = await pool.query(
    `SELECT current_period_end
     FROM subscriptions
     WHERE user_id = $1
     LIMIT 1`,
    [clientId]
  );

  if (result.rows.length > 0 && result.rows[0].current_period_end) {
    return new Date(result.rows[0].current_period_end);
  }

  return null;
}

/**
 * Check if a store has remaining AI budget for the current billing period.
 */
export async function checkQuota(clientId: number, userType: UserType): Promise<QuotaStatus> {
  const pool = await ensureConnection();
  const budget = DEFAULT_MONTHLY_BUDGET;
  const periodStart = await getBillingPeriodStart(clientId);
  const periodEnd = await getBillingPeriodEnd(clientId);

  const result = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) as total_spent
     FROM ai_usage_logs
     WHERE client_id = $1 AND created_at >= $2`,
    [clientId, periodStart]
  );

  const totalSpent = Number(result.rows[0].total_spent);
  const remaining = Math.max(0, budget - totalSpent);

  return {
    allowed: remaining > 0,
    remaining,
    limit: budget,
    resetDate: periodEnd,
    userType,
  };
}

/**
 * Record an AI usage event with actual cost from API response.
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
 * Get quota usage summary for a store.
 * Returns token counts for display (old UI format) but budget is enforced in dollars.
 */
export async function getQuotaSummary(clientId: number): Promise<{
  ownerUsed: number;
  ownerLimit: number;
  customerUsed: number;
  customerLimit: number;
  periodStart: Date;
}> {
  const pool = await ensureConnection();
  const periodStart = await getBillingPeriodStart(clientId);

  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN user_type = 'owner' THEN total_tokens ELSE 0 END), 0) as owner_tokens,
       COALESCE(SUM(CASE WHEN user_type = 'customer' THEN total_tokens ELSE 0 END), 0) as customer_tokens
     FROM ai_usage_logs
     WHERE client_id = $1 AND created_at >= $2`,
    [clientId, periodStart]
  );

  const ownerUsed = Number(result.rows[0].owner_tokens);
  const customerUsed = Number(result.rows[0].customer_tokens);

  // Show token-equivalent of the $2 budget at 14B rates (~$0.156/1M avg)
  // This is what store owners see in the UI (not dollars)
  const CUSTOMER_TOKEN_LIMIT = 12_000_000;

  return {
    ownerUsed,
    ownerLimit: 5_000_000,
    customerUsed,
    customerLimit: CUSTOMER_TOKEN_LIMIT,
    periodStart,
  };
}
