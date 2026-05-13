import { RequestHandler } from "express";
import { pool } from "../utils/database";
import { registerTelegramWebhook, upsertTelegramWebhookSecret } from "../utils/telegram";
import { getPublicBaseUrl } from '../utils/public-url';
import { ensureBotSettingsRow } from '../utils/client-provisioning';
import { encryptData } from '../utils/encryption';

// Read env vars lazily so they're always current (not frozen at import time)
function getPlatformFbPageId() { return String(process.env.PLATFORM_FB_PAGE_ID || '').trim(); }
function getPlatformFbPageAccessToken() { return String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim(); }
function getPlatformMessengerAvailable() { return !!getPlatformFbPageId() && !!getPlatformFbPageAccessToken(); }

function getPlatformTelegramBotToken() { return String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim(); }
function getPlatformTelegramBotUsername() { return String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim(); }
function getPlatformTelegramAvailable() { return !!getPlatformTelegramBotToken() && !!getPlatformTelegramBotUsername(); }

function getPlatformWhatsappPhoneNumberId() { return String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(); }
function getPlatformWhatsappAccessToken() { return String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(); }
function getPlatformWhatsappAvailable() { return !!getPlatformWhatsappPhoneNumberId() && !!getPlatformWhatsappAccessToken(); }

function getPlatformViberAuthToken() { return String(process.env.PLATFORM_VIBER_AUTH_TOKEN || '').trim(); }
function getPlatformViberSenderName() { return String(process.env.PLATFORM_VIBER_SENDER_NAME || '').trim(); }
function getPlatformViberAvailable() { return !!getPlatformViberAuthToken(); }

function getPlatformInstagramPageId() { return String(process.env.PLATFORM_INSTAGRAM_PAGE_ID || '').trim(); }
function getPlatformInstagramAccessToken() { return String(process.env.PLATFORM_INSTAGRAM_ACCESS_TOKEN || '').trim(); }
function getPlatformInstagramAvailable() { return !!getPlatformInstagramPageId() && !!getPlatformInstagramAccessToken(); }

// Keep frozen constants for backward compatibility within this file
const PLATFORM_FB_PAGE_ID = getPlatformFbPageId();
const PLATFORM_FB_PAGE_ACCESS_TOKEN = getPlatformFbPageAccessToken();
const PLATFORM_MESSENGER_AVAILABLE = getPlatformMessengerAvailable();

const PLATFORM_TELEGRAM_BOT_TOKEN = getPlatformTelegramBotToken();
const PLATFORM_TELEGRAM_BOT_USERNAME = getPlatformTelegramBotUsername();
const PLATFORM_TELEGRAM_AVAILABLE = getPlatformTelegramAvailable();

const PLATFORM_WHATSAPP_PHONE_NUMBER_ID = getPlatformWhatsappPhoneNumberId();
const PLATFORM_WHATSAPP_ACCESS_TOKEN = getPlatformWhatsappAccessToken();
const PLATFORM_WHATSAPP_AVAILABLE = getPlatformWhatsappAvailable();

function normalizeTelegramUsername(username: string): string {
  return String(username || '').trim().replace(/^@/, '');
}

async function getClientAccessState(clientId: string | number): Promise<{ allowBot: boolean; reason?: string }>
{
  // Check if user is locked - is_locked means subscription issue, bot should be disabled
  try {
    const lockRes = await pool.query(
      `SELECT is_locked, locked_reason FROM clients WHERE id = $1`,
      [clientId]
    );
    if (lockRes.rows.length && lockRes.rows[0].is_locked) {
      return { 
        allowBot: false, 
        reason: lockRes.rows[0].locked_reason || 'Account locked. Please renew your subscription to enable the bot.' 
      };
    }
  } catch {
    // If the lock columns aren't present, skip this check.
  }

  // Check subscription_extended_until on the clients table first (admin-granted extensions)
  try {
    const extRes = await pool.query(
      `SELECT subscription_extended_until FROM clients WHERE id = $1`,
      [clientId]
    );
    if (extRes.rows.length) {
      const extRaw = extRes.rows[0].subscription_extended_until;
      if (extRaw) {
        const extensionEnds = new Date(extRaw);
        if (Number.isFinite(extensionEnds.getTime()) && new Date() < extensionEnds) {
          return { allowBot: true };
        }
      }
    }
  } catch {
    // If column doesn't exist yet, fall through to subscription check.
  }

  // Subscription check
  const subRes = await pool.query(
    `SELECT status, trial_ends_at, current_period_end FROM subscriptions WHERE user_id = $1`,
    [clientId]
  );
  if (!subRes.rows.length) {
    return { allowBot: false, reason: 'No subscription found. Please renew to enable the bot.' };
  }

  const sub = subRes.rows[0];
  const now = new Date();
  if (sub.status === 'trial') {
    const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
    if (trialEnd && now < trialEnd) return { allowBot: true };
    return { allowBot: false, reason: 'Trial ended. Please renew to enable the bot.' };
  }

  if (sub.status === 'active' || sub.status === 'extended') {
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    if (!periodEnd || now < periodEnd) return { allowBot: true };
    return { allowBot: false, reason: 'Subscription ended. Please renew to enable the bot.' };
  }

  return { allowBot: false, reason: 'Subscription ended. Please renew to enable the bot.' };
}

// Get bot settings for the current client
export const getBotSettings: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get bot settings from database
    const result = await pool.query(
      `SELECT * FROM bot_settings WHERE client_id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      // Older behavior returned in-memory defaults but did not create a DB row.
      // That breaks scheduling/sending which JOINs bot_settings. Ensure row exists.
      const access = await getClientAccessState(clientId);
      try {
        await ensureBotSettingsRow(Number(clientId), { enabled: access.allowBot });
      } catch (e) {
        console.warn('[getBotSettings] Failed to ensure bot_settings row:', (e as any)?.message || e);
      }

      const refetch = await pool.query(`SELECT * FROM bot_settings WHERE client_id = $1`, [clientId]);
      if (refetch.rows.length === 0) {
        // Fallback: preserve old behavior if the DB insert failed for any reason.
        return res.json({
          enabled: access.allowBot,
          provider: 'telegram',
          whatsappPhoneId: '',
          // Never expose tokens/secrets to store owners.
          whatsappToken: '',
          whatsappTokenConfigured: false,
          telegramBotToken: '',
          telegramTokenConfigured: PLATFORM_TELEGRAM_AVAILABLE,
          telegramBotUsername: '',
          telegramDelayMinutes: 5,
          autoExpireHours: 24,
          viberAuthToken: '',
          viberSenderName: '',
          messengerEnabled: false,
          fbPageId: '',
          fbPageAccessToken: '',
          fbPageAccessTokenConfigured: false,
          messengerDelayMinutes: 5,
          platformMessengerAvailable: PLATFORM_MESSENGER_AVAILABLE,
          platformTelegramAvailable: PLATFORM_TELEGRAM_AVAILABLE,
          usePlatformMessenger: PLATFORM_MESSENGER_AVAILABLE,
          messengerUsingPlatform: PLATFORM_MESSENGER_AVAILABLE,
          usePlatformTelegram: PLATFORM_TELEGRAM_AVAILABLE,
          telegramUsingPlatform: PLATFORM_TELEGRAM_AVAILABLE,
          platformWhatsappAvailable: PLATFORM_WHATSAPP_AVAILABLE,
          usePlatformWhatsapp: PLATFORM_WHATSAPP_AVAILABLE,
          whatsappUsingPlatform: PLATFORM_WHATSAPP_AVAILABLE,
          // Do not expose platform Page ID to store owners.
          platformMessengerPageId: '',
          templateGreeting: `شكراً لطلبك من {storeName}، {customerName}! 🎉\n\n✅ فعّل الإشعارات لتلقي تأكيد الطلب وتحديثات التتبع.`,
          templateInstantOrder: `🎉 شكراً لك {customerName}!\n\nتم استلام طلبك بنجاح ✅\n\n━━━━━━━━━━━━━━━━\n📦 تفاصيل الطلب\n━━━━━━━━━━━━━━━━\n🔢 رقم الطلب: #{orderId}\n📱 المنتج: {productName}\n💰 السعر: {totalPrice} دج\n📍 الكمية: {quantity}\n\n━━━━━━━━━━━━━━━━\n👤 معلومات التوصيل\n━━━━━━━━━━━━━━━━\n📛 الاسم: {customerName}\n📞 الهاتف: {customerPhone}\n🏠 العنوان: {address}\n\n━━━━━━━━━━━━━━━━\n🚚 حالة الطلب: قيد المعالجة\n━━━━━━━━━━━━━━━━\n\nسنتصل بك قريباً للتأكيد 📞\n\n⭐ من {storeName}`,
          templatePinInstructions: `📌 نصيحة مهمة:\n\nاضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!\n\n🔔 تأكد من:\n• تفعيل الإشعارات\n• عدم كتم المحادثة\n• ستتلقى تحديثات حالة الطلب هنا مباشرة`,
          templateOrderConfirmation: `مرحباً {customerName}! 🌟\n\nشكراً لطلبك من {companyName}!\n\n📦 تفاصيل الطلب:\n• المنتج: {productName}\n• السعر: {totalPrice} دج\n• العنوان: {address}\n\nهل تؤكد الطلب؟ اضغط ✅ للتأكيد أو ❌ للإلغاء.`,
          templatePayment: `تم تأكيد طلبك #{orderId}. المبلغ المطلوب: {totalPrice} دج.`,
          templateShipping: `تم شحن طلبك #{orderId}. رقم التتبع: {trackingNumber}.`,
        });
      }

      // Continue as normal with a real DB row.
      (result as any).rows = refetch.rows;
    }

    const settings = result.rows[0];
    const access = await getClientAccessState(clientId);
    // Force enabled=false in response if subscription/payment lock blocks bot usage
    const effectiveEnabled = !!settings.enabled && access.allowBot;
    if (!access.allowBot && settings.enabled) {
      // Hard-stop the bot at the source so it cannot run while locked.
      await pool.query(
        `UPDATE bot_settings SET enabled = false, updated_at = NOW() WHERE client_id = $1`,
        [clientId]
      );
    }

    let storedTelegramToken = String(settings.telegram_bot_token || '').trim();
    let storedTelegramUsername = String(settings.telegram_bot_username || '').trim();
    const telegramTokenConfigured = !!storedTelegramToken;
    const telegramUsingPlatform = getPlatformTelegramAvailable() && storedTelegramToken === getPlatformTelegramBotToken();

    const storedFbPageId = String(settings.fb_page_id || '').trim();
    const storedFbPageAccessToken = String(settings.fb_page_access_token || '').trim();
    const messengerTokenConfigured = !!storedFbPageAccessToken;
    const _platformMessengerAvailable = getPlatformMessengerAvailable();
    const _platformFbPageId = getPlatformFbPageId();
    const messengerUsingPlatform = _platformMessengerAvailable && storedFbPageId === _platformFbPageId;

    const whatsappTokenConfigured = !!String(settings.whatsapp_token || '').trim();
    const whatsappPhoneIdStored = String(settings.whatsapp_phone_id || '').trim();
    const _platformWhatsappAvailable = getPlatformWhatsappAvailable();
    const _platformWhatsappPhoneId = getPlatformWhatsappPhoneNumberId();
    const whatsappUsingPlatform = _platformWhatsappAvailable && whatsappPhoneIdStored === _platformWhatsappPhoneId;

    // Check if manual Instagram credentials exist in facebook_tokens.
    let instagramTokenConfigured = false;
    let instagramAccountIdStored = '';
    try {
      const igRes = await pool.query(
        `SELECT instagram_account_id, page_access_token_encrypted FROM facebook_tokens
         WHERE client_id = $1 AND is_active = TRUE AND instagram_account_id IS NOT NULL AND instagram_account_id != ''
         LIMIT 1`,
        [clientId]
      );
      if (igRes.rows.length) {
        instagramAccountIdStored = igRes.rows[0].instagram_account_id || '';
        instagramTokenConfigured = !!igRes.rows[0].page_access_token_encrypted;
      }
    } catch {
      // facebook_tokens may not exist yet; ignore.
    }

    const response = {
      enabled: effectiveEnabled,
      updatesEnabled: !!settings.updates_enabled,
      trackingEnabled: !!settings.tracking_enabled,
      provider: settings.provider || 'telegram',
      whatsappPhoneId: whatsappUsingPlatform ? '' : settings.whatsapp_phone_id,
      // Never expose tokens/secrets to store owners.
      whatsappToken: '',
      whatsappTokenConfigured: whatsappTokenConfigured || whatsappUsingPlatform,
      telegramBotToken: '',
      telegramTokenConfigured: telegramTokenConfigured || telegramUsingPlatform,
      // Username isn't secret, but hide it when platform bot is used.
      telegramBotUsername: telegramUsingPlatform ? '' : normalizeTelegramUsername(storedTelegramUsername),
      telegramDelayMinutes: settings.telegram_delay_minutes || 5,
      autoExpireHours: settings.auto_expire_hours || 24,
      viberAuthToken: settings.viber_auth_token,
      viberSenderName: settings.viber_sender_name,
      templateGreeting: settings.template_greeting || `شكراً لطلبك من {storeName}، {customerName}! 🎉\n\n✅ فعّل الإشعارات لتلقي تأكيد الطلب وتحديثات التتبع.`,
      templateInstantOrder: settings.template_instant_order || `🎉 شكراً لك {customerName}!\n\nتم استلام طلبك بنجاح ✅\n\n━━━━━━━━━━━━━━━━\n📦 تفاصيل الطلب\n━━━━━━━━━━━━━━━━\n🔢 رقم الطلب: #{orderId}\n📱 المنتج: {productName}\n💰 السعر: {totalPrice} دج\n📍 الكمية: {quantity}\n\n━━━━━━━━━━━━━━━━\n👤 معلومات التوصيل\n━━━━━━━━━━━━━━━━\n📛 الاسم: {customerName}\n📞 الهاتف: {customerPhone}\n🏠 العنوان: {address}\n\n━━━━━━━━━━━━━━━━\n🚚 حالة الطلب: قيد المعالجة\n━━━━━━━━━━━━━━━━\n\nسنتصل بك قريباً للتأكيد 📞\n\n⭐ من {storeName}`,
      templatePinInstructions: settings.template_pin_instructions || `📌 نصيحة مهمة:\n\nاضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!\n\n🔔 تأكد من:\n• تفعيل الإشعارات\n• عدم كتم المحادثة\n• ستتلقى تحديثات حالة الطلب هنا مباشرة`,
      templateOrderConfirmation: settings.template_order_confirmation || `مرحباً {customerName}! 🌟\n\nشكراً لطلبك من {companyName}!\n\n📦 تفاصيل الطلب:\n• المنتج: {productName}\n• السعر: {totalPrice} دج\n• العنوان: {address}\n\nهل تؤكد الطلب؟ اضغط ✅ للتأكيد أو ❌ للإلغاء.`,
      templatePayment: settings.template_payment || `تم تأكيد طلبك #{orderId}. المبلغ المطلوب: {totalPrice} دج.`,
      templateShipping: settings.template_shipping || `تم شحن طلبك #{orderId}. رقم التتبع: {trackingNumber}.`,
      messengerEnabled: !!settings.messenger_enabled,
      fbPageId: messengerUsingPlatform ? '' : (settings.fb_page_id || ''),
      fbPageAccessToken: '',
      fbPageAccessTokenConfigured: messengerTokenConfigured || messengerUsingPlatform,
      messengerDelayMinutes: settings.messenger_delay_minutes || 5,
      delivery_notifications_enabled: settings.delivery_notifications_enabled !== false,
      delivery_status_template: settings.delivery_status_template || null,
      platformMessengerAvailable: getPlatformMessengerAvailable(),
      platformTelegramAvailable: getPlatformTelegramAvailable(),
      usePlatformTelegram: telegramUsingPlatform,
      platformWhatsappAvailable: getPlatformWhatsappAvailable(),
      usePlatformMessenger: messengerUsingPlatform,
      messengerUsingPlatform,
      telegramUsingPlatform,
      usePlatformWhatsapp: whatsappUsingPlatform,
      whatsappUsingPlatform,
      // Instagram manual credentials status (never expose token).
      instagramAccountId: instagramAccountIdStored,
      instagramPageAccessToken: '',
      instagramTokenConfigured,
      // Do not expose platform Page ID to store owners.
      platformMessengerPageId: '',
      platformViberAvailable: getPlatformViberAvailable(),
      usePlatformViber: getPlatformViberAvailable(),
      viberUsingPlatform: getPlatformViberAvailable(),
      platformInstagramAvailable: getPlatformInstagramAvailable(),
      usePlatformInstagram: getPlatformInstagramAvailable(),
      instagramUsingPlatform: getPlatformInstagramAvailable(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    res.status(500).json({ error: 'Failed to fetch bot settings' });
  }
};

// Test bot connection for the current client
export const testBotConnection: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    const { platform } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform required' });

    const row = await pool.query(
      `SELECT telegram_bot_token, fb_page_id, fb_page_access_token FROM bot_settings WHERE client_id = $1 LIMIT 1`,
      [clientId]
    );
    const s = row.rows[0];
    if (!s) return res.json({ success: false, error: 'No bot settings found' });

    if (platform === 'telegram') {
      const token = String(s.telegram_bot_token || '').trim();
      if (!token) return res.json({ success: false, error: 'No Telegram bot token configured' });
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const d = await r.json() as any;
        if (d.ok) return res.json({ success: true, botName: d.result?.first_name, username: d.result?.username });
        return res.json({ success: false, error: d.description || 'Telegram API error' });
      } catch (e: any) {
        return res.json({ success: false, error: e.message || 'Network error reaching Telegram' });
      }
    }

    if (platform === 'facebook') {
      const token = String(s.fb_page_access_token || '').trim();
      const effectiveToken = token || getPlatformFbPageAccessToken();
      if (!effectiveToken) return res.json({ success: false, error: 'No Facebook token configured' });
      try {
        // /me with a Page Access Token returns the page info — no special permissions required
        const r = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${effectiveToken}`);
        const d = await r.json() as any;
        if (d.id) return res.json({ success: true, pageName: d.name, pageId: d.id });
        // Distinguish token expiry vs missing permissions
        const code = d.error?.code;
        const msg = d.error?.message || 'Facebook API error';
        if (code === 190) return res.json({ success: false, error: 'رمز الوصول منتهي الصلاحية — يجب تجديده من Meta Developers', errorType: 'token_expired' });
        if (code === 100 || code === 200 || code === 10) return res.json({ success: false, error: 'الرمز صالح لكن التطبيق يفتقر للأذونات المطلوبة (pages_messaging, pages_read_engagement). تأكد من App Review في Meta Developers.', errorType: 'missing_permissions' });
        return res.json({ success: false, error: msg });
      } catch (e: any) {
        return res.json({ success: false, error: e.message || 'Network error reaching Facebook' });
      }
    }

    if (platform === 'instagram') {
      const fbRow = await pool.query(
        `SELECT instagram_account_id, page_access_token_encrypted FROM facebook_tokens WHERE client_id = $1 AND is_active = TRUE LIMIT 1`,
        [clientId]
      );
      if (!fbRow.rows[0]?.instagram_account_id) return res.json({ success: false, error: 'No Instagram credentials configured' });
      const igId = fbRow.rows[0].instagram_account_id;
      const { decryptData } = await import('../utils/encryption');
      const token = decryptData(fbRow.rows[0].page_access_token_encrypted);
      try {
        const r = await fetch(`https://graph.facebook.com/v20.0/${igId}?fields=name,username&access_token=${token}`);
        const d = await r.json() as any;
        if (d.id) return res.json({ success: true, username: d.username });
        return res.json({ success: false, error: d.error?.message || 'Invalid Instagram token or Account ID' });
      } catch (e: any) {
        return res.json({ success: false, error: e.message || 'Network error reaching Instagram' });
      }
    }

    return res.json({ success: false, error: 'Unsupported platform' });
  } catch (error) {
    console.error('[testBotConnection] error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Update bot settings for the current client
export const updateBotSettings: RequestHandler = async (req, res) => {
  try {
    const clientId = (req as any).user?.id;
    
    if (!clientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      enabled,
      updatesEnabled,
      trackingEnabled,
      provider,
      whatsappPhoneId,
      whatsappToken,
      telegramBotToken,
      telegramBotUsername,
      telegramDelayMinutes,
      autoExpireHours,
      viberAuthToken,
      viberSenderName,
      templateGreeting,
      templateInstantOrder,
      templatePinInstructions,
      templateOrderConfirmation,
      templatePayment,
      templateShipping,
      messengerEnabled,
      fbPageId,
      fbPageAccessToken,
      messengerDelayMinutes,
      usePlatformMessenger,
      usePlatformTelegram,
      usePlatformWhatsapp,
      instagramAccountId,
      instagramPageAccessToken,
      deliveryNotificationsEnabled,
      deliveryStatusTemplate,
    } = req.body;

    const effectiveProvider = provider ?? 'telegram';

    const normalizedWhatsappToken = typeof whatsappToken === 'string' ? whatsappToken.trim() : '';
    const normalizedTelegramBotToken = typeof telegramBotToken === 'string' ? telegramBotToken.trim() : '';
    const normalizedTelegramBotUsername = typeof telegramBotUsername === 'string' ? telegramBotUsername.trim() : '';
    const normalizedFbPageId = typeof fbPageId === 'string' ? fbPageId.trim() : '';
    const normalizedFbPageAccessToken = typeof fbPageAccessToken === 'string' ? fbPageAccessToken.trim() : '';
    const normalizedWhatsappPhoneId = typeof whatsappPhoneId === 'string' ? whatsappPhoneId.trim() : '';

    // Detect which fields were explicitly sent (even as empty string) to support clearing credentials.
    const whatsappPhoneIdSent = 'whatsappPhoneId' in req.body;
    const whatsappTokenSent = 'whatsappToken' in req.body;
    const telegramBotTokenSent = 'telegramBotToken' in req.body;
    const fbPageIdSent = 'fbPageId' in req.body;

    // Load existing secrets so we can preserve them unless explicitly replaced.
    const existingSecretsRes = await pool.query(
      `SELECT whatsapp_phone_id, whatsapp_token, telegram_bot_token, telegram_bot_username, fb_page_id, fb_page_access_token
       FROM bot_settings WHERE client_id = $1`,
      [clientId]
    );
    const existingSecrets = existingSecretsRes.rows[0] || {};

    const existingTelegramIsPlatform = getPlatformTelegramAvailable()
      && String(existingSecrets.telegram_bot_token || '').trim() === getPlatformTelegramBotToken();
    const existingMessengerIsPlatform = getPlatformMessengerAvailable()
      && String(existingSecrets.fb_page_id || '').trim() === getPlatformFbPageId();
    const existingWhatsappIsPlatform = getPlatformWhatsappAvailable()
      && String(existingSecrets.whatsapp_phone_id || '').trim() === getPlatformWhatsappPhoneNumberId();

    const wantsPlatformMessenger = usePlatformMessenger === true
      || (usePlatformMessenger == null && existingMessengerIsPlatform);
    const wantsPlatformTelegram = usePlatformTelegram === true
      || (usePlatformTelegram == null && existingTelegramIsPlatform);
    const wantsPlatformWhatsapp = usePlatformWhatsapp === true
      || (usePlatformWhatsapp == null && existingWhatsappIsPlatform);

    // ── WhatsApp ──
    let finalWhatsappPhoneId: string | null = existingSecrets.whatsapp_phone_id ?? null;
    let finalWhatsappToken: string | null = existingSecrets.whatsapp_token ?? null;

    if (wantsPlatformWhatsapp) {
      if (!getPlatformWhatsappAvailable()) {
        return res.status(400).json({ error: 'Platform WhatsApp is not configured on the server.' });
      }
      finalWhatsappPhoneId = getPlatformWhatsappPhoneNumberId();
      finalWhatsappToken = null;
    } else if (whatsappPhoneIdSent || whatsappTokenSent) {
      // Credentials explicitly provided (or explicitly emptied) — save or clear accordingly.
      finalWhatsappPhoneId = normalizedWhatsappPhoneId || null;
      finalWhatsappToken = normalizedWhatsappToken || null;
    }
    // else: keep existing

    // Fetch real phone number from Graph API for wa.me links
    let finalWhatsappDisplayPhone: string | null = null;
    if (finalWhatsappPhoneId && finalWhatsappToken) {
      try {
        const waRes = await fetch(`https://graph.facebook.com/v25.0/${finalWhatsappPhoneId}?fields=display_phone_number`, {
          headers: { 'Authorization': `Bearer ${finalWhatsappToken}` }
        });
        if (waRes.ok) {
          const waData = await waRes.json();
          finalWhatsappDisplayPhone = String(waData.display_phone_number || '').replace(/[^0-9]/g, '') || null;
        }
      } catch (e) { /* ignore */ }
    }

    // ── Telegram ──
    let finalTelegramBotToken: string | null = existingSecrets.telegram_bot_token ?? null;
    let finalTelegramBotUsername: string | null = existingSecrets.telegram_bot_username ?? null;

    if (wantsPlatformTelegram) {
      if (!getPlatformTelegramAvailable()) {
        return res.status(400).json({ error: 'Platform Telegram bot is not configured on the server.' });
      }
      finalTelegramBotToken = getPlatformTelegramBotToken();
      finalTelegramBotUsername = normalizeTelegramUsername(getPlatformTelegramBotUsername());
    } else if (telegramBotTokenSent) {
      // Token explicitly provided (or explicitly emptied) — save or clear accordingly.
      finalTelegramBotToken = normalizedTelegramBotToken || null;
      finalTelegramBotUsername = normalizedTelegramBotUsername || null;
    }
    // else: keep existing (no token in request body)

    // ── Messenger ──
    let finalFbPageId: string | null = existingSecrets.fb_page_id ?? null;
    let finalFbPageAccessToken: string | null = existingSecrets.fb_page_access_token ?? null;

    if (wantsPlatformMessenger) {
      if (!getPlatformMessengerAvailable()) {
        return res.status(400).json({ error: 'Platform Messenger page is not configured on the server.' });
      }
      finalFbPageId = getPlatformFbPageId();
      finalFbPageAccessToken = null;
    } else if (fbPageIdSent) {
      // Page ID explicitly provided (or explicitly emptied) — save or clear accordingly.
      finalFbPageId = normalizedFbPageId || null;
      finalFbPageAccessToken = normalizedFbPageAccessToken || null;
    }
    // else: keep existing

    let effectiveEnabled: boolean = enabled ?? true;
    let botDisabledReason: string | undefined;

    // Do not allow enabling the bot while subscription is ended or payment-locked.
    // messengerEnabled is a contact channel setting and is always allowed to be saved.
    if (enabled === true) {
      const access = await getClientAccessState(clientId);
      if (!access.allowBot) {
        // Allow saving other settings (Messenger credentials/templates/etc), but hard-disable the bot.
        effectiveEnabled = false;
        botDisabledReason = access.reason || 'Subscription ended. Please renew to enable the bot.';
      }
    }

    // Check if settings exist
    const existingResult = await pool.query(
      `SELECT id FROM bot_settings WHERE client_id = $1`,
      [clientId]
    );

    if (existingResult.rows.length === 0) {
      // Insert new settings
      await pool.query(
        `INSERT INTO bot_settings (
          client_id, enabled, updates_enabled, tracking_enabled, provider, whatsapp_phone_id, whatsapp_token, whatsapp_display_phone,
          telegram_bot_token, telegram_delay_minutes, auto_expire_hours, viber_auth_token, viber_sender_name,
          telegram_bot_username, telegram_webhook_secret,
          template_greeting, template_instant_order, template_pin_instructions, template_order_confirmation, template_payment, template_shipping,
          messenger_enabled, fb_page_id, fb_page_access_token, messenger_delay_minutes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW())`,
        [
          clientId,
          effectiveEnabled,
          updatesEnabled ?? false,
          trackingEnabled ?? false,
          effectiveProvider,
          finalWhatsappPhoneId,
          finalWhatsappToken,
          finalWhatsappDisplayPhone,
          finalTelegramBotToken,
          telegramDelayMinutes ?? 5,
          autoExpireHours ?? 24,
          viberAuthToken ?? null,
          viberSenderName ?? null,
          finalTelegramBotUsername,
          null,
          templateGreeting ?? null,
          templateInstantOrder ?? null,
          templatePinInstructions ?? null,
          templateOrderConfirmation ?? null,
          templatePayment ?? null,
          templateShipping ?? null,
          messengerEnabled ?? false,
          finalFbPageId,
          finalFbPageAccessToken,
          messengerDelayMinutes ?? 5,
        ]
      );
    } else {
      // Update existing settings
      await pool.query(
        `UPDATE bot_settings SET
          enabled = $2,
          updates_enabled = $3,
          tracking_enabled = $4,
          provider = $5,
          whatsapp_phone_id = $6,
          whatsapp_token = $7,
          telegram_bot_token = $8,
          telegram_delay_minutes = $9,
          auto_expire_hours = $10,
          viber_auth_token = $11,
          viber_sender_name = $12,
          telegram_bot_username = $13,
          template_greeting = $14,
          template_instant_order = $15,
          template_pin_instructions = $16,
          template_order_confirmation = $17,
          template_payment = $18,
          template_shipping = $19,
          messenger_enabled = $20,
          fb_page_id = $21,
          fb_page_access_token = $22,
          messenger_delay_minutes = $23,
          delivery_notifications_enabled = $24,
          delivery_status_template = $25,
          whatsapp_display_phone = $26,
          updated_at = NOW()
        WHERE client_id = $1`,
        [
          clientId,
          effectiveEnabled,
          updatesEnabled ?? false,
          trackingEnabled ?? false,
          effectiveProvider,
          finalWhatsappPhoneId,
          finalWhatsappToken,
          finalTelegramBotToken,
          telegramDelayMinutes ?? 5,
          autoExpireHours ?? 24,
          viberAuthToken ?? null,
          viberSenderName ?? null,
          finalTelegramBotUsername,
          templateGreeting ?? null,
          templateInstantOrder ?? null,
          templatePinInstructions ?? null,
          templateOrderConfirmation ?? null,
          templatePayment ?? null,
          templateShipping ?? null,
          messengerEnabled ?? false,
          finalFbPageId,
          finalFbPageAccessToken,
          messengerDelayMinutes ?? 5,
          deliveryNotificationsEnabled ?? true,
          deliveryStatusTemplate ?? null,
          finalWhatsappDisplayPhone,
        ]
      );
    }

    // Save manual Instagram credentials into facebook_tokens if provided.
    const normalizedIgAccountId = typeof instagramAccountId === 'string' ? instagramAccountId.trim() : '';
    const normalizedIgPageToken = typeof instagramPageAccessToken === 'string' ? instagramPageAccessToken.trim() : '';
    if (normalizedIgAccountId && normalizedIgPageToken) {
      try {
        const encryptedToken = encryptData(normalizedIgPageToken);
        const existing = await pool.query(
          `SELECT id FROM facebook_tokens WHERE client_id = $1 LIMIT 1`,
          [clientId]
        );
        if (existing.rows.length) {
          // Update existing row — set Instagram fields + page token.
          await pool.query(
            `UPDATE facebook_tokens SET
               instagram_account_id = $1,
               page_access_token_encrypted = $2,
               is_active = TRUE,
               updated_at = NOW()
             WHERE client_id = $3`,
            [normalizedIgAccountId, encryptedToken, clientId]
          );
        } else {
          // Insert new row — fill NOT NULL cols with manual-entry placeholders.
          await pool.query(
            `INSERT INTO facebook_tokens
               (client_id, fb_user_id, user_access_token_encrypted, page_id, page_access_token_encrypted,
                instagram_account_id, is_active, created_at, updated_at)
             VALUES ($1, 'manual', $2, 'manual', $2, $3, TRUE, NOW(), NOW())
             ON CONFLICT (client_id) DO UPDATE SET
               instagram_account_id = EXCLUDED.instagram_account_id,
               page_access_token_encrypted = EXCLUDED.page_access_token_encrypted,
               is_active = TRUE, updated_at = NOW()`,
            [clientId, encryptedToken, normalizedIgAccountId]
          );
        }
        console.log(`[Bot] Manual Instagram credentials saved for client ${clientId}, IG Account: ${normalizedIgAccountId}`);
      } catch (igErr) {
        console.warn('[Bot] Failed to save manual Instagram credentials:', (igErr as any)?.message || igErr);
      }
    }

    // Auto-register Telegram webhook when Telegram is enabled/configured.
    let webhookWarning: string | undefined;
    if (effectiveEnabled && effectiveProvider === 'telegram' && finalTelegramBotToken && finalTelegramBotUsername) {
      try {
        const secret = await upsertTelegramWebhookSecret(clientId, finalTelegramBotToken);
        const baseUrl = getPublicBaseUrl(req);
        const hook = await registerTelegramWebhook({
          botToken: finalTelegramBotToken,
          baseUrl,
          secretToken: secret,
        });
        if (!hook.ok) {
          webhookWarning = hook.error || 'Failed to register Telegram webhook';
          console.warn('[Telegram] setWebhook failed (non-blocking):', webhookWarning);
        }
      } catch (whErr) {
        webhookWarning = (whErr as any)?.message || 'Telegram webhook registration error';
        console.warn('[Telegram] setWebhook exception (non-blocking):', webhookWarning);
      }
    }

    if (botDisabledReason) {
      return res.json({
        success: true,
        message: 'Settings saved, but the bot remains disabled until subscription is renewed.',
        botDisabled: true,
        reason: botDisabledReason,
        paymentRequired: true,
        code: 'SUBSCRIPTION_REQUIRED_FOR_BOT',
        ...(webhookWarning ? { webhookWarning } : {}),
      });
    }

    res.json({
      success: true,
      message: 'Bot settings updated successfully',
      ...(webhookWarning ? { webhookWarning } : {}),
    });
  } catch (error) {
    console.error('Error updating bot settings:', error);
    res.status(500).json({ error: 'Failed to update bot settings' });
  }
};
