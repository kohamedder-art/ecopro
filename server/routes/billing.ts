import { RequestHandler } from "express";
import { randomInt } from "crypto";
import { pool } from "../utils/database";
import { jsonError, jsonServerError } from "../utils/httpHelpers";
import { createCheckoutSession, handlePaymentCompleted, handlePaymentFailed, verifyWebhookSignature } from "../utils/redotpay";

const isProduction = process.env.NODE_ENV === 'production';

async function getNumberSetting(settingKey: string, fallback: number): Promise<number> {
  try {
    const r = await pool.query(
      `SELECT setting_value
       FROM platform_settings
       WHERE setting_key = $1
       LIMIT 1`,
      [settingKey]
    );
    if (!r.rows.length) return fallback;
    const raw = r.rows[0]?.setting_value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

async function getTrialDaysFromSettings(): Promise<number> {
  try {
    const r = await pool.query(
      `SELECT setting_value, data_type
       FROM platform_settings
       WHERE setting_key = 'trial_days'
       LIMIT 1`
    );
    if (!r.rows.length) return 30;
    const raw = r.rows[0]?.setting_value;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 30;
    // keep within sane bounds
    return Math.max(1, Math.min(365, Math.floor(n)));
  } catch {
    return 30;
  }
}

/**
 * Public (no auth): exposes pricing-related settings.
 * GET /api/billing/public
 */
export const getPublicBillingInfo: RequestHandler = async (_req, res) => {
  const trialDaysRaw = await getNumberSetting('trial_days', 30);
  const subscriptionPriceRaw = await getNumberSetting('subscription_price', 3500);

  const trialDays = Math.max(1, Math.min(365, Math.floor(trialDaysRaw)));
  const subscriptionPrice = Math.max(0, Math.min(999999, subscriptionPriceRaw));

  return res.json({
    trialDays,
    subscriptionPrice,
  });
};

async function setPaymentLock(userId: number, reason: string): Promise<void> {
  // Best-effort: DB schema can be in transition (lock_type column may not exist)
  try {
    await pool.query(
      `UPDATE clients
       SET is_locked = true,
           locked_reason = $2,
           locked_at = NOW(),
           lock_type = 'payment'
       WHERE id = $1 AND (is_locked IS DISTINCT FROM true)`
      ,
      [userId, reason]
    );
  } catch {
    await pool.query(
      `UPDATE clients
       SET is_locked = true,
           locked_reason = $2,
           locked_at = NOW()
       WHERE id = $1 AND (is_locked IS DISTINCT FROM true)`
      ,
      [userId, reason]
    ).catch(() => null);
  }

  // Bots should be off for subscription-locked clients
  await pool.query(
    `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = $1`,
    [userId]
  ).catch(() => null);
}

async function clearPaymentLockIfAny(userId: number, unlockReason: string): Promise<void> {
  try {
    // Only clear payment locks; do not touch critical/admin locks.
    const r = await pool.query(
      `UPDATE clients
       SET is_locked = false,
           locked_reason = NULL,
           locked_at = NULL,
           unlock_reason = $2,
           unlocked_at = NOW()
       WHERE id = $1 AND is_locked = true AND lock_type = 'payment'`,
      [userId, unlockReason]
    );
    if ((r.rowCount ?? 0) > 0) {
      await pool.query(
        `UPDATE bot_settings SET enabled = true, updated_at = NOW() WHERE client_id = $1`,
        [userId]
      ).catch(() => null);
    }
  } catch {
    // If lock_type column doesn't exist, do not auto-unlock.
  }
}

/**
 * Create a 30-day trial subscription for a new user
 * Called during registration to ensure all new users get their trial
 */
export async function createTrialSubscription(userId: number): Promise<void> {
  try {
    const trialDays = await getTrialDaysFromSettings();
    // Check if subscription already exists
    const existing = await pool.query(
      `SELECT id FROM subscriptions WHERE user_id = $1`,
      [userId]
    );
    
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO subscriptions (user_id, status, trial_started_at, trial_ends_at, current_period_start)
         VALUES ($1, 'trial', NOW(), NOW() + ($2::text || ' days')::interval, NOW())`,
        [userId, trialDays]
      );
      if (!isProduction) {
        console.log(`[Billing] Created ${trialDays}-day trial subscription for user ${userId}`);
      }
    }
  } catch (error) {
    console.error('[Billing] Failed to create trial subscription:', error);
    // Non-critical - don't throw, the user can still use the platform
  }
}

/**
 * Get subscription status for current user
 * GET /api/billing/subscription
 */
export const getSubscription: RequestHandler = async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return jsonError(res, 401, "Not authenticated");

    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create new subscription with 30-day trial
      const trialDays = await getTrialDaysFromSettings();
      const newSub = await pool.query(
        `INSERT INTO subscriptions (user_id, status, trial_started_at, trial_ends_at)
         VALUES ($1, 'trial', NOW(), NOW() + ($2::text || ' days')::interval)
         RETURNING *`,
        [userId, trialDays]
      );
      return res.json(newSub.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting subscription:", error);
    return jsonError(res, 500, "Failed to get subscription");
  }
};

/**
 * Check if store owner has access (not expired)
 * GET /api/billing/check-access
 */
export const checkAccess: RequestHandler = async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return jsonError(res, 401, "Not authenticated");

    const result = await pool.query(
      `SELECT s.*, c.subscription_extended_until, c.is_locked, c.locked_reason, c.lock_type
       FROM subscriptions s
       LEFT JOIN clients c ON c.id = s.user_id
       WHERE s.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // New user - create subscription with 30-day trial
      const trialDays = await getTrialDaysFromSettings();
      await pool.query(
        `INSERT INTO subscriptions (user_id, status, trial_started_at, trial_ends_at)
         VALUES ($1, 'trial', NOW(), NOW() + ($2::text || ' days')::interval)`,
        [userId, trialDays]
      );
      return res.json({ hasAccess: true, status: "trial", message: "Free trial active" });
    }

    const subscription = result.rows[0];
    const now = new Date();

    const extensionEndsRaw = subscription.subscription_extended_until as any;
    const extensionEnds = extensionEndsRaw ? new Date(extensionEndsRaw) : null;
    const trialEnds = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    const activeEnds = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

    const extensionOk = !!(extensionEnds && Number.isFinite(extensionEnds.getTime()) && now < extensionEnds);
    const trialOk = subscription.status === 'trial' && !!(trialEnds && Number.isFinite(trialEnds.getTime()) && now < trialEnds);
    const activeOk = subscription.status === 'active' && (!activeEnds || (Number.isFinite(activeEnds.getTime()) && now < activeEnds));

    const hasAccess = extensionOk || trialOk || activeOk;

    // If access is restored (e.g., paid/extended) and the account is payment-locked, auto-unlock.
    if (hasAccess) {
      await clearPaymentLockIfAny(Number(userId), 'Auto unlock: subscription active');
    }

    // Trial still active
    if (trialOk) {
      return res.json({ 
        hasAccess: true, 
        status: "trial", 
        tier: subscription.tier,
        daysLeft: trialEnds ? Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
        message: "Free trial active" 
      });
    }

    // Trial expired - check if paid
    if (extensionOk) {
      return res.json({
        hasAccess: true,
        status: "extended",
        tier: subscription.tier,
        daysLeft: extensionEnds ? Math.ceil((extensionEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
        message: "Subscription extended"
      });
    }

    if (activeOk) {
      return res.json({
        hasAccess: true,
        status: "active",
        tier: subscription.tier,
        daysLeft: activeEnds ? Math.ceil((activeEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
        message: "Subscription active"
      });
    }

    // Expired/suspended
    // Enforce account lock for subscription expiration so the platform can reliably gate access.
    // This makes free-trial auto-lock work even if UI doesn't manually lock.
    await setPaymentLock(Number(userId), 'Subscription expired (auto-lock)');
    return res.json({ 
      hasAccess: false, 
      status: subscription.status,
      tier: subscription.tier,
      message: `Subscription ${subscription.status}. Please pay $7/month to continue.`
    });
  } catch (error) {
    console.error("Error checking access:", error);
    return jsonError(res, 500, "Failed to check access");
  }
};

/**
 * Get all subscriptions (admin only)
 * GET /api/billing/admin/subscriptions
 */
export const getAllSubscriptions: RequestHandler = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        s.id, s.user_id, u.email, u.name,
        s.tier, s.status, s.trial_started_at, s.trial_ends_at,
        s.current_period_start, s.current_period_end, s.created_at
      FROM subscriptions s
      JOIN clients u ON s.user_id = u.id
      ORDER BY s.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error getting subscriptions:", error);
    return jsonError(res, 500, "Failed to get subscriptions");
  }
};

/**
 * Get billing metrics (admin only)
 * GET /api/billing/admin/metrics
 */
export const getBillingMetrics: RequestHandler = async (req, res) => {
  try {
    // Total revenue (paid subscriptions)
    const revenueResult = await pool.query(
      `SELECT SUM(amount) as total_revenue FROM payments 
       WHERE status = 'completed' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
    );

    // Active subscriptions
    const activeResult = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`
    );

    // Unpaid/Expired subscriptions
    const unpaidResult = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status IN ('expired', 'cancelled')`
    );

    // New signups this month
    const newSignupsResult = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions 
       WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
    );

    // Trial active
    const trialResult = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'trial'`
    );

    // Payment failures
    const failuresResult = await pool.query(
      `SELECT COUNT(*) as count FROM payments WHERE status = 'failed'`
    );

    res.json({
      totalRevenue: parseFloat(revenueResult.rows[0].total_revenue) || 0,
      activeSubscriptions: parseInt(activeResult.rows[0].count),
      unpaidExpired: parseInt(unpaidResult.rows[0].count),
      trialActive: parseInt(trialResult.rows[0].count),
      newSignupsThisMonth: parseInt(newSignupsResult.rows[0].count),
      paymentFailures: parseInt(failuresResult.rows[0].count)
    });
  } catch (error) {
    console.error("Error getting billing metrics:", error);
    return jsonError(res, 500, "Failed to get billing metrics");
  }
};

/**
 * Get platform settings (admin only)
 * GET /api/billing/admin/settings
 */
export const getPlatformSettings: RequestHandler = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT setting_key, setting_value, data_type, updated_at FROM platform_settings`
    );

    let lastUpdated: string | null = null;

    const settings = result.rows.reduce((acc: any, row: any) => {
      if (row?.updated_at) {
        const ts = new Date(row.updated_at).toISOString();
        if (!lastUpdated || ts > lastUpdated) lastUpdated = ts;
      }

      if (row.data_type === 'number') {
        const n = Number(row.setting_value);
        acc[row.setting_key] = Number.isFinite(n) ? n : 0;
      } else {
        acc[row.setting_key] = row.setting_value;
      }
      return acc;
    }, {});

    res.json({ ...settings, updated_at: lastUpdated });
  } catch (error) {
    console.error("Error getting settings:", error);
    return jsonError(res, 500, "Failed to get settings");
  }
};

/**
 * Get public pricing settings (no auth required)
 * GET /api/billing/public/settings
 */
export const getPublicSettings: RequestHandler = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT setting_key, setting_value, data_type FROM platform_settings WHERE setting_key IN ('subscription_price', 'trial_days')`
    );
    const settings = result.rows.reduce((acc: any, row: any) => {
      if (row.data_type === 'number') {
        const n = Number(row.setting_value);
        acc[row.setting_key] = Number.isFinite(n) ? n : 0;
      } else {
        acc[row.setting_key] = row.setting_value;
      }
      return acc;
    }, {});
    res.json(settings);
  } catch (error) {
    console.error("Error getting public settings:", error);
    return jsonError(res, 500, "Failed to get settings");
  }
};

/**
 * Update platform settings (admin only)
 * POST /api/billing/admin/settings
 */
export const updatePlatformSettings: RequestHandler = async (req, res) => {
  try {
    const { settings } = req.body;
    const adminId = (req.user as any)?.id;

    if (!settings || typeof settings !== 'object') {
      return jsonError(res, 400, "Invalid settings object");
    }

    const allowedKeys = new Set([
      'maintenance_mode', 'min_app_version', 'max_stores_per_ip',
      'default_trial_days', 'max_products_free_tier', 'max_products_pro_tier',
      'commission_rate', 'referral_bonus', 'minimum_withdrawal',
      'whatsapp_webhook_url', 'whatsapp_api_version',
      'subscription_price', 'trial_days',
    ]);

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.has(key)) {
        console.warn(`[updatePlatformSettings] Ignoring unknown key: ${key}`);
        continue;
      }
      await pool.query(
        `UPDATE platform_settings SET setting_value = $1, updated_by = $2, updated_at = NOW()
         WHERE setting_key = $3`,
        [String(value), adminId, key]
      );
    }

    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating settings:", error);
    return jsonError(res, 500, "Failed to update settings");
  }
};

/**
 * Get store details for admin (subscription + owner info)
 * GET /api/billing/admin/stores
 */
export const getStoresWithSubscription: RequestHandler = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.name,
        s.tier, s.status, s.trial_started_at, s.trial_ends_at,
        s.current_period_start, s.current_period_end,
        s.created_at as subscription_created,
        u.created_at as user_created
      FROM subscriptions s
      JOIN clients u ON s.user_id = u.id
      ORDER BY s.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error getting stores:", error);
    return jsonError(res, 500, "Failed to get stores");
  }
};

/**
 * Create a RedotPay checkout session for subscription renewal
 * POST /api/billing/checkout
 * Body: {} (uses authenticated user)
 */
export const createCheckout: RequestHandler = async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    const user = (req.user as any);
    
    if (!userId) {
      return jsonError(res, 401, "Not authenticated");
    }

    // Get user email and referral info for checkout (from clients table)
    const userResult = await pool.query(
      `SELECT c.email, c.referred_by_affiliate_id, c.referral_voucher_code,
              a.discount_percent
       FROM clients c
       LEFT JOIN affiliates a ON a.id = c.referred_by_affiliate_id AND a.status = 'active'
       WHERE c.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return jsonError(res, 404, "User not found");
    }

    const userEmail = userResult.rows[0].email;
    const affiliateId = userResult.rows[0].referred_by_affiliate_id;
    const voucherCode = userResult.rows[0].referral_voucher_code;
    const discountPercent = parseFloat(userResult.rows[0].discount_percent) || 0;

    // Get or create subscription
    let subResult = await pool.query(
      `SELECT id FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    let subscriptionId: number;

    if (subResult.rows.length === 0) {
      // Create new subscription
      const newSub = await pool.query(
        `INSERT INTO subscriptions (user_id, status, trial_started_at, trial_ends_at)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days')
         RETURNING id`,
        [userId, 'trial']
      );
      subscriptionId = newSub.rows[0].id;
    } else {
      subscriptionId = subResult.rows[0].id;
    }

    // Get subscription price from settings
    const basePriceCents = await getNumberSetting('subscription_price', 7) * 100; // Convert to cents
    
    // Check if this is the user's first payment (for affiliate discount)
    let finalPriceCents = basePriceCents;
    let discountApplied = 0;
    let isFirstPayment = false;
    
    if (affiliateId && discountPercent > 0) {
      // Check if user has made any payments before
      const paymentsResult = await pool.query(
        `SELECT COUNT(*) as count FROM payments WHERE user_id = $1 AND status = 'completed'`,
        [userId]
      );
      isFirstPayment = parseInt(paymentsResult.rows[0].count) === 0;
      
      if (isFirstPayment) {
        // Apply affiliate discount on first payment only
        discountApplied = Math.round(basePriceCents * discountPercent / 100);
        finalPriceCents = basePriceCents - discountApplied;
        
        if (!isProduction) {
          console.log(`[Billing] Applying affiliate discount: ${discountPercent}% off (${discountApplied} cents) for user ${userId}, code: ${voucherCode}`);
        }
      }
    }

    const finalPriceUnits = finalPriceCents / 100;
    const basePriceUnits = basePriceCents / 100;

    // Create checkout session with RedotPay
    const checkoutSession = await createCheckoutSession({
      userId,
      userEmail,
      subscriptionId,
      amountCents: finalPriceCents,
      description: discountApplied > 0 
        ? `EcoPro subscription - $${finalPriceUnits.toFixed(2)} (${discountPercent}% off with code ${voucherCode})`
        : `EcoPro monthly subscription - $${basePriceUnits.toFixed(2)}/month`,
      metadata: {
        user_id: userId,
        subscription_id: subscriptionId,
        type: 'subscription_renewal',
        email: userEmail,
        affiliate_id: affiliateId || null,
        voucher_code: voucherCode || null,
        discount_percent: discountApplied > 0 ? discountPercent : 0,
        discount_amount: discountApplied / 100,
        original_price: basePriceUnits,
        is_first_payment: isFirstPayment,
      },
    });

    if (!isProduction) {
      console.log('[Billing] Checkout session created:', {
        userId,
        sessionToken: checkoutSession.sessionToken,
        checkoutUrl: checkoutSession.checkoutUrl,
        amount: finalPriceUnits,
        discount: discountApplied > 0 ? `${discountPercent}%` : 'none',
      });
    }

    res.json({
      message: 'Checkout session created successfully',
      sessionToken: checkoutSession.sessionToken,
      checkoutUrl: checkoutSession.checkoutUrl,
      expiresAt: checkoutSession.expiresAt,
      amount: finalPriceUnits,
      originalAmount: basePriceUnits,
      discountPercent: discountApplied > 0 ? discountPercent : 0,
      discountAmount: discountApplied / 100,
      voucherCode: discountApplied > 0 ? voucherCode : null,
      currency: 'DZD',
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return jsonServerError(res, error, 'Failed to create checkout session');
  }
};

/**
 * Handle RedotPay webhook callback
 * POST /api/billing/webhook/redotpay
 * Headers: X-RedotPay-Signature
 * Body: RedotPay webhook payload
 */
export const handleRedotPayWebhook: RequestHandler = async (req, res) => {
  try {
    const signature = req.headers['x-redotpay-signature'] as string;
    
    if (!signature) {
      console.warn('[RedotPay Webhook] Missing signature header');
      return jsonError(res, 401, 'Missing signature');
    }

    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('[RedotPay Webhook] Invalid signature');
      return jsonError(res, 401, 'Invalid signature');
    }

    const payload = req.body;

    if (!isProduction) {
      console.log('[RedotPay Webhook] Received event:', {
        event: payload.event,
        transactionId: payload.data?.transaction_id,
        status: payload.data?.status,
      });
    }

    // Handle different webhook events
    switch (payload.event) {
      case 'payment.completed':
        await handlePaymentCompleted(payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      case 'payment.cancelled':
        if (!isProduction) console.log('[RedotPay Webhook] Payment cancelled:', payload.data?.transaction_id);
        break;
      default:
        if (!isProduction) console.log('[RedotPay Webhook] Unhandled event:', payload.event);
    }

    // Always return 200 OK to acknowledge receipt
    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('[RedotPay Webhook] Error processing webhook:', error);
    // Still return 200 to prevent RedotPay from retrying
    res.json(isProduction ? { message: 'Webhook processed' } : { message: 'Webhook processed', error: (error as any).message });
  }
};

/**
 * Get payment history for current user
 * GET /api/billing/payments
 */
export const getPaymentHistory: RequestHandler = async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return jsonError(res, 401, "Not authenticated");
    }

    const result = await pool.query(
      `SELECT 
        p.id,
        p.amount,
        p.currency,
        p.status,
        p.transaction_id,
        p.payment_method,
        p.paid_at,
        p.created_at,
        p.error_message,
        s.status as subscription_status
       FROM payments p
       LEFT JOIN subscriptions s ON p.subscription_id = s.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      payments: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error getting payment history:', error);
    return jsonError(res, 500, 'Failed to get payment history');
  }
};

/**
 * ADMIN: Get pending/expired code requests (replaces payment failures)
 * GET /api/billing/admin/payment-failures
 * Now shows code requests that need attention
 */
export const getPaymentFailures: RequestHandler = async (req, res) => {
  try {
    const user = req.user as any;
    if (user?.user_type !== 'admin') {
      return jsonError(res, 403, 'Admin access required');
    }

    // Get pending and expired code requests
    const result = await pool.query(
      `SELECT 
        cr.id,
        cr.id::text as transaction_id,
        cr.client_id as user_id,
        7.00 as amount,
        'USD' as currency,
        CASE 
          WHEN cr.status = 'pending' THEN 'pending'
          WHEN cr.status = 'expired' THEN 'failed'
          WHEN cr.status = 'issued' AND cr.expiry_date < NOW() THEN 'expired'
          ELSE cr.status
        END as status,
        CASE 
          WHEN cr.status = 'pending' THEN 'Awaiting code issuance'
          WHEN cr.status = 'expired' THEN 'Code expired before redemption'
          WHEN cr.status = 'issued' AND cr.expiry_date < NOW() THEN 'Code expired - needs reissue'
          ELSE 'Unknown'
        END as failure_reason,
        cr.created_at,
        COALESCE(cr.expiry_date, cr.created_at) as updated_at,
        c.email as store_owner_email,
        c.name as store_owner_name,
        css.store_name,
        css.store_slug,
        cr.code_tier as tier,
        cr.payment_method,
        ch.id as chat_id
       FROM code_requests cr
       LEFT JOIN clients c ON cr.client_id = c.id
       LEFT JOIN client_store_settings css ON c.id = css.client_id
       LEFT JOIN chats ch ON cr.chat_id = ch.id
       WHERE cr.status IN ('pending', 'expired') 
          OR (cr.status = 'issued' AND cr.expiry_date < NOW())
       ORDER BY cr.created_at DESC`,
      []
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting code requests:', error);
    return jsonError(res, 500, 'Failed to get code requests');
  }
};

/**
 * ADMIN: Reissue a code (replaces retry payment)
 * POST /api/billing/admin/retry-payment
 * Now reissues an expired or pending code
 */
export const retryPayment: RequestHandler = async (req, res) => {
  try {
    const user = req.user as any;
    if (user?.user_type !== 'admin') {
      return jsonError(res, 403, 'Admin access required');
    }

    const { transactionId } = req.body;
    if (!transactionId) {
      return jsonError(res, 400, 'Code request ID is required');
    }

    // Get the code request details
    const codeResult = await pool.query(
      `SELECT cr.*, c.email as client_email, ch.id as chat_id
       FROM code_requests cr
       LEFT JOIN clients c ON cr.client_id = c.id
       LEFT JOIN chats ch ON cr.chat_id = ch.id
       WHERE cr.id = $1`,
      [transactionId]
    );

    if (codeResult.rows.length === 0) {
      return jsonError(res, 404, 'Code request not found');
    }

    const codeRequest = codeResult.rows[0];

    // Generate new code (crypto-secure)
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode = '';
    for (let i = 0; i < 16; i++) {
      newCode += characters.charAt(randomInt(0, characters.length));
      if ((i + 1) % 4 === 0 && i !== 15) newCode += '-';
    }

    // Update code request with new code and extended expiry
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + 1); // 1 hour expiry

    await pool.query(
      `UPDATE code_requests 
       SET generated_code = $1, 
           expiry_date = $2, 
           status = 'issued',
           issued_at = NOW()
       WHERE id = $3`,
      [newCode, newExpiry, transactionId]
    );

    // Send notification in chat if chat exists
    if (codeRequest.chat_id) {
      await pool.query(
        `INSERT INTO chat_messages (chat_id, sender_id, sender_type, message_content, message_type, metadata)
         VALUES ($1, $2, 'admin', $3, 'code_response', $4)`,
        [
          codeRequest.chat_id,
          user.id,
          `🔄 Code Reissued!\n\nYour new subscription code is:\n\`${newCode}\`\n\nThis code expires in 1 hour. Please redeem it at /codes-store`,
          JSON.stringify({ code: newCode, expiry_date: newExpiry, reissued: true })
        ]
      );
    }

    res.json({
      message: 'Code reissued successfully',
      transactionId,
      newCode,
      expiresAt: newExpiry,
      status: 'issued',
    });
  } catch (error) {
    console.error('Error reissuing code:', error);
    return jsonError(res, 500, 'Failed to reissue code');
  }
};

/**
 * ADMIN: Get payment metrics (for dashboard)
 * GET /api/billing/admin/metrics
 * Updated to work with code-based payment system
 */
export const getPaymentMetrics: RequestHandler = async (req, res) => {
  try {
    const user = req.user as any;
    if (user?.user_type !== 'admin') {
      return jsonError(res, 403, 'Admin access required');
    }

    // Get subscription counts from latest record per client, with effective status
    const subscriptionResult = await pool.query(
      `SELECT
        COUNT(CASE WHEN effective_status = 'active_paid' THEN 1 END) as active_subscriptions,
        COUNT(CASE WHEN effective_status = 'expired' THEN 1 END) as expired_count,
        COUNT(CASE WHEN effective_status = 'active_trial' THEN 1 END) as trial_count
       FROM (
        SELECT c.id as client_id,
          CASE
            WHEN s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > NOW()) THEN 'active_paid'
            WHEN s.status = 'trial' AND s.trial_ends_at > NOW() THEN 'active_trial'
            ELSE 'expired'
          END as effective_status
        FROM clients c
        LEFT JOIN LATERAL (
          SELECT status, trial_ends_at, current_period_end, created_at
          FROM subscriptions
          WHERE user_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) s ON true
       ) client_status`
    );

    // Get code statistics
    const codesResult = await pool.query(
      `SELECT 
        COUNT(*) as total_codes,
        COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_codes,
        COUNT(CASE WHEN status = 'used' THEN 1 END) as redeemed_codes,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_codes,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_codes
       FROM code_requests`
    );

    // Get codes issued this month (as MRR equivalent)
    const monthlyCodesResult = await pool.query(
      `SELECT COUNT(*) as monthly_codes FROM code_requests 
       WHERE status = 'used' 
       AND created_at >= NOW() - INTERVAL '30 days'`
    );

    // Get churn rate (clients whose subscription expired this month)
    const churnResult = await pool.query(
      `SELECT COUNT(*) as churn_count FROM clients
       WHERE subscription_ends_at IS NOT NULL
       AND subscription_ends_at >= NOW() - INTERVAL '30 days'
       AND subscription_ends_at <= NOW()`
    );

    // Get new signups this month
    const signupsResult = await pool.query(
      `SELECT COUNT(*) as new_signups FROM clients
       WHERE created_at >= NOW() - INTERVAL '30 days'`
    );

    // Count temporarily paid clients
    const tempPaidResult = await pool.query(
      `SELECT COUNT(*) as temp_paid_count FROM clients 
       WHERE is_paid_temporarily = true 
       AND subscription_extended_until > NOW()`
    );
    const tempPaidCount = parseInt(tempPaidResult.rows[0]?.temp_paid_count || 0);

    // Calculate estimated MRR based on active subscriptions + temporarily paid (assuming $7/code)
    const subscriptionPrice = 7; // $7 per month
    const activeCount = parseInt(subscriptionResult.rows[0]?.active_subscriptions || 0);
    const mrr = (activeCount + tempPaidCount) * subscriptionPrice;

    const metrics = {
      mrr: mrr,
      active_subscriptions: activeCount + tempPaidCount,  // Include temporarily paid users
      expired_count: parseInt(subscriptionResult.rows[0]?.expired_count || 0),
      trial_count: parseInt(subscriptionResult.rows[0]?.trial_count || 0),
      // Code statistics
      total_codes_issued: parseInt(codesResult.rows[0]?.total_codes || 0),
      codes_issued: parseInt(codesResult.rows[0]?.issued_codes || 0),
      codes_redeemed: parseInt(codesResult.rows[0]?.redeemed_codes || 0),
      codes_pending: parseInt(codesResult.rows[0]?.pending_codes || 0),
      codes_expired: parseInt(codesResult.rows[0]?.expired_codes || 0),
      monthly_redemptions: parseInt(monthlyCodesResult.rows[0]?.monthly_codes || 0),
      // Legacy fields for backward compat
      failed_payments: parseInt(codesResult.rows[0]?.expired_codes || 0), // Expired codes = "failed"
      unpaid_count: parseInt(subscriptionResult.rows[0]?.expired_count || 0),
      churn_rate: parseFloat(((parseInt(churnResult.rows[0]?.churn_count || 0) / Math.max(activeCount, 1)) * 100).toFixed(1)),
      new_signups: parseInt(signupsResult.rows[0]?.new_signups || 0),
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error getting payment metrics:', error);
    return jsonError(res, 500, 'Failed to get payment metrics');
  }
};

/**
 * Expire a client's subscription (admin only)
 * POST /api/billing/admin/expire-subscription
 * Used for testing voucher code redemption flow
 */
export const expireSubscription: RequestHandler = async (req, res) => {
  try {
    const adminUser = req.user as any;
    
    // Verify admin access
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, 'Admin access required');
    }

    const { clientId, reason } = req.body;

    if (!clientId) {
      return jsonError(res, 400, 'Client ID is required');
    }

    // Check if client exists
    const clientResult = await pool.query(
      'SELECT id, email, name FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return jsonError(res, 404, 'Client not found');
    }

    const client = clientResult.rows[0];

    // Begin transaction
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // Update or create subscription as expired
      const subResult = await dbClient.query(
        `INSERT INTO subscriptions (user_id, status, current_period_start, current_period_end, updated_at)
         VALUES ($1, 'expired', NOW() - INTERVAL '40 days', NOW() - INTERVAL '1 day', NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           status = 'expired',
           current_period_end = NOW() - INTERVAL '1 day',
           updated_at = NOW()
         RETURNING *`,
        [clientId]
      );

      // Note: We do NOT lock the account - user can still login
      // They will be redirected to the renew page instead

      await dbClient.query('COMMIT');

      res.json({
        success: true,
        message: `Subscription expired for ${client.email}`,
        client: {
          id: client.id,
          email: client.email,
          name: client.name
        },
        subscription: subResult.rows[0],
        reason: reason || 'Testing voucher code flow'
      });
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error('Error expiring subscription:', error);
    return jsonError(res, 500, 'Failed to expire subscription');
  }
};

/**
 * Reactivate a client's subscription (admin only)
 * POST /api/billing/admin/reactivate-subscription
 */
export const reactivateSubscription: RequestHandler = async (req, res) => {
  try {
    const adminUser = req.user as any;
    
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.user_type !== 'admin')) {
      return jsonError(res, 403, 'Admin access required');
    }

    const { clientId, durationDays = 30 } = req.body;

    if (!clientId) {
      return jsonError(res, 400, 'Client ID is required');
    }

    const clientResult = await pool.query(
      'SELECT id, email, name FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return jsonError(res, 404, 'Client not found');
    }

    const client = clientResult.rows[0];

    // Update subscription to active
    const subResult = await pool.query(
      `INSERT INTO subscriptions (user_id, status, current_period_start, current_period_end, updated_at)
       VALUES ($1, 'active', NOW(), NOW() + INTERVAL '${durationDays} days', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'active',
         current_period_start = NOW(),
         current_period_end = NOW() + INTERVAL '${durationDays} days',
         updated_at = NOW()
       RETURNING *`,
      [clientId]
    );

    res.json({
      success: true,
      message: `Subscription reactivated for ${client.email} (${durationDays} days)`,
      client: {
        id: client.id,
        email: client.email,
        name: client.name
      },
      subscription: subResult.rows[0]
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return jsonError(res, 500, 'Failed to reactivate subscription');
  }
};

