-- Replace default blue (#3b82f6) with sage (#8a9a8b) for a professional soft-tone palette.
-- Also updates stores that never changed away from the blue default.

ALTER TABLE client_store_settings
  ALTER COLUMN primary_color SET DEFAULT '#8a9a8b',
  ALTER COLUMN secondary_color SET DEFAULT '#c8a88e';

UPDATE client_store_settings
  SET primary_color = '#8a9a8b', secondary_color = '#c8a88e'
  WHERE primary_color = '#3b82f6' OR primary_color IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_store_settings') THEN
    ALTER TABLE seller_store_settings
      ALTER COLUMN primary_color SET DEFAULT '#8a9a8b',
      ALTER COLUMN secondary_color SET DEFAULT '#c8a88e';

    UPDATE seller_store_settings
      SET primary_color = '#8a9a8b', secondary_color = '#c8a88e'
      WHERE primary_color = '#3b82f6' OR primary_color IS NULL;
  END IF;
END $$;
