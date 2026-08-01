-- ═══════════════════════════════════════════════════════════════
-- AI Store Manager — Phase 1: Store Memory Foundation
-- ═══════════════════════════════════════════════════════════════

-- Daily store snapshots — time-series metrics for trend analysis
CREATE TABLE IF NOT EXISTS store_daily_snapshots (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date     DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Order metrics
  total_orders      INTEGER DEFAULT 0,
  pending_orders    INTEGER DEFAULT 0,
  delivered_orders  INTEGER DEFAULT 0,
  cancelled_orders  INTEGER DEFAULT 0,
  fake_orders       INTEGER DEFAULT 0,
  revenue           NUMERIC(12,2) DEFAULT 0,
  avg_order_value   NUMERIC(10,2) DEFAULT 0,

  -- Product metrics
  active_products   INTEGER DEFAULT 0,
  out_of_stock      INTEGER DEFAULT 0,
  low_stock         INTEGER DEFAULT 0,

  -- Customer metrics
  new_customers     INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,
  unique_phones     INTEGER DEFAULT 0,

  -- Delivery metrics
  home_deliveries   INTEGER DEFAULT 0,
  desk_deliveries   INTEGER DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(client_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_client_date ON store_daily_snapshots(client_id, snapshot_date DESC);

-- AI store memory — what the AI has learned about each store over time
CREATE TABLE IF NOT EXISTS ai_store_memory (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category          VARCHAR(50) NOT NULL,  -- 'customer_pattern', 'product_insight', 'revenue_trend', 'owner_preference', 'market_knowledge'
  key               VARCHAR(200) NOT NULL,
  value             TEXT NOT NULL,
  confidence        NUMERIC(3,2) DEFAULT 0.8,  -- 0.0 to 1.0
  source            VARCHAR(50) DEFAULT 'observed',  -- 'observed', 'owner_told', 'inferred'
  expires_at        TIMESTAMPTZ DEFAULT NULL,  -- optional TTL
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(client_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_memory_client_cat ON ai_store_memory(client_id, category);

-- Unified customer profiles — 360° view built from orders + conversations + behavior
CREATE TABLE IF NOT EXISTS customer_profiles (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_phone    VARCHAR(50) NOT NULL,
  customer_name     VARCHAR(200) DEFAULT NULL,

  -- Order behavior
  total_orders      INTEGER DEFAULT 0,
  total_spent       NUMERIC(12,2) DEFAULT 0,
  avg_order_value   NUMERIC(10,2) DEFAULT 0,
  first_order_date  TIMESTAMPTZ DEFAULT NULL,
  last_order_date   TIMESTAMPTZ DEFAULT NULL,
  days_between_orders NUMERIC(6,1) DEFAULT NULL,  -- avg days between orders

  -- Preferences (learned)
  preferred_wilaya  VARCHAR(100) DEFAULT NULL,
  preferred_commune VARCHAR(100) DEFAULT NULL,
  preferred_categories TEXT[] DEFAULT '{}',
  preferred_contact VARCHAR(20) DEFAULT NULL,  -- 'phone', 'telegram', 'whatsapp'

  -- Risk & engagement
  risk_score        INTEGER DEFAULT 0,  -- 0-100 fraud risk
  engagement_score  INTEGER DEFAULT 50,  -- 0-100 how active
  lifetime_value    NUMERIC(12,2) DEFAULT 0,
  segment           VARCHAR(20) DEFAULT 'new',  -- 'new', 'regular', 'vip', 'at_risk', 'dormant'

  -- AI notes
  ai_notes          TEXT DEFAULT NULL,
  ai_last_analysis  TIMESTAMPTZ DEFAULT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(client_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_profiles_client ON customer_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_segment ON customer_profiles(client_id, segment);
CREATE INDEX IF NOT EXISTS idx_profiles_last_order ON customer_profiles(client_id, last_order_date);

-- Proactive actions log — tracks what the AI did autonomously
CREATE TABLE IF NOT EXISTS proactive_actions (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action_type       VARCHAR(50) NOT NULL,  -- 'auto_confirm', 'send_followup', 'price_suggestion', 'restock_alert', 'reengagement', 'weekly_report'
  action_data       JSONB DEFAULT '{}',
  status            VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'executed', 'rejected', 'failed'
  ai_reasoning      TEXT DEFAULT NULL,  -- why the AI decided to do this
  executed_at       TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_client_status ON proactive_actions(client_id, status);

-- Weekly insight snapshots — pre-generated reports
CREATE TABLE IF NOT EXISTS weekly_insights (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start        DATE NOT NULL,
  week_end          DATE NOT NULL,

  -- Summary metrics
  total_revenue     NUMERIC(12,2) DEFAULT 0,
  revenue_change_pct NUMERIC(5,1) DEFAULT 0,  -- vs previous week
  total_orders      INTEGER DEFAULT 0,
  orders_change_pct NUMERIC(5,1) DEFAULT 0,
  conversion_rate   NUMERIC(5,2) DEFAULT NULL,

  -- AI-generated insight
  summary_ar        TEXT DEFAULT NULL,  -- Arabic narrative
  recommendations   JSONB DEFAULT '[]',  -- [{type, title, description, priority}]
  top_products      JSONB DEFAULT '[]',
  top_customers     JSONB DEFAULT '[]',

  delivered_at      TIMESTAMPTZ DEFAULT NULL,  -- when sent to owner
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(client_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_client_week ON weekly_insights(client_id, week_start DESC);
