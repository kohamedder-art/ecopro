-- Add image_url column to product_offers for promotional banners
ALTER TABLE product_offers ADD COLUMN IF NOT EXISTS image_url TEXT NULL;
