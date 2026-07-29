-- Add product_id column to ab_test_variants (added after initial migration)
ALTER TABLE ab_test_variants ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES client_store_products(id) ON DELETE SET NULL;
