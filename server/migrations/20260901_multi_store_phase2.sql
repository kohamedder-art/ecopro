-- Multi-Store Phase 2: fully isolate remaining client-owned tables by store.
-- Adds store_id to tables that still only had client_id, then backfills existing
-- rows to the client's first (default) store.
--
-- For backfill we map each row to the client's LOWEST store id, i.e. their
-- original/default store (before multi-store there was effectively one store).

-- ============================================================
-- 1. Add store_id columns
-- ============================================================
ALTER TABLE order_statuses ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE client_pixel_settings ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE pixel_events ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE pixel_stats_daily ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;
ALTER TABLE client_store_daily_views ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES client_store_settings(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Backfill existing rows to the client's first store
-- ============================================================
UPDATE order_statuses os SET store_id = css.id
  FROM (SELECT client_id, MIN(id) AS id FROM client_store_settings GROUP BY client_id) css
  WHERE css.client_id = os.client_id AND os.store_id IS NULL;

UPDATE client_pixel_settings ps SET store_id = css.id
  FROM (SELECT client_id, MIN(id) AS id FROM client_store_settings GROUP BY client_id) css
  WHERE css.client_id = ps.client_id AND ps.store_id IS NULL;

UPDATE pixel_events pe SET store_id = css.id
  FROM (SELECT client_id, MIN(id) AS id FROM client_store_settings GROUP BY client_id) css
  WHERE css.client_id = pe.client_id AND pe.store_id IS NULL;

UPDATE pixel_stats_daily ps SET store_id = css.id
  FROM (SELECT client_id, MIN(id) AS id FROM client_store_settings GROUP BY client_id) css
  WHERE css.client_id = ps.client_id AND ps.store_id IS NULL;

UPDATE client_store_daily_views v SET store_id = css.id
  FROM (SELECT client_id, MIN(id) AS id FROM client_store_settings GROUP BY client_id) css
  WHERE css.client_id = v.client_id AND v.store_id IS NULL;

-- ============================================================
-- 3. Indexes on store_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_statuses_store_id ON order_statuses(store_id);
CREATE INDEX IF NOT EXISTS idx_client_pixel_settings_store_id ON client_pixel_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_pixel_events_store_id ON pixel_events(store_id);
CREATE INDEX IF NOT EXISTS idx_pixel_stats_daily_store_id ON pixel_stats_daily(store_id);
CREATE INDEX IF NOT EXISTS idx_client_store_daily_views_store_id ON client_store_daily_views(store_id);
