-- Per-platform AI auto-reply toggles
-- Store owners can choose which platforms the AI responds on
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS ai_reply_telegram   BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS ai_reply_messenger  BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS ai_reply_instagram  BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS ai_reply_whatsapp   BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS ai_reply_viber      BOOLEAN DEFAULT TRUE;
