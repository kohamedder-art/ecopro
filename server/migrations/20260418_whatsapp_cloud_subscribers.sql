-- WhatsApp Cloud API: subscriber tracking table
-- Tracks customer phone → client (store) mapping for WhatsApp messaging

CREATE TABLE IF NOT EXISTS whatsapp_subscribers (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  wa_phone TEXT NOT NULL,
  customer_name TEXT,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  last_interaction TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(client_id, wa_phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_subscribers_phone ON whatsapp_subscribers(wa_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_subscribers_client ON whatsapp_subscribers(client_id);
