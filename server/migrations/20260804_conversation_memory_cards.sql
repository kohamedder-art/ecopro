-- Conversation memory cards
-- 1) Extend customer facts with likes/dislikes/wants + structured order history
-- 2) Create store owner facts table (owner + store memory card)

ALTER TABLE customer_conversation_facts
  ADD COLUMN IF NOT EXISTS likes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dislikes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wants TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS order_history JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS store_owner_facts (
  client_id INTEGER NOT NULL PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  store_name TEXT,
  store_slug TEXT,
  store_description TEXT,
  template TEXT,
  currency TEXT,
  likes TEXT[] DEFAULT '{}',
  dislikes TEXT[] DEFAULT '{}',
  wants TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  summary TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);
