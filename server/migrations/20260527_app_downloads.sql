CREATE TABLE IF NOT EXISTS app_downloads (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  download_url TEXT NOT NULL,
  version VARCHAR(50) DEFAULT 'latest',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_downloads_platform ON app_downloads(platform, created_at DESC);
