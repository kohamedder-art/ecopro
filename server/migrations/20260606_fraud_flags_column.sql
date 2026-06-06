-- Add fraud assessment columns to store_orders (stored at creation time)
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_level TEXT DEFAULT 'low';

CREATE INDEX IF NOT EXISTS idx_store_orders_fraud_level ON store_orders(fraud_level) WHERE fraud_level IN ('high', 'critical');
