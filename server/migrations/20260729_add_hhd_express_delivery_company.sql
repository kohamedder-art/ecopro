-- Migration: Add HHD Express delivery company
-- Date: 2026-07-29
-- Purpose: Add HHD Express as a new delivery company (Ecotrack-powered)
-- Website: https://hhdexpress.ecotrack.dz

INSERT INTO delivery_companies (name, api_url, contact_email, contact_phone, features, is_active)
VALUES (
  'HHD Express',
  'https://hhdexpress.ecotrack.dz/api/v1',
  'contact@hhd-express.com',
  '+213',
  '{"supports_cod": true, "supports_tracking": true, "supports_labels": false, "supports_webhooks": false, "api_rating": 3, "requires_credentials": true}'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = NOW();

DO $$
BEGIN
  RAISE NOTICE 'Added HHD Express delivery company.';
END $$;
