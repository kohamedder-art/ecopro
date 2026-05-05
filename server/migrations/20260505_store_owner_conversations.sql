-- Store Owner AI Conversation History
-- Tracks conversations between store owners and AI assistant

CREATE TABLE IF NOT EXISTS store_owner_conversations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fetching recent conversation by store owner
CREATE INDEX IF NOT EXISTS idx_store_owner_conversations_lookup
ON store_owner_conversations(client_id, created_at DESC);

-- Cleanup old conversations (keep last 50 messages per owner)
-- This is handled in the application code for better control
