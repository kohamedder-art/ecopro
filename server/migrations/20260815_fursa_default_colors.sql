-- Set fursa store colors as platform-wide defaults
-- Primary: #f97316 (orange), Accent: #22c55e (green), Bg: #b0b8c9 (gray-blue)

ALTER TABLE client_store_settings
  ALTER COLUMN primary_color SET DEFAULT '#f97316',
  ALTER COLUMN template_accent_color SET DEFAULT '#22c55e',
  ALTER COLUMN template_bg_color SET DEFAULT '#b0b8c9',
  ALTER COLUMN template_bg_image SET DEFAULT 'url(/store-backgrounds/360_F_644654023_cZMVl6feXmUMSNi9CPb9qygWkl64gtMl.webp)';

-- Update stores that never set custom colors (still have old defaults or NULL)
UPDATE client_store_settings
  SET 
    primary_color = '#f97316',
    template_accent_color = '#22c55e',
    template_bg_color = '#b0b8c9',
    template_bg_image = 'url(/store-backgrounds/360_F_644654023_cZMVl6feXmUMSNi9CPb9qygWkl64gtMl.webp)'
  WHERE 
    (primary_color IS NULL OR primary_color IN ('#a0876a', '#3b82f6', '#8a9a8b'))
    AND template_accent_color IS NULL;

-- Update stores with NULL bg (even if they had custom primary)
UPDATE client_store_settings
  SET
    template_bg_color = '#b0b8c9',
    template_bg_image = 'url(/store-backgrounds/360_F_644654023_cZMVl6feXmUMSNi9CPb9qygWkl64gtMl.webp)'
  WHERE template_bg_color IS NULL;

-- Same for seller_store_settings if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_store_settings') THEN
    ALTER TABLE seller_store_settings
      ALTER COLUMN primary_color SET DEFAULT '#f97316',
      ALTER COLUMN template_accent_color SET DEFAULT '#22c55e',
      ALTER COLUMN template_bg_color SET DEFAULT '#b0b8c9',
      ALTER COLUMN template_bg_image SET DEFAULT 'url(/store-backgrounds/360_F_644654023_cZMVl6feXmUMSNi9CPb9qygWkl64gtMl.webp)';

    UPDATE seller_store_settings
      SET 
        primary_color = '#f97316',
        template_accent_color = '#22c55e',
        template_bg_color = '#b0b8c9',
        template_bg_image = 'url(/store-backgrounds/360_F_644654023_cZMVl6feXmUMSNi9CPb9qygWkl64gtMl.webp)'
      WHERE 
        (primary_color IS NULL OR primary_color IN ('#a0876a', '#3b82f6', '#8a9a8b'))
        AND template_accent_color IS NULL;

    UPDATE seller_store_settings
      SET
        template_bg_color = '#b0b8c9',
        template_bg_image = 'url(/store-backgrounds/360_F_644654023_cZMVl6feXmUMSNi9CPb9qygWkl64gtMl.webp)'
      WHERE template_bg_color IS NULL;
  END IF;
END $$;
