/**
 * AlertService
 * Provides pure-function helpers for the Guardian AI alert system.
 * All functions are tenant-isolated via client_id.
 */

import type { Pool } from 'pg';

export type AlertSeverity = 'urgent' | 'warning' | 'info';
export type AlertStatus   = 'unread' | 'read' | 'dismissed' | 'followed';

export interface StoredAlert {
  id: number;
  client_id: number;
  type: string;
  severity: AlertSeverity;
  message: string;
  ai_logic?: string;
  metadata: Record<string, unknown>;
  link: string;
  created_at: string;
  updated_at: string;
  status: AlertStatus;
}

/** How long before the same alert type can fire again for the same store. */
const DEDUP_WINDOW_HOURS = 6;

/**
 * Default thresholds — seeded on first scan if the row is missing.
 */
export const DEFAULT_THRESHOLDS: Record<string, number> = {
  stale_pending_hours: 24,
  fake_order_week:     5,
  low_stock_enabled:   1,
  sub_expiry_days:     5,
};

/**
 * Ensure default threshold rows exist for a client.
 * Uses INSERT … ON CONFLICT DO NOTHING so existing customisations are preserved.
 */
export async function ensureDefaultThresholds(pool: Pool, clientId: number): Promise<void> {
  const entries = Object.entries(DEFAULT_THRESHOLDS);
  for (const [metric, value] of entries) {
    await pool.query(
      `INSERT INTO user_thresholds (client_id, metric, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (client_id, metric) DO NOTHING`,
      [clientId, metric, value]
    );
  }
}

/**
 * Read all thresholds for a client, falling back to defaults if missing.
 */
export async function getThresholds(
  pool: Pool,
  clientId: number
): Promise<Record<string, number>> {
  const res = await pool.query(
    `SELECT metric, value FROM user_thresholds WHERE client_id = $1`,
    [clientId]
  );
  const result: Record<string, number> = { ...DEFAULT_THRESHOLDS };
  for (const row of res.rows) {
    result[row.metric] = parseFloat(row.value);
  }
  return result;
}

/**
 * Check whether a new alert of this type was already fired for this client
 * within the deduplication window.
 *
 * - If a recent alert exists  → update its updated_at and return null (skip).
 * - If no recent alert         → call messageFn() to get AI prose, insert alert
 *                                + unread tracking row, return the new alert id.
 *
 * @param messageFn  Async function that returns the AI-generated message text.
 *                   Only called when a new alert will actually be inserted.
 * @param logicNote  Short human note about why this fired (stored in ai_logic).
 */
export async function checkAndInsertAlert(
  pool: Pool,
  clientId: number,
  type: string,
  severity: AlertSeverity,
  metadata: Record<string, unknown>,
  link: string,
  messageFn: () => Promise<string>,
  logicNote: string
): Promise<number | null> {
  // ── deduplication check ──────────────────────────────────
  const dupRes = await pool.query(
    `SELECT id FROM ai_alerts
     WHERE client_id = $1
       AND type       = $2
       AND created_at > NOW() - INTERVAL '${DEDUP_WINDOW_HOURS} hours'
     ORDER BY created_at DESC
     LIMIT 1`,
    [clientId, type]
  );

  if (dupRes.rows.length > 0) {
    // Bump updated_at so callers can see it was re-evaluated
    await pool.query(
      `UPDATE ai_alerts SET updated_at = NOW() WHERE id = $1`,
      [dupRes.rows[0].id]
    );
    return null; // duplicate — do not insert
  }

  // ── generate AI message ──────────────────────────────────
  let message: string;
  try {
    message = await messageFn();
  } catch {
    // Fallback so one failed AI call doesn't abort other alerts
    message = buildFallbackMessage(type, metadata);
  }

  // ── insert alert + tracking row ──────────────────────────
  const insertRes = await pool.query(
    `INSERT INTO ai_alerts (client_id, type, severity, message, ai_logic, metadata, link)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [clientId, type, severity, message, logicNote, JSON.stringify(metadata), link]
  );
  const alertId = insertRes.rows[0].id as number;

  await pool.query(
    `INSERT INTO alert_tracking (alert_id, client_id, status)
     VALUES ($1, $2, 'unread')
     ON CONFLICT (alert_id, client_id) DO NOTHING`,
    [alertId, clientId]
  );

  return alertId;
}

/**
 * Return alerts for a client that are NOT dismissed.
 * Joins ai_alerts with alert_tracking so the status is included.
 */
export async function getClientAlerts(
  pool: Pool,
  clientId: number,
  limit = 10
): Promise<StoredAlert[]> {
  const res = await pool.query(
    `SELECT
       a.id, a.client_id, a.type, a.severity, a.message, a.ai_logic,
       a.metadata, a.link, a.created_at, a.updated_at,
       COALESCE(t.status, 'unread') AS status
     FROM ai_alerts a
     LEFT JOIN alert_tracking t ON t.alert_id = a.id AND t.client_id = $1
     WHERE a.client_id = $1
       AND COALESCE(t.status, 'unread') NOT IN ('dismissed', 'followed')
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [clientId, limit]
  );
  return res.rows as StoredAlert[];
}

/**
 * Verify the alert belongs to this client before any status mutation.
 * Returns false if the alert doesn't exist or belongs to another tenant.
 */
export async function verifyAlertOwnership(
  pool: Pool,
  alertId: number,
  clientId: number
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM ai_alerts WHERE id = $1 AND client_id = $2 LIMIT 1`,
    [alertId, clientId]
  );
  return res.rows.length > 0;
}

export async function markAlertRead(pool: Pool, alertId: number, clientId: number): Promise<void> {
  await pool.query(
    `INSERT INTO alert_tracking (alert_id, client_id, status, read_at)
     VALUES ($1, $2, 'read', NOW())
     ON CONFLICT (alert_id, client_id)
     DO UPDATE SET status = CASE
       WHEN alert_tracking.status IN ('dismissed', 'followed') THEN alert_tracking.status
       ELSE 'read'
     END,
     read_at = COALESCE(alert_tracking.read_at, NOW())`,
    [alertId, clientId]
  );
}

export async function markAlertDismissed(pool: Pool, alertId: number, clientId: number): Promise<void> {
  await pool.query(
    `INSERT INTO alert_tracking (alert_id, client_id, status)
     VALUES ($1, $2, 'dismissed')
     ON CONFLICT (alert_id, client_id)
     DO UPDATE SET status = 'dismissed'`,
    [alertId, clientId]
  );
}

export async function markAlertFollowed(
  pool: Pool,
  alertId: number,
  clientId: number,
  actionTaken = 'clicked'
): Promise<void> {
  await pool.query(
    `INSERT INTO alert_tracking (alert_id, client_id, status, action_taken, acted_at)
     VALUES ($1, $2, 'followed', $3, NOW())
     ON CONFLICT (alert_id, client_id)
     DO UPDATE SET
       status       = 'followed',
       action_taken = $3,
       acted_at     = NOW()`,
    [alertId, clientId, actionTaken]
  );
}

// ─── Fallback template messages ────────────────────────────────────────────
function buildFallbackMessage(type: string, meta: Record<string, unknown>): string {
  switch (type) {
    case 'stale_orders':
      return `عندك ${meta.count ?? 'بعض'} طلب(ات) عالقة في الانتظار لأكثر من 24 ساعة. توجه لصفحة الطلبات لتأكيدها أو إلغائها.`;
    case 'out_of_stock':
      return `${meta.count ?? 'بعض'} منتجات نفذ مخزونها. حدّث المخزون باش ما تخسرش مبيعات.`;
    case 'low_stock':
      return `${meta.count ?? 'بعض'} منتجات مخزونها قارب ينفذ. فكّر في إعادة التوريد.`;
    case 'subscription_expiry':
      return `اشتراكك ينتهي خلال ${meta.daysLeft ?? 'أيام قليلة'} يوم. جدّد الآن باش متجرك يبقى شغال.`;
    case 'fake_order_spike':
      return `عندك ${meta.count ?? 'عدة'} طلبات مزيفة أو مكررة هاد الأسبوع. راجعها في صفحة الطلبات.`;
    case 'bot_disabled':
      return `البوت تاع الرسائل معطّل حالياً والطلبات مازالت داخلة. فعّلو باش العملاء يتلقاو تأكيد تلقائي.`;
    case 'delivery_gap':
      return `بعض الولايات اللي عندها طلبات ما عندهاش أسعار توصيل. حدّد أسعار التوصيل لكل الولايات.`;
    default:
      return `تم اكتشاف مشكلة في متجرك. تحقق من لوحة التحكم.`;
  }
}
