-- Add third variant dimension (size2) for number sizes (shoe sizes, etc.)
-- Backward compatible: existing products with just color + size continue to work

-- Add size2 to product_variants
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS size2 TEXT NULL;

-- Update unique index (drop old, create new with size2)
DROP INDEX IF EXISTS uniq_product_variants_product_color_size;
CREATE UNIQUE INDEX uniq_product_variants_product_color_size
  ON product_variants (product_id, LOWER(COALESCE(color, '')), LOWER(COALESCE(size, '')), LOWER(COALESCE(size2, '')));

-- Add variant_size2 to store_orders for snapshot
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS variant_size2 TEXT;

-- Add size2 to client_stock_variants
ALTER TABLE client_stock_variants ADD COLUMN IF NOT EXISTS size2 TEXT NULL;

-- Update stock variants unique index
DROP INDEX IF EXISTS uniq_client_stock_variants_stock_color_size;
CREATE UNIQUE INDEX uniq_client_stock_variants_stock_color_size
  ON client_stock_variants (stock_id, LOWER(COALESCE(color, '')), LOWER(COALESCE(size, '')), LOWER(COALESCE(size2, '')));
