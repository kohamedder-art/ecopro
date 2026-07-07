-- Platform-level pixel tracking configuration (for landing page)
INSERT INTO platform_settings (setting_key, setting_value, data_type, description, editable)
VALUES (
  'pixel_config',
  '[]',
  'json',
  'Platform pixel tracking config — array of {platform, pixel_id, enabled}. Used on the landing page.',
  true
)
ON CONFLICT (setting_key) DO NOTHING;
