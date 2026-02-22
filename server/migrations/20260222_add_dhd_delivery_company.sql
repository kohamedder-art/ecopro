-- Migration: Add DHD Livraison Express delivery company
-- Date: 2026-02-22
-- Purpose: Add DHD as a new delivery company (Ecotrack-powered, 55 wilayas in Algeria)
-- Website: https://dhd-dz.com
-- Contact: commercialedhd@gmail.com | 0770 064 917

INSERT INTO delivery_companies (name, api_url, contact_email, contact_phone, features, is_active)
VALUES (
  'DHD Livraison',
  'https://app.dhd-dz.com',
  'commercialedhd@gmail.com',
  '0770064917',
  '{"supports_cod": true, "supports_tracking": true, "supports_labels": true, "supports_webhooks": false, "api_rating": 3, "requires_credentials": true}'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = NOW();

DO $$
BEGIN
  RAISE NOTICE 'Added DHD Livraison Express delivery company.';
END $$;
