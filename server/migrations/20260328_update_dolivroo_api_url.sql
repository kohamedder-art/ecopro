-- Align Dolivroo with the official SDK base URL.

UPDATE delivery_companies
SET api_url = 'https://dolivroo.com/api/v1/unified',
    updated_at = NOW()
WHERE lower(name) = 'dolivroo';