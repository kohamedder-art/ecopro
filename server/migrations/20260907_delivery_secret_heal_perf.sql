-- Speed up dashboard polling queries (flagged-count, low-stock alerts)
-- so they can't pile up and hit pool timeouts on large tables.
CREATE INDEX IF NOT EXISTS idx_client_stock_lowstock
  ON client_stock_products(store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_orders_flagged_client
  ON store_orders(client_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_orders_flagged_store
  ON store_orders(store_id, status) WHERE deleted_at IS NULL;
