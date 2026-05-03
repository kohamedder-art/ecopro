-- Add order_source column to track where orders came from
-- Values: 'storefront' (default), 'ai_chat', 'manual', 'api'
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS order_source VARCHAR(50) DEFAULT 'storefront',
  ADD COLUMN IF NOT EXISTS source_platform VARCHAR(50); -- e.g. 'telegram', 'whatsapp', 'messenger', 'instagram'

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_store_orders_source ON store_orders(client_id, order_source);
