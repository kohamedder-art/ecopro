-- Product quantity-based bundle offers (e.g. "Buy 2 for 2700 DZD + free delivery")
CREATE TABLE IF NOT EXISTS product_offers (
  id            BIGSERIAL PRIMARY KEY,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES client_store_products(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  bundle_price  NUMERIC(10, 2) NOT NULL CHECK (bundle_price >= 0),
  compare_price NUMERIC(10, 2) NULL CHECK (compare_price IS NULL OR compare_price >= 0),
  free_delivery BOOLEAN NOT NULL DEFAULT false,
  label         TEXT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching offers for a product
CREATE INDEX IF NOT EXISTS idx_product_offers_product ON product_offers (product_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_offers_client ON product_offers (client_id);

-- Unique constraint: one offer per quantity level per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_offers_unique_qty
  ON product_offers (product_id, quantity) WHERE is_active = true;

-- Add offer_id to store_orders to track which offer was used
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS offer_id BIGINT NULL;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS offer_quantity INTEGER NULL;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS offer_bundle_price NUMERIC(10,2) NULL;
