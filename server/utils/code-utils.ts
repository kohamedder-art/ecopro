/**
 * Code Generation and Validation Utilities
 * Handles secure subscription code generation, validation, and redemption
 */

import crypto from 'crypto';
import { pool } from './database';

/**
 * Generate a secure, unique subscription code
 * Format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric characters)
 * Example: A7K2-9M3Q-5R8T-2B9L
 */
export function generateSubscriptionCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  // Generate 16 random alphanumeric characters
  for (let i = 0; i < 16; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    code += characters[randomIndex];

    // Add hyphens for readability (every 4 characters)
    if ((i + 1) % 4 === 0 && i !== 15) {
      code += '-';
    }
  }

  return code;
}

/**
 * Normalize user input into the canonical code format.
 * - Removes spaces/dashes/any non-alphanumeric
 * - Uppercases
 * - If it contains exactly 16 chars, re-inserts dashes as XXXX-XXXX-XXXX-XXXX
 */
export function normalizeSubscriptionCode(input: string): string {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (cleaned.length !== 16) return String(input || '').trim().toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join('-') || cleaned;
}

/**
 * Validate code format
 */
export function isValidCodeFormat(code: string): boolean {
  const normalized = normalizeSubscriptionCode(code);
  const codeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return codeRegex.test(normalized);
}

/**
 * Get code age in hours
 */
export function getCodeAgeHours(issuedAt: Date | string): number {
  const issued = typeof issuedAt === 'string' ? new Date(issuedAt) : issuedAt;
  const now = new Date();
  return (now.getTime() - issued.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if code is expired
 */
export function isCodeExpired(expiryDate: Date | string): boolean {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  return new Date() > expiry;
}

/**
 * Get hours until code expiry
 */
export function getHoursUntilExpiry(expiryDate: Date | string): number {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();
  return (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Format expiry time in human-readable format
 */
export function formatExpiryTime(expiryDate: Date | string): string {
  const hours = getHoursUntilExpiry(expiryDate);

  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
  }

  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''} remaining`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} remaining`;
}

/**
 * Rate limit check for code validation attempts
 * Strict: Max 3 attempts per 5 minutes per user (prevents brute force)
 */
export async function checkCodeValidationRateLimit(
  userId: number,
  userType: 'client' | 'seller',
  ipAddress?: string
): Promise<{ allowed: boolean; attemptsRemaining: number; resetIn: number }> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Get attempts in last 5 minutes
    const result = await pool.query(
      `SELECT COUNT(*) as attempt_count 
       FROM code_validation_attempts 
       WHERE user_id = $1 AND user_type = $2 AND created_at > $3`,
      [userId, userType, fiveMinutesAgo]
    );

    const attemptCount = parseInt(result.rows[0].attempt_count);
    const maxAttempts = 3;
    const allowed = attemptCount < maxAttempts;

    // Calculate reset time (seconds until oldest attempt expires)
    const oldestAttempt = await pool.query(
      `SELECT created_at FROM code_validation_attempts 
       WHERE user_id = $1 AND user_type = $2 AND created_at > $3
       ORDER BY created_at ASC LIMIT 1`,
      [userId, userType, fiveMinutesAgo]
    );

    let resetIn = 0;
    if (oldestAttempt.rows.length > 0) {
      const oldestTime = new Date(oldestAttempt.rows[0].created_at).getTime();
      resetIn = Math.ceil((oldestTime + 5 * 60 * 1000 - Date.now()) / 1000);
    }

    return {
      allowed,
      attemptsRemaining: Math.max(0, maxAttempts - attemptCount),
      resetIn: Math.max(0, resetIn)
    };
  } catch (error: any) {
    console.error('Rate limit check error:', error);
    // On error, allow the attempt but log it
    return { allowed: true, attemptsRemaining: 5, resetIn: 0 };
  }
}

/**
 * Record code validation attempt for rate limiting
 */
export async function recordCodeValidationAttempt(
  userId: number,
  userType: 'client' | 'seller',
  attemptedCode: string,
  result: 'success' | 'invalid' | 'expired' | 'already_used',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO code_validation_attempts (user_id, user_type, attempted_code, attempt_result, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, userType, attemptedCode, result, ipAddress || null, userAgent || null]
    );
  } catch (error: any) {
    console.error('Error recording validation attempt:', error);
  }
}

/**
 * Validate subscription code and return details
 * Checks: format, expiry, already used, valid status
 */
export async function validateSubscriptionCode(
  code: string
): Promise<{
  valid: boolean;
  codeRequest?: any;
  error?: string;
}> {
  try {
    const normalizedCode = normalizeSubscriptionCode(code);

    // Format validation
    if (!isValidCodeFormat(normalizedCode)) {
      return {
        valid: false,
        error: 'Invalid code format. Use format: XXXX-XXXX-XXXX-XXXX'
      };
    }

    // Query database
    const result = await pool.query(
      `SELECT * FROM code_requests WHERE generated_code = $1`,
      [normalizedCode.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'Code not found. Please check and try again.'
      };
    }

    const codeRequest = result.rows[0];

    // Check if code is in correct status
    if (codeRequest.status !== 'issued') {
      return {
        valid: false,
        error: `Code has already been ${codeRequest.status}. Each code can only be used once.`
      };
    }

    // Check expiry
    if (isCodeExpired(codeRequest.expiry_date)) {
      return {
        valid: false,
        error: `Code has expired. Codes are valid for 1 hour after being issued.`
      };
    }

    return {
      valid: true,
      codeRequest
    };
  } catch (error: any) {
    return {
      valid: false,
      error: 'Error validating code. Please try again.'
    };
  }
}

/**
 * Redeem a code for a client
 * This activates/upgrades their subscription
 */
export async function redeemSubscriptionCode(
  code: string,
  clientId: number,
  userAgent?: string,
  ipAddress?: string
): Promise<{
  success: boolean;
  subscription?: any;
  error?: string;
}> {
  try {
    const normalizeTier = (t: any): string => String(t || '').trim().toLowerCase();
    const tierRank = (t: string): number => {
      switch (normalizeTier(t)) {
        case 'bronze':
          return 1;
        case 'silver':
          return 2;
        case 'gold':
          return 3;
        default:
          return 0;
      }
    };
    const coerceCodeTierToSubscriptionTier = (t: any): string => {
      const tt = normalizeTier(t);
      // Business rule: voucher/license codes grant Gold-level editor access.
      if (tt === 'voucher' || tt === 'license') return 'gold';
      if (tt === 'general') return 'silver';
      return tt;
    };

    // Check rate limit first
    const rateLimit = await checkCodeValidationRateLimit(clientId, 'client', ipAddress);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many attempts. Please try again in ${rateLimit.resetIn} second${rateLimit.resetIn !== 1 ? 's' : ''}.`
      };
    }

    // Validate code
    const validation = await validateSubscriptionCode(code);
    if (!validation.valid) {
      // Record failed attempt
      await recordCodeValidationAttempt(
        clientId,
        'client',
        code,
        'invalid',
        ipAddress,
        userAgent
      );

      return {
        success: false,
        error: validation.error
      };
    }

    const codeRequest = validation.codeRequest;

    const requestedTier = coerceCodeTierToSubscriptionTier((codeRequest as any)?.code_tier);

    // Verify client matches the code request
    // If the code was issued to a specific client, enforce ownership.
    // If client_id is NULL, the code is an unassigned voucher and can be redeemed by any client.
    if (codeRequest.client_id != null && codeRequest.client_id !== clientId) {
      await recordCodeValidationAttempt(
        clientId,
        'client',
        code,
        'invalid',
        ipAddress,
        userAgent
      );

      return {
        success: false,
        error: 'This code was not issued to your account.'
      };
    }

    // Begin transaction: update code status and subscription
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Mark code as used
      const updateCodeResult = await client.query(
        `UPDATE code_requests 
         SET status = 'used', redeemed_at = NOW(), redeemed_by_client_id = $1, is_redeemable = false
         WHERE id = $2 AND status = 'issued'
         RETURNING *`,
        [clientId, codeRequest.id]
      );

      if (updateCodeResult.rows.length === 0) {
        throw new Error('Code was already redeemed');
      }

      // Get user associated with client (clients table is the store owner)
      const userResult = await client.query(
        `SELECT id FROM clients WHERE id = $1`,
        [clientId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Client user not found');
      }

      const userId = userResult.rows[0].id;

      // Get or create subscription
      const subResult = await client.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      let subscriptionId;
      if (subResult.rows.length === 0) {
        // Create new subscription with 30-day trial-to-active conversion
        const newSub = await client.query(
          `INSERT INTO subscriptions (user_id, tier, status, trial_started_at, trial_ends_at, current_period_start, current_period_end)
           VALUES ($1, $2, 'active', NOW() - INTERVAL '1 day', NOW(), NOW(), NOW() + INTERVAL '30 days')
           RETURNING *`,
          [userId, requestedTier || 'free']
        );
        subscriptionId = newSub.rows[0].id;
      } else {
        // Update existing subscription to active (or extend if already active)
        const currentSub = subResult.rows[0];
        const newEndDate = currentSub.status === 'active' 
          ? new Date(currentSub.current_period_end).getTime() + (30 * 24 * 60 * 60 * 1000)
          : Date.now() + (30 * 24 * 60 * 60 * 1000);

        const currentTier = normalizeTier((currentSub as any)?.tier);
        const nextTier = requestedTier || currentTier || 'free';
        const upgradedTier = tierRank(nextTier) > tierRank(currentTier) ? nextTier : currentTier || nextTier;

        const updateSubResult = await client.query(
          `UPDATE subscriptions 
           SET status = 'active', 
               tier = $1,
               current_period_end = to_timestamp($2 / 1000.0),
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [upgradedTier || 'free', newEndDate, currentSub.id]
        );
        subscriptionId = updateSubResult.rows[0].id;
      }

      // Get final subscription state
      const finalSub = await client.query(
        `SELECT * FROM subscriptions WHERE id = $1`,
        [subscriptionId]
      );

      // Read subscription price from platform settings
      const priceRes = await client.query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = 'subscription_price'`
      );
      const subscriptionPrice = priceRes.rows[0]?.setting_value
        ? Math.max(0, Number(priceRes.rows[0].setting_value))
        : 3500;

      // Create payment record for code redemption
      await client.query(
        `INSERT INTO payments
         (user_id, subscription_id, checkout_session_id, amount, currency, status, transaction_id, payment_method, provider_response, paid_at)
         VALUES ($1, $2, NULL, $3, 'DZD', 'completed', $4, 'code', $5, NOW())`,
        [
          userId,
          subscriptionId,
          subscriptionPrice,
          code, // Use the redeemed code as transaction_id for traceability
          JSON.stringify({ code_redeemed: code, method: 'voucher_code', duration_days: 30 })
        ]
      );

      // Unlock account if it was locked - always unlock after successful code redemption
      // This handles any lock reason since the user proved they have a valid code
      await client.query(
        `UPDATE clients
         SET is_locked = false, locked_reason = NULL, locked_at = NULL, locked_by_admin_id = NULL
         WHERE id = $1
         AND is_locked = true`,
        [clientId]
      );

      // Record successful attempt
      await recordCodeValidationAttempt(
        clientId,
        'client',
        code,
        'success',
        ipAddress,
        userAgent
      );

      await client.query('COMMIT');

      return {
        success: true,
        subscription: finalSub.rows[0]
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Code redemption error:', error);
    return {
      success: false,
      error: error.message || 'Failed to redeem code. Please try again.'
    };
  }
}

/**
 * Get code status for display in chat
 */
export function getCodeStatus(codeRequest: any): {
  status: 'pending' | 'issued' | 'used' | 'expired' | 'expiring-soon';
  label: string;
  color: string;
  icon: string;
} {
  if (codeRequest.status === 'used') {
    return {
      status: 'used',
      label: `Redeemed ${new Date(codeRequest.redeemed_at).toLocaleDateString()}`,
      color: 'bg-green-100 text-green-800',
      icon: '✓'
    };
  }

  if (codeRequest.status === 'pending') {
    return {
      status: 'pending',
      label: 'Awaiting payment confirmation',
      color: 'bg-yellow-100 text-yellow-800',
      icon: '⏳'
    };
  }

  if (isCodeExpired(codeRequest.expiry_date)) {
    return {
      status: 'expired',
      label: 'Code expired',
      color: 'bg-red-100 text-red-800',
      icon: '✗'
    };
  }

  const hoursLeft = getHoursUntilExpiry(codeRequest.expiry_date);
  if (hoursLeft < 0.25) { // Less than 15 minutes
    return {
      status: 'expiring-soon',
      label: `Expires in ${Math.round(hoursLeft * 60)} minutes`,
      color: 'bg-red-100 text-red-800 animate-pulse',
      icon: '⚠'
    };
  }

  return {
    status: 'issued',
    label: `${formatExpiryTime(codeRequest.expiry_date)}`,
    color: 'bg-blue-100 text-blue-800',
    icon: '📋'
  };
}

/**
 * Delete expired codes and mark as expired in database
 * Should run as a background job
 */
export async function cleanupExpiredCodes(): Promise<{ cleaned: number; notified: number }> {
  try {
    // Debug: First, check how many codes match the condition
    const debugResult = await pool.query(
      `SELECT COUNT(*) as count, 
              COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_count,
              COUNT(CASE WHEN expiry_date IS NULL THEN 1 END) as null_expiry_count,
              COUNT(CASE WHEN expiry_date < NOW() THEN 1 END) as expired_count,
              MIN(expiry_date) as oldest_expiry,
              MAX(expiry_date) as newest_expiry
       FROM code_requests 
       WHERE status = 'issued'`
    );
    console.log('[Code Cleanup] Debug info:', debugResult.rows[0]);

    // Find expired codes that haven't been marked as expired yet
    const expiredResult = await pool.query(
      `UPDATE code_requests 
       SET status = 'expired', is_redeemable = false
       WHERE status = 'issued' AND expiry_date < NOW()
       RETURNING id, client_id, chat_id`
    );

    const cleaned = expiredResult.rows.length;
    let notified = 0;

    // Send notifications for each expired code
    for (const expiredCode of expiredResult.rows) {
      try {
        // Add system message to chat about expiration
        await pool.query(
          `INSERT INTO chat_messages (chat_id, sender_id, sender_type, message_content, message_type)
           VALUES ($1, $2, 'system', 'Code has expired. A new code needs to be issued.', 'system')`,
          [expiredCode.chat_id, expiredCode.client_id]
        );
        notified++;
      } catch (error) {
        console.error('Error notifying about expired code:', error);
      }
    }

    console.log(`[Code Cleanup] Cleaned ${cleaned} expired codes, notified about ${notified}`);
    return { cleaned, notified };
  } catch (error: any) {
    console.error('Code cleanup error:', error);
    return { cleaned: 0, notified: 0 };
  }
}
