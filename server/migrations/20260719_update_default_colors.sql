-- Replace default blue (#3b82f6) with warm earth tones (#a0876a / #8B7355).
-- Also updates stores that never changed away from the blue default.

ALTER TABLE client_store_settings
  ALTER COLUMN primary_color SET DEFAULT '#a0876a',
  ALTER COLUMN secondary_color SET DEFAULT '#8B7355';

UPDATE client_store_settings
  SET primary_color = '#a0876a', secondary_color = '#8B7355'
  WHERE primary_color = '#3b82f6' OR primary_color IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_store_settings') THEN
    ALTER TABLE seller_store_settings
      ALTER COLUMN primary_color SET DEFAULT '#a0876a',
      ALTER COLUMN secondary_color SET DEFAULT '#8B7355';

    UPDATE seller_store_settings
      SET primary_color = '#a0876a', secondary_color = '#8B7355'
      WHERE primary_color = '#3b82f6' OR primary_color IS NULL;
  END IF;
END $$;
