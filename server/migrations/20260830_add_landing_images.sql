ALTER TABLE client_store_products
ADD COLUMN IF NOT EXISTS landing_images TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE client_stock_products
ADD COLUMN IF NOT EXISTS landing_images TEXT[] DEFAULT ARRAY[]::TEXT[];
