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

// ─── Owner: 4 pipeline steps + attention bucket ─────────────────
export type OwnerTrackStatus =
  | 'new'
  | 'confirmed'
  | 'in_transit' // includes courier OFD — folded, not a separate promise
  | 'delivered'
  | 'attention'; // failed / returned / cancelled — needs action, not a step

export const OWNER_TRACK_STEPS: OwnerTrackStatus[] = [
  'new',
  'confirmed',
  'in_transit',
  'delivered',
];

export const OWNER_STATUS_LABEL: Record<OwnerTrackStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  in_transit: 'في الطريق',
  delivered: 'تم التسليم',
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
  if (s === 'failed' || s === 'returned' || s === 'cancelled' || s === 'canceled' || s === 'fake' || s === 'duplicate') return 'attention';
  return 'in_transit'; // unrecognized → neutral in-progress bucket
}

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
