-- AI Chat History: persists the floating assistant conversation per user
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id            BIGSERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,       -- clients.id or admins.id
  user_type     TEXT    NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  role          TEXT    NOT NULL,       -- 'user' | 'assistant'
  content       TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user ON ai_chat_history (user_id, user_type, created_at DESC);
