-- Add proxy gateway columns to bot_settings for Meta review bypass (Unipile)
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_provider VARCHAR(50);
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_page_id VARCHAR(255);
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_channel_id VARCHAR(255);
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_api_key TEXT;
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_webhook_secret VARCHAR(255);

-- Add Instagram Business Account ID column (used by proxy for IG routing)
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS instagram_business_account_id VARCHAR(255);

-- Add Unipile chat tracking to messenger_subscribers (reuses psid/page_id for attendee/account)
ALTER TABLE messenger_subscribers ADD COLUMN IF NOT EXISTS unipile_chat_id VARCHAR(255);
ALTER TABLE messenger_subscribers ADD COLUMN IF NOT EXISTS unipile_account_id VARCHAR(255);
