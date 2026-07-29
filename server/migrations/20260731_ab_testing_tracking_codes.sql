-- Add tracking_code to ab_test_variants for per-variant tracking links
ALTER TABLE ab_test_variants ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;
-- Add ab_test_variant_id to store_orders for order attribution
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ab_test_variant_id INTEGER REFERENCES ab_test_variants(id) ON DELETE SET NULL;

-- Generate tracking codes for existing variants that don't have one
UPDATE ab_test_variants SET tracking_code = substr(md5(random()::text || clock_timestamp()::text), 1, 8) WHERE tracking_code IS NULL;
