-- Enable custom store slugs that owners can edit

-- Remove the UNIQUE constraint temporarily to allow migration
-- We'll re-add it after updating existing slugs

-- First, let's make the column nullable to allow better slug generation
ALTER TABLE client_store_settings 
  ALTER COLUMN store_slug DROP NOT NULL;

-- Add a column to track if slug was custom-set by owner
ALTER TABLE client_store_settings 
  ADD COLUMN IF NOT EXISTS is_custom_slug BOOLEAN DEFAULT false;

-- Function to generate URL-friendly slug from store name
CREATE OR REPLACE FUNCTION generate_url_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  -- Convert Arabic/Persian characters to Latin equivalents
  slug := input_text;
  
  -- Transliterate common Arabic characters
  slug := REPLACE(slug, 'ا', 'a');
  slug := REPLACE(slug, 'أ', 'a');
  slug := REPLACE(slug, 'إ', 'i');
  slug := REPLACE(slug, 'آ', 'aa');
  slug := REPLACE(slug, 'ب', 'b');
  slug := REPLACE(slug, 'ت', 't');
  slug := REPLACE(slug, 'ث', 'th');
  slug := REPLACE(slug, 'ج', 'j');
  slug := REPLACE(slug, 'ح', 'h');
  slug := REPLACE(slug, 'خ', 'kh');
  slug := REPLACE(slug, 'د', 'd');
  slug := REPLACE(slug, 'ذ', 'dh');
  slug := REPLACE(slug, 'ر', 'r');
  slug := REPLACE(slug, 'ز', 'z');
  slug := REPLACE(slug, 'س', 's');
  slug := REPLACE(slug, 'ش', 'sh');
  slug := REPLACE(slug, 'ص', 's');
  slug := REPLACE(slug, 'ض', 'd');
  slug := REPLACE(slug, 'ط', 't');
  slug := REPLACE(slug, 'ظ', 'z');
  slug := REPLACE(slug, 'ع', 'a');
  slug := REPLACE(slug, 'غ', 'gh');
  slug := REPLACE(slug, 'ف', 'f');
  slug := REPLACE(slug, 'ق', 'q');
  slug := REPLACE(slug, 'ك', 'k');
  slug := REPLACE(slug, 'ل', 'l');
  slug := REPLACE(slug, 'م', 'm');
  slug := REPLACE(slug, 'ن', 'n');
  slug := REPLACE(slug, 'ه', 'h');
  slug := REPLACE(slug, 'و', 'w');
  slug := REPLACE(slug, 'ي', 'y');
  slug := REPLACE(slug, 'ء', '');
  slug := REPLACE(slug, 'ئ', 'y');
  slug := REPLACE(slug, 'ؤ', 'w');
  slug := REPLACE(slug, 'ة', 'h');
  slug := REPLACE(slug, 'ى', 'a');
  
  -- Lowercase
  slug := LOWER(slug);
  
  -- Replace spaces and special chars with hyphens
  slug := REGEXP_REPLACE(slug, '[^a-z0-9]+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  slug := TRIM(BOTH '-' FROM slug);
  
  -- Collapse multiple hyphens
  slug := REGEXP_REPLACE(slug, '-+', '-', 'g');
  
  -- Limit length
  slug := LEFT(slug, 50);
  
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Generate better slugs from existing store names for stores without custom slugs
UPDATE client_store_settings 
SET store_slug = generate_url_slug(COALESCE(store_name, 'store-' || client_id::text)),
    is_custom_slug = false
WHERE store_slug IS NULL 
   OR store_slug LIKE 'store-%'
   OR is_custom_slug = false;

-- Ensure uniqueness by appending numbers if needed
DO $$
DECLARE
  duplicate RECORD;
  counter INT;
  new_slug TEXT;
BEGIN
  FOR duplicate IN 
    SELECT store_slug, MIN(id) as keep_id
    FROM client_store_settings 
    GROUP BY store_slug 
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    FOR duplicate IN 
      SELECT id, store_slug 
      FROM client_store_settings 
      WHERE store_slug = duplicate.store_slug 
        AND id != duplicate.keep_id
      ORDER BY id
    LOOP
      new_slug := duplicate.store_slug || '-' || counter;
      WHILE EXISTS (SELECT 1 FROM client_store_settings WHERE store_slug = new_slug) LOOP
        counter := counter + 1;
        new_slug := duplicate.store_slug || '-' || counter;
      END LOOP;
      
      UPDATE client_store_settings 
      SET store_slug = new_slug,
          is_custom_slug = false
      WHERE id = duplicate.id;
      
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Re-add unique constraint
ALTER TABLE client_store_settings 
  ADD CONSTRAINT unique_store_slug UNIQUE (store_slug);

-- Validate slug format function
CREATE OR REPLACE FUNCTION is_valid_store_slug(slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must be 3-50 chars
  IF LENGTH(slug) < 3 OR LENGTH(slug) > 50 THEN
    RETURN false;
  END IF;
  
  -- Must contain only lowercase letters, numbers, and hyphens
  IF slug !~ '^[a-z0-9-]+$' THEN
    RETURN false;
  END IF;
  
  -- Cannot start or end with hyphen
  IF slug ~ '^-' OR slug ~ '-$' THEN
    RETURN false;
  END IF;
  
  -- Cannot have consecutive hyphens
  IF slug ~ '--' THEN
    RETURN false;
  END IF;
  
  -- Reserved words
  IF slug IN ('admin', 'api', 'store', 'dashboard', 'login', 'register', 'logout', 'settings', 
              'profile', 'orders', 'products', 'cart', 'checkout', 'payment', 'support', 'help',
              'terms', 'privacy', 'about', 'contact', 'blog', 'news', 'app', 'mobile', 'ios', 'android') THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

SELECT 'Custom store slug migration applied' AS status;
