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

// ─── Customer: 4 steps ──────────────────────────────────────────
export type CustomerTrackStatus =
  | 'placed'           // 1. تم استلام طلبك
  | 'confirmed'        // 2. تم التأكيد — الطرد عند شركة التوصيل
  | 'out_for_delivery' // 3. المندوب في الطريق إليك
  | 'delivered'        // 4a. تم التسليم ✅
  | 'failed';          // 4b. تعذّر التوصيل ❌ (shares terminal slot)

export const CUSTOMER_TRACK_STEPS: CustomerTrackStatus[] = [
  'placed',
  'confirmed',
  'out_for_delivery',
  'delivered',
];

export const CUSTOMER_STATUS_LABEL: Record<CustomerTrackStatus, string> = {
  placed: 'تم استلام طلبك',
  confirmed: 'تم تأكيد طلبك وهو عند شركة التوصيل',
  out_for_delivery: 'المندوب في الطريق إليك',
  delivered: 'تم التسليم بنجاح ✅',
  failed: 'تعذّر التوصيل ❌',
};

// ─── Owner: 5 pipeline steps + attention bucket ─────────────────
export type OwnerTrackStatus =
  | 'new'
  | 'confirmed'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'attention'; // failed / returned / cancelled — needs action, not a step

export const OWNER_TRACK_STEPS: OwnerTrackStatus[] = [
  'new',
  'confirmed',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

export const OWNER_STATUS_LABEL: Record<OwnerTrackStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  in_transit: 'في الطريق',
  out_for_delivery: 'خارج للتوصيل',
  delivered: 'تم التسليم',
  attention: 'يحتاج تدخل',
};

// ─── Raw → customer bucket ──────────────────────────────────────
export function toCustomerStatus(raw: string | null | undefined): CustomerTrackStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (!s || s === 'pending' || s === 'assigned' || s === 'unknown') return 'placed';
  if (s === 'picked_up' || s === 'in_transit' || s === 'shipped' || s === 'at_hub' || s === 'ready_for_pickup') return 'confirmed';
  if (s === 'out_for_delivery' || s === 'out_delivery') return 'out_for_delivery';
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'failed' || s === 'returned' || s === 'cancelled' || s === 'canceled') return 'failed';
  return 'confirmed'; // unrecognized → neutral in-progress, never false "failed"
}

// ─── Raw → owner bucket ─────────────────────────────────────────
export function toOwnerStatus(raw: string | null | undefined): OwnerTrackStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (!s || s === 'pending') return 'new';
  if (s === 'assigned' || s === 'picked_up' || s === 'shipped' || s === 'confirmed' || s === 'processing') return 'confirmed';
  if (s === 'in_transit' || s === 'at_hub' || s === 'at_warehouse' || s === 'ready_for_pickup' || s === 'in_delivery') return 'in_transit';
  if (s === 'out_for_delivery' || s === 'out_delivery') return 'out_for_delivery';
  if (s === 'delivered' || s === 'completed') return 'delivered';
  if (s === 'failed' || s === 'returned' || s === 'cancelled' || s === 'canceled' || s === 'fake' || s === 'duplicate') return 'attention';
  return 'in_transit'; // unrecognized → neutral in-progress bucket
}

// ─── Notification gate ──────────────────────────────────────────
// Customer gets max 4 messages per order: confirmed, out_for_delivery,
// delivered, failed. Intermediate noise (picked_up→in_transit→at_hub…)
// stays in the same bucket and must NOT re-notify.
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
