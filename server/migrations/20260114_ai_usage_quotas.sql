-- AI Usage Quotas and Tracking
-- Tracks per-store AI usage for billing and quota management

-- Quota table: monthly limits per store
CREATE TABLE IF NOT EXISTS ai_usage_quotas (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start DATE NOT NULL, -- First day of month (e.g., 2026-01-01)
  owner_messages_used INTEGER DEFAULT 0,
  owner_messages_limit INTEGER DEFAULT 200,
  customer_messages_used INTEGER DEFAULT 0,
  customer_messages_limit INTEGER DEFAULT 3000,
  last_reset_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, period_start)
);

-- Index for quick quota lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_quotas_client_period ON ai_usage_quotas(client_id, period_start);

-- Usage log: detailed tracking of every AI call for analytics
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('owner', 'customer')),
  platform_chat_id VARCHAR(100), -- For customers (telegram/messenger/whatsapp chat ID)
  model_used VARCHAR(50) NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  message_preview TEXT, -- First 100 chars for debugging
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_client_created ON ai_usage_logs(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_client_period ON ai_usage_logs(client_id, created_at DESC);
