-- Allow 'platform' as a pixel_type for built-in analytics tracking
-- (without requiring Facebook/TikTok pixel configuration)

-- Drop the old constraint that only allows 'facebook' and 'tiktok'
ALTER TABLE pixel_events DROP CONSTRAINT IF EXISTS pixel_events_pixel_type_check;

-- Add updated constraint that also allows 'platform'
ALTER TABLE pixel_events ADD CONSTRAINT pixel_events_pixel_type_check
  CHECK (pixel_type IN ('facebook', 'tiktok', 'platform'));
