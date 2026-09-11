-- 5-day free trial for new accounts (existing trials keep their trial_ends_at)
UPDATE platform_settings SET setting_value = '5', updated_at = NOW()
WHERE setting_key = 'trial_days';
