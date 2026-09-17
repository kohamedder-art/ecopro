/**
 * AI Quota Management
 *
 * Monthly message allowances per store (VIP-style finite limits):
 * - Displayed in AI Settings so owners see real consumption + % bar.
 * - Enforced in checkQuota: when the monthly allowance is gone, the AI
 *   answers with a friendly "limit reached" message instead of calling
 *   the bridge (see gemini.ts denial texts).
 * Daily request caps stay as an abuse guard on top.
 * Usage is logged in ai_usage_logs for display/history.
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

// ─── Monthly allowances (messages / store / calendar month) ───
// Tune these two numbers to taste. They should feel scarce (finite,
// visible in the UI) but finish the month for a normal active store.
const MONTHLY_LIMITS: Record<UserType, number> = {
  owner: 1000, // dashboard assistant chats (~33/day)
  customer: 5000, // auto-replies to customers (~165/day)
};

// ─── Day pass: paid 24h extension after the monthly allowance is gone ───
export const DAY_PASS_PRICE_DZD = 200;
export const DAY_PASS_DURATION_HOURS = 24;

const DAILY_LIMITS: Record<UserType, number> = {
  owner: 500,
  customer: 200,
};

/**
 * Active (unexpired) day pass for a store, if any.
 * Returns null if the table doesn't exist yet (migration pending) —
 * a missing table must never break quota checks.
 */
export async function getActivePass(clientId: number): Promise<{ id: number; endsAt: Date } | null> {
  try {
    const pool = await ensureConnection();
    const result = await pool.query(
      `SELECT id, ends_at as "endsAt"
        FROM ai_passes
        WHERE client_id = $1 AND status = 'active' AND ends_at > NOW()
        ORDER BY ends_at DESC LIMIT 1`,
      [clientId]
    );
    return result.rows[0] || null;
  } catch (err: any) {
    if (err?.code === '42P01') return null; // undefined_table: migration not applied yet
    throw err;
  }
}

/**
 * Check quota: monthly allowance (binding) + daily request cap (abuse guard).
 * An active day pass re-opens the monthly allowance for 24h (daily cap stays).
 */
export async function checkQuota(clientId: number, userType: UserType): Promise<QuotaStatus> {
  const pool = await ensureConnection();
  const monthlyLimit = MONTHLY_LIMITS[userType];
  const dailyLimit = DAILY_LIMITS[userType];

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int as month_count,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int as day_count
      FROM ai_usage_logs
      WHERE client_id = $1 AND user_type = $2`,
    [clientId, userType]
  );

  const monthUsed = result.rows[0]?.month_count || 0;
  const dayUsed = result.rows[0]?.day_count || 0;

  const monthlyRemaining = Math.max(0, monthlyLimit - monthUsed);
  const dailyRemaining = Math.max(0, dailyLimit - dayUsed);

  // Active day pass re-opens the monthly allowance (abuse cap still applies).
  let passActive = false;
  if (monthlyRemaining <= 0) {
    const pass = await getActivePass(clientId);
    passActive = !!pass;
  }

  // Binding limit is whichever runs out first; monthly is the advertised one.
  const remaining = passActive ? dailyRemaining : Math.min(monthlyRemaining, dailyRemaining);

  // Next reset = 1st of next month (what the UI promises).
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    allowed: remaining > 0,
    remaining,
    limit: monthlyLimit,
    resetDate,
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
 * Get quota usage summary for display (AI Settings page).
 * Counts MESSAGES in the current calendar month — finite VIP-style
 * allowances, so the progress bars actually move.
 */
export async function getQuotaSummary(clientId: number): Promise<{
  ownerUsed: number;
  ownerLimit: number;
  customerUsed: number;
  customerLimit: number;
  periodStart: Date;
  passActive: boolean;
  passEndsAt: Date | null;
  dayPassPriceDzd: number;
}> {
  const pool = await ensureConnection();

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE user_type = 'owner')::int as owner_msgs,
       COUNT(*) FILTER (WHERE user_type = 'customer')::int as customer_msgs
      FROM ai_usage_logs
      WHERE client_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [clientId]
  );

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const pass = await getActivePass(clientId);

  return {
    ownerUsed: Number(result.rows[0].owner_msgs),
    ownerLimit: MONTHLY_LIMITS.owner,
    customerUsed: Number(result.rows[0].customer_msgs),
    customerLimit: MONTHLY_LIMITS.customer,
    periodStart,
    passActive: !!pass,
    passEndsAt: pass ? pass.endsAt : null,
    dayPassPriceDzd: DAY_PASS_PRICE_DZD,
  };
}


