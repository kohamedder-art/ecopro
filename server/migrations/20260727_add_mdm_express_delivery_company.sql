-- Add MDM Express delivery company
INSERT INTO delivery_companies (name, api_url, features, is_active, created_at)
VALUES (
  'MDM Express',
  'https://api.mdm.express',
  '{
    "supports_cod": true,
    "supports_tracking": true,
    "supports_labels": false,
    "supports_webhooks": false,
    "requires_credentials": true,
    "credential_label": "Bearer Token",
    "secondary_credential_label": "Store ID"
  }'::jsonb,
  true,
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = NOW();
