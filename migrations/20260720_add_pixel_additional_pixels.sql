ALTER TABLE client_pixel_settings ADD COLUMN IF NOT EXISTS additional_pixels JSONB DEFAULT '[]'::jsonb;
