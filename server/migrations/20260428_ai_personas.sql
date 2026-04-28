-- AI Persona System: Store-specific AI instructions and knowledge

-- Main table for AI personality configuration
CREATE TABLE IF NOT EXISTS ai_personas (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Persona identity
  persona_name      VARCHAR(100) DEFAULT 'المساعد الافتراضي',  -- "My Store Assistant"
  tone              VARCHAR(20) DEFAULT 'professional',          -- professional, friendly, casual, luxury
  personality_note  TEXT DEFAULT NULL,                          -- "We are a luxury brand, be elegant"
  
  -- Knowledge scope
  business_type     VARCHAR(50) DEFAULT NULL,                   -- retail, wholesale, handmade, dropshipping
  expertise_areas   TEXT[] DEFAULT '{}',                        -- ["skincare", "fashion", "electronics"]
  
  -- Language & communication
  primary_language  VARCHAR(10) DEFAULT 'ar',                 -- ar, fr, en, darija
  use_emojis        BOOLEAN DEFAULT true,
  emoji_style       VARCHAR(20) DEFAULT 'minimal',              -- none, minimal, moderate, heavy
  
  -- What AI should know (public knowledge for customer conversations)
  store_story       TEXT DEFAULT NULL,                          -- Our journey, why we started
  product_philosophy TEXT DEFAULT NULL,                         -- "We only sell organic..."
  unique_selling_points TEXT[] DEFAULT '{}',                   -- ["free_returns", "24h_shipping", "handmade"]
  
  -- What AI should NOT say (boundaries)
  forbidden_topics  TEXT[] DEFAULT '{}',                        -- ["never_mention_suppliers", "dont_discount"]
  competitor_policy VARCHAR(20) DEFAULT 'ignore',              -- ignore, acknowledge_neutral, dont_mention
  
  -- Sales behavior
  upsell_enabled    BOOLEAN DEFAULT true,
  cross_sell_enabled BOOLEAN DEFAULT true,
  discount_policy   TEXT DEFAULT NULL,                          -- "Never offer more than 10%"
  urgency_enabled   BOOLEAN DEFAULT false,                      -- "Only 3 left!" type messaging
  
  -- Response style
  response_length   VARCHAR(20) DEFAULT 'medium',              -- short, medium, detailed
  greeting_template TEXT DEFAULT NULL,                          -- Custom greeting
  closing_template  TEXT DEFAULT NULL,                          -- Custom sign-off
  
  -- Advanced: Custom knowledge base
  faq_entries       JSONB DEFAULT '[]',                         -- [{q: "", a: ""}]
  common_objections JSONB DEFAULT '[]',                         -- How to handle price concerns, etc.
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id)
);

-- Product-specific AI knowledge (what AI should know about each product category)
CREATE TABLE IF NOT EXISTS ai_product_knowledge (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category          VARCHAR(100) NOT NULL,                     -- "skincare", "phones"
  
  -- Expertise content
  category_expertise TEXT DEFAULT NULL,                        -- "Our skincare is Korean-made..."
  key_benefits      TEXT[] DEFAULT '{}',                       -- ["hydrating", "anti-aging"]
  usage_instructions TEXT DEFAULT NULL,                        -- How to use products in this category
  comparison_notes TEXT DEFAULT NULL,                        -- "Compared to competitors, ours..."
  
  -- Selling guidance
  common_questions  JSONB DEFAULT '[]',                      -- [{q: "", a: ""}]
  upsell_suggestions TEXT[] DEFAULT '{}',                     -- "Pair with our toner"
  target_audience   TEXT DEFAULT NULL,                        -- "Women 25-40 with dry skin"
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, category)
);

-- Conversation training examples (store owner can correct AI responses)
CREATE TABLE IF NOT EXISTS ai_training_examples (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  scenario          VARCHAR(200) NOT NULL,                     -- "Customer asks about shipping time"
  customer_message    TEXT NOT NULL,                           -- Example customer message
  ai_response_good   TEXT NOT NULL,                           -- What AI should say
  ai_response_bad    TEXT DEFAULT NULL,                       -- What AI should NOT say (optional)
  
  context_required  TEXT[] DEFAULT '{}',                     -- ["delivery_zones", "order_status"]
  active            BOOLEAN DEFAULT true,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI conversation memory (what AI has learned about this customer's preferences)
CREATE TABLE IF NOT EXISTS ai_customer_insights (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_phone    VARCHAR(50) NOT NULL,
  
  -- Preferences learned over time
  preferred_categories TEXT[] DEFAULT '{}',                   -- ["electronics", "fashion"]
  price_sensitivity   VARCHAR(20) DEFAULT NULL,                -- low, medium, high
  preferred_contact_time TIME DEFAULT NULL,                  -- When they usually respond
  language_preference VARCHAR(10) DEFAULT NULL,              -- ar, fr, darija
  
  -- Behavioral patterns
  abandoned_cart_count INTEGER DEFAULT 0,
  last_order_date     DATE DEFAULT NULL,
  total_orders        INTEGER DEFAULT 0,
  total_spent         NUMERIC(12,2) DEFAULT 0,
  
  -- Notes for AI
  ai_notes            TEXT DEFAULT NULL,                      -- "Always asks for discounts", "Loves new arrivals"
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(client_id, customer_phone)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_personas_client ON ai_personas(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_product_knowledge_client_cat ON ai_product_knowledge(client_id, category);
CREATE INDEX IF NOT EXISTS idx_ai_training_client ON ai_training_examples(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_client_phone ON ai_customer_insights(client_id, customer_phone);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_ai_personas_updated_at ON ai_personas;
CREATE TRIGGER update_ai_personas_updated_at BEFORE UPDATE ON ai_personas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_product_knowledge_updated_at ON ai_product_knowledge;
CREATE TRIGGER update_ai_product_knowledge_updated_at BEFORE UPDATE ON ai_product_knowledge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_training_updated_at ON ai_training_examples;
CREATE TRIGGER update_ai_training_updated_at BEFORE UPDATE ON ai_training_examples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON ai_customer_insights;
CREATE TRIGGER update_ai_insights_updated_at BEFORE UPDATE ON ai_customer_insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default persona for existing stores
INSERT INTO ai_personas (client_id, persona_name)
SELECT id, 'المساعد الافتراضي'
FROM clients c
WHERE NOT EXISTS (SELECT 1 FROM ai_personas ap WHERE ap.client_id = c.id);

SELECT 'AI Persona system migration applied' AS status;
