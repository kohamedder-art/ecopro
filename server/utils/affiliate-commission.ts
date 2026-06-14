import { pool } from './database';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Calculate and record affiliate commission for a user's payment
 * Called when a user makes a subscription payment
 * 
 * Logic:
 * 1. Check if user was referred by an affiliate
 * 2. Count how many subscription payments the user has made
 * 3. If within commission_months window, calculate commission (fixed amount per referral)
 * 4. Create commission record for the affiliate
 */
export async function calculateAffiliateCommission(
  userId: number,
  paymentId: number,
  paymentAmount: number
): Promise<void> {
  try {
    // Get the user's referral info from clients table
    const userResult = await pool.query(
      `SELECT c.referred_by_affiliate_id, c.referral_voucher_code,
              a.earn_per_referral, a.commission_months
       FROM clients c
       LEFT JOIN affiliates a ON a.id = c.referred_by_affiliate_id
       WHERE c.id = $1 AND c.referred_by_affiliate_id IS NOT NULL`,
      [userId]
    );

    if (!userResult.rows.length) {
      // User wasn't referred by an affiliate
      return;
    }

    const { referred_by_affiliate_id, referral_voucher_code, earn_per_referral, commission_months } = userResult.rows[0];

    if (!referred_by_affiliate_id || !earn_per_referral) {
      return;
    }

    // Get the referral record
    const referralResult = await pool.query(
      `SELECT id FROM affiliate_referrals WHERE user_id = $1 AND affiliate_id = $2`,
      [userId, referred_by_affiliate_id]
    );

    if (!referralResult.rows.length) {
      console.warn(`[Affiliate] No referral record found for user ${userId} and affiliate ${referred_by_affiliate_id}`);
      return;
    }

    const referralId = referralResult.rows[0].id;

    // Count how many subscription payments this user has made (including this one)
    const paymentCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM payments 
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    const paymentMonth = parseInt(paymentCountResult.rows[0].count);

    // Check if we're within the commission window
    if (paymentMonth > commission_months) {
      if (!isProduction) {
        console.log(`[Affiliate] Payment month ${paymentMonth} exceeds commission window ${commission_months} for user ${userId}`);
      }
      return;
    }

    // Check if commission already exists for this payment
    const existingCommission = await pool.query(
      `SELECT id FROM affiliate_commissions WHERE payment_id = $1`,
      [paymentId]
    );

    if (existingCommission.rows.length > 0) {
      console.log(`[Affiliate] Commission already recorded for payment ${paymentId}`);
      return;
    }

    // Calculate the commission (fixed amount per referral per month)
    const commissionAmount = Number(earn_per_referral);

    // Create commission record
    await pool.query(
      `INSERT INTO affiliate_commissions 
       (affiliate_id, referral_id, user_id, payment_id, payment_month, 
        user_paid_amount, platform_revenue, commission_percent, commission_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [
        referred_by_affiliate_id,
        referralId,
        userId,
        paymentId,
        paymentMonth,
        paymentAmount,
        paymentAmount,
        0,
        commissionAmount,
      ]
    );

    // Update affiliate totals
    await pool.query(
      `UPDATE affiliates 
       SET total_commission_earned = total_commission_earned + $2,
           updated_at = NOW()
       WHERE id = $1`,
      [referred_by_affiliate_id, commissionAmount]
    );

    // Update paid referrals count if this is the first payment
    if (paymentMonth === 1) {
      await pool.query(
        `UPDATE affiliates 
         SET total_paid_referrals = total_paid_referrals + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [referred_by_affiliate_id]
      );
    }

    console.log(`[Affiliate] Commission recorded: affiliate ${referred_by_affiliate_id}, user ${userId}, month ${paymentMonth}, amount ${commissionAmount}`);
  } catch (error) {
    console.error('[Affiliate] Error calculating commission:', error);
    throw error;
  }
}

/**
 * Get platform revenue settings (subscription price minus any costs)
 * For now, we assume full payment amount is platform revenue
 */
export async function getPlatformRevenueFromPayment(paymentAmount: number): Promise<number> {
  // In future, this could subtract payment processing fees, etc.
  return paymentAmount;
}
