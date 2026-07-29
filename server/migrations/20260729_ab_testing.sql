-- A/B Testing System for Sahla4Eco
-- Tests different landing page images to find which brings more orders

-- A/B test definitions
CREATE TABLE IF NOT EXISTS ab_tests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, running, paused, completed
  public_id TEXT UNIQUE NOT NULL, -- short ID for public URLs (e.g., 'abc123')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Each variant (image + product link)
CREATE TABLE IF NOT EXISTS ab_test_variants (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- 'Variant A', 'Variant B', etc.
  image_url TEXT NOT NULL, -- the hero image
  product_id INTEGER REFERENCES client_store_products(id) ON DELETE SET NULL, -- which product this variant sells
  headline TEXT, -- optional text overlay
  cta_text TEXT DEFAULT 'Shop Now', -- button text
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event tracking per variant
CREATE TABLE IF NOT EXISTS ab_test_events (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL, -- from cookie
  event_type TEXT NOT NULL, -- impression, click, order
  order_id INTEGER, -- link to store_orders if converted
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sticky variant assignment (same visitor always sees same variant)
CREATE TABLE IF NOT EXISTS ab_test_assignments (
  visitor_id TEXT NOT NULL,
  test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES ab_test_variants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (visitor_id, test_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ab_tests_client_id ON ab_tests(client_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_public_id ON ab_tests(public_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_variants_test_id ON ab_test_variants(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_events_test_id ON ab_test_events(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_events_variant_id ON ab_test_events(variant_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_events_visitor_id ON ab_test_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_visitor_test ON ab_test_assignments(visitor_id, test_id);
