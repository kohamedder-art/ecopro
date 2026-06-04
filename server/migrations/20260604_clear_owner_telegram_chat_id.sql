-- The owner_telegram_chat_id auto-save was buggy: it incorrectly saved
-- first-time CUSTOMERS as the store owner (commit: remove auto-save).
-- Clear all values so the AI doesn't stay silenced for those customers.
UPDATE bot_settings SET owner_telegram_chat_id = NULL WHERE owner_telegram_chat_id IS NOT NULL;