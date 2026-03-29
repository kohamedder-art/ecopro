-- Ensure Dolivroo exists as an active unified delivery provider.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_companies_name_unique'
  ) THEN
    ALTER TABLE delivery_companies ADD CONSTRAINT delivery_companies_name_unique UNIQUE (name);
  END IF;
END $$;

INSERT INTO delivery_companies (name, api_url, contact_email, contact_phone, features, is_active)
VALUES (
  'Dolivroo',
  'https://api.dolivroo.com/v1/unified',
  'support@dolivroo.com',
  NULL,
  '{"supports_cod": true, "supports_tracking": true, "supports_labels": true, "supports_webhooks": true, "api_rating": 5, "is_aggregator": true, "providers": ["yalidine", "zr-express", "ecotrack", "maystro"]}'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = NOW();