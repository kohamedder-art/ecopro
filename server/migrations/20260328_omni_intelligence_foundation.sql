-- Omni Intelligence foundation tables.
-- Raw SQL remains the source of truth; Prisma is used only as a bounded schema/client layer.

CREATE TABLE IF NOT EXISTS analytic_sessions (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    store_slug VARCHAR(120),
    session_id VARCHAR(120) NOT NULL,
    visitor_id VARCHAR(120),
    status VARCHAR(24) NOT NULL DEFAULT 'live',
    first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    landing_page TEXT,
    exit_page TEXT,
    entry_referrer TEXT,
    entry_source VARCHAR(80),
    entry_medium VARCHAR(80),
    entry_campaign VARCHAR(160),
    entry_content VARCHAR(160),
    entry_term VARCHAR(160),
    platform_hint VARCHAR(32),
    page_views INTEGER NOT NULL DEFAULT 0,
    product_views INTEGER NOT NULL DEFAULT 0,
    add_to_cart_count INTEGER NOT NULL DEFAULT 0,
    checkout_count INTEGER NOT NULL DEFAULT 0,
    purchase_count INTEGER NOT NULL DEFAULT 0,
    max_scroll_depth INTEGER NOT NULL DEFAULT 0,
    active_time_seconds INTEGER NOT NULL DEFAULT 0,
    last_event_name VARCHAR(80),
    last_page_url TEXT,
    last_product_id INTEGER REFERENCES client_store_products(id) ON DELETE SET NULL,
    last_order_id INTEGER REFERENCES store_orders(id) ON DELETE SET NULL,
    device_type VARCHAR(24),
    locale VARCHAR(16),
    ip_hash VARCHAR(64),
    is_partial BOOLEAN NOT NULL DEFAULT false,
    diagnostic_label VARCHAR(80),
    diagnostic_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_analytic_sessions_client_period ON analytic_sessions(client_id, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytic_sessions_client_order ON analytic_sessions(client_id, last_order_id);
CREATE INDEX IF NOT EXISTS idx_analytic_sessions_client_visitor ON analytic_sessions(client_id, visitor_id);

CREATE TABLE IF NOT EXISTS analytic_session_touches (
    id BIGSERIAL PRIMARY KEY,
    analytic_session_id BIGINT NOT NULL REFERENCES analytic_sessions(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    touch_position INTEGER NOT NULL DEFAULT 1,
    platform VARCHAR(32),
    source VARCHAR(80),
    medium VARCHAR(80),
    campaign_name VARCHAR(160),
    adset_name VARCHAR(160),
    creative_name VARCHAR(160),
    creative_key VARCHAR(240),
    landing_page TEXT,
    fbclid VARCHAR(255),
    ttclid VARCHAR(255),
    gclid VARCHAR(255),
    is_entry BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, analytic_session_id, touch_position)
);

CREATE INDEX IF NOT EXISTS idx_analytic_session_touches_client_creative ON analytic_session_touches(client_id, creative_key);
CREATE INDEX IF NOT EXISTS idx_analytic_session_touches_client_campaign ON analytic_session_touches(client_id, campaign_name);

CREATE TABLE IF NOT EXISTS creative_catalog (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL,
    campaign_name VARCHAR(160),
    adset_name VARCHAR(160),
    creative_name VARCHAR(160) NOT NULL,
    creative_key VARCHAR(240) NOT NULL,
    landing_page TEXT,
    promise_angle TEXT,
    target_persona TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, creative_key)
);

CREATE INDEX IF NOT EXISTS idx_creative_catalog_client_platform ON creative_catalog(client_id, platform);

CREATE TABLE IF NOT EXISTS creative_spend_entries (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    platform VARCHAR(32) NOT NULL,
    campaign_name VARCHAR(160),
    adset_name VARCHAR(160),
    creative_name VARCHAR(160),
    creative_key VARCHAR(240),
    spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    link_clicks INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_spend_entries_client_date ON creative_spend_entries(client_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_creative_spend_entries_client_creative ON creative_spend_entries(client_id, creative_key);

CREATE TABLE IF NOT EXISTS product_economics (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES client_store_products(id) ON DELETE CASCADE,
    buy_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    packaging_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    handling_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    fallback_shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_economics_client_product ON product_economics(client_id, product_id);

CREATE TABLE IF NOT EXISTS historical_import_jobs (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    job_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    source_label TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    partial_rows INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_import_jobs_client_created ON historical_import_jobs(client_id, created_at DESC);

COMMENT ON TABLE analytic_sessions IS 'Session-level attribution and behavior summaries used by Omni Intelligence';
COMMENT ON TABLE analytic_session_touches IS 'Entry touch metadata for attributed sessions';
COMMENT ON TABLE creative_catalog IS 'Manual creative descriptors and landing-page promises';
COMMENT ON TABLE creative_spend_entries IS 'Manual spend and delivery of creative/campaign spend input';
COMMENT ON TABLE product_economics IS 'Per-product cost assumptions used for profit and POAS';
COMMENT ON TABLE historical_import_jobs IS 'Audit trail for historical Omni imports and backfills';