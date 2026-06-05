-- Add 'in_delivery' status (handed off to courier, awaiting pickup)
-- and backfill all existing clients so the new code path works immediately.

INSERT INTO order_statuses (client_id, name, key, color, icon, sort_order, is_default, counts_as_revenue, is_system)
SELECT c.id, 'In Delivery', 'in_delivery', '#8b5cf6', '🚚', 2, true, false, true
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM order_statuses os
  WHERE os.client_id = c.id AND os.key = 'in_delivery'
)
ON CONFLICT DO NOTHING;
