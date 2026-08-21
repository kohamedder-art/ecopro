-- Add rotation_hours to ab_test_variants for time-based image rotation
ALTER TABLE ab_test_variants ADD COLUMN IF NOT EXISTS rotation_hours INTEGER DEFAULT 0;
