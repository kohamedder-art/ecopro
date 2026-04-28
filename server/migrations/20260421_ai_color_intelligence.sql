-- AI Color Intelligence System Migration
-- Stores product colors, customer segment analytics, and color version history

-- Table: Product color analysis
-- Stores dominant colors extracted from product images
CREATE TABLE IF NOT EXISTS store_product_colors (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES client_store_settings(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES client_store_products(id) ON DELETE CASCADE,
  dominant_colors JSONB NOT NULL, -- Array: [{ hex: "#FF5733", percent: 35 }, ...]
  color_mood VARCHAR(50), -- "warm", "cool", "neutral"
  color_harmony VARCHAR(50), -- "monochrome", "analogous", "complementary", "triadic"
  brightness_level VARCHAR(20), -- "dark", "medium", "light"
  saturation_level VARCHAR(20), -- "muted", "medium", "vibrant"
  analyzed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

-- Table: Customer segment analytics
-- Tracks visitor behavior by product category/segment
CREATE TABLE IF NOT EXISTS store_customer_segments (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES client_store_settings(id) ON DELETE CASCADE,
  segment_name VARCHAR(100) NOT NULL, -- "Electronics", "Fashion", "Home Decor", etc.
  product_category VARCHAR(100),
  visitor_count BIGINT DEFAULT 0,
  total_sessions BIGINT DEFAULT 0,
  avg_time_on_site INTEGER DEFAULT 0, -- seconds
  conversion_rate DECIMAL(5, 2) DEFAULT 0, -- percentage
  bounce_rate DECIMAL(5, 2) DEFAULT 0, -- percentage
  click_through_rate DECIMAL(5, 2) DEFAULT 0, -- percentage
  preferred_colors JSONB, -- Array: ["#FF5733", "#00FF00", ...]
  average_order_value DECIMAL(10, 2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, segment_name)
);

-- Table: Store color versions (undo/redo history)
-- Stores snapshots of store colors for comparison and rollback
CREATE TABLE IF NOT EXISTS store_color_versions (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES client_store_settings(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  colors_config JSONB NOT NULL, -- Full color schema snapshot
  applied_by VARCHAR(50) NOT NULL, -- "AI" or "StoreOwner"
  reason TEXT, -- "Color optimization", "Manual change", etc.
  metrics_before JSONB, -- Metrics before this version
  metrics_after JSONB, -- Metrics after applying this version
  avg_time_on_site_before INTEGER,
  avg_time_on_site_after INTEGER,
  conversion_rate_before DECIMAL(5, 2),
  conversion_rate_after DECIMAL(5, 2),
  bounce_rate_before DECIMAL(5, 2),
  bounce_rate_after DECIMAL(5, 2),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'rolled_back'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, version_number)
);

-- Table: Color analysis log
-- Logs all color recommendation events for auditing
CREATE TABLE IF NOT EXISTS color_analysis_logs (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES client_store_settings(id) ON DELETE CASCADE,
  analysis_type VARCHAR(100), -- "product_analysis", "segment_analysis", "recommendation"
  analysis_data JSONB,
  recommendations JSONB, -- Suggested colors and reasoning
  confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  action_taken VARCHAR(50), -- "suggested", "applied", "rejected"
  store_owner_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: Color recommendation history
-- Tracks all AI color recommendations and whether they were accepted
CREATE TABLE IF NOT EXISTS color_recommendations (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES client_store_settings(id) ON DELETE CASCADE,
  recommended_colors JSONB NOT NULL, -- Recommended color scheme
  recommendation_reason TEXT, -- Why this color scheme is recommended
  confidence_score DECIMAL(3, 2), -- Confidence in recommendation
  estimated_impact JSONB, -- { time_on_site_increase: 15, conversion_increase: 5 }
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'applied'
  accepted_by BIGINT, -- User ID (store owner)
  accepted_at TIMESTAMP,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_product_colors_store_id 
  ON store_product_colors(store_id);
CREATE INDEX IF NOT EXISTS idx_store_product_colors_product_id 
  ON store_product_colors(product_id);
CREATE INDEX IF NOT EXISTS idx_store_product_colors_mood 
  ON store_product_colors(color_mood);

CREATE INDEX IF NOT EXISTS idx_store_customer_segments_store_id 
  ON store_customer_segments(store_id);
CREATE INDEX IF NOT EXISTS idx_store_customer_segments_segment_name 
  ON store_customer_segments(segment_name);

CREATE INDEX IF NOT EXISTS idx_store_color_versions_store_id 
  ON store_color_versions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_color_versions_version_number 
  ON store_color_versions(version_number DESC);

CREATE INDEX IF NOT EXISTS idx_color_analysis_logs_store_id 
  ON color_analysis_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_color_analysis_logs_analysis_type 
  ON color_analysis_logs(analysis_type);

CREATE INDEX IF NOT EXISTS idx_color_recommendations_store_id 
  ON color_recommendations(store_id);
CREATE INDEX IF NOT EXISTS idx_color_recommendations_status 
  ON color_recommendations(status);
