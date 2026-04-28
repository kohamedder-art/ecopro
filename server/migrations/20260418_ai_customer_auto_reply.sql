-- Add AI auto-reply toggle to bot_settings
ALTER TABLE bot_settings
ADD COLUMN IF NOT EXISTS ai_auto_reply BOOLEAN DEFAULT false;

-- Add custom AI instructions to ai_settings (store owner customizes AI behavior)
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS ai_instructions TEXT;

-- Conversation history for AI customer messaging
CREATE TABLE IF NOT EXISTS customer_conversations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL, -- 'telegram', 'messenger', 'whatsapp'
  platform_chat_id TEXT NOT NULL, -- telegram chat_id, messenger psid, etc.
  role VARCHAR(10) NOT NULL CHECK (role IN ('customer', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fetching recent conversation by platform chat
CREATE INDEX IF NOT EXISTS idx_customer_conversations_lookup
ON customer_conversations(client_id, platform, platform_chat_id, created_at DESC);

-- Cleanup old conversations (keep last 7 days)
-- This can be run periodically via cron or at query time
