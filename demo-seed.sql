-- ══════════════════════════════════════════════════════════════
-- EcoPro Demo Seed — Arabic Content + High-Res Images
-- ══════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE v_client_id INTEGER;
BEGIN
  SELECT id INTO v_client_id FROM clients WHERE email = 'skull2@gmail.com' LIMIT 1;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Client not found.'; END IF;
  RAISE NOTICE 'Using client_id = %', v_client_id;
END $$;

-- Clean existing data
DELETE FROM store_orders          WHERE client_id = (SELECT id FROM clients WHERE email = 'skull2@gmail.com');
DELETE FROM client_store_products WHERE client_id = (SELECT id FROM clients WHERE email = 'skull2@gmail.com');
DELETE FROM store_products        WHERE client_id = (SELECT id FROM clients WHERE email = 'skull2@gmail.com');

-- ── Products ────────────────────────────────────────────────────
WITH cid AS (SELECT id FROM clients WHERE email = 'skull2@gmail.com')
INSERT INTO client_store_products
  (client_id, title, description, price, original_price, images, category,
   stock_quantity, status, is_featured, views, slug)
SELECT
  cid.id,
  p.title, p.description, p.price, p.orig,
  p.imgs,
  p.cat, p.stock, 'active', p.featured, p.vws, p.slug
FROM cid
CROSS JOIN (VALUES
  (
    'جاكيت بومبر أوفرسايز',
    'جاكيت بومبر رجالي فاخر أوفرسايز، مصنوع من قماش عالي الجودة مقاوم للريح. متوفر باللون الأسود والكاكي. مثالي للإطلالة الشبابية العصرية.',
    4200.00::numeric, 5500.00::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=800&q=85&fit=crop'
    ]::text[],
    'ملابس', 45::int, true::bool, 2840::int, 'jacket-bomber-10001'
  ),
  (
    'حذاء رياضي كلاسيك أبيض',
    'حذاء رياضي يونيسكس من الجلد الصناعي الأبيض. نعل EVA مريح وخياطة معززة. مقاسات من 39 إلى 45.',
    3800.00::numeric, 4900.00::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&q=85&fit=crop'
    ]::text[],
    'أحذية', 30::int, true::bool, 3100::int, 'sneakers-classic-10002'
  ),
  (
    'عطر عود رويال 100 مل',
    'عطر شرقي فاخر بنفحات العود والعنبر والمسك. يدوم أكثر من 12 ساعة. مرفق بقارورة فاخرة وعلبة هدايا أنيقة.',
    2900.00::numeric, NULL::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1588514912908-b2d8e5093d70?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1541643600914-78b084683702?w=800&q=85&fit=crop'
    ]::text[],
    'عطور وجمال', 60::int, false::bool, 1560::int, 'perfume-oud-royal-10003'
  ),
  (
    'ساعة رجالية كلاسيكية بالفولاذ',
    'ساعة أنالوغ بسوار من الفولاذ المقاوم للصدأ. زجاج ياقوتي مضاد للخدش. مقاومة للماء 30 متر. حركة يابانية ميوتا موثوقة.',
    6500.00::numeric, 8200.00::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&q=85&fit=crop'
    ]::text[],
    'إكسسوارات', 18::int, true::bool, 4200::int, 'watch-steel-classic-10004'
  ),
  (
    'حقيبة يد جلد كراميل',
    'حقيبة بكتف نسائية من الجلد الطبيعي بلون الكراميل. سعة 8 لترات، قسم مضغوط وجيب مخصص للهاتف.',
    5100.00::numeric, 6300.00::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=85&fit=crop'
    ]::text[],
    'حقائب', 22::int, false::bool, 1980::int, 'handbag-leather-caramel-10005'
  ),
  (
    'هودي بريميوم مطرز',
    'سويتشيرت بقلنسوة من القطن الثقيل 380 غرام. شعار مطرز على الصدر. جيب كانغارو. قابل للغسيل عند 40°. مقاسات S إلى 3XL.',
    2600.00::numeric, NULL::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=85&fit=crop'
    ]::text[],
    'ملابس', 85::int, false::bool, 5600::int, 'hoodie-premium-embroidered-10006'
  ),
  (
    'كريم وجه بيو بزيت الأرجان',
    'كريم مرطب 50مل بزيت الأرجان الطبيعي. خالٍ من البارابين. للبشرة المختلطة والجافة. حاصل على شهادة ECOCERT.',
    1800.00::numeric, 2200.00::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=85&fit=crop'
    ]::text[],
    'عناية وجمال', 120::int, false::bool, 7200::int, 'face-cream-argan-bio-10007'
  ),
  (
    'حزام جلد مضفر',
    'حزام رجالي من الجلد الطبيعي المضفر مع إبزيم فضي أنيق. طول قابل للتعديل من 90 إلى 120 سم.',
    1400.00::numeric, NULL::numeric,
    ARRAY[
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a65?w=800&q=85&fit=crop',
      'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&q=85&fit=crop'
    ]::text[],
    'إكسسوارات', 55::int, false::bool, 890::int, 'belt-leather-braided-10008'
  )
) AS p(title, description, price, orig, imgs, cat, stock, featured, vws, slug);

-- ── Orders ──────────────────────────────────────────────────────
WITH product_ids AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM client_store_products
  WHERE client_id = (SELECT id FROM clients WHERE email = 'skull2@gmail.com')
),
cid AS (SELECT id FROM clients WHERE email = 'skull2@gmail.com')
INSERT INTO store_orders
  (client_id, product_id, customer_name, customer_phone, shipping_address,
   shipping_wilaya_id, quantity, total_price, unit_price, status, payment_status, created_at)
SELECT
  cid.id, pi.id,
  o.cname, o.cphone, o.addr, o.wilaya,
  o.qty, o.total, o.unit, o.status,
  CASE WHEN o.status IN ('delivered','shipped') THEN 'paid' ELSE 'unpaid' END,
  NOW() - (o.days_ago || ' days')::INTERVAL
FROM cid,
(VALUES
  (1,  'ياسين بوزيدي',      '0550123456', '12 شارع ديدوش مراد، وسط الجزائر العاصمة',       16, 1, 4200.00::numeric, 4200.00::numeric, 'delivered',  14),
  (2,  'إيمان فرحات',        '0661789012', 'حي 200 مسكن بناية ج، وهران',                     31, 2, 7600.00::numeric, 3800.00::numeric, 'delivered',  12),
  (3,  'سفيان عمارة',        '0770345678', 'شارع الحرية، قسنطينة',                           25, 1, 6500.00::numeric, 6500.00::numeric, 'shipped',     5),
  (4,  'أسماء بن سالم',      '0555901234', 'حي الحمري رقم 7، عنابة',                         23, 1, 2900.00::numeric, 2900.00::numeric, 'confirmed',   3),
  (5,  'رؤوف تلمساني',       '0662567890', 'شارع زيغود يوسف، تلمسان',                        13, 1, 3800.00::numeric, 3800.00::numeric, 'confirmed',   2),
  (6,  'ليندة شريف',         '0771123456', 'إقامة البدر شقة 4، باتنة',                         5, 2, 5200.00::numeric, 2600.00::numeric, 'processing',  4),
  (7,  'خليل مزيان',         '0556789012', 'شارع ابن باديس، سطيف',                           19, 1, 5100.00::numeric, 5100.00::numeric, 'pending',     1),
  (8,  'نادية وهراني',       '0663345678', 'تجمع الياسمين، البليدة',                           9, 3, 5400.00::numeric, 1800.00::numeric, 'pending',     1),
  (9,  'حمزة بوكابوس',       '0772901234', 'الطريق الوطني 5، بجاية',                           6, 1, 1800.00::numeric, 1800.00::numeric, 'pending',     0),
  (10, 'سارة بن علي',        '0557567890', 'تجمع سوناتيبا فيلا 22، المدية',                  26, 1, 4200.00::numeric, 4200.00::numeric, 'at_delivery', 2),
  (11, 'مهدي لونيس',         '0664123456', 'شارع أول نوفمبر، تيزي وزو',                      15, 2, 5800.00::numeric, 2900.00::numeric, 'delivered',  20),
  (12, 'ضياء آيت منصور',     '0773789012', 'حي أميزور، بجاية',                                 6, 1, 2600.00::numeric, 2600.00::numeric, 'cancelled',   8)
) AS o(rn, cname, cphone, addr, wilaya, qty, total, unit, status, days_ago)
JOIN product_ids pi ON pi.rn = ((o.rn - 1) % 8) + 1;

-- ── Summary ─────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM client_store_products
   WHERE client_id = (SELECT id FROM clients WHERE email = 'skull2@gmail.com')) AS products_created,
  (SELECT COUNT(*) FROM store_orders
   WHERE client_id = (SELECT id FROM clients WHERE email = 'skull2@gmail.com')) AS orders_created;

COMMIT;
