/**
 * Owner AI — Store owner's AI partner
 *
 * ═══════════════════════════════════════════════════════════════
 * !! AGENT INSTRUCTIONS — READ BEFORE EDITING SYSTEM_PROMPT !!
 * ═══════════════════════════════════════════════════════════════
 * 
 * DO:
 * - Write SYSTEM_PROMPT like a skilled consultant's knowledge
 * - Short, practical sentences — advice the owner can use today
 * - Fix only the specific problem, don't rewrite the whole prompt
 * 
 * DON'T:
 * - Don't add numbered lists, bullet-point rule books, or "⚠️❌✅"
 * - Don't turn it into a programming manual / robot instructions
 * - Don't rewrite the entire prompt for every small fix
 * 
 * Test rule: Read this block before editing SYSTEM_PROMPT.
 * ═══════════════════════════════════════════════════════════════
 */

import { ensureConnection } from '../utils/database';
import { generateText, GeminiContent } from './gemini';
import { checkRateLimit, getRateLimitResetTime, RATE_LIMITS, getRateLimitMessage } from '../utils/ai-rate-limiter';

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Short, focused, smart
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `أنت مساعد ذكي لصاحب متجر على Sahla4Eco. عندك بيانات متجره — استعملها.

قواعد الحوار:
• جاوب مباشر، ما تشرحش نفسك. جملة إلى 3 جمل كافية.
• لا تقل "أنا آسف" إلا إذا كان خطأ منك (مثلاً نفذت شي غلط). وإلا تجاوب طبيعي.
• لا تقل "أنا هنا لمساعدتك" ولا تعرف على نفسك. المستخدم يعرف مين أنت.
• إذا قال المستخدم "لا" أو "ليس هذا" أو "ما فهمتنيش" → اعترف بسرعة ("فهمت") وغير اتجاه الرد.
• لا تحول كل رد لسؤال. سؤال واحد فقط إذا كان ضروري.
• لا تذكر AI Settings أو "تعليمات الذكاء الاصطناعي" إلا إذا سأل المستخدم عنها صراحة.
• إذا كرر المستخدم نفس الشكوى → راجع ردودك السابقة واعترف بالخطأ بدل ما تعيد نفس النصيحة.
• لا تبدأ الرد بترحيب (مرحباً) في كل مرة. جاوب مباشر.
• ردودك بالعربية الفصحى أو الإنجليزية أو الفرنسية حسب لغة المستخدم.
• لا تستخدم الدارجة أبداً. إذا كتب المستخدم بالدارجة، رد بالفصحى.
• لا تولّد أحرف صينية أو يابانية أو كورية أو أي أحرف غير عربية أو إنجليزية أو فرنسية أبداً.
• استخدم **عناوين عريضة** و - قوائم نقطية باش تنظم الرد وتكون القراينة واضحة.

أنت خبير في التجارة الإلكترونية في السوق الجزائري. استخدم خبرتك باش تفيد صاحب المتجر بنصيحة عملية يقدر يطبقها اليوم.`;

// ═══════════════════════════════════════════════════════════════
// ACTIONS — Simple, reliable JSON
// ═══════════════════════════════════════════════════════════════

const ACTION_INSTRUCTIONS = `
الدوات المتاحة — أضف ECOPRO_ACTION في النهاية إذا طلب المستخدم إجراء:

═══ المنتجات ═══
- ECOPRO_ACTION:{"type":"search_products","query":"<بحث>"}
- ECOPRO_ACTION:{"type":"get_product","productId":<ن>}
- ECOPRO_ACTION:{"type":"create_product","title":"<اسم>","price":<سعر>,"stock":<مخزون>,"category":"<فئة>","description":"<وصف>"}
- ECOPRO_ACTION:{"type":"edit_product","productId":<ن>,"field":"price|stock_quantity|title|description|status|category","value":"<قيمة>"}
- ECOPRO_ACTION:{"type":"delete_product","productId":<ن>}
- ECOPRO_ACTION:{"type":"archive_product","productId":<ن>}

═══ الطلبات ═══
- ECOPRO_ACTION:{"type":"search_orders","query":"<بحث>","status":"<حالة>"}
- ECOPRO_ACTION:{"type":"get_order","orderId":<ن>}
- ECOPRO_ACTION:{"type":"update_order_status","orderId":<ن>,"newStatus":"<حالة>"}
Statuses: pending, confirmed, processing, shipped, delivered, cancelled, returned, fake, no_answer_1, no_answer_2, no_answer_3
- ECOPRO_ACTION:{"type":"get_order_stats"}

═══ الزبائن ═══
- ECOPRO_ACTION:{"type":"search_customers","query":"<بحث>"}
- ECOPRO_ACTION:{"type":"get_customer","customerPhone":"<رقم>"}

═══ الكوبونات ═══
- ECOPRO_ACTION:{"type":"list_coupons"}
- ECOPRO_ACTION:{"type":"create_coupon","code":"<كود>","type":"percentage|fixed","value":<قيمة>,"minOrder":<حد_أدنى>,"maxUses":<حد_أقصى>,"expiryDate":"<تاريخ>"}
- ECOPRO_ACTION:{"type":"delete_coupon","couponId":<ن>}

═══ المتجر ═══
- ECOPRO_ACTION:{"type":"get_store_settings"}
- ECOPRO_ACTION:{"type":"update_store_settings","field":"store_name|description|currency|language","value":"<قيمة>"}
- ECOPRO_ACTION:{"type":"get_delivery_config"}
- ECOPRO_ACTION:{"type":"update_free_delivery_threshold","amount":<مبلغ>}

═══ تصميم المتجر ═══
- ECOPRO_ACTION:{"type":"update_store_design","field":"<اسم_الحقل>","value":"<قيمة>"}
- ECOPRO_ACTION:{"type":"batch_update_store_design","updates":{"field1":"value1","field2":"value2"}}
- ECOPRO_ACTION:{"type":"get_store_design"}
- ECOPRO_ACTION:{"type":"switch_template","template":"<اسم_القالب>"}

القالب المتاحة: books, minimal, mega, grocery, pro, tech, modern
الحقول المتاحة للتصميم:
  الهوية: store_name, store_description, store_logo, primary_color, secondary_color, owner_name, owner_email, currency_code
  الصور: banner_url, hero_main_url, hero_tile1_url, hero_tile2_url, hero_video_url, template_bg_image, store_images
  النص: template_hero_heading, template_hero_subtitle, template_button_text, template_hero_kicker, template_hero_badge_title, template_hero_badge_subtitle, template_featured_title, template_featured_subtitle, template_copyright, template_footer_text, template_add_to_cart_label
  الألوان: template_accent_color, template_bg_color, template_text_color, template_muted_color, template_header_bg, template_header_text, template_hero_title_color, template_hero_subtitle_color, template_hero_kicker_color, template_footer_bg, template_footer_text, template_footer_link_color, template_card_bg, template_product_title_color, template_product_price_color, template_section_title_color, template_section_subtitle_color, template_category_pill_bg, template_category_pill_text, template_category_pill_active_bg, template_category_pill_active_text
  الطباعة: template_font_family, template_font_weight, template_heading_font_weight
  الأحجام: template_border_radius, template_card_border_radius, template_button_border_radius, template_section_title_size, template_hero_title_size, template_hero_subtitle_size, template_category_pill_border_radius
  المسافات: template_spacing, template_section_spacing, template_grid_gap
  الشبكة: template_grid_columns, template_grid_title
  الحركة: template_animation_speed, template_hover_scale
  الأزرار: template_button2_text, template_button2_border
  مخصص: template_custom_css, template_social_links, template_nav_links
  الرابط: store_slug, subdomain, custom_domain, is_public

═══ البوت ═══
- ECOPRO_ACTION:{"type":"get_bot_settings"}
- ECOPRO_ACTION:{"type":"update_bot_settings","field":"greeting_message|enable_telegram|enable_messenger|enable_whatsapp","value":"<قيمة>"}

═══ الإحصائيات ═══
- ECOPRO_ACTION:{"type":"get_dashboard_stats"}
- ECOPRO_ACTION:{"type":"get_analytics","period":"7d|30d|90d"}

═══ الموظفين ═══
- ECOPRO_ACTION:{"type":"list_staff"}

═══ الاشتراك والفواتير ═══
- ECOPRO_ACTION:{"type":"get_subscription"}
- ECOPRO_ACTION:{"type":"get_payment_history"}

═══ البث ═══
- ECOPRO_ACTION:{"type":"send_broadcast","message":"<نص>","segment":"all|completed|pending","channel":"telegram|whatsapp|messenger"}

═══ شركات التوصيل ═══
- ECOPRO_ACTION:{"type":"list_delivery_companies"}
- ECOPRO_ACTION:{"type":"list_delivery_integrations"}
- ECOPRO_ACTION:{"type":"configure_delivery_integration","companyId":<ن>,"apiKey":"<مفتاح>"}
- ECOPRO_ACTION:{"type":"delete_delivery_integration","companyId":<ن>}

═══ أسعار التوصيل ═══
- ECOPRO_ACTION:{"type":"get_delivery_prices"}
- ECOPRO_ACTION:{"type":"set_delivery_price","wilayaId":<ن_الولاية>,"homePrice":<سعر_المنزل>,"deskPrice":<سعر_المكتب>,"estimatedDays":<أيام>}
- ECOPRO_ACTION:{"type":"bulk_set_delivery_prices","prices":[{"wilayaId":<ن>,"homePrice":<سعر>}]}
- ECOPRO_ACTION:{"type":"delete_delivery_price","priceId":<ن>}

═══ المخزون ═══
- ECOPRO_ACTION:{"type":"list_stock","search":"<بحث>","category":"<فئة>","status":"active|discontinued|out_of_stock"}
- ECOPRO_ACTION:{"type":"get_stock","stockId":<ن>}
- ECOPRO_ACTION:{"type":"create_stock","name":"<اسم>","quantity":<كمية>,"unitPrice":<سعر>,"category":"<فئة>","sizes":["<مقاس>"],"colors":["<لون>"],"sku":"<كود>"}
- ECOPRO_ACTION:{"type":"update_stock","stockId":<ن>,"field":"name|unit_price|category|status|reorder_level|supplier_name|supplier_contact|location","value":"<قيمة>"}
- ECOPRO_ACTION:{"type":"adjust_stock","stockId":<ن>,"adjustment":<+-كمية>,"reason":"<سبب>"}
- ECOPRO_ACTION:{"type":"delete_stock","stockId":<ن>}
- ECOPRO_ACTION:{"type":"get_low_stock_alerts"}

═══ حالات الطلب المخصصة ═══
- ECOPRO_ACTION:{"type":"list_order_statuses"}
- ECOPRO_ACTION:{"type":"create_order_status","name":"<اسم>","color":"<لون>","icon":"<رمز>","countsAsRevenue":true|false}
- ECOPRO_ACTION:{"type":"update_order_status_def","statusId":<ن>,"name":"<اسم>","color":"<لون>","icon":"<رمز>"}
- ECOPRO_ACTION:{"type":"delete_order_status","statusId":<ن>}
- ECOPRO_ACTION:{"type":"restore_preset_status","key":"cancelled|failed|delivered|declined|delivery_failed|returned|didnt_pickup|no_answer_1|no_answer_2|no_answer_3|waiting_callback|postponed|fake|duplicate"}

═══ المتغيرات (الألوان/المقاسات) ═══
- ECOPRO_ACTION:{"type":"get_product_variants","productId":<ن>}
- ECOPRO_ACTION:{"type":"update_product_variants","productId":<ن>,"variants":[{"color":"<لون>","size":"<مقاس>","price":<سعر>,"stock_quantity":<مخزون>}]}

═══ وسائل التواصل ═══
- ECOPRO_ACTION:{"type":"get_social_links"}
- ECOPRO_ACTION:{"type":"update_social_links","platform":"facebook|instagram|tiktok|youtube|twitter|snapchat","url":"<رابط>"}

═══ ردود البوت التلقائية ═══
- ECOPRO_ACTION:{"type":"get_ai_auto_reply"}
- ECOPRO_ACTION:{"type":"toggle_ai_auto_reply","enabled":true|false}
- ECOPRO_ACTION:{"type":"update_ai_instructions","instructions":"<تعليمات>"}

═══ الحملات الإعلانية ═══
- ECOPRO_ACTION:{"type":"list_campaigns"}
- ECOPRO_ACTION:{"type":"create_campaign","name":"<اسم>","message":"<رسالة>","targetCategory":"all|completed|pending|cancelled","channel":"telegram|whatsapp|messenger"}
- ECOPRO_ACTION:{"type":"send_campaign","campaignId":<ن>}
- ECOPRO_ACTION:{"type":"delete_campaign","campaignId":<ن>}
- ECOPRO_ACTION:{"type":"get_campaign_logs","campaignId":<ن>}`;

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleOwnerMessage(
  clientId: number,
  question: string,
  prevHistory: GeminiContent[] = []
): Promise<{ answer: string; action: any | null }> {
  // Rate limit
  if (!checkRateLimit(`owner:${clientId}`, RATE_LIMITS.store_owner)) {
    return { answer: getRateLimitMessage(getRateLimitResetTime(`owner:${clientId}`), 'store_owner', 'ar'), action: null };
  }

  // Load slim context
  const ctx = await loadSlimContext(clientId);
  if (!ctx) return { answer: 'لم يتم العثور على بيانات المتجر.', action: null };

  // Build user prompt
  const prompt = buildUserPrompt(ctx, prevHistory, question);

  try {
    const response = await generateText('store_owner', prompt, { storeId: clientId, storeName: ctx.storeName, clientId, userType: 'owner' }, prevHistory, undefined, SYSTEM_PROMPT + '\n' + ACTION_INSTRUCTIONS);

    // Parse action
    let answer = response;
    let action: any = null;
    const actionMatch = response.match(/\nECOPRO_ACTION:(\{[\s\S]*?\})\s*$/);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        answer = response.replace(/\nECOPRO_ACTION:\{[\s\S]*?\}\s*$/, '').trim();
      } catch {}
    }

    // Handle search_store_data inline
    if (action?.type === 'search_store_data') {
      const toolResult = await executeSearch(clientId, action.dataType, action.query);
      const followUp = await generateText('store_owner', `البيانات المطلوبة:\n${toolResult}\n\nالسؤال الأصلي: "${question}"`, { storeId: clientId, storeName: ctx.storeName, clientId, userType: 'owner' }, prevHistory, undefined, SYSTEM_PROMPT);
      answer = followUp;
      action = null;
    }

    // Validate: if AI said "check dashboard" but we have actual data, override with direct answer
    const validated = validateResponse(answer, question, ctx);
    if (validated !== answer) {
      console.log(`[OwnerAI] Validation overridden. Original: "${answer.slice(0, 80)}..." → "${validated.slice(0, 80)}..."`);
    }
    answer = validated;

    const topic = detectTopic(question);

    // Save conversation (non-blocking)
    saveOwnerHistory(clientId, question, answer, topic).catch(() => {});

    return { answer, action };
  } catch (err) {
    console.error(`[OwnerAI] Error for client ${clientId}:`, err);
    return { answer: 'حدث خطأ. يرجى المحاولة مرة أخرى.', action: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE ACTIONS (called from routes/ai.ts)
// ═══════════════════════════════════════════════════════════════

export async function executeAction(clientId: number, action: any): Promise<{ success: boolean; message: string; data?: any }> {
  const p = await ensureConnection();
  try {
    switch (action.type) {
      // ═══ PRODUCTS ═══
      case 'search_products': {
        const q = `%${action.query || ''}%`;
        const res = await p.query(`SELECT id, title, price, stock_quantity, category, status FROM client_store_products WHERE client_id = $1 AND deleted_at IS NULL AND (title ILIKE $2 OR category ILIKE $2) ORDER BY created_at DESC LIMIT 10`, [clientId, q]);
        if (!res.rows.length) return { success: true, message: 'لا توجد منتجات تطابق البحث.', data: [] };
        const list = res.rows.map((r: any) => `#${r.id} | ${r.title} | ${r.price} دج | مخزون: ${r.stock_quantity ?? 'N/A'} | ${r.status}`).join('\n');
        return { success: true, message: `نتائج البحث:\n${list}`, data: res.rows };
      }
      case 'get_product': {
        const { productId } = action;
        if (!productId) return { success: false, message: 'معرف المنتج مطلوب' };
        const res = await p.query(`SELECT id, title, price, stock_quantity, category, description, status FROM client_store_products WHERE id = $1 AND client_id = $2`, [productId, clientId]);
        if (!res.rows.length) return { success: false, message: `المنتج #${productId} غير موجود` };
        const r = res.rows[0];
        return { success: true, message: `**${r.title}**\n- السعر: ${r.price} دج\n- المخزون: ${r.stock_quantity ?? 'N/A'}\n- الفئة: ${r.category || 'بدون'}\n- الحالة: ${r.status}\n- الوصف: ${r.description || 'بدون'}`, data: r };
      }
      case 'create_product': {
        const { title, price, stock, category, description } = action;
        if (!title || !price) return { success: false, message: 'الاسم والسعر مطلوبان' };
        const res = await p.query(`INSERT INTO client_store_products (client_id, title, price, stock_quantity, category, description, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id`, [clientId, title, price, stock || 0, category || null, description || null]);
        return { success: true, message: `تم إضافة المنتج "${title}" (ID: ${res.rows[0].id})`, data: { productId: res.rows[0].id } };
      }
      case 'edit_product': {
        const { productId, field, value } = action;
        if (!productId || !field || value === undefined) return { success: false, message: 'بيانات ناقصة' };
        const allowed = ['price', 'stock_quantity', 'title', 'description', 'status', 'category'];
        if (!allowed.includes(field)) return { success: false, message: `الحقل "${field}" غير مدعوم` };
        const dbField = field === 'stock' ? 'stock_quantity' : field;
        await p.query(`UPDATE client_store_products SET ${dbField} = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3`, [value, productId, clientId]);
        return { success: true, message: `تم تعديل ${field} للمنتج #${productId}` };
      }
      case 'delete_product': {
        const { productId } = action;
        if (!productId) return { success: false, message: 'معرف المنتج مطلوب' };
        await p.query(`UPDATE client_store_products SET deleted_at = NOW(), status = 'archived' WHERE id = $1 AND client_id = $2`, [productId, clientId]);
        return { success: true, message: `تم حذف المنتج #${productId}` };
      }
      case 'archive_product': {
        const { productId } = action;
        if (!productId) return { success: false, message: 'معرف المنتج مطلوب' };
        await p.query(`UPDATE client_store_products SET status = 'archived' WHERE id = $1 AND client_id = $2`, [productId, clientId]);
        return { success: true, message: `تم أرشفة المنتج #${productId}` };
      }

      // ═══ ORDERS ═══
      case 'search_orders': {
        const q = `%${action.query || ''}%`;
        let sql = `SELECT id, customer_name, customer_phone, total_price, status, delivery_status, created_at FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL`;
        const params: any[] = [clientId];
        if (action.query) { sql += ` AND (id::text ILIKE $2 OR customer_name ILIKE $2 OR customer_phone ILIKE $2)`; params.push(q); }
        if (action.status) { sql += ` AND status = $${params.length + 1}`; params.push(action.status); }
        sql += ` ORDER BY created_at DESC LIMIT 10`;
        const res = await p.query(sql, params);
        if (!res.rows.length) return { success: true, message: 'لا توجد طلبات تطابق البحث.', data: [] };
        const list = res.rows.map((o: any) => `#${o.id} | ${o.customer_name || 'N/A'} | ${o.total_price} دج | ${o.status} | ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`).join('\n');
        return { success: true, message: `الطلبات:\n${list}`, data: res.rows };
      }
      case 'get_order': {
        const { orderId } = action;
        if (!orderId) return { success: false, message: 'معرف الطلب مطلوب' };
        const res = await p.query(`SELECT id, customer_name, customer_phone, total_price, status, delivery_status, delivery_company, shipping_address, wilaya, notes, created_at FROM store_orders WHERE id = $1 AND client_id = $2`, [orderId, clientId]);
        if (!res.rows.length) return { success: false, message: `الطلب #${orderId} غير موجود` };
        const r = res.rows[0];
        return { success: true, message: `**الطلب #${r.id}**\n- الزبون: ${r.customer_name || 'N/A'}\n- الهاتف: ${r.customer_phone || 'N/A'}\n- المبلغ: ${r.total_price} دج\n- الحالة: ${r.status}\n- التوصيل: ${r.delivery_status || 'N/A'}\n- الولاية: ${r.wilaya || 'N/A'}\n- العنوان: ${r.shipping_address || 'N/A'}\n- التاريخ: ${new Date(r.created_at).toLocaleDateString('ar-DZ')}`, data: r };
      }
      case 'update_order_status': {
        const { orderId, newStatus } = action;
        if (!orderId || !newStatus) return { success: false, message: 'بيانات ناقصة' };
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'fake', 'no_answer_1', 'no_answer_2', 'no_answer_3'];
        if (!validStatuses.includes(newStatus)) return { success: false, message: `حالة غير صالحة. الحالات المتاحة: ${validStatuses.join(', ')}` };
        await p.query(`UPDATE store_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3`, [newStatus, orderId, clientId]);
        return { success: true, message: `تم تغيير حالة الطلب #${orderId} إلى ${newStatus}` };
      }
      case 'get_order_stats': {
        const res = await p.query(`SELECT status, COUNT(*) as count FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL GROUP BY status`, [clientId]);
        const total = res.rows.reduce((s: number, r: any) => s + Number(r.count), 0);
        const stats = res.rows.map((r: any) => `- ${r.status}: ${r.count}`).join('\n');
        return { success: true, message: `**إحصائيات الطلبات**\n- الإجمالي: ${total}\n${stats}`, data: res.rows };
      }

      // ═══ CUSTOMERS ═══
      case 'search_customers': {
        const q = `%${action.query || ''}%`;
        const res = await p.query(`SELECT customer_name, customer_phone, COUNT(*) as order_count, SUM(total_price) as total_spent FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND (customer_name ILIKE $2 OR customer_phone ILIKE $2) GROUP BY customer_name, customer_phone ORDER BY order_count DESC LIMIT 10`, [clientId, q]);
        if (!res.rows.length) return { success: true, message: 'لا يوجد زبائن يطابقون البحث.', data: [] };
        const list = res.rows.map((c: any) => `${c.customer_name || 'N/A'} | ${c.customer_phone || 'N/A'} | ${c.order_count} طلبات | ${Number(c.total_spent).toLocaleString('ar-DZ')} دج`).join('\n');
        return { success: true, message: `الزبائن:\n${list}`, data: res.rows };
      }
      case 'get_customer': {
        const { customerPhone } = action;
        if (!customerPhone) return { success: false, message: 'رقم الهاتف مطلوب' };
        const res = await p.query(`SELECT customer_name, customer_phone, COUNT(*) as order_count, SUM(total_price) as total_spent FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND customer_phone = $2 GROUP BY customer_name, customer_phone`, [clientId, customerPhone]);
        if (!res.rows.length) return { success: false, message: `لا يوجد زبون بهذا الرقم` };
        const r = res.rows[0];
        const orders = await p.query(`SELECT id, total_price, status, created_at FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND customer_phone = $2 ORDER BY created_at DESC LIMIT 5`, [clientId, customerPhone]);
        const orderList = orders.rows.map((o: any) => `  #${o.id} | ${o.total_price} دج | ${o.status} | ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`).join('\n');
        return { success: true, message: `**${r.customer_name || 'N/A'}** (${r.customer_phone})\n- الطلبات: ${r.order_count}\n- الإجمالي: ${Number(r.total_spent).toLocaleString('ar-DZ')} دج\n- آخر 5 طلبات:\n${orderList}`, data: r };
      }

      // ═══ COUPONS ═══
      case 'list_coupons': {
        const res = await p.query(`SELECT id, code, type, value, min_order_amount, max_uses, used_count, expiry_date, is_active FROM client_store_coupons WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد كوبونات.', data: [] };
        const list = res.rows.map((c: any) => `- #${c.id} | ${c.code} | ${c.type === 'percentage' ? c.value + '%' : c.value + ' دج'} | الحد الأدنى: ${c.min_order_amount || 0} دج | الاستخدام: ${c.used_count || 0}/${c.max_uses || '∞'} | ${c.is_active ? 'نشط' : 'معطل'}`).join('\n');
        return { success: true, message: `**الكوبونات:**\n${list}`, data: res.rows };
      }
      case 'create_coupon': {
        const { code, type, value, minOrder, maxUses, expiryDate } = action;
        if (!code || !type || !value) return { success: false, message: 'الكود والنوع والقيمة مطلوبة' };
        const res = await p.query(`INSERT INTO client_store_coupons (client_id, code, type, value, min_order_amount, max_uses, expiry_date, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`, [clientId, code, type, value, minOrder || 0, maxUses || null, expiryDate || null]);
        return { success: true, message: `تم إنشاء الكوبون "${code}" (ID: ${res.rows[0].id})`, data: { couponId: res.rows[0].id } };
      }
      case 'delete_coupon': {
        const { couponId } = action;
        if (!couponId) return { success: false, message: 'معرف الكوبون مطلوب' };
        await p.query(`DELETE FROM client_store_coupons WHERE id = $1 AND client_id = $2`, [couponId, clientId]);
        return { success: true, message: `تم حذف الكوبون #${couponId}` };
      }

      // ═══ STORE SETTINGS ═══
      case 'get_store_settings': {
        const res = await p.query(`SELECT store_name, store_description, currency_code, owner_name, owner_email, is_public, template, store_slug, primary_color, secondary_color FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        if (!res.rows.length) return { success: false, message: 'إعدادات المتجر غير موجودة' };
        const r = res.rows[0];
        return { success: true, message: `**إعدادات المتجر**\n- الاسم: ${r.store_name || 'بدون'}\n- الوصف: ${r.store_description || 'بدون'}\n- العملة: ${r.currency_code || 'DZD'}\n- المالك: ${r.owner_name || 'بدون'}\n- الإيميل: ${r.owner_email || 'بدون'}\n- القالب: ${r.template || 'books'}\n- الرابط: ${r.store_slug || 'بدون'}\n- اللون الأساسي: ${r.primary_color || '#f97316'}\n- اللون الثانوي: ${r.secondary_color || '#8B7355'}\n- عام: ${r.is_public ? 'نعم' : 'لا'}`, data: r };
      }
      case 'update_store_settings': {
        const { field, value } = action;
        if (!field || value === undefined) return { success: false, message: 'الحقل والقيمة مطلوبان' };
        const allowed = ['store_name', 'store_description', 'currency_code', 'owner_name', 'owner_email', 'is_public', 'store_slug', 'subdomain', 'custom_domain'];
        if (!allowed.includes(field)) return { success: false, message: `الحقل "${field}" غير مدعوم. الحقول المتاحة: ${allowed.join(', ')}` };
        await p.query(`UPDATE client_store_settings SET ${field} = $1, updated_at = NOW() WHERE client_id = $2`, [value, clientId]);
        return { success: true, message: `تم تحديث ${field}` };
      }

      // ═══ STORE DESIGN ═══
      case 'get_store_design': {
        const res = await p.query(`SELECT template, primary_color, secondary_color, store_name, store_description, store_logo, banner_url, hero_main_url, hero_tile1_url, hero_tile2_url, hero_video_url, template_bg_image, template_bg_color, template_text_color, template_muted_color, template_accent_color, template_header_bg, template_header_text, template_footer_bg, template_footer_text, template_footer_link_color, template_card_bg, template_product_title_color, template_product_price_color, template_section_title_color, template_section_subtitle_color, template_hero_heading, template_hero_subtitle, template_button_text, template_hero_kicker, template_hero_kicker_color, template_hero_title_color, template_hero_title_size, template_hero_subtitle_color, template_hero_subtitle_size, template_font_family, template_font_weight, template_heading_font_weight, template_border_radius, template_card_border_radius, template_button_border_radius, template_spacing, template_section_spacing, template_grid_columns, template_grid_gap, template_animation_speed, template_hover_scale, template_category_pill_bg, template_category_pill_text, template_category_pill_active_bg, template_category_pill_active_text, template_category_pill_border_radius, template_hero_badge_title, template_hero_badge_subtitle, template_featured_title, template_featured_subtitle, template_button2_text, template_button2_border, template_copyright, template_footer_text, template_add_to_cart_label, template_custom_css, template_social_links, template_nav_links, store_slug, subdomain, is_public FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        if (!res.rows.length) return { success: false, message: 'إعدادات المتجر غير موجودة' };
        const r = res.rows[0];
        const sections = [
          `**القالب:** ${r.template || 'books'}`,
          `**الهوية:** ${r.store_name || '-'} | ${r.store_description || '-'}`,
          `**الألوان الأساسية:** أساسي: ${r.primary_color || '-'} | ثانوي: ${r.secondary_color || '-'} | تمييز: ${r.template_accent_color || '-'}`,
          `**الخلفية:** لون: ${r.template_bg_color || '-'} | صورة: ${r.template_bg_image ? 'موجودة' : 'بدون'}`,
          `**الهيدر:** خلفية: ${r.template_header_bg || '-'} | نص: ${r.template_header_text || '-'}`,
          `**الفوتر:** خلفية: ${r.template_footer_bg || '-'} | نص: ${r.template_footer_text || '-'} | روابط: ${r.template_footer_link_color || '-'}`,
          `**البطاقات:** خلفية: ${r.template_card_bg || '-'} | عنوان: ${r.template_product_title_color || '-'} | سعر: ${r.template_product_price_color || '-'}`,
          `**الهIRO:** عنوان: ${r.template_hero_heading || '-'} | عنوان فرعي: ${r.template_hero_subtitle || '-'} | زر: ${r.template_button_text || '-'}`,
          `**الطباعة:** عائلة: ${r.template_font_family || '-'} | وزن: ${r.template_font_weight || '-'} | عناوين: ${r.template_heading_font_weight || '-'}`,
          `**الأحجام:** عام: ${r.template_border_radius || '-'} | بطاقة: ${r.template_card_border_radius || '-'} | زر: ${r.template_button_border_radius || '-'}`,
          `**الشبكة:** أعمدة: ${r.template_grid_columns || '-'} | فجوة: ${r.template_grid_gap || '-'}`,
          `**الرابط:** ${r.store_slug || '-'} | عام: ${r.is_public ? 'نعم' : 'لا'}`,
        ];
        return { success: true, message: sections.join('\n'), data: r };
      }
      case 'update_store_design': {
        const { field, value } = action;
        if (!field || value === undefined) return { success: false, message: 'الحقل والقيمة مطلوبان' };
        const allowedDesignCols = [
          'store_name', 'store_description', 'store_logo', 'primary_color', 'secondary_color',
          'banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'hero_video_url',
          'template_bg_image', 'template_bg_color', 'template_text_color', 'template_muted_color',
          'template_accent_color', 'template_header_bg', 'template_header_text',
          'template_footer_bg', 'template_footer_text', 'template_footer_link_color',
          'template_card_bg', 'template_product_title_color', 'template_product_price_color',
          'template_section_title_color', 'template_section_subtitle_color',
          'template_hero_heading', 'template_hero_subtitle', 'template_button_text',
          'template_hero_kicker', 'template_hero_kicker_color',
          'template_hero_title_color', 'template_hero_title_size',
          'template_hero_subtitle_color', 'template_hero_subtitle_size',
          'template_hero_badge_title', 'template_hero_badge_subtitle',
          'template_featured_title', 'template_featured_subtitle',
          'template_button2_text', 'template_button2_border',
          'template_font_family', 'template_font_weight', 'template_heading_font_weight',
          'template_border_radius', 'template_card_border_radius', 'template_button_border_radius',
          'template_section_title_size', 'template_category_pill_border_radius',
          'template_spacing', 'template_section_spacing', 'template_grid_gap', 'template_grid_columns', 'template_grid_title',
          'template_animation_speed', 'template_hover_scale',
          'template_category_pill_bg', 'template_category_pill_text',
          'template_category_pill_active_bg', 'template_category_pill_active_text',
          'template_copyright', 'template_footer_text', 'template_add_to_cart_label',
          'template_custom_css', 'template_social_links', 'template_nav_links',
          'store_slug', 'subdomain', 'is_public',
          'owner_name', 'owner_email', 'currency_code',
        ];
        if (!allowedDesignCols.includes(field)) return { success: false, message: `الحقل "${field}" غير مدعوم. اكتب "عرض التصميم" لرؤية كل الحقول المتاحة.` };
        await p.query(`UPDATE client_store_settings SET ${field} = $1, updated_at = NOW() WHERE client_id = $2`, [value, clientId]);
        return { success: true, message: `تم تحديث ${field} ✅` };
      }
      case 'batch_update_store_design': {
        const { updates } = action;
        if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) return { success: false, message: 'البيانات مطلوبة' };
        const allowedDesignCols = new Set([
          'store_name', 'store_description', 'store_logo', 'primary_color', 'secondary_color',
          'banner_url', 'hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'hero_video_url',
          'template_bg_image', 'template_bg_color', 'template_text_color', 'template_muted_color',
          'template_accent_color', 'template_header_bg', 'template_header_text',
          'template_footer_bg', 'template_footer_text', 'template_footer_link_color',
          'template_card_bg', 'template_product_title_color', 'template_product_price_color',
          'template_section_title_color', 'template_section_subtitle_color',
          'template_hero_heading', 'template_hero_subtitle', 'template_button_text',
          'template_hero_kicker', 'template_hero_kicker_color',
          'template_hero_title_color', 'template_hero_title_size',
          'template_hero_subtitle_color', 'template_hero_subtitle_size',
          'template_hero_badge_title', 'template_hero_badge_subtitle',
          'template_featured_title', 'template_featured_subtitle',
          'template_button2_text', 'template_button2_border',
          'template_font_family', 'template_font_weight', 'template_heading_font_weight',
          'template_border_radius', 'template_card_border_radius', 'template_button_border_radius',
          'template_section_title_size', 'template_category_pill_border_radius',
          'template_spacing', 'template_section_spacing', 'template_grid_gap', 'template_grid_columns', 'template_grid_title',
          'template_animation_speed', 'template_hover_scale',
          'template_category_pill_bg', 'template_category_pill_text',
          'template_category_pill_active_bg', 'template_category_pill_active_text',
          'template_copyright', 'template_footer_text', 'template_add_to_cart_label',
          'template_custom_css', 'template_social_links', 'template_nav_links',
          'store_slug', 'subdomain', 'is_public',
          'owner_name', 'owner_email', 'currency_code',
        ]);
        const fields: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;
        const changed: string[] = [];
        for (const [k, v] of Object.entries(updates)) {
          if (!allowedDesignCols.has(k)) continue;
          fields.push(`${k} = $${paramIdx}`);
          values.push(v);
          paramIdx++;
          changed.push(k);
        }
        if (fields.length === 0) return { success: false, message: 'لا توجد حقول صالحة للتحديث' };
        values.push(clientId);
        await p.query(`UPDATE client_store_settings SET ${fields.join(', ')}, updated_at = NOW() WHERE client_id = $${paramIdx}`, values);
        return { success: true, message: `تم تحديث ${changed.length} حقل: ${changed.join(', ')} ✅`, data: { updated: changed } };
      }
      case 'switch_template': {
        const { template } = action;
        if (!template) return { success: false, message: 'اسم القالب مطلوب' };
        const validTemplates = ['books', 'minimal', 'mega', 'grocery', 'pro', 'tech', 'modern'];
        if (!validTemplates.includes(template)) return { success: false, message: `قالب غير صالح. المتاح: ${validTemplates.join(', ')}` };
        await p.query(`UPDATE client_store_settings SET template = $1, updated_at = NOW() WHERE client_id = $2`, [template, clientId]);
        return { success: true, message: `تم تغيير القالب إلى "${template}" ✅` };
      }
      case 'get_delivery_config': {
        const res = await p.query(`SELECT free_delivery_threshold FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        const threshold = res.rows[0]?.free_delivery_threshold;
        return { success: true, message: `**إعدادات التوصيل**\n- الحد الأقصى للتوصيل المجاني: ${threshold ? threshold + ' دج' : 'غير محدد'}`, data: { free_delivery_threshold: threshold } };
      }
      case 'update_free_delivery_threshold': {
        const { amount } = action;
        if (amount === undefined) return { success: false, message: 'المبلغ مطلوب' };
        await p.query(`UPDATE client_store_settings SET free_delivery_threshold = $1, updated_at = NOW() WHERE client_id = $2`, [amount, clientId]);
        return { success: true, message: `تم تحديث حد التوصيل المجاني إلى ${amount} دج` };
      }

      // ═══ BOT SETTINGS ═══
      case 'get_bot_settings': {
        const res = await p.query(`SELECT greeting_message, enable_telegram, enable_messenger, enable_whatsapp, telegram_bot_username FROM bot_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد إعدادات بوت مُعدّة.', data: null };
        const r = res.rows[0];
        return { success: true, message: `**إعدادات البوت**\n- التحية: ${r.greeting_message || 'بدون'}\n- تيليجرام: ${r.enable_telegram ? 'مفعّل' : 'معطّل'} ${r.telegram_bot_username ? '@' + r.telegram_bot_username : ''}\n- ماسنجر: ${r.enable_messenger ? 'مفعّل' : 'معطّل'}\n- واتساب: ${r.enable_whatsapp ? 'مفعّل' : 'معطّل'}`, data: r };
      }
      case 'update_bot_settings': {
        const { field, value } = action;
        if (!field || value === undefined) return { success: false, message: 'الحقل والقيمة مطلوبان' };
        const allowed = ['greeting_message', 'enable_telegram', 'enable_messenger', 'enable_whatsapp'];
        if (!allowed.includes(field)) return { success: false, message: `الحقل "${field}" غير مدعوم` };
        await p.query(`UPDATE bot_settings SET ${field} = $1, updated_at = NOW() WHERE client_id = $2`, [value, clientId]);
        return { success: true, message: `تم تحديث ${field}` };
      }

      // ═══ ANALYTICS ═══
      case 'get_dashboard_stats': {
        const [ordersRes, revenueRes, productsRes, customersRes] = await Promise.all([
          p.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'pending') as pending, COUNT(*) FILTER (WHERE status = 'delivered') as delivered, COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL`, [clientId]),
          p.query(`SELECT COALESCE(SUM(total_price), 0) as this_month, (SELECT COALESCE(SUM(total_price), 0) FROM store_orders WHERE client_id = $1 AND status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '30 days') as last_month FROM store_orders WHERE client_id = $1 AND status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`, [clientId]),
          p.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM client_store_products WHERE client_id = $1`, [clientId]),
          p.query(`SELECT COUNT(DISTINCT customer_phone) as total FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND customer_phone IS NOT NULL`, [clientId]),
        ]);
        const o = ordersRes.rows[0];
        const r = revenueRes.rows[0];
        const pr = productsRes.rows[0];
        const thisMonth = Number(r.this_month) || 0;
        const lastMonth = Number(r.last_month) || 0;
        const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
        return { success: true, message: `**لوحة التحكم**\n\n📦 الطلبات: ${o.total} (${o.pending} معلقة, ${o.delivered} مسلّمة, ${o.cancelled} ملغاة)\n💰 الإيرادات هذا الشهر: ${thisMonth.toLocaleString('ar-DZ')} دج ${growth > 0 ? `(+${growth}%)` : growth < 0 ? `(${growth}%)` : ''}\n🏷️ المنتجات: ${pr.active} نشط من ${pr.total}\n👤 الزبائن: ${customersRes.rows[0]?.total || 0}` };
      }
      case 'get_analytics': {
        const period = action.period === '90d' ? '90 days' : action.period === '7d' ? '7 days' : '30 days';
        const [revenueRes, topProducts, recentOrders] = await Promise.all([
          p.query(`SELECT COALESCE(SUM(total_price), 0) as revenue, COUNT(*) as orders FROM store_orders WHERE client_id = $1 AND status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '${period}'`, [clientId]),
          p.query(`SELECT p.title, COUNT(o.id) as sales, SUM(o.total_price) as revenue FROM client_store_products p JOIN store_orders o ON o.product_id = p.id WHERE p.client_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '${period}' AND o.status != 'cancelled' GROUP BY p.title ORDER BY sales DESC LIMIT 5`, [clientId]),
          p.query(`SELECT status, COUNT(*) as count FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND created_at >= CURRENT_DATE - INTERVAL '${period}' GROUP BY status`, [clientId]),
        ]);
        const rev = revenueRes.rows[0];
        const top = topProducts.rows.map((p: any) => `  - ${p.title}: ${p.sales} مبيعات | ${Number(p.revenue).toLocaleString('ar-DZ')} دج`).join('\n') || '  لا توجد بيانات';
        const statusBreakdown = recentOrders.rows.map((r: any) => `  - ${r.status}: ${r.count}`).join('\n');
        return { success: true, message: `**التحليلات (${period})**\n\n💰 الإيرادات: ${Number(rev.revenue).toLocaleString('ar-DZ')} دج\n📦 الطلبات: ${rev.orders}\n\n**الأكثر مبيعاً:**\n${top}\n\n**توزيع الحالات:**\n${statusBreakdown}` };
      }

      // ═══ STAFF ═══
      case 'list_staff': {
        const res = await p.query(`SELECT id, name, email, role, is_active FROM client_staff WHERE client_id = $1 ORDER BY created_at DESC`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا يوجد موظفين مُضافين.', data: [] };
        const list = res.rows.map((s: any) => `- ${s.name} (${s.email || 'بدون إيميل'}) | ${s.role} | ${s.is_active ? 'نشط' : 'معطّل'}`).join('\n');
        return { success: true, message: `**الموظفين:**\n${list}`, data: res.rows };
      }

      // ═══ SUBSCRIPTION & BILLING ═══
      case 'get_subscription': {
        const res = await p.query(`SELECT tier, status, trial_started_at, trial_ends_at, current_period_start, current_period_end, auto_renew, cancelled_at, next_auto_renewal_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا يوجد اشتراك مسجل.', data: null };
        const r = res.rows[0];
        const now = new Date();
        const trialEnd = r.trial_ends_at ? new Date(r.trial_ends_at) : null;
        const periodEnd = r.current_period_end ? new Date(r.current_period_end) : null;
        let urgency = '';
        if (trialEnd && trialEnd > now) {
          const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          urgency = daysLeft <= 7 ? `\n⚠️ تنتهي التجربة بعد ${daysLeft} يوم` : '';
        } else if (trialEnd && trialEnd <= now && r.status === 'trial') {
          urgency = '\n🔴 انتهت التجربة! يرجى تجديد الاشتراك';
        }
        if (periodEnd && periodEnd <= now && r.status === 'active') {
          urgency = '\n⚠️ انتهت فترة الاشتراك الحالية';
        }
        return { success: true, message: `**الاشتراك:**\n- الخطة: ${r.tier}\n- الحالة: ${r.status}\n- التجربة: ${r.trial_started_at ? new Date(r.trial_started_at).toLocaleDateString('ar-DZ') : '-'} → ${trialEnd ? trialEnd.toLocaleDateString('ar-DZ') : '-'}\n- الفترة: ${periodEnd ? periodEnd.toLocaleDateString('ar-DZ') : '-'}\n- التجديد التلقائي: ${r.auto_renew ? 'نعم' : 'لا'}\n-(${r.next_auto_renewal_at ? 'تجديد: ' + new Date(r.next_auto_renewal_at).toLocaleDateString('ar-DZ') : ''})${urgency}`, data: r };
      }
      case 'get_payment_history': {
        const res = await p.query(`SELECT id, amount, currency, status, payment_method, paid_at, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد سجلات دفع.', data: [] };
        const list = res.rows.map((r: any) => `- #${r.id} | ${Number(r.amount).toLocaleString('ar-DZ')} ${r.currency} | ${r.status} | ${r.payment_method || 'غير محدد'} | ${r.paid_at ? new Date(r.paid_at).toLocaleDateString('ar-DZ') : new Date(r.created_at).toLocaleDateString('ar-DZ')}`).join('\n');
        return { success: true, message: `**سجل الدفع:**\n${list}`, data: res.rows };
      }

      // ═══ BROADCAST ═══
      case 'send_broadcast': {
        const { message, segment, channel } = action;
        if (!message) return { success: false, message: 'الرسالة مطلوبة' };
        return { success: true, message: `تم إرسال الرسالة لقسم "${segment || 'all'}" عبر "${channel || 'all'}".`, data: { queued: true, message, segment, channel } };
      }

      // ═══ DELIVERY COMPANIES ═══
      case 'list_delivery_companies': {
        const res = await p.query(`SELECT dc.id, dc.name, dc.features, di.id as integration_id, di.is_enabled FROM delivery_companies dc LEFT JOIN delivery_integrations di ON di.delivery_company_id = dc.id AND di.client_id = $1 WHERE dc.is_active = true ORDER BY dc.name`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد شركات توصيل متاحة.', data: [] };
        const list = res.rows.map((r: any) => `- ${r.name} | ${r.integration_id ? (r.is_enabled ? '✅ مُعدّ' : '⚠️ معطّل') : '❌ غير مُعدّ'}`).join('\n');
        return { success: true, message: `**شركات التوصيل:**\n${list}`, data: res.rows };
      }
      case 'list_delivery_integrations': {
        const res = await p.query(`SELECT di.id, di.delivery_company_id, dc.name, di.is_enabled, di.configured_at FROM delivery_integrations di JOIN delivery_companies dc ON dc.id = di.delivery_company_id WHERE di.client_id = $1 ORDER BY dc.name`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لم تُعدّ أي شركة توصيل بعد.', data: [] };
        const list = res.rows.map((r: any) => `- ${r.name} | ${r.is_enabled ? 'مفعّل' : 'معطّل'} | منذ ${new Date(r.configured_at).toLocaleDateString('ar-DZ')}`).join('\n');
        return { success: true, message: `**إعدادات التوصيل:**\n${list}`, data: res.rows };
      }
      case 'configure_delivery_integration': {
        const { companyId, apiKey, apiSecret, accountNumber, merchantId } = action;
        if (!companyId || !apiKey) return { success: false, message: 'معرف الشركة والمفتاح مطلوبان' };
        const existing = await p.query(`SELECT id FROM delivery_integrations WHERE client_id = $1 AND delivery_company_id = $2`, [clientId, companyId]);
        if (existing.rows.length) {
          await p.query(`UPDATE delivery_integrations SET api_key_encrypted = $1, is_enabled = true, updated_at = NOW() WHERE client_id = $2 AND delivery_company_id = $3`, [apiKey, clientId, companyId]);
        } else {
          await p.query(`INSERT INTO delivery_integrations (client_id, delivery_company_id, api_key_encrypted, api_secret_encrypted, account_number, merchant_id) VALUES ($1, $2, $3, $4, $5, $6)`, [clientId, companyId, apiKey, apiSecret || null, accountNumber || null, merchantId || null]);
        }
        const co = await p.query(`SELECT name FROM delivery_companies WHERE id = $1`, [companyId]);
        return { success: true, message: `تم إعداد ${co.rows[0]?.name || 'شركة التوصيل'} ✅` };
      }
      case 'delete_delivery_integration': {
        const { companyId } = action;
        if (!companyId) return { success: false, message: 'معرف الشركة مطلوب' };
        await p.query(`DELETE FROM delivery_integrations WHERE client_id = $1 AND delivery_company_id = $2`, [clientId, companyId]);
        return { success: true, message: `تم حذف إعدادات شركة التوصيل #${companyId}` };
      }

      // ═══ DELIVERY PRICES ═══
      case 'get_delivery_prices': {
        const res = await p.query(`SELECT id, wilaya_id, home_delivery_price, desk_delivery_price, is_active, estimated_days, notes FROM delivery_prices WHERE client_id = $1 ORDER BY wilaya_id`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لم تُعدّ أسعار التوصيل بعد.', data: [] };
        const list = res.rows.slice(0, 15).map((r: any) => `- ولاية ${r.wilaya_id}: منزلي ${r.home_delivery_price} دج | مكتب ${r.desk_delivery_price || '-'} دج | ${r.estimated_days} أيام | ${r.is_active ? 'مفعّل' : 'معطّل'}`).join('\n');
        const more = res.rows.length > 15 ? `\n... و${res.rows.length - 15} ولاية أخرى` : '';
        return { success: true, message: `**أسعار التوصيل (${res.rows.length} ولاية):**\n${list}${more}`, data: res.rows };
      }
      case 'set_delivery_price': {
        const { wilayaId, homePrice, deskPrice, estimatedDays } = action;
        if (!wilayaId || homePrice === undefined) return { success: false, message: 'رقم الولاية والسعر المنزلي مطلوبان' };
        const existing = await p.query(`SELECT id FROM delivery_prices WHERE client_id = $1 AND wilaya_id = $2 AND delivery_company_id IS NULL`, [clientId, wilayaId]);
        if (existing.rows.length) {
          await p.query(`UPDATE delivery_prices SET home_delivery_price = $1, desk_delivery_price = $2, estimated_days = $3, updated_at = NOW() WHERE id = $4`, [homePrice, deskPrice || null, estimatedDays || 3, existing.rows[0].id]);
        } else {
          await p.query(`INSERT INTO delivery_prices (client_id, wilaya_id, home_delivery_price, desk_delivery_price, estimated_days) VALUES ($1, $2, $3, $4, $5)`, [clientId, wilayaId, homePrice, deskPrice || null, estimatedDays || 3]);
        }
        return { success: true, message: `تم تحديث سعر التوصيل لولاية ${wilayaId}: ${homePrice} دج ✅` };
      }
      case 'bulk_set_delivery_prices': {
        const { prices } = action;
        if (!prices || !Array.isArray(prices) || prices.length === 0) return { success: false, message: 'القائمة مطلوبة' };
        let updated = 0;
        for (const p2 of prices) {
          if (!p2.wilayaId || p2.homePrice === undefined) continue;
          const ex = await p.query(`SELECT id FROM delivery_prices WHERE client_id = $1 AND wilaya_id = $2 AND delivery_company_id IS NULL`, [clientId, p2.wilayaId]);
          if (ex.rows.length) {
            await p.query(`UPDATE delivery_prices SET home_delivery_price = $1, updated_at = NOW() WHERE id = $2`, [p2.homePrice, ex.rows[0].id]);
          } else {
            await p.query(`INSERT INTO delivery_prices (client_id, wilaya_id, home_delivery_price, desk_delivery_price, estimated_days) VALUES ($1, $2, $3, $4, $5)`, [clientId, p2.wilayaId, p2.homePrice, p2.deskPrice || null, p2.estimatedDays || 3]);
          }
          updated++;
        }
        return { success: true, message: `تم تحديث أسعار ${updated} ولاية ✅` };
      }
      case 'delete_delivery_price': {
        const { priceId } = action;
        if (!priceId) return { success: false, message: 'معرف السعر مطلوب' };
        await p.query(`DELETE FROM delivery_prices WHERE id = $1 AND client_id = $2`, [priceId, clientId]);
        return { success: true, message: `تم حذف سعر التوصيل #${priceId}` };
      }

      // ═══ STOCK / INVENTORY ═══
      case 'list_stock': {
        let sql = `SELECT id, name, sku, category, quantity, unit_price, reorder_level, status, supplier_name FROM client_stock_products WHERE client_id = $1`;
        const params: any[] = [clientId];
        if (action.search) { params.push(`%${action.search}%`); sql += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length} OR description ILIKE $${params.length})`; }
        if (action.category) { params.push(action.category); sql += ` AND category = $${params.length}`; }
        if (action.status) { params.push(action.status); sql += ` AND status = $${params.length}`; }
        sql += ` ORDER BY name LIMIT 20`;
        const res = await p.query(sql, params);
        if (!res.rows.length) return { success: true, message: 'لا توجد منتجات في المخزون.', data: [] };
        const list = res.rows.map((r: any) => `- #${r.id} | ${r.name} | ${r.quantity} وحدة | ${r.unit_price || '-'} دج | ${r.status}${r.sku ? ' | SKU: ' + r.sku : ''}`).join('\n');
        return { success: true, message: `**المخزون (${res.rows.length} منتج):**\n${list}`, data: res.rows };
      }
      case 'get_stock': {
        const { stockId } = action;
        if (!stockId) return { success: false, message: 'معرف المنتج مطلوب' };
        const res = await p.query(`SELECT id, name, sku, description, category, quantity, unit_price, reorder_level, location, supplier_name, supplier_contact, status, notes, sizes, colors FROM client_stock_products WHERE id = $1 AND client_id = $2`, [stockId, clientId]);
        if (!res.rows.length) return { success: false, message: `المنتج #${stockId} غير موجود` };
        const r = res.rows[0];
        const variants = await p.query(`SELECT color, size, size2, price, stock_quantity FROM client_stock_variants WHERE stock_id = $1 AND client_id = $2 ORDER BY sort_order`, [stockId, clientId]);
        let variantStr = '';
        if (variants.rows.length) {
          variantStr = `\n\n**المتغيرات (${variants.rows.length}):**\n` + variants.rows.map((v: any) => `  - ${[v.color, v.size].filter(Boolean).join('/')} | ${v.stock_quantity} وحدة | ${v.price || r.unit_price || '-'} دج`).join('\n');
        }
        return { success: true, message: `**${r.name}** (#${r.id})\n- SKU: ${r.sku || 'بدون'}\n- الكمية: ${r.quantity} | الحد الأدنى: ${r.reorder_level}\n- السعر: ${r.unit_price || 'بدون'} دج\n- الفئة: ${r.category || 'بدون'}\n- الموقع: ${r.location || 'بدون'}\n- المورد: ${r.supplier_name || 'بدون'}\n- الحالة: ${r.status}\n- المقاسات: ${r.sizes?.join(', ') || 'بدون'}\n- الألوان: ${r.colors?.join(', ') || 'بدون'}${variantStr}`, data: r };
      }
      case 'create_stock': {
        const { name, quantity, unitPrice, category, sizes, colors, sku, description, reorderLevel, location, supplierName, supplierContact, shippingMode, shippingFlatFee, notes } = action;
        if (!name) return { success: false, message: 'اسم المنتج مطلوب' };
        const res = await p.query(`INSERT INTO client_stock_products (client_id, name, quantity, unit_price, category, sizes, colors, sku, description, reorder_level, location, supplier_name, supplier_contact, shipping_mode, shipping_flat_fee, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`, [clientId, name, quantity || 0, unitPrice || null, category || null, sizes || [], colors || [], sku || null, description || null, reorderLevel || 10, location || null, supplierName || null, supplierContact || null, shippingMode || 'delivery_pricing', shippingFlatFee || null, notes || null]);
        return { success: true, message: `تم إضافة "${name}" للمخزون (ID: ${res.rows[0].id}) ✅`, data: { stockId: res.rows[0].id } };
      }
      case 'update_stock': {
        const { stockId, field, value } = action;
        if (!stockId || !field || value === undefined) return { success: false, message: 'بيانات ناقصة' };
        const allowed = ['name', 'unit_price', 'category', 'status', 'reorder_level', 'supplier_name', 'supplier_contact', 'location', 'sku', 'description', 'notes', 'shipping_mode', 'shipping_flat_fee'];
        if (!allowed.includes(field)) return { success: false, message: `الحقل "${field}" غير مدعوم. المتاح: ${allowed.join(', ')}` };
        await p.query(`UPDATE client_stock_products SET ${field} = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3`, [value, stockId, clientId]);
        return { success: true, message: `تم تحديث ${field} للمنتج #${stockId} ✅` };
      }
      case 'adjust_stock': {
        const { stockId, adjustment, reason, notes } = action;
        if (!stockId || !adjustment || !reason) return { success: false, message: 'معرف المنتج والتعديل والسبب مطلوبون' };
        const current = await p.query(`SELECT quantity FROM client_stock_products WHERE id = $1 AND client_id = $2`, [stockId, clientId]);
        if (!current.rows.length) return { success: false, message: `المنتج #${stockId} غير موجود` };
        const newQty = Number(current.rows[0].quantity) + Number(adjustment);
        if (newQty < 0) return { success: false, message: `الكمية النهائية (${newQty}) ستكون سالبة` };
        await p.query(`UPDATE client_stock_products SET quantity = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3`, [newQty, stockId, clientId]);
        await p.query(`INSERT INTO client_stock_history (stock_id, client_id, adjustment, reason, notes, previous_quantity, new_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [stockId, clientId, adjustment, reason, notes || null, current.rows[0].quantity, newQty]);
        return { success: true, message: `تم تعديل مخزون #${stockId}: ${current.rows[0].quantity} → ${newQty} (${adjustment > 0 ? '+' : ''}${adjustment}) ✅` };
      }
      case 'delete_stock': {
        const { stockId } = action;
        if (!stockId) return { success: false, message: 'معرف المنتج مطلوب' };
        await p.query(`DELETE FROM client_stock_products WHERE id = $1 AND client_id = $2`, [stockId, clientId]);
        return { success: true, message: `تم حذف المنتج #${stockId} من المخزون` };
      }
      case 'get_low_stock_alerts': {
        const res = await p.query(`SELECT id, name, quantity, reorder_level, category FROM client_stock_products WHERE client_id = $1 AND status = 'active' AND quantity <= reorder_level ORDER BY quantity ASC LIMIT 15`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد منتجات بمخزون منخفض 🎉', data: [] };
        const list = res.rows.map((r: any) => `- **${r.name}** (${r.category || '-'}) | المخزون: ${r.quantity} | الحد الأدنى: ${r.reorder_level}`).join('\n');
        return { success: true, message: `**⚠️ مخزون منخفض (${res.rows.length}):**\n${list}`, data: res.rows };
      }

      // ═══ ORDER STATUSES ═══
      case 'list_order_statuses': {
        const res = await p.query(`SELECT id, name, key, color, icon, sort_order, is_default, is_system, counts_as_revenue FROM order_statuses WHERE client_id = $1 ORDER BY sort_order, name`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد حالات مخصصة.', data: [] };
        const list = res.rows.map((r: any) => `- ${r.icon} ${r.name} (${r.key || '-'}) | ${r.color} | ${r.is_system ? '🔒' : '✏️'} ${r.counts_as_revenue ? '💰' : ''}`).join('\n');
        return { success: true, message: `**حالات الطلب:**\n${list}`, data: res.rows };
      }
      case 'create_order_status': {
        const { name, color, icon, countsAsRevenue } = action;
        if (!name) return { success: false, message: 'اسم الحالة مطلوب' };
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
        const maxSort = await p.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM order_statuses WHERE client_id = $1`, [clientId]);
        const res = await p.query(`INSERT INTO order_statuses (client_id, name, key, color, icon, sort_order, counts_as_revenue) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [clientId, name, key, color || '#6b7280', icon || '●', maxSort.rows[0].next, countsAsRevenue || false]);
        return { success: true, message: `تم إنشاء حالة "${name}" (ID: ${res.rows[0].id}) ✅` };
      }
      case 'update_order_status_def': {
        const { statusId, name, color, icon, countsAsRevenue, sortOrder } = action;
        if (!statusId) return { success: false, message: 'معرف الحالة مطلوب' };
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (name !== undefined) { fields.push(`name = $${idx}`); values.push(name); idx++; }
        if (color !== undefined) { fields.push(`color = $${idx}`); values.push(color); idx++; }
        if (icon !== undefined) { fields.push(`icon = $${idx}`); values.push(icon); idx++; }
        if (countsAsRevenue !== undefined) { fields.push(`counts_as_revenue = $${idx}`); values.push(countsAsRevenue); idx++; }
        if (sortOrder !== undefined) { fields.push(`sort_order = $${idx}`); values.push(sortOrder); idx++; }
        if (fields.length === 0) return { success: false, message: 'لا توجد حقول للتحديث' };
        values.push(statusId, clientId);
        await p.query(`UPDATE order_statuses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND client_id = $${idx + 1}`, values);
        return { success: true, message: `تم تحديث الحالة #${statusId} ✅` };
      }
      case 'delete_order_status': {
        const { statusId } = action;
        if (!statusId) return { success: false, message: 'معرف الحالة مطلوب' };
        const check = await p.query(`SELECT is_system, is_default FROM order_statuses WHERE id = $1 AND client_id = $2`, [statusId, clientId]);
        if (!check.rows.length) return { success: false, message: 'الحالة غير موجودة' };
        if (check.rows[0].is_system) return { success: false, message: 'لا يمكن حذف حالة نظام 🔒' };
        await p.query(`DELETE FROM order_statuses WHERE id = $1 AND client_id = $2`, [statusId, clientId]);
        return { success: true, message: `تم حذف الحالة #${statusId}` };
      }
      case 'restore_preset_status': {
        const { key } = action;
        if (!key) return { success: false, message: 'مفتاح الحالة مطلوب' };
        const presets: Record<string, { name: string; color: string; icon: string }> = {
          cancelled: { name: 'ملغي', color: '#ef4444', icon: '❌' },
          failed: { name: 'فشل', color: '#dc2626', icon: '⚠️' },
          delivered: { name: 'تم التوصيل', color: '#22c55e', icon: '✅' },
          declined: { name: 'مرفوض', color: '#f97316', icon: '🚫' },
          delivery_failed: { name: 'فشل التوصيل', color: '#ef4444', icon: '📦❌' },
          returned: { name: 'مرجوع', color: '#eab308', icon: '↩️' },
          didnt_pickup: { name: 'لم يسلّم', color: '#f97316', icon: '📭' },
          no_answer_1: { name: 'لم يُجيب - 1', color: '#6b7280', icon: '📞' },
          no_answer_2: { name: 'لم يُجيب - 2', color: '#6b7280', icon: '📞📞' },
          no_answer_3: { name: 'لم يُجيب - 3', color: '#6b7280', icon: '📞📞📞' },
          waiting_callback: { name: 'بانتظار الاتصال', color: '#3b82f6', icon: '🕐' },
          postponed: { name: 'مؤجّل', color: '#8b5cf6', icon: '⏳' },
          fake: { name: 'طلب وهمي', color: '#ef4444', icon: '🎭' },
          duplicate: { name: 'مكرر', color: '#f97316', icon: '📋' },
        };
        const preset = presets[key];
        if (!preset) return { success: false, message: `مفتاح "${key}" غير صالح. المتاح: ${Object.keys(presets).join(', ')}` };
        const existing = await p.query(`SELECT id FROM order_statuses WHERE client_id = $1 AND key = $2`, [clientId, key]);
        if (existing.rows.length) return { success: true, message: `الحالة "${preset.name}" موجودة مسبقاً` };
        const maxSort = await p.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM order_statuses WHERE client_id = $1`, [clientId]);
        await p.query(`INSERT INTO order_statuses (client_id, name, key, color, icon, sort_order, is_system) VALUES ($1, $2, $3, $4, $5, $6, true)`, [clientId, preset.name, key, preset.color, preset.icon, maxSort.rows[0].next]);
        return { success: true, message: `تمت إضافة حالة "${preset.name}" ${preset.icon} ✅` };
      }

      // ═══ PRODUCT VARIANTS ═══
      case 'get_product_variants': {
        const { productId } = action;
        if (!productId) return { success: false, message: 'معرف المنتج مطلوب' };
        const res = await p.query(`SELECT id, color, size, size2, variant_name, price, stock_quantity, is_active FROM product_variants WHERE product_id = $1 AND client_id = $2 ORDER BY sort_order`, [productId, clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد متغيرات لهذا المنتج.', data: [] };
        const list = res.rows.map((r: any) => `- #${r.id} | ${[r.color, r.size, r.size2].filter(Boolean).join('/')} | ${r.price || 'رئيسي'} دج | ${r.stock_quantity} وحدة | ${r.is_active ? 'مفعّل' : 'معطّل'}`).join('\n');
        return { success: true, message: `**متغيرات المنتج #${productId}:**\n${list}`, data: res.rows };
      }
      case 'update_product_variants': {
        const { productId, variants } = action;
        if (!productId || !variants || !Array.isArray(variants)) return { success: false, message: 'معرف المنتج وقائمة المتغيرات مطلوبان' };
        const formatted = variants.map((v: any, i: number) => ({
          color: v.color || null,
          size: v.size || null,
          size2: v.size2 || null,
          variant_name: v.variant_name || null,
          price: v.price || null,
          stock_quantity: v.stock_quantity ?? 0,
          images: v.images || null,
          is_active: v.is_active !== false,
          sort_order: v.sort_order ?? i,
        }));
        // Use raw SQL to upsert variants
        for (const v of formatted) {
          const existing = await p.query(`SELECT id FROM product_variants WHERE product_id = $1 AND client_id = $2 AND LOWER(COALESCE(color,'')) = LOWER(COALESCE($3,'')) AND LOWER(COALESCE(size,'')) = LOWER(COALESCE($4,'')) AND LOWER(COALESCE(size2,'')) = LOWER(COALESCE($5,''))`, [productId, clientId, v.color, v.size, v.size2]);
          if (existing.rows.length) {
            await p.query(`UPDATE product_variants SET price = $1, stock_quantity = $2, variant_name = $3, is_active = $4, sort_order = $5, updated_at = NOW() WHERE id = $6`, [v.price, v.stock_quantity, v.variant_name, v.is_active, v.sort_order, existing.rows[0].id]);
          } else {
            await p.query(`INSERT INTO product_variants (client_id, product_id, color, size, size2, variant_name, price, stock_quantity, is_active, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [clientId, productId, v.color, v.size, v.size2, v.variant_name, v.price, v.stock_quantity, v.is_active, v.sort_order]);
          }
        }
        return { success: true, message: `تم تحديث ${formatted.length} متغير للمنتج #${productId} ✅` };
      }

      // ═══ SOCIAL LINKS ═══
      case 'get_social_links': {
        const res = await p.query(`SELECT template_social_links FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        const links = res.rows[0]?.template_social_links;
        if (!links) return { success: true, message: 'لا توجد روابط تواصل مُعدّة.', data: {} };
        const parsed = typeof links === 'string' ? JSON.parse(links) : links;
        const list = Object.entries(parsed).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n');
        return { success: true, message: `**روابط التواصل:**\n${list || 'بدون'}`, data: parsed };
      }
      case 'update_social_links': {
        const { platform, url } = action;
        if (!platform) return { success: false, message: 'المنصة مطلوبة' };
        const allowed = ['facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'snapchat', 'whatsapp', 'telegram'];
        if (!allowed.includes(platform)) return { success: false, message: `المنصة "${platform}" غير مدعومة. المتاح: ${allowed.join(', ')}` };
        const res = await p.query(`SELECT template_social_links FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        let links: Record<string, string> = {};
        try { links = typeof res.rows[0]?.template_social_links === 'string' ? JSON.parse(res.rows[0].template_social_links) : (res.rows[0]?.template_social_links || {}); } catch { links = {}; }
        if (url) { links[platform] = url; } else { delete links[platform]; }
        await p.query(`UPDATE client_store_settings SET template_social_links = $1, updated_at = NOW() WHERE client_id = $2`, [JSON.stringify(links), clientId]);
        return { success: true, message: `تم تحديث ${platform}: ${url || 'تم الحذف'} ✅` };
      }

      // ═══ AI AUTO-REPLY ═══
      case 'get_ai_auto_reply': {
        const res = await p.query(`SELECT ai_reply_telegram, ai_reply_messenger, ai_reply_whatsapp, ai_reply_viber, ai_instructions FROM ai_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'إعدادات الذكاء الاصطناعي غير موجودة.', data: null };
        const r = res.rows[0];
        return { success: true, message: `**ردود البوت التلقائية:**\n- تيليجرام: ${r.ai_reply_telegram ? '✅' : '❌'}\n- ماسنجر: ${r.ai_reply_messenger ? '✅' : '❌'}\n- واتساب: ${r.ai_reply_whatsapp ? '✅' : '❌'}\n- فايبر: ${r.ai_reply_viber ? '✅' : '❌'}\n- التعليمات: ${r.ai_instructions || 'بدون'}`, data: r };
      }
      case 'toggle_ai_auto_reply': {
        const { enabled } = action;
        if (enabled === undefined) return { success: false, message: 'القيمة مطلوبة (true/false)' };
        await p.query(`UPDATE ai_settings SET ai_reply_telegram = $1, ai_reply_messenger = $1, ai_reply_whatsapp = $1, ai_reply_viber = $1, updated_at = NOW() WHERE client_id = $2`, [enabled, clientId]);
        return { success: true, message: `${enabled ? 'تم تفعيل' : 'تم تعطيل'} ردود البوت التلقائية لجميع المنصات ✅` };
      }
      case 'update_ai_instructions': {
        const { instructions } = action;
        if (!instructions) return { success: false, message: 'التعليمات مطلوبة' };
        await p.query(`UPDATE ai_settings SET ai_instructions = $1, updated_at = NOW() WHERE client_id = $2`, [instructions, clientId]);
        return { success: true, message: `تم تحديث تعليمات البوت ✅` };
      }

      // ═══ CAMPAIGNS ═══
      case 'list_campaigns': {
        const res = await p.query(`SELECT id, name, target_category, channel, status, recipients_count, sent_count, failed_count, sent_at, created_at FROM message_campaigns WHERE client_id = $1 ORDER BY created_at DESC LIMIT 10`, [clientId]);
        if (!res.rows.length) return { success: true, message: 'لا توجد حملات.', data: [] };
        const list = res.rows.map((r: any) => `- #${r.id} | ${r.name} | ${r.channel} | ${r.status} | ${r.sent_count}/${r.recipients_count} مرسل | ${new Date(r.created_at).toLocaleDateString('ar-DZ')}`).join('\n');
        return { success: true, message: `**الحملات:**\n${list}`, data: res.rows };
      }
      case 'create_campaign': {
        const { name, message, targetCategory, channel } = action;
        if (!name || !message) return { success: false, message: 'الاسم والرسالة مطلوبان' };
        const res = await p.query(`INSERT INTO message_campaigns (client_id, name, message, target_category, channel, status) VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING id`, [clientId, name, message, targetCategory || 'all', channel || 'telegram']);
        return { success: true, message: `تم إنشاء الحملة "${name}" (ID: ${res.rows[0].id}) ✅`, data: { campaignId: res.rows[0].id } };
      }
      case 'send_campaign': {
        const { campaignId } = action;
        if (!campaignId) return { success: false, message: 'معرف الحملة مطلوب' };
        await p.query(`UPDATE message_campaigns SET status = 'sending', sent_at = NOW(), updated_at = NOW() WHERE id = $1 AND client_id = $2`, [campaignId, clientId]);
        return { success: true, message: `تم إرسال الحملة #${campaignId} ✅` };
      }
      case 'delete_campaign': {
        const { campaignId } = action;
        if (!campaignId) return { success: false, message: 'معرف الحملة مطلوب' };
        await p.query(`DELETE FROM message_campaigns WHERE id = $1 AND client_id = $2`, [campaignId, clientId]);
        return { success: true, message: `تم حذف الحملة #${campaignId}` };
      }
      case 'get_campaign_logs': {
        const { campaignId } = action;
        if (!campaignId) return { success: false, message: 'معرف الحملة مطلوب' };
        const camp = await p.query(`SELECT name, status, recipients_count, sent_count, failed_count FROM message_campaigns WHERE id = $1 AND client_id = $2`, [campaignId, clientId]);
        if (!camp.rows.length) return { success: false, message: 'الحملة غير موجودة' };
        const c = camp.rows[0];
        const logs = await p.query(`SELECT customer_name, customer_phone, status, error_message, sent_at FROM message_logs WHERE campaign_id = $1 AND client_id = $2 ORDER BY created_at DESC LIMIT 10`, [campaignId, clientId]);
        const logList = logs.rows.map((l: any) => `  - ${l.customer_name || l.customer_phone} | ${l.status} ${l.error_message ? '(' + l.error_message + ')' : ''}`).join('\n');
        return { success: true, message: `**الحملة: ${c.name}**\n- الحالة: ${c.status} | المرسل: ${c.sent_count}/${c.recipients_count} | فشل: ${c.failed_count}\n\n**آخر 10 سجلات:**\n${logList || 'لا توجد سجلات'}`, data: c };
      }

      default:
        return { success: false, message: `إجراء غير معروف: ${action.type}` };
    }
  } catch (err) {
    console.error('[OwnerAI] executeAction error:', err);
    return { success: false, message: 'حدث خطأ أثناء التنفيذ' };
  }
}

// ═══════════════════════════════════════════════════════════════
// RESPONSE VALIDATION — Fix "check dashboard" responses
// ═══════════════════════════════════════════════════════════════

const DASHBOARD_PATTERNS = /تحقق|لوحة التحكم|يمكنك رؤية|يمكنك الاطلاع|تستطيع رؤية|يمكنك مراجعة|من خلال قسم|في قسم|صفحة.*الإعدادات|تقرير مفصل/i;

function validateResponse(answer: string, question: string, ctx: SlimContext): string {
  if (!DASHBOARD_PATTERNS.test(answer)) return answer;

  const q = question.toLowerCase();

  let md = '';
  if (q.includes('طلبات') || q.includes('طلب')) {
    md = `**الطلبات**\n- الإجمالي: ${ctx.totalOrders}\n- المعلقة: ${ctx.pendingOrders}`;
    return md;
  }
  if (q.includes('دخل') || q.includes('ارباح') || q.includes('أرباح') || q.includes('مبيعات') || q.includes('إيرادات')) {
    md = `**الإيرادات**\n- هذا الشهر: ${ctx.totalRevenue.toLocaleString('ar-DZ')} دج`;
    return md;
  }
  if (q.includes('منتج') || q.includes('منتجات')) {
    md = `**المنتجات**\n- النشطة: ${ctx.totalProducts}`;
    if (ctx.lowStockProducts.length) md += `\n- مخزون منخفض: ${ctx.lowStockProducts.join('، ')}`;
    if (ctx.topProducts.length) md += `\n- الأكثر مبيعاً: ${ctx.topProducts.join('، ')}`;
    return md;
  }
  if (q.includes('اسم') && (q.includes('متجر') || q.includes('المتجر'))) {
    return `**اسم المتجر:** ${ctx.storeName}`;
  }
  return answer;
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

function pool() { return ensureConnection(); }

interface SlimContext {
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  storePhone: string;
  storeWilaya: string;
  storeDescription: string;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalProducts: number;
  lowStockProducts: string[];
  topProducts: string[];
  subscriptionTier: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  template: string;
  primaryColor: string;
  secondaryColor: string;
  storeSlug: string;
  isPublic: boolean;
  totalCustomers: number;
  deliveryPricesCount: number;
  integrationsCount: number;
  couponsCount: number;
  staffCount: number;
}

async function loadSlimContext(clientId: number): Promise<SlimContext | null> {
  const p = await pool();

  const storeRes = await p.query(`SELECT store_name, store_description, template, primary_color, secondary_color, store_slug, is_public FROM client_store_settings WHERE client_id = $1 LIMIT 1`, [clientId]);
  if (!storeRes.rows.length) return null;
  const s = storeRes.rows[0];
  const storeName = s.store_name || 'المتجر';

  const ownerRes = await p.query(`SELECT name, email, phone FROM clients WHERE id = $1 LIMIT 1`, [clientId]).catch(() => ({ rows: [] }));
  const owner = ownerRes.rows[0] || {};

  const subRes = await p.query(`SELECT tier, status, trial_ends_at, current_period_end FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [clientId]).catch(() => ({ rows: [] }));
  const sub = subRes.rows[0] || {};

  // Key metrics
  const [ordersRes, revenueRes, productsRes, lowStockRes, topRes, customersRes, deliveryRes, integrationsRes, couponsRes, staffRes] = await Promise.all([
    p.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'pending') as pending, COUNT(*) FILTER (WHERE status = 'delivered') as delivered, COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL`, [clientId]),
    p.query(`SELECT COALESCE(SUM(total_price), 0) as revenue FROM store_orders WHERE client_id = $1 AND status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`, [clientId]),
    p.query(`SELECT COUNT(*) as total FROM client_store_products WHERE client_id = $1 AND status = 'active' AND deleted_at IS NULL`, [clientId]),
    p.query(`SELECT title, stock_quantity FROM client_store_products WHERE client_id = $1 AND status = 'active' AND stock_quantity <= 5 AND stock_quantity > 0 AND deleted_at IS NULL ORDER BY stock_quantity ASC LIMIT 5`, [clientId]),
    p.query(`SELECT p.title, COUNT(o.id) as sales FROM client_store_products p JOIN store_orders o ON o.product_id = p.id WHERE p.client_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY p.title ORDER BY sales DESC LIMIT 5`, [clientId]),
    p.query(`SELECT COUNT(DISTINCT customer_phone) as total FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND customer_phone IS NOT NULL`, [clientId]),
    p.query(`SELECT COUNT(*) as total FROM delivery_prices WHERE client_id = $1`, [clientId]),
    p.query(`SELECT COUNT(*) as total FROM delivery_integrations WHERE client_id = $1`, [clientId]),
    p.query(`SELECT COUNT(*) as total FROM client_store_coupons WHERE client_id = $1`, [clientId]),
    p.query(`SELECT COUNT(*) as total FROM client_staff WHERE client_id = $1`, [clientId]),
  ]);

  const or = ordersRes.rows[0];
  return {
    storeName,
    ownerName: owner.name || '',
    ownerEmail: owner.email || '',
    ownerPhone: owner.phone || '',
    storePhone: owner.phone || '',
    storeWilaya: '',
    storeDescription: s.store_description || '',
    totalOrders: Number(or.total) || 0,
    pendingOrders: Number(or.pending) || 0,
    deliveredOrders: Number(or.delivered) || 0,
    cancelledOrders: Number(or.cancelled) || 0,
    totalRevenue: Number(revenueRes.rows[0]?.revenue) || 0,
    totalProducts: Number(productsRes.rows[0]?.total) || 0,
    lowStockProducts: lowStockRes.rows.map((r: any) => `${r.title} (${r.stock_quantity})`),
    topProducts: topRes.rows.map((r: any) => `${r.title} (${r.sales} مبيعات)`),
    subscriptionTier: sub.tier || 'free',
    subscriptionStatus: sub.status || 'unknown',
    trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('ar-DZ') : null,
    template: s.template || 'books',
    primaryColor: s.primary_color || '#f97316',
    secondaryColor: s.secondary_color || '#8B7355',
    storeSlug: s.store_slug || '',
    isPublic: s.is_public || false,
    totalCustomers: Number(customersRes.rows[0]?.total) || 0,
    deliveryPricesCount: Number(deliveryRes.rows[0]?.total) || 0,
    integrationsCount: Number(integrationsRes.rows[0]?.total) || 0,
    couponsCount: Number(couponsRes.rows[0]?.total) || 0,
    staffCount: Number(staffRes.rows[0]?.total) || 0,
  };
}

function buildUserPrompt(ctx: SlimContext, history: GeminiContent[], question: string): string {
  let p = `=== بيانات الصاحب ===\n`;
  p += `الاسم: ${ctx.ownerName || 'غير محدد'}\n`;
  p += `الإيميل: ${ctx.ownerEmail || 'غير محدد'}\n`;
  p += `الهاتف: ${ctx.ownerPhone || 'غير محدد'}\n\n`;

  p += `=== بيانات المتجر ===\n`;
  p += `المتجر: ${ctx.storeName}\n`;
  p += `الوصف: ${ctx.storeDescription || 'بدون'}\n`;
  p += `القالب: ${ctx.template} | ألوان: ${ctx.primaryColor} / ${ctx.secondaryColor}\n`;
  p += `الرابط: sahla4eco.com/store/${ctx.storeSlug} | عام: ${ctx.isPublic ? 'نعم' : 'لا'}\n\n`;

  p += `=== الاشتراك ===\n`;
  p += `الخطة: ${ctx.subscriptionTier} | الحالة: ${ctx.subscriptionStatus}`;
  if (ctx.trialEndsAt) p += ` | تنتهي التجربة: ${ctx.trialEndsAt}`;
  p += `\n\n`;

  p += `=== الإحصائيات ===\n`;
  p += `الطلبات: ${ctx.totalOrders} (${ctx.pendingOrders} معلقة, ${ctx.deliveredOrders} مسلّمة, ${ctx.cancelledOrders} ملغاة)\n`;
  p += `الدخل (30 يوم): ${ctx.totalRevenue.toLocaleString('ar-DZ')} دج\n`;
  p += `المنتجات: ${ctx.totalProducts} نشط\n`;
  p += `الزبائن: ${ctx.totalCustomers}\n`;
  p += `الكوبونات: ${ctx.couponsCount} | الموظفين: ${ctx.staffCount}\n`;
  p += `شركات التوصيل: ${ctx.integrationsCount} | أسعار التوصيل: ${ctx.deliveryPricesCount} ولاية`;
  if (ctx.lowStockProducts?.length) p += `\nمخزون منخفض: ${ctx.lowStockProducts.join('، ')}`;
  if (ctx.topProducts?.length) p += `\nالأكثر مبيعاً: ${ctx.topProducts.join('، ')}`;

  // Past topics from history
  const pastTopics = history
    .filter(m => m.parts?.[0]?.text?.startsWith('[topic]'))
    .map(m => m.parts[0].text.replace('[topic] ', ''))
    .slice(-3);
  if (pastTopics.length) {
    p += `\n\n=== مواضيع سابقة ===\n- ${pastTopics.join('\n- ')}`;
  }

  p += `\n\nسؤال المستخدم: ${question || ''}`;
  return p;
}

function detectTopic(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('طلب') || q.includes('طلبات') || q.includes('اوردر') || q.includes('شحنة') || q.includes('توصيل')) return '📦 طلبات';
  if (q.includes('منتج') || q.includes('منتجات') || q.includes('مخزون') || q.includes('سلعة')) return '🏷️ منتجات';
  if (q.includes('دخل') || q.includes('ارباح') || q.includes('مبيعات') || q.includes('إيرادات') || q.includes('ربح') || q.includes('فلوس')) return '💰 مبيعات';
  if (q.includes('زبون') || q.includes('زبائن') || q.includes('عميل') || q.includes('عملاء') || q.includes('شاري')) return '👤 زبائن';
  if (q.includes('تسويق') || q.includes('اعلان') || q.includes('دعاية') || q.includes('برومو') || q.includes('اشهار')) return '📢 تسويق';
  if (q.includes('كوبون') || q.includes('تخفيض') || q.includes('خصم') || q.includes('عرض')) return '🎉 عروض';
  if (q.includes('متجر') || q.includes('تصميم') || q.includes('شكل') || q.includes('الوان') || q.includes('ثيم')) return '🎨 المتجر';
  return '💬 عام';
}

async function searchStoreData(clientId: number, dataType: string, query: string): Promise<any[]> {
  const p = await pool();
  const q = `%${query || ''}%`;
  switch (dataType) {
    case 'orders': {
      const res = await p.query(`SELECT id, customer_name, customer_phone, total_price, status, delivery_status, created_at FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND (id::text ILIKE $2 OR customer_name ILIKE $2 OR customer_phone ILIKE $2 OR status ILIKE $2) ORDER BY created_at DESC LIMIT 10`, [clientId, q]);
      return res.rows;
    }
    case 'products': {
      const res = await p.query(`SELECT id, title, price, stock_quantity, category, status FROM client_store_products WHERE client_id = $1 AND (title ILIKE $2 OR category ILIKE $2) ORDER BY created_at DESC LIMIT 10`, [clientId, q]);
      return res.rows;
    }
    case 'customers': {
      const res = await p.query(`SELECT customer_name, customer_phone, COUNT(*) as order_count FROM store_orders WHERE client_id = $1 AND deleted_at IS NULL AND (customer_name ILIKE $2 OR customer_phone ILIKE $2) GROUP BY customer_name, customer_phone ORDER BY order_count DESC LIMIT 10`, [clientId, q]);
      return res.rows;
    }
    default: return [];
  }
}

async function executeSearch(clientId: number, dataType: string, query: string): Promise<string> {
  const results = await searchStoreData(clientId, dataType, query);
  if (!results.length) return 'لا توجد نتائج.';
  if (dataType === 'orders') return results.map((o: any) => `#${o.id} | ${o.customer_name || 'N/A'} | ${o.total_price} دج | ${o.status} | ${new Date(o.created_at).toLocaleDateString('ar-DZ')}`).join('\n');
  if (dataType === 'products') return results.map((p: any) => `#${p.id} | ${p.title} | ${p.price} دج | مخزون: ${p.stock_quantity ?? 'N/A'} | ${p.category || ''}`).join('\n');
  if (dataType === 'customers') return results.map((c: any) => `${c.customer_name || 'N/A'} | ${c.customer_phone || 'N/A'} | ${c.order_count} طلبات`).join('\n');
  return JSON.stringify(results);
}

// ═══════════════════════════════════════════════════════════════
// OWNER CONVERSATION HISTORY
// ═══════════════════════════════════════════════════════════════

export async function getOwnerHistory(clientId: number): Promise<GeminiContent[]> {
  try {
    const p = await pool();
    const res = await p.query(`SELECT role, message FROM store_owner_conversations WHERE client_id = $1 ORDER BY created_at DESC LIMIT 8`, [clientId]);
    return res.rows.reverse().map((r: any) => {
      let text = r.message;
      if (r.role === 'assistant') text = text.replace(/^\[topic\].*\n?/, '');
      return { role: r.role === 'owner' ? 'user' as const : 'model' as const, parts: [{ text }] };
    });
  } catch { return []; }
}

export async function saveOwnerHistory(clientId: number, message: string, response: string, topic?: string): Promise<void> {
  try {
    const p = await pool();
    const tag = topic ? `[topic] ${topic}\n` : '';
    await p.query(`INSERT INTO store_owner_conversations (client_id, role, message) VALUES ($1, 'owner', $2), ($1, 'assistant', $3)`, [clientId, message, tag + response]);
    await p.query(`DELETE FROM store_owner_conversations WHERE client_id = $1 AND id NOT IN (SELECT id FROM store_owner_conversations WHERE client_id = $1 ORDER BY created_at DESC LIMIT 50)`, [clientId]).catch(() => {});
  } catch {}
}
