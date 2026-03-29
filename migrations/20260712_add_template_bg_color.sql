-- Add template_bg_color column to client_store_settings
-- This allows background color to be stored as a proper DB column (like template_accent_color)
-- instead of only in the template_settings JSONB field.
ALTER TABLE client_store_settings ADD COLUMN IF NOT EXISTS template_bg_color TEXT;
