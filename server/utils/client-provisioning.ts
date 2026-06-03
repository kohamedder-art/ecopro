import { ensureConnection } from './database';

// Read env vars lazily so they're always current at call time
function getPlatformTelegramBotToken() { return String(process.env.PLATFORM_TELEGRAM_BOT_TOKEN || '').trim(); }
function getPlatformTelegramBotUsername() { return String(process.env.PLATFORM_TELEGRAM_BOT_USERNAME || '').trim(); }
function isPlatformTelegramAvailable() { return !!getPlatformTelegramBotToken() && !!getPlatformTelegramBotUsername(); }

function getPlatformFbPageId() { return String(process.env.PLATFORM_FB_PAGE_ID || '').trim(); }
function getPlatformFbPageAccessToken() { return String(process.env.PLATFORM_FB_PAGE_ACCESS_TOKEN || '').trim(); }
function isPlatformMessengerAvailable() { return !!getPlatformFbPageId() && !!getPlatformFbPageAccessToken(); }



const DEFAULT_TEMPLATES = {
  greeting: `شكراً لطلبك من {storeName}، {customerName}! 🎉\n\n✅ فعّل الإشعارات لتلقي تأكيد الطلب وتحديثات التتبع.`,
  instantOrder: `🎉 شكراً لك {customerName}!\n\nتم استلام طلبك بنجاح ✅\n\n━━━━━━━━━━━━━━━━\n📦 تفاصيل الطلب\n━━━━━━━━━━━━━━━━\n🔢 رقم الطلب: #{orderId}\n📱 المنتج: {productName}\n💰 السعر: {totalPrice} دج\n📍 الكمية: {quantity}\n\n━━━━━━━━━━━━━━━━\n👤 معلومات التوصيل\n━━━━━━━━━━━━━━━━\n📛 الاسم: {customerName}\n📞 الهاتف: {customerPhone}\n🏠 العنوان: {address}\n\n━━━━━━━━━━━━━━━━\n🚚 حالة الطلب: قيد المعالجة\n━━━━━━━━━━━━━━━━\n\nسنتصل بك قريباً للتأكيد 📞\n\n⭐ من {storeName}`,
  pinInstructions: `📌 نصيحة مهمة:\n\nاضغط مطولاً على الرسالة السابقة واختر "تثبيت" لتتبع طلبك بسهولة!\n\n🔔 تأكد من:\n• تفعيل الإشعارات\n• عدم كتم المحادثة\n• ستتلقى تحديثات حالة الطلب هنا مباشرة`,
  orderConfirmation: `مرحباً {customerName}! 🌟\n\nشكراً لطلبك من {companyName}!\n\n📦 تفاصيل الطلب:\n• المنتج: {productName}\n• السعر: {totalPrice} دج\n• العنوان: {address}\n\nهل تؤكد الطلب؟ اضغط ✅ للتأكيد أو ❌ للإلغاء.`,
  payment: `تم تأكيد طلبك #{orderId}. المبلغ المطلوب: {totalPrice} دج.`,
  shipping: `تم شحن طلبك #{orderId}. رقم التتبع: {trackingNumber}.`,
};

let cachedOrderStatusesHasIsSystem: boolean | null = null;

async function orderStatusesHasIsSystem(): Promise<boolean> {
  if (cachedOrderStatusesHasIsSystem != null) return cachedOrderStatusesHasIsSystem;
  const pool = await ensureConnection();
  const res = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'order_statuses' AND column_name = 'is_system'
     LIMIT 1`
  );
  cachedOrderStatusesHasIsSystem = res.rowCount > 0;
  return cachedOrderStatusesHasIsSystem;
}

/**
 * Ensure a bot_settings row exists for a client.
 * This fixes the "bots not used for new users" issue: much of the bot pipeline
 * assumes a DB row exists, but the UI previously only returned in-memory defaults.
 */
export async function ensureBotSettingsRow(
  clientId: number,
  opts?: { enabled?: boolean }
): Promise<void> {
  const pool = await ensureConnection();

  const existing = await pool.query('SELECT id, enabled, telegram_bot_token, fb_page_id FROM bot_settings WHERE client_id = $1 LIMIT 1', [clientId]);
  
  if (existing.rowCount) {
    const row = existing.rows[0];
    // Always backfill platform credentials if the row exists but is missing them
    const needsTelegramBackfill = isPlatformTelegramAvailable() && !row.telegram_bot_token;
    const needsMessengerBackfill = isPlatformMessengerAvailable() && !row.fb_page_id;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (opts?.enabled !== undefined) {
      updates.push(`enabled = $${idx++}`);
      values.push(opts.enabled);
    }
    if (needsTelegramBackfill) {
      updates.push(`telegram_bot_token = $${idx++}`, `telegram_bot_username = $${idx++}`);
      values.push(getPlatformTelegramBotToken(), getPlatformTelegramBotUsername());
    }
    if (needsMessengerBackfill) {
      updates.push(`fb_page_id = $${idx++}`, `messenger_enabled = $${idx++}`);
      values.push(getPlatformFbPageId(), true);
    }
    // Backfill NULL template fields with defaults for existing rows
    updates.push(
      `template_greeting = COALESCE(NULLIF(template_greeting, ''), $${idx++})`,
      `template_instant_order = COALESCE(NULLIF(template_instant_order, ''), $${idx++})`,
      `template_pin_instructions = COALESCE(NULLIF(template_pin_instructions, ''), $${idx++})`,
      `template_order_confirmation = COALESCE(NULLIF(template_order_confirmation, ''), $${idx++})`,
      `template_payment = COALESCE(NULLIF(template_payment, ''), $${idx++})`,
      `template_shipping = COALESCE(NULLIF(template_shipping, ''), $${idx++})`
    );
    values.push(
      DEFAULT_TEMPLATES.greeting,
      DEFAULT_TEMPLATES.instantOrder,
      DEFAULT_TEMPLATES.pinInstructions,
      DEFAULT_TEMPLATES.orderConfirmation,
      DEFAULT_TEMPLATES.payment,
      DEFAULT_TEMPLATES.shipping
    );

    if (updates.length > 0) {
      values.push(clientId);
      await pool.query(`UPDATE bot_settings SET ${updates.join(', ')}, updated_at = NOW() WHERE client_id = $${idx}`, values);
    }
    return;
  }

  // Auto-enable bots when platform credentials are configured
  const platformAvailable = isPlatformTelegramAvailable() || isPlatformMessengerAvailable();
  const enabled = opts?.enabled ?? platformAvailable;

  // Store Page ID but do NOT store platform Page Access Token (env-only).
  const fbPageId = isPlatformMessengerAvailable() ? getPlatformFbPageId() : null;
  const fbPageAccessToken = null;

  // Auto-enable Messenger when platform Messenger is configured
  const messengerEnabled = isPlatformMessengerAvailable();

  await pool.query(
    `INSERT INTO bot_settings (
      client_id, enabled, updates_enabled, tracking_enabled, provider,
      whatsapp_phone_id, whatsapp_token,
      telegram_bot_token, telegram_bot_username, telegram_delay_minutes, auto_expire_hours,
      viber_auth_token, viber_sender_name, viber_delay_minutes,
      template_greeting, template_instant_order, template_pin_instructions, template_order_confirmation, template_payment, template_shipping,
      messenger_enabled, fb_page_id, fb_page_access_token, messenger_delay_minutes,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14,
      $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24,
      NOW(), NOW()
    )`,
    [
      clientId,
      enabled,
      true,
      true,
      'telegram',
      null,
      null,
      isPlatformTelegramAvailable() ? getPlatformTelegramBotToken() : null,
      isPlatformTelegramAvailable() ? getPlatformTelegramBotUsername() : null,
      5,
      24,
      null,
      null,
      5,
      DEFAULT_TEMPLATES.greeting,
      DEFAULT_TEMPLATES.instantOrder,
      DEFAULT_TEMPLATES.pinInstructions,
      DEFAULT_TEMPLATES.orderConfirmation,
      DEFAULT_TEMPLATES.payment,
      DEFAULT_TEMPLATES.shipping,
      messengerEnabled,
      fbPageId,
      fbPageAccessToken,
      5,
    ]
  );
}

/**
 * Backfill ALL existing bot_settings rows with platform credentials.
 * Run once at server startup so existing accounts get Sahla's shared bot connected.
 */
export async function backfillPlatformBotCredentials(): Promise<void> {
  if (!isPlatformTelegramAvailable() && !isPlatformMessengerAvailable()) {
    console.log('[Provisioning] No platform bot credentials configured — skipping backfill');
    return;
  }

  try {
    const pool = await ensureConnection();

    const updates: string[] = [];
    const baseValues: any[] = [];
    let idx = 1;

    if (isPlatformTelegramAvailable()) {
      updates.push(
        `telegram_bot_token = COALESCE(NULLIF(telegram_bot_token, ''), $${idx++})`,
        `telegram_bot_username = COALESCE(NULLIF(telegram_bot_username, ''), $${idx++})`
      );
      baseValues.push(getPlatformTelegramBotToken(), getPlatformTelegramBotUsername());
    }

    if (isPlatformMessengerAvailable()) {
      updates.push(
        `fb_page_id = COALESCE(NULLIF(fb_page_id, ''), $${idx++})`,
        `messenger_enabled = CASE WHEN fb_page_id IS NULL OR fb_page_id = '' THEN true ELSE messenger_enabled END`
      );
      baseValues.push(getPlatformFbPageId());
    }

    if (updates.length === 0) return;

    const result = await pool.query(
      `UPDATE bot_settings SET ${updates.join(', ')}, updated_at = NOW()
       WHERE (telegram_bot_token IS NULL OR telegram_bot_token = ''
              OR fb_page_id IS NULL OR fb_page_id = '')`,
      baseValues
    );

    console.log(`[Provisioning] Backfilled platform bot credentials for ${result.rowCount} existing account(s)`);
  } catch (err) {
    console.error('[Provisioning] backfillPlatformBotCredentials failed (non-fatal):', err);
  }
}

/**
 * Ensure system order statuses exist for a client.
 * Many dashboards/revenue queries rely on order_statuses rows.
 */
export async function ensureSystemOrderStatuses(clientId: number): Promise<void> {
  const pool = await ensureConnection();

  // IMPORTANT:
  // Do not return early if the client already has statuses.
  // Existing accounts might have a partial set (missing bot/system statuses like didnt_pickup).
  // We only insert missing keys and never overwrite user/custom rows.

  const hasIsSystem = await orderStatusesHasIsSystem();

  const baseCols = ['client_id', 'name', 'key', 'color', 'icon', 'sort_order', 'is_default', 'counts_as_revenue'];
  const cols = hasIsSystem ? [...baseCols, 'is_system'] : baseCols;

  const values: any[] = [];
  // Seed only the essential statuses for new accounts.
  // All other statuses (failure types, call-center, quality control, etc.) can be added
  // by the user via the Status Manager in their dashboard.
  const rows = [
    { key: 'pending',     name: 'Pending',              color: '#eab308', icon: '●',  sort_order: 0, is_default: true,  counts_as_revenue: false, is_system: true },
    { key: 'confirmed',   name: 'Confirmed',             color: '#22c55e', icon: '✓',  sort_order: 1, is_default: true,  counts_as_revenue: false, is_system: true },
    { key: 'at_delivery', name: 'At Delivery',           color: '#8b5cf6', icon: '🚚', sort_order: 2, is_default: true,  counts_as_revenue: false, is_system: true },
    { key: 'completed',   name: 'Completed',             color: '#10b981', icon: '✓',  sort_order: 3, is_default: true,  counts_as_revenue: true,  is_system: true },
    { key: 'fake',        name: 'Fake',                  color: '#dc2626', icon: '⚠️', sort_order: 89, is_default: true,  counts_as_revenue: false, is_system: true },
    { key: 'duplicate',   name: 'Duplicate',             color: '#9ca3af', icon: '📋', sort_order: 90, is_default: true,  counts_as_revenue: false, is_system: true },
  ];

  // Insert missing keys one-by-one using WHERE NOT EXISTS to avoid duplicates.
  // (Some older DBs may not have a unique constraint on (client_id, key).)
  // We also add explicit casts to avoid Postgres "inconsistent types deduced" errors.
  for (const r of rows) {
    const rowVals = [
      clientId,
      r.name,
      r.key,
      r.color,
      r.icon,
      r.sort_order,
      r.is_default,
      r.counts_as_revenue,
      ...(hasIsSystem ? [r.is_system] : []),
    ];
    values.length = 0;
    values.push(...rowVals);
    const placeholders = rowVals.map((_, i) => {
      const idx = i + 1;
      // Fixed column order: client_id, name, key, color, icon, sort_order, is_default, counts_as_revenue, [is_system]
      if (idx === 1) return `$${idx}::int`;
      if (idx === 2) return `$${idx}::text`;
      if (idx === 3) return `$${idx}::text`;
      if (idx === 4) return `$${idx}::text`;
      if (idx === 5) return `$${idx}::text`;
      if (idx === 6) return `$${idx}::int`;
      if (idx === 7) return `$${idx}::boolean`;
      if (idx === 8) return `$${idx}::boolean`;
      if (idx === 9) return `$${idx}::boolean`;
      return `$${idx}`;
    });

    await pool.query(
      `INSERT INTO order_statuses (${cols.join(', ')})
       SELECT ${placeholders.join(', ')}
       WHERE NOT EXISTS (
         SELECT 1 FROM order_statuses WHERE client_id = $1::int AND key = $3::text
       )`,
       values
     );
   }
 }

const SAMPLE_PRODUCTS = [
  {
    title: 'ساعة رجالية فاخرة',
    description: 'ساعة رجالية أنيقة بتصميم كلاسيكي، علبة ستانلس ستيل، مقاومة للماء، متوفرة بعدة ألوان.',
    price: 4500,
    images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&q=85'],
    category: 'اكسسوارات',
  },
  {
    title: 'عطر فرنسي أصلي',
    description: 'عطر فرنسي فاخر برائحة خشبية منعشة، يدوم طويلاً، مناسب للاستخدام اليومي والمناسبات.',
    price: 3200,
    images: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=85'],
    category: 'عطور',
  },
  {
    title: 'حقيبة يد نسائية',
    description: 'حقيبة يد جلدية عصرية، واسعة بتصميم أنيق، مناسبة للعمل والخروجات. متوفرة بالأسود والبني.',
    price: 2800,
    images: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=85'],
    category: 'اكسسوارات',
  },
  {
    title: 'طقم رياضي رجالي',
    description: 'طقم رياضي قطني مريح، مناسب للجيم والجري، متوفر بعدة مقاسات وألوان. جودة عالية وخياطة متقنة.',
    price: 3800,
    images: ['https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=85'],
    category: 'ملابس',
  },
];

export async function ensureSampleProducts(clientId: number): Promise<void> {
  try {
    const pool = await ensureConnection();
    const existing = await pool.query(
      `SELECT COUNT(*) as cnt FROM client_store_products WHERE client_id = $1`,
      [clientId]
    );
    if (Number(existing.rows[0]?.cnt || 0) > 0) return;
    for (const p of SAMPLE_PRODUCTS) {
      await pool.query(
        `INSERT INTO client_store_products (client_id, title, description, price, images, category, stock_quantity, status, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, 15, 'active', true)`,
        [clientId, p.title, p.description, p.price, p.images, p.category]
      );
    }
    console.log(`[Provisioning] Created ${SAMPLE_PRODUCTS.length} sample products for client ${clientId}`);
  } catch (err) {
    console.error('[Provisioning] ensureSampleProducts failed (non-fatal):', err);
  }
 }
