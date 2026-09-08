-- Track which orders were already uploaded to Google Sheets
-- so exports default to new orders only.
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS exported_to_sheets_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_store_orders_sheets_pending
  ON store_orders(store_id) WHERE deleted_at IS NULL AND exported_to_sheets_at IS NULL;
