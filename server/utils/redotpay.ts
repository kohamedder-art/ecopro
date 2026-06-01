import crypto from 'crypto';
import https from 'https';
import { pool } from './database';
import { calculateAffiliateCommission } from './affiliate-commission';

/**
 * RedotPay Integration Utilities
 * Handles checkout session creation, signature verification, and payment processing
 */

// Environment variables
const REDOTPAY_API_KEY = process.env.REDOTPAY_API_KEY || '';
const REDOTPAY_SECRET_KEY = process.env.REDOTPAY_SECRET_KEY || '';
const REDOTPAY_WEBHOOK_SECRET = process.env.REDOTPAY_WEBHOOK_SECRET || '';
const REDOTPAY_API_URL = process.env.REDOTPAY_API_URL || 'https://api.redotpay.com/v1';
const REDOTPAY_REDIRECT_URL = process.env.REDOTPAY_REDIRECT_URL || 'https://sahla4eco.com/billing/success';

// Pricing (in cents: 700 = 7.00 DZD)
const SUBSCRIPTION_PRICE_CENTS = 700;
const CURRENCY = 'DZD';

/**
 * Interface for checkout session creation
 */
export interface CreateCheckoutSessionParams {
  userId: number;
  userEmail: string;
  userPhone?: string;
  subscriptionId: number;
  description?: string;
  metadata?: Record<string, any>;
  /** Custom amount in cents (optional - defaults to SUBSCRIPTION_PRICE_CENTS) */
  amountCents?: number;
}

/**
 * Interface for webhook payload
 */
export interface RedotPayWebhookPayload {
  event: string;
  data: {
    session_id: string;
    transaction_id: string;
    amount: number;
    currency: string;
    status: 'completed' | 'failed' | 'pending';
    customer_email: string;
    customer_phone?: string;
    metadata?: Record<string, any>;
    paid_at?: string;
    [key: string]: any;
  };
  timestamp: string;
}

/**
 * Create a unique session token
 */
export function generateSessionToken(): string {
  return 'session_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Create a RedotPay checkout session
 * Returns session token and checkout URL
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<{
  sessionToken: string;
  checkoutUrl: string;
  expiresAt: Date;
  redotpaySessionId: string;
}> {
  try {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute expiry

    // Use custom amount if provided (for discounts), otherwise use standard price
    const finalAmountCents = params.amountCents ?? SUBSCRIPTION_PRICE_CENTS;

    // Call RedotPay API to create session
    const redotpaySessionId = await createRedotPaySession({
      amount: finalAmountCents,
      currency: CURRENCY,
      customer_email: params.userEmail,
      customer_phone: params.userPhone || '',
      description: params.description || 'EcoPro monthly subscription ($7/month)',
      metadata: {
        user_id: params.userId,
        subscription_id: params.subscriptionId,
        type: 'subscription_renewal',
        ...params.metadata,
      },
      success_url: `${REDOTPAY_REDIRECT_URL}?session=${sessionToken}`,
      cancel_url: `${process.env.VITE_API_URL || 'https://sahla4eco.com'}/billing/cancelled`,
    });

    // Store checkout session in database
    const result = await pool.query(
      `INSERT INTO checkout_sessions 
       (user_id, session_token, subscription_id, redotpay_session_id, status, amount, currency, metadata, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        params.userId,
        sessionToken,
        params.subscriptionId,
        redotpaySessionId,
        'pending',
        finalAmountCents / 100, // Convert cents to units
        CURRENCY,
        JSON.stringify({
          user_id: params.userId,
          subscription_id: params.subscriptionId,
          type: 'subscription_renewal',
          ...params.metadata,
        }),
        expiresAt,
      ]
    );

    const checkoutUrl = `https://checkout.redotpay.com/pay/${redotpaySessionId}`;

    console.log('[RedotPay] Checkout session created:', {
      sessionToken,
      redotpaySessionId,
      userId: params.userId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      sessionToken,
      checkoutUrl,
      expiresAt,
      redotpaySessionId,
    };
  } catch (error) {
    console.error('[RedotPay] Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Make HTTPS request to RedotPay API
 */
async function makeRedotPayRequest(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, REDOTPAY_API_URL);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${REDOTPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`RedotPay API error: ${res.statusCode} - ${data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse RedotPay response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Create session on RedotPay and return session ID
 */
async function createRedotPaySession(params: {
  amount: number;
  currency: string;
  customer_email: string;
  customer_phone: string;
  description: string;
  metadata: Record<string, any>;
  success_url: string;
  cancel_url: string;
}): Promise<string> {
  try {
    const response = await makeRedotPayRequest('POST', '/checkout/sessions', {
      amount: params.amount,
      currency: params.currency,
      customer_email: params.customer_email,
      customer_phone: params.customer_phone,
      description: params.description,
      metadata: params.metadata,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
    });

    if (!response.session_id) {
      throw new Error('No session_id in RedotPay response');
    }

    return response.session_id;
  } catch (error) {
    console.error('[RedotPay] Error creating RedotPay session:', error);
    throw error;
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  try {
    if (!REDOTPAY_WEBHOOK_SECRET) {
      console.error('[RedotPay] REDOTPAY_WEBHOOK_SECRET not configured');
      return false;
    }

    const hmac = crypto
      .createHmac('sha256', REDOTPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const isValid = hmac === signature;

    if (!isValid) {
      console.warn('[RedotPay] Invalid webhook signature:', {
        expected: hmac,
        received: signature,
      });
    }

    return isValid;
  } catch (error) {
    console.error('[RedotPay] Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Handle webhook payment completed event
 */
export async function handlePaymentCompleted(
  payload: RedotPayWebhookPayload
): Promise<void> {
  const { session_id, transaction_id, amount, status, metadata } = payload.data;

  try {
    // Verify amount matches expected subscription price from platform settings
    const priceRes = await pool.query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'subscription_price'`
    );
    const expectedPriceCents = priceRes.rows[0]?.setting_value
      ? Number(priceRes.rows[0].setting_value) * 100
      : 700;

    // Allow a small tolerance for currency conversion rounding
    if (amount < expectedPriceCents * 0.95 || amount > expectedPriceCents * 1.05) {
      console.warn(
        `[RedotPay] Amount mismatch: expected ~${expectedPriceCents}, got ${amount}. Processing anyway.`
      );
    }

    // Extract user_id and subscription_id from metadata
    const userId = metadata?.user_id;
    const subscriptionId = metadata?.subscription_id;

    if (!userId || !subscriptionId) {
      throw new Error(
        `Missing required metadata: user_id=${userId}, subscription_id=${subscriptionId}`
      );
    }

    // Check if transaction already processed (idempotency)
    const existingPayment = await pool.query(
      'SELECT id FROM payments WHERE transaction_id = $1',
      [transaction_id]
    );

    if (existingPayment.rows.length > 0) {
      console.log('[RedotPay] Transaction already processed:', transaction_id);
      return;
    }

    // Update subscription to active
    if (status === 'completed') {
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await pool.query(
        `UPDATE subscriptions 
         SET status = $1, 
             current_period_start = $2,
             current_period_end = $3,
             auto_renew = true,
             updated_at = NOW()
         WHERE id = $4`,
        ['active', now, periodEnd, subscriptionId]
      );

      console.log('[RedotPay] Subscription activated:', { subscriptionId, userId });
    }

    // Create payment record
    const checkoutSession = await pool.query(
      'SELECT id, metadata FROM checkout_sessions WHERE redotpay_session_id = $1',
      [session_id]
    );

    const checkoutSessionId = checkoutSession.rows[0]?.id || null;
    const sessionMetadata = checkoutSession.rows[0]?.metadata || {};

    await pool.query(
      `INSERT INTO payments 
       (user_id, subscription_id, checkout_session_id, amount, currency, status, transaction_id, payment_method, provider_response, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        userId,
        subscriptionId,
        checkoutSessionId,
        amount / 100, // Convert cents to units
        payload.data.currency,
        'completed',
        transaction_id,
        'redotpay',
        JSON.stringify(payload.data),
        new Date(payload.data.paid_at || payload.timestamp),
      ]
    ).then(async (paymentResult) => {
      // Calculate affiliate commission if user was referred
      const paymentId = paymentResult.rows[0]?.id;
      if (paymentId) {
        try {
          await calculateAffiliateCommission(userId, paymentId, amount / 100);
          
          // Mark discount as applied in referral record if this was a discounted payment
          if (sessionMetadata.is_first_payment && sessionMetadata.affiliate_id && sessionMetadata.discount_percent > 0) {
            await pool.query(
              `UPDATE affiliate_referrals 
               SET discount_applied = true 
               WHERE affiliate_id = $1 AND user_id = $2`,
              [sessionMetadata.affiliate_id, userId]
            );
            console.log('[RedotPay] Marked affiliate discount as applied:', {
              affiliateId: sessionMetadata.affiliate_id,
              userId,
              discountPercent: sessionMetadata.discount_percent,
            });
          }
        } catch (commissionError) {
          console.warn('[RedotPay] Failed to calculate affiliate commission:', commissionError);
          // Non-critical - don't fail the payment
        }
      }
    });

    // Update checkout session status
    if (checkoutSessionId) {
      await pool.query(
        'UPDATE checkout_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['completed', checkoutSessionId]
      );
    }

    console.log('[RedotPay] Payment recorded successfully:', {
      transactionId: transaction_id,
      userId,
      amount: amount / 100,
    });
  } catch (error) {
    console.error('[RedotPay] Error handling payment completed:', error);
    throw error;
  }
}

/**
 * Handle webhook payment failed event
 */
export async function handlePaymentFailed(
  payload: RedotPayWebhookPayload
): Promise<void> {
  const { session_id, transaction_id, amount, metadata } = payload.data;

  try {
    const userId = metadata?.user_id;
    const subscriptionId = metadata?.subscription_id;

    // Check if already recorded
    const existingPayment = await pool.query(
      'SELECT id, retry_count FROM payments WHERE transaction_id = $1',
      [transaction_id]
    );

    if (existingPayment.rows.length > 0) {
      // Update retry count
      const currentRetries = existingPayment.rows[0].retry_count || 0;
      await pool.query(
        `UPDATE payments 
         SET retry_count = $1, 
             next_retry_at = NOW() + INTERVAL '1 hour',
             updated_at = NOW()
         WHERE transaction_id = $2`,
        [currentRetries + 1, transaction_id]
      );
    } else {
      // Create failed payment record
      const checkoutSession = await pool.query(
        'SELECT id FROM checkout_sessions WHERE redotpay_session_id = $1',
        [session_id]
      );

      const checkoutSessionId = checkoutSession.rows[0]?.id || null;

      await pool.query(
        `INSERT INTO payments 
         (user_id, subscription_id, checkout_session_id, amount, currency, status, transaction_id, payment_method, error_message, retry_count, next_retry_at, provider_response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId,
          subscriptionId,
          checkoutSessionId,
          amount / 100,
          payload.data.currency,
          'failed',
          transaction_id,
          'redotpay',
          payload.data.error_message || 'Payment declined',
          1,
          new Date(Date.now() + 3600000), // Retry in 1 hour
          JSON.stringify(payload.data),
        ]
      );
    }

    console.log('[RedotPay] Payment failure recorded:', {
      transactionId: transaction_id,
      userId,
      reason: payload.data.error_message,
    });
  } catch (error) {
    console.error('[RedotPay] Error handling payment failed:', error);
    throw error;
  }
}

export default {
  generateSessionToken,
  createCheckoutSession,
  verifyWebhookSignature,
  handlePaymentCompleted,
  handlePaymentFailed,
};
