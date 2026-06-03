CREATE TABLE IF NOT EXISTS customer_conversation_facts (
  client_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  platform_chat_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  preferred_wilaya TEXT,
  preferred_commune TEXT,
  interests TEXT[] DEFAULT '{}',
  purchased_products TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  summary TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (client_id, platform, platform_chat_id)
);
