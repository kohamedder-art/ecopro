import { pool } from './database';

const isProduction = process.env.NODE_ENV === 'production';

export async function enforceSubscriptionLocksOnce(): Promise<{ locked: number; unlocked: number }> {
  // Lock clients whose subscription is expired (trial ended or active ended) and who have no extension.
  // Also unlock payment-locked clients when access is restored.
  let locked = 0;
  let unlocked = 0;

  // 1) Lock expired
  try {
    const idsRes = await pool.query(
      `SELECT c.id
       FROM clients c
       LEFT JOIN subscriptions s ON s.user_id = c.id
       WHERE (c.is_blocked IS DISTINCT FROM true)
         AND (c.is_locked IS DISTINCT FROM true)
         AND (
           s.user_id IS NULL
           OR NOT (
             (c.subscription_extended_until IS NOT NULL AND c.subscription_extended_until > NOW())
             OR (s.status = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > NOW())
             OR (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > NOW()))
           )
         )
       LIMIT 500`
    );

    const ids: number[] = idsRes.rows.map((r: any) => Number(r.id)).filter((n) => Number.isFinite(n));
    if (ids.length) {
      // Best-effort lock_type
      try {
        const r = await pool.query(
          `UPDATE clients
           SET is_locked = true,
               locked_reason = 'Subscription expired (auto-lock)',
               locked_at = NOW(),
               lock_type = 'payment'
           WHERE id = ANY($1::int[]) AND (is_locked IS DISTINCT FROM true)`,
          [ids]
        );
        locked = r.rowCount ?? 0;
      } catch {
        const r = await pool.query(
          `UPDATE clients
           SET is_locked = true,
               locked_reason = 'Subscription expired (auto-lock)',
               locked_at = NOW()
           WHERE id = ANY($1::int[]) AND (is_locked IS DISTINCT FROM true)`,
          [ids]
        ).catch(() => ({ rowCount: 0 } as any));
        locked = r.rowCount ?? 0;
      }

      await pool.query(
        `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = ANY($1::int[])`,
        [ids]
      ).catch(() => null);
    }
  } catch (e: any) {
    if (!isProduction) console.warn('[subscription-enforcement] lock pass failed:', e?.message || e);
  }

  // 2) Unlock restored access (payment locks only)
  try {
    const idsRes = await pool.query(
      `SELECT c.id
       FROM clients c
       LEFT JOIN subscriptions s ON s.user_id = c.id
       WHERE c.is_locked = true
         AND c.lock_type = 'payment'
         AND (c.is_blocked IS DISTINCT FROM true)
         AND s.user_id IS NOT NULL
         AND (
           (c.subscription_extended_until IS NOT NULL AND c.subscription_extended_until > NOW())
           OR (s.status = 'trial' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > NOW())
           OR (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > NOW()))
         )
       LIMIT 500`
    );

    const ids: number[] = idsRes.rows.map((r: any) => Number(r.id)).filter((n) => Number.isFinite(n));
    if (ids.length) {
      const r = await pool.query(
        `UPDATE clients
         SET is_locked = false,
             locked_reason = NULL,
             locked_at = NULL,
             unlock_reason = 'Auto unlock: subscription active',
             unlocked_at = NOW()
         WHERE id = ANY($1::int[]) AND is_locked = true AND lock_type = 'payment'`,
        [ids]
      );
      unlocked = r.rowCount ?? 0;

      if (unlocked > 0) {
        await pool.query(
          `UPDATE bot_settings SET enabled = true, updated_at = NOW() WHERE client_id = ANY($1::int[])`,
          [ids]
        ).catch(() => null);
      }
    }
  } catch {
    // If lock_type column doesn't exist yet, skip auto-unlock.
  }

  return { locked, unlocked };
}

export function startSubscriptionEnforcement(): void {
  // Run once on boot, then periodically.
  void enforceSubscriptionLocksOnce().catch(() => null);
  setInterval(() => {
    void enforceSubscriptionLocksOnce().catch(() => null);
  }, 15 * 60 * 1000);
}
