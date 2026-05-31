-- Add subdomain support for storefront subdomains (e.g., mystore.sahla4eco.com)
ALTER TABLE client_store_settings ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_client_store_settings_subdomain ON client_store_settings(subdomain);
