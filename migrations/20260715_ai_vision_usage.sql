-- AI Vision Usage Tracking
-- Tracks image analysis requests for analytics and rate monitoring

CREATE TABLE IF NOT EXISTS ai_vision_usage (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  feature VARCHAR(50) NOT NULL,           -- 'analyze_product', 'vision_chat', 'quality_check'
  tokens_estimated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_vision_usage_client ON ai_vision_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_usage_created ON ai_vision_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_vision_usage_feature ON ai_vision_usage(feature);
