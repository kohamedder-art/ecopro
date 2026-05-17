CREATE TABLE IF NOT EXISTS platform_daily_page_views (
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  path_group TEXT NOT NULL,
  is_store BOOLEAN NOT NULL DEFAULT false,
  store_slug TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (view_date, path_group)
);

CREATE INDEX IF NOT EXISTS idx_platform_daily_page_views_date ON platform_daily_page_views (view_date);
CREATE INDEX IF NOT EXISTS idx_platform_daily_page_views_store ON platform_daily_page_views (is_store, store_slug);
