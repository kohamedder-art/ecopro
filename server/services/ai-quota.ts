/**
 * AI Quota Management
 *
 * Tracks per-store AI usage and enforces monthly dollar-based budgets.
 * Each store gets a $2/month budget shared between owner AI and customer AI.
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

const DEFAULT_MONTHLY_BUDGET = 2.00;

function getPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getNextMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Get or create a quota record for the current month.
 */
async function getOrCreateQuota(clientId: number): Promise<any> {
  const pool = await ensureConnection();
  const periodStart = getPeriodStart();

  const existing = await pool.query(
    `SELECT * FROM ai_usage_quotas WHERE client_id = $1 AND period_start = $2`,
    [clientId, periodStart]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (!row.monthly_budget_usd || Number(row.monthly_budget_usd) <= 0) {
      await pool.query(
        `UPDATE ai_usage_quotas
         SET monthly_budget_usd = $3, updated_at = NOW()
         WHERE id = $1 AND (monthly_budget_usd IS NULL OR monthly_budget_usd <= 0)`,
        [row.id, periodStart, DEFAULT_MONTHLY_BUDGET]
      );
      row.monthly_budget_usd = DEFAULT_MONTHLY_BUDGET;
    }
    return row;
  }

  const created = await pool.query(
    `INSERT INTO ai_usage_quotas (client_id, period_start, monthly_budget_usd, owner_token_limit, customer_token_limit)
     VALUES ($1, $2, $3, 0, 0)
     RETURNING *`,
    [clientId, periodStart, DEFAULT_MONTHLY_BUDGET]
  );

  return created.rows[0];
}

/**
 * Check if a store has remaining AI budget for the current month.
 */
export async function checkQuota(clientId: number, userType: UserType): Promise<QuotaStatus> {
  const quota = await getOrCreateQuota(clientId);
  const budget = Number(quota.monthly_budget_usd || DEFAULT_MONTHLY_BUDGET);
  const periodStart = getPeriodStart();
  const pool = await ensureConnection();

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
    resetDate: getNextMonth(),
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
  const quota = await getOrCreateQuota(params.clientId);

  const usedField = params.userType === 'owner' ? 'owner_tokens_used' : 'customer_tokens_used';
  await pool.query(
    `UPDATE ai_usage_quotas
     SET ${usedField} = ${usedField} + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [params.totalTokens, quota.id]
  );

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
 * Get quota usage summary for a store in dollars.
 * Also provides estimated conversation counts for display to store owners.
 */
export async function getQuotaSummary(clientId: number): Promise<{
  ownerUsed: number;
  ownerLimit: number;
  customerUsed: number;
  customerLimit: number;
  totalUsed: number;
  totalLimit: number;
  conversationsUsed: number;
  conversationsLimit: number;
  periodStart: Date;
}> {
  const quota = await getOrCreateQuota(clientId);
  const budget = Number(quota.monthly_budget_usd || DEFAULT_MONTHLY_BUDGET);
  const periodStart = getPeriodStart();
  const pool = await ensureConnection();

  const result = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN user_type = 'owner' THEN cost_usd ELSE 0 END), 0) as owner_spent,
       COALESCE(SUM(CASE WHEN user_type = 'customer' THEN cost_usd ELSE 0 END), 0) as customer_spent
     FROM ai_usage_logs
     WHERE client_id = $1 AND created_at >= $2`,
    [clientId, periodStart]
  );

  const ownerUsed = Number(result.rows[0].owner_spent);
  const customerUsed = Number(result.rows[0].customer_spent);
  const totalUsed = ownerUsed + customerUsed;

  // ~250 conversations per dollar (~$0.004 per full 8-exchange conversation)
  const CONVERSATIONS_PER_DOLLAR = 250;
  const conversationsLimit = Math.floor(budget * CONVERSATIONS_PER_DOLLAR);
  const conversationsUsed = Math.floor(totalUsed * CONVERSATIONS_PER_DOLLAR);

  return {
    ownerUsed,
    ownerLimit: budget,
    customerUsed,
    customerLimit: budget,
    totalUsed,
    totalLimit: budget,
    conversationsUsed,
    conversationsLimit,
    periodStart: quota.period_start,
  };
}
