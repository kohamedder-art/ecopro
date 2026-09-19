/**
 * Tracking status — single source of truth for display + notifications.
 *
 * Raw `delivery_status` values in DB (written by courier webhooks/pollers) are
 * noisy and courier-specific. This module maps them to:
 *  - CUSTOMER view: 4 steps (placed → confirmed → out_for_delivery → delivered/failed)
 *  - OWNER view: 5 pipeline steps + an "attention" bucket (failed/returned/cancelled)
 *
 * DB values are NEVER changed here — mapping is display-layer only.
 */

// ─── Customer: 3 steps ──────────────────────────────────────────
export type CustomerTrackStatus =
  | 'placed'           // 1. تم استلام طلبك
  | 'confirmed'        // 2. تم التأكيد — الطرد عند شركة التوصيل (includes courier OFD: no false "arriving now")
  | 'delivered'        // 3a. تم التسليم ✅
  | 'failed';          // 3b. تعذّر التوصيل ❌ (shares terminal slot)

export const CUSTOMER_TRACK_STEPS: CustomerTrackStatus[] = [
  'placed',
  'confirmed',
  'delivered',
];

export const CUSTOMER_STATUS_LABEL: Record<CustomerTrackStatus, string> = {
  placed: 'تم استلام طلبك',
  confirmed: 'تم تأكيد طلبك وهو عند شركة التوصيل',
  delivered: 'تم التسليم بنجاح ✅',
  failed: 'تعذّر التوصيل ❌',
};

// ─── Owner: 4 pipeline steps + failed + attention ───────────────
export type OwnerTrackStatus =
  | 'new'
  | 'confirmed'
  | 'in_transit' // includes courier OFD — folded, not a separate promise
  | 'delivered'
  | 'failed'     // delivery failed — terminal, needs owner action
  | 'attention'; // returned / cancelled — needs action, not a step

export const OWNER_TRACK_STEPS: OwnerTrackStatus[] = [
  'new',
  'confirmed',
  'in_transit',
  'delivered',
  'failed',
];

export const OWNER_STATUS_LABEL: Record<OwnerTrackStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  in_transit: 'في الطريق',
  delivered: 'تم التسليم',
  failed: 'فشل التوصيل',
  attention: 'يحتاج تدخل',
};

// ─── Raw → customer bucket ──────────────────────────────────────
export function toCustomerStatus(raw: string | null | undefined): CustomerTrackStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (!s || s === 'pending' || s === 'assigned' || s === 'unknown') return 'placed';
  // picked_up / in_transit / courier OFD all mean "with the courier" — OFD is
  // deliberately NOT a separate step (couriers flag it for days; false "arriving now")
  if (s === 'picked_up' || s === 'in_transit' || s === 'shipped' || s === 'at_hub' || s === 'ready_for_pickup' || s === 'out_for_delivery' || s === 'out_delivery') return 'confirmed';
  if (s === 'failed' || s === 'returned' || s === 'cancelled' || s === 'canceled') return 'failed';
  return 'confirmed'; // unrecognized → neutral in-progress, never false "failed"
}

// ─── Raw → owner bucket ─────────────────────────────────────────
export function toOwnerStatus(raw: string | null | undefined): OwnerTrackStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (!s || s === 'pending') return 'new';
  if (s === 'assigned' || s === 'picked_up' || s === 'shipped' || s === 'confirmed' || s === 'processing') return 'confirmed';
  // Courier OFD folds into in_transit — no false precision for owner either
  if (s === 'in_transit' || s === 'at_hub' || s === 'at_warehouse' || s === 'ready_for_pickup' || s === 'in_delivery' || s === 'out_for_delivery' || s === 'out_delivery') return 'in_transit';
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'failed') return 'failed';
  if (s === 'returned' || s === 'cancelled' || s === 'canceled' || s === 'fake' || s === 'duplicate' || s === 'delivery_failed' || s === 'refunded') return 'attention';
  return 'in_transit'; // unrecognized → neutral in-progress bucket
}

// ─── Manual status → courier bucket sync ────────────────────────
// Owner manual edits must win: changing order.status also syncs
// delivery_status so the tracking page/AI/notifications agree.
// Returns the delivery_status to write, or null to leave untouched
// (call-attempt statuses like no_answer_* are pre-shipment outcomes).
export function manualStatusToDelivery(status: string | null | undefined): string | null {
  const s = String(status || '').toLowerCase().trim();
  switch (s) {
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
    case 'fake':
    case 'duplicate':
      return 'cancelled';
    case 'failed':
      return 'failed';
    case 'returned':
    case 'refunded':
      return 'returned';
    case 'shipped':
      return 'shipped';
    case 'in_delivery':
    case 'at_delivery':
      return 'in_transit';
    case 'pending':
    case 'confirmed':
    case 'processing':
      return 'pending';
    default:
      return null; // no_answer_*, waiting_callback, postponed, line_closed, custom…
  }
}

// Order statuses after which courier auto-updates must NOT overwrite
// (owner closed the order manually — machine stays quiet).
export const TERMINAL_ORDER_STATUSES = new Set([
  'cancelled', 'delivered', 'completed', 'returned', 'refunded',
  'failed', 'fake', 'duplicate', 'delivery_failed',
]);

// ─── Notification gate ──────────────────────────────────────────
// Customer gets max 3 messages per order: confirmed, delivered, failed.
// Intermediate noise (picked_up→in_transit→OFD→at_hub…) stays in the same
// bucket and must NOT re-notify.
export function shouldNotifyCustomer(
  newRaw: string | null | undefined,
  prevRaw?: string | null,
): boolean {
  const s = String(newRaw || '').toLowerCase().trim();
  if (!s || s === 'unknown') return false;
  const next = toCustomerStatus(s);
  // "Order placed" is announced at order creation, never by courier sync
  if (next === 'placed') return false;
  // Same customer bucket as before → courier noise (picked_up→in_transit…), skip
  if (prevRaw != null && toCustomerStatus(prevRaw) === next) return false;
  return true;
}
