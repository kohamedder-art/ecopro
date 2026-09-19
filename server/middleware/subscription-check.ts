import { RequestHandler } from "express";
import { pool } from "../utils/database";

/**
 * Middleware to enforce subscription status
 * Returns 403 if subscription is expired or not active
 * Allows access only if:
 * - Trial is still active (before trial_ends_at)
 * - Paid subscription is active (before period_end)
 */
export const requireActiveSubscription: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user as any;
    const userId = user?.id;
    
    // Admin users bypass subscription check
    if (user?.user_type === 'admin') {
      return next();
    }

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // If the client is explicitly payment-locked, block access immediately.
    // (Lock allows login, but should restrict store owner APIs.)
    try {
      const lockRes = await pool.query(
        `SELECT is_locked, locked_reason, lock_type FROM clients WHERE id = $1`,
        [userId]
      );
      if (lockRes.rows.length) {
        const row = lockRes.rows[0];
        const lockType = row.lock_type || (typeof row.locked_reason === 'string' && /(subscription|expired|payment|trial|billing)/i.test(row.locked_reason)
          ? 'payment'
          : 'critical');
        if (row.is_locked && lockType === 'payment') {
          return res.status(403).json({
            error: row.locked_reason || "Subscription expired. Your store access is temporarily disabled.",
            accountLocked: true,
            paymentRequired: true,
            code: "SUBSCRIPTION_EXPIRED"
          });
        }
        // Frozen by owner (all stores paused) — resume anytime, paid days preserved.
        if (row.is_locked && lockType === 'frozen') {
          return res.status(403).json({
            error: row.locked_reason || "Account frozen. Resume anytime from Billing.",
            accountLocked: true,
            frozen: true,
            paymentRequired: false,
            code: "SUBSCRIPTION_PAUSED"
          });
        }
      }
    } catch {
      // If we cannot validate lock status, fail closed.
      return res.status(503).json({ error: "Server error checking subscription", code: "SUBSCRIPTION_CHECK_ERROR" });
    }

    // Get subscription from database
    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    // No subscription found - this shouldn't happen, but allow with warning
    if (result.rows.length === 0) {
      return res.status(402).json({
        error: "No subscription found. Please create a store to start your free trial.",
        paymentRequired: true,
        code: "NO_SUBSCRIPTION"
      });
    }

    const subscription = result.rows[0];
    const now = new Date();

    // Frozen by owner — never convert to a payment lock, just report paused.
    if (subscription.status === 'paused') {
      return res.status(403).json({
        error: "Account frozen. Resume anytime from Billing — paid days are preserved.",
        accountLocked: true,
        frozen: true,
        paymentRequired: false,
        code: "SUBSCRIPTION_PAUSED"
      });
    }

    // Check if trial is still active
    if (subscription.status === 'trial') {
      const trialEnd = new Date(subscription.trial_ends_at);
      if (now < trialEnd) {
        // Ensure payment-lock is cleared when trial is valid
        try {
          await pool.query(
            `UPDATE clients
             SET is_locked = false, locked_reason = NULL, lock_type = NULL, updated_at = NOW()
             WHERE id = $1 AND COALESCE(is_locked, false) = true AND lock_type = 'payment'`,
            [userId]
          );
        } catch {
          // Non-fatal
        }
        // Trial still active, allow access
        return next();
      }
      // Trial expired, move to expired status
      await pool.query(
        `UPDATE subscriptions SET status = 'expired' WHERE id = $1`,
        [subscription.id]
      );
      // Fall through to lock account
    }

    // Check if paid subscription is active
    if (subscription.status === 'active' && subscription.period_end) {
      const periodEnd = new Date(subscription.period_end);
      if (now < periodEnd) {
        // Ensure payment-lock is cleared when subscription is valid
        try {
          await pool.query(
            `UPDATE clients
             SET is_locked = false, locked_reason = NULL, lock_type = NULL, updated_at = NOW()
             WHERE id = $1 AND COALESCE(is_locked, false) = true AND lock_type = 'payment'`,
            [userId]
          );
        } catch {
          // Non-fatal
        }
        // Paid subscription still active, allow access
        return next();
      }
      // Subscription expired, move to expired status
      await pool.query(
        `UPDATE subscriptions SET status = 'expired' WHERE id = $1`,
        [subscription.id]
      );
      // Fall through to lock account
    }

    // Subscription expired or not active - LOCK ACCOUNT
    const trialEnded = subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toISOString() : null;

    // Mark client as payment-locked so UI/bots can rely on a single flag.
    try {
      await pool.query(
        `UPDATE clients
         SET is_locked = true,
             lock_type = 'payment',
             locked_reason = COALESCE(locked_reason, 'Subscription expired. Pay $7/month to unlock.'),
             locked_at = COALESCE(locked_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [userId]
      );
    } catch {
      // Non-fatal; still block API access.
    }
    
    return res.status(403).json({
      error: "Subscription expired. Your store access is temporarily disabled.",
      accountLocked: true,
      status: subscription.status,
      trialEndedAt: trialEnded,
      paymentRequired: true,
      paymentLink: "https://redotpay.com/checkout/session_placeholder",
      renewalUrl: "/api/billing/renew",
      message: "Pay $7/month to unlock your store and continue managing your business.",
      code: "SUBSCRIPTION_EXPIRED"
    });

  } catch (error) {
    console.error('Subscription check middleware error:', error);
    res.status(500).json({ 
      error: "Server error checking subscription",
      code: "SUBSCRIPTION_CHECK_ERROR"
    });
  }
};

export default requireActiveSubscription;
