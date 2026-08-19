-- Migration: Enable API features for ProColis delivery company
-- ProColis now has full API integration (create shipment, tracking, ready-to-ship)

UPDATE delivery_companies
SET features = '{"supports_cod": true, "supports_tracking": true, "supports_labels": false, "supports_webhooks": false, "requires_credentials": true, "api_rating": 3}'::jsonb
WHERE name = 'ProColis';
