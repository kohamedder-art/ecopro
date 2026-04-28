-- AI autopilot settings per store owner
CREATE TABLE IF NOT EXISTS ai_settings (
  id            SERIAL PRIMARY KEY,
  client_id     INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,

  -- Core
  ai_chat_enabled        BOOLEAN DEFAULT TRUE,   -- Floating AI chat bubble
  guardian_enabled        BOOLEAN DEFAULT TRUE,   -- Guardian alert system
  storefront_assistant   BOOLEAN DEFAULT TRUE,   -- Public storefront product Q&A

  -- Product automation
  auto_descriptions      BOOLEAN DEFAULT FALSE,  -- Auto-generate product descriptions
  auto_pricing           BOOLEAN DEFAULT FALSE,  -- AI pricing suggestions on new products
  auto_alt_text          BOOLEAN DEFAULT FALSE,  -- Auto-generate image alt text
  image_analysis         BOOLEAN DEFAULT TRUE,   -- AI analyzes product photos

  -- Analytics & orders
  analytics_narration    BOOLEAN DEFAULT TRUE,   -- AI weekly analytics summaries
  inventory_forecast     BOOLEAN DEFAULT TRUE,   -- AI inventory restock predictions
  order_suggestions      BOOLEAN DEFAULT TRUE,   -- AI next-action suggestions on orders
  order_priority         BOOLEAN DEFAULT TRUE,   -- AI flags urgent/overdue orders
  churn_warning          BOOLEAN DEFAULT TRUE,   -- Revenue decline detection

  -- Messaging
  reply_suggestions      BOOLEAN DEFAULT TRUE,   -- AI suggests WhatsApp replies
  broadcast_composer     BOOLEAN DEFAULT TRUE,   -- AI drafts campaign messages
  omni_intelligence      BOOLEAN DEFAULT TRUE,   -- Deep behavior/friction analysis

  -- AI Actions (what the AI chat can execute)
  action_order_status    BOOLEAN DEFAULT TRUE,   -- AI can update order statuses
  action_create_product  BOOLEAN DEFAULT TRUE,   -- AI can create new products
  action_edit_product    BOOLEAN DEFAULT TRUE,   -- AI can edit product fields
  action_delete_product  BOOLEAN DEFAULT TRUE,   -- AI can deactivate products
  action_store_design    BOOLEAN DEFAULT TRUE,   -- AI can change store colors/text/fonts
  action_bot_control     BOOLEAN DEFAULT TRUE,   -- AI can toggle/configure bot settings

  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_client ON ai_settings(client_id);
