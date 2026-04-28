---
name: create-template
description: >-
  **WORKFLOW SKILL** — Create a new EcoPro storefront template with ALL required functionality:
  delivery system, order submission, cart, checkout form, wilaya dropdown, contentEditable text editing,
  RTL layout, color/settings wiring, mobile responsiveness, product display, success screen.
  USE FOR: adding a new storefront template, creating a store theme, building a template component.
  DO NOT USE FOR: editing existing templates, fixing bugs in templates, template editor changes.
---

# Create New EcoPro Storefront Template

## OVERVIEW

Every storefront template is a **single React component** that must implement:
- Product display (hero product + grid)
- Cart system
- Checkout form (name, phone, wilaya)
- Delivery pricing via `useStoreDeliveryPrices`
- Order submission via `POST /api/orders/create`
- Order success screen
- ContentEditable text fields (editor mode)
- RTL layout (`dir="rtl"`)
- Dynamic colors from settings
- Mobile responsiveness

**Missing ANY of these = broken template.**

---

## STEP 1: CREATE THE TEMPLATE FILE

**Path:** `client/pages/storefront/templates/{id}/{Name}Template.tsx`

- `{id}` = lowercase template ID (e.g. `elegance`)
- `{Name}` = PascalCase name (e.g. `Elegance`)
- One file per template, default export

### Required Imports

```typescript
import React, { useState, useMemo } from 'react';
import { TemplateProps } from '../types';
import { useStoreDeliveryPrices } from '@/hooks/useStoreDeliveryPrices';
```

Also import icons from `lucide-react` as needed (e.g. `ShoppingBag`, `Check`, `X`, `Phone`, `MapPin`, `Truck`).

### Function Signature

```typescript
export default function {Name}Template({
  settings,
  products,
  canManage,
  storeSlug,
  primaryColor: propPrimaryColor,
}: TemplateProps) {
```

All props are **mandatory** to destructure. `primaryColor` (renamed to `propPrimaryColor`) is computed by the editor from raw settings and survives template preview overrides — use it as an accent fallback.

---

## STEP 2: SETTINGS WIRING

### Colors (CRITICAL — use correct priority)

The editor has **4 color pickers** in the "الألوان الأساسية" panel. Templates MUST wire to all of them:

| Picker Label | Settings Key | Purpose |
|-------------|-------------|---------|
| اللون الأساسي | `primary_color` | Headings, body text on light bg |
| لون الزر / Accent | `template_accent_color` | Buttons, CTA, prices, active states |
| لون الخلفية / Background | `template_bg_color` | Page background |
| لون الهيدر / Header | `iyco_header_color` | Nav, form cards, FAQ surfaces |

#### Accent Color (buttons, prices)

```typescript
// propPrimaryColor survives editor preview override; settings.primary_color also survives
const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#DEFAULT';
```

#### Background Color

```typescript
const bgColor = settings?.template_bg_color || settings?.{id}_bg_color || '#DEFAULT';
```

#### Primary / Text Color

```typescript
const primaryColor = settings?.primary_color || '#0f172a';
```

#### Header / Surface Color (new)

```typescript
const headerColor = settings?.iyco_header_color || (isDark ? '#1e293b' : '#ffffff');
```

**WRONG:** `settings?.{id}_accent_color || settings?.template_accent_color` — this breaks the editor color pickers (global keys MUST come first).

### Dark/Light Auto-Detection (MANDATORY)

Templates MUST detect whether `bgColor` and `headerColor` are dark and adapt all text/surface colors:

```typescript
const isDark = useMemo(() => {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}, [bgColor]);

const isHeaderDark = useMemo(() => {
  const hex = headerColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}, [headerColor]);

// Helper: check if a color is light enough to read on dark backgrounds
const isLight = (hex: string) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
};

// Page-level colors — primaryColor is used on dark bg ONLY if it's light enough to be readable
const textColor = isDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
const textMuted = isDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';
const borderColor = isDark ? '#334155' : '#e2e8f0';
const surfaceMuted = isDark ? '#0f172a' : '#f1f5f9';

// Surface-level colors (adapt to headerColor) — use on nav, form cards, FAQ, inputs
const surfaceColor = headerColor;
const surfaceTextColor = isHeaderDark ? (isLight(primaryColor) ? primaryColor : '#f1f5f9') : primaryColor;
const surfaceTextMuted = isHeaderDark ? (isLight(primaryColor) ? primaryColor + 'aa' : '#94a3b8') : '#64748b';
```

### CRITICAL: Do NOT Hardcode Tailwind Color Classes

**WRONG** (ignores color pickers):
```typescript
<nav className="bg-white text-slate-900 border-slate-200">
<div className="bg-slate-100 text-slate-700">
```

**RIGHT** (respects color pickers):
```typescript
<nav style={{ backgroundColor: surfaceColor, color: surfaceTextColor, borderBottom: `1px solid ${borderColor}` }}>
<div style={{ backgroundColor: surfaceMuted, color: textColor }}>
```

Every element that has a visible background, text color, or border MUST use dynamic `style={{}}` with the derived colors. Tailwind color classes like `bg-white`, `text-slate-*`, `border-slate-*` will NOT respond to the editor pickers.

### Editor Preview Override (important context)

`GoldTemplateEditor.tsx` has a `TEMPLATE_SETTING_KEYS` array. When previewing a **different** template (before publishing), all keys in this array get set to `null`. Color keys (`template_bg_color`, `template_accent_color`) were **removed** from this array so they survive preview mode. Only text/copy settings reset.

This means `settings?.template_accent_color` may still be `null` if the store has never set it. Always chain fallbacks:
```typescript
const accentColor = settings?.template_accent_color || propPrimaryColor || settings?.primary_color || '#DEFAULT';
```

### Text Settings

```typescript
const heroTitle = settings?.template_hero_heading || 'Default Arabic Title';
const heroSubtitle = settings?.template_hero_subtitle || 'Default subtitle';
const buttonText = settings?.template_button_text || 'اطلب الآن';
```

### Main Product

```typescript
const mainProduct = useMemo(() => {
  const mainId = settings?.dzp_main_product_id;
  return mainId
    ? products?.find((p: any) => String(p.id) === String(mainId))
    : products?.[0];
}, [products, settings?.dzp_main_product_id]);
```

### Currency

```typescript
const currency = settings?.currency_code || 'د.ج';
```

### Store Logo

```typescript
{settings?.store_logo ? (
  <img src={settings.store_logo} alt="" className="w-8 h-8 rounded-full object-cover" />
) : (
  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
       style={{ backgroundColor: accentColor }}>
    {(settings?.store_name || 'م').charAt(0)}
  </div>
)}
```

---

## STEP 3: DELIVERY SYSTEM (MANDATORY)

```typescript
const { wilayas } = useStoreDeliveryPrices(storeSlug);
const [selectedWilayaId, setSelectedWilayaId] = useState<number | null>(null);
const selectedWilaya = wilayas.find(w => w.id === selectedWilayaId);
const deliveryFee = selectedWilaya?.homePrice ?? 0;
```

### Wilaya Dropdown (in checkout form)

```typescript
<select
  value={selectedWilayaId ?? ''}
  onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
  className="w-full px-4 py-2 border rounded-lg"
>
  <option value="">اختر الولاية</option>
  {wilayas.map(w => (
    <option key={w.id} value={w.id}>{w.labelAR}</option>
  ))}
</select>
```

---

## STEP 4: CART SYSTEM

Use a simple cart array with quantity tracking:

```typescript
const [cart, setCart] = useState<{ id: number; title: string; price: number; image: string; qty: number }[]>([]);

const addToCart = (product: any) => {
  setCart(prev => {
    const existing = prev.find(item => item.id === product.id);
    if (existing) return prev.map(item =>
      item.id === product.id ? { ...item, qty: item.qty + 1 } : item
    );
    return [...prev, {
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.images?.[0] || '/placeholder.png',
      qty: 1
    }];
  });
};

const removeFromCart = (productId: number) => {
  setCart(prev => prev.filter(item => item.id !== productId));
};

const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
const total = subtotal + deliveryFee;
```

---

## STEP 5: ORDER SUBMISSION (MANDATORY)

### Form State

```typescript
const [customerName, setCustomerName] = useState('');
const [customerPhone, setCustomerPhone] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [orderSuccess, setOrderSuccess] = useState(false);
```

### Submit Handler

```typescript
const handleOrder = async () => {
  if (!customerName || !customerPhone || !selectedWilayaId || cart.length === 0) {
    alert('يرجى ملء جميع الحقول');
    return;
  }

  try {
    setIsSubmitting(true);
    for (const item of cart) {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_slug: storeSlug,
          product_id: item.id,
          quantity: item.qty,
          total_price: item.price * item.qty,
          delivery_fee: deliveryFee,
          delivery_type: 'desk',
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: selectedWilaya?.labelAR || '',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'خطأ في الطلب');
        return;
      }
    }
    setOrderSuccess(true);
  } catch (err) {
    alert('خطأ في الطلب');
  } finally {
    setIsSubmitting(false);
  }
};
```

### Required Fields in POST Body

| Field | Source |
|-------|--------|
| `store_slug` | `storeSlug` prop |
| `product_id` | `item.id` from cart |
| `quantity` | `item.qty` |
| `total_price` | `item.price * item.qty` |
| `delivery_fee` | From `useStoreDeliveryPrices` |
| `delivery_type` | `'desk'` or `'home'` |
| `customer_name` | Form input |
| `customer_phone` | Form input |
| `customer_address` | `selectedWilaya?.labelAR` |

---

## STEP 6: ORDER SUCCESS SCREEN (MANDATORY)

Must show BEFORE the main template return (early return pattern):

```typescript
if (orderSuccess) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }} dir="rtl">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
             style={{ backgroundColor: accentColor + '20' }}>
          <Check size={32} style={{ color: accentColor }} />
        </div>
        <h2 className="text-2xl font-bold mb-2">تم تأكيد طلبك!</h2>
        <p className="text-gray-500 mb-6">سنتواصل معك قريباً</p>
        <div className="text-right bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between">
              <span>{item.title} × {item.qty}</span>
              <span>{item.price * item.qty} {currency}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>المجموع</span>
            <span style={{ color: accentColor }}>{total} {currency}</span>
          </div>
        </div>
        <button onClick={() => { setOrderSuccess(false); setCart([]); }}
          className="px-6 py-2 rounded-lg text-white"
          style={{ backgroundColor: accentColor }}>
          تسوق مرة أخرى
        </button>
      </div>
    </div>
  );
}
```

---

## STEP 7: CONTENTEDITABLE TEXT EDITING

For the template editor to allow inline text editing:

```typescript
const handleTextEdit = (key: string) => (e: React.FocusEvent<HTMLElement>) => {
  const text = e.currentTarget.textContent || '';
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage({ type: 'TEMPLATE_UPDATE_SETTING', key, value: text }, '*');
  }
};
```

### Usage on Text Elements

```typescript
<h1
  contentEditable={canManage}
  suppressContentEditableWarning
  onBlur={handleTextEdit('template_hero_heading')}
>
  {heroTitle}
</h1>
```

Apply to ALL user-facing text: hero heading, subtitle, button text, section titles.

---

## STEP 8: RTL LAYOUT

The **root div** MUST have `dir="rtl"`:

```typescript
return (
  <div className="min-h-screen" style={{ backgroundColor: bgColor }} dir="rtl">
    {/* All content */}
  </div>
);
```

Use Arabic text for all default/fallback strings:
- Button text: `'اطلب الآن'`
- Placeholders: `'الاسم الكامل'`, `'رقم الهاتف'`, `'اختر الولاية'`
- Headings: Arabic defaults

---

## STEP 9: canManage CONDITIONAL BEHAVIOR

```typescript
// Enable text editing only in editor mode
<h2 contentEditable={canManage} suppressContentEditableWarning ...>

// Show placeholder when no products in editor
{canManage && products.length === 0 && (
  <div className="py-20 text-center opacity-50">
    <p>أضف منتجات من لوحة التحكم</p>
  </div>
)}
```

---

## STEP 10: MOBILE RESPONSIVENESS

### Responsive Grid for Products

```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  {products.map(p => (...))}
</div>
```

### Modal/Checkout (full-screen on mobile)

```typescript
{showCheckout && (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40">
    <div className="w-full sm:max-w-xl rounded-t-[2rem] sm:rounded-[2rem] bg-white p-6 max-h-[90vh] overflow-y-auto">
      {/* Checkout form */}
    </div>
  </div>
)}
```

### Max-Width Wrapper

```typescript
<div className="max-w-md mx-auto px-4">
```

---

## STEP 11: IMAGE HANDLING

### Product Images — Always provide fallback

```typescript
<img
  src={product?.images?.[0] || '/placeholder.png'}
  alt={product?.title}
  className="w-full h-full object-cover"
/>
```

### Banner/Hero Images

```typescript
const bannerUrl = settings?.banner_url || '/placeholder.png';
```

---

## STEP 12: CSS/TAILWIND PATTERNS

### Glassmorphic Effects (optional, fits design system)

```typescript
<div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-[2rem] p-6">
```

### Border Radius (Bento Box)

- Major panels: `rounded-[2rem]`
- Buttons/inputs: `rounded-2xl` or `rounded-xl`
- Small elements: `rounded-lg`

### Dynamic Colors via Inline Styles

```typescript
<div style={{ backgroundColor: bgColor, color: accentColor }}>
<button style={{ backgroundColor: accentColor }} className="text-white rounded-xl px-6 py-3">
```

### Google Fonts (optional)

```typescript
useEffect(() => {
  if (!document.getElementById('cairo-font')) {
    const link = document.createElement('link');
    link.id = 'cairo-font';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
}, []);
```

---

## STEP 13: REGISTER THE TEMPLATE

### 13a. Edit `client/pages/storefront/templates/index.tsx`

Four changes required:

**1. Add import:**
```typescript
import {Name}Template from './{id}/{Name}Template';
```

**2. Add to validIds array in `normalizeTemplateId()`:**
```typescript
const validIds = ['dzshop', 'dzpremium', ..., '{id}'];
```

**3. Add case to `RenderStorefront()` switch:**
```typescript
case '{id}': return <{Name}Template {...sanitizedProps} />;
```

**4. Add to named exports:**
```typescript
export { ..., {Name}Template };
```

### 13b. Edit `client/pages/GoldTemplateEditor.tsx`

**1. Add to `TEMPLATE_PREVIEWS` array:**
```typescript
{
  id: '{id}',
  name: '{Display Name}',
  description: 'Short description of the template style',
  image: '/templates/{id}.png',
  category: 'modern' | 'classic' | 'minimal' | 'luxury' | 'bold',
  isNew: true,
}
```

**2. Add to `READY_TEMPLATE_IDS` set:**
```typescript
const READY_TEMPLATE_IDS = new Set([..., '{id}']);
```

---

## STEP 14: CHECKOUT FORM REQUIREMENTS

Every template MUST have a checkout form with these fields:

```typescript
<input
  value={customerName}
  onChange={(e) => setCustomerName(e.target.value)}
  placeholder="الاسم الكامل"
  className="w-full px-4 py-3 border rounded-xl"
/>
<input
  value={customerPhone}
  onChange={(e) => setCustomerPhone(e.target.value)}
  placeholder="رقم الهاتف"
  className="w-full px-4 py-3 border rounded-xl"
  type="tel"
/>
<select
  value={selectedWilayaId ?? ''}
  onChange={(e) => setSelectedWilayaId(Number(e.target.value) || null)}
  className="w-full px-4 py-3 border rounded-xl"
>
  <option value="">اختر الولاية</option>
  {wilayas.map(w => <option key={w.id} value={w.id}>{w.labelAR}</option>)}
</select>
```

### Price Summary (show before submit button)

```typescript
<div className="space-y-2">
  <div className="flex justify-between">
    <span>المنتجات</span><span>{subtotal} {currency}</span>
  </div>
  <div className="flex justify-between">
    <span>التوصيل</span><span>{deliveryFee} {currency}</span>
  </div>
  <div className="flex justify-between font-bold text-lg border-t pt-2">
    <span>المجموع</span><span style={{ color: accentColor }}>{total} {currency}</span>
  </div>
</div>
```

### Submit Button

```typescript
<button
  onClick={handleOrder}
  disabled={isSubmitting || cart.length === 0}
  className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-50"
  style={{ backgroundColor: accentColor }}
>
  {isSubmitting ? 'جاري المعالجة...' : buttonText}
</button>
```

---

## FINAL CHECKLIST

Before considering the template done, verify ALL of these:

- [ ] File at `client/pages/storefront/templates/{id}/{Name}Template.tsx`
- [ ] Imports `TemplateProps` from `../types`
- [ ] Imports `useStoreDeliveryPrices` from `@/hooks/useStoreDeliveryPrices`
- [ ] Destructures `{ settings, products, canManage, storeSlug, primaryColor: propPrimaryColor }`
- [ ] Root div has `dir="rtl"` and `style={{ backgroundColor: bgColor, color: textColor }}`
- [ ] Accent color chain: `template_accent_color || propPrimaryColor || primary_color || default`
- [ ] Background color: `template_bg_color` before template-specific key
- [ ] Header/surface color: `iyco_header_color` with dark/light fallback
- [ ] Dark/light auto-detection via luminance on `bgColor` AND `headerColor`
- [ ] `isLight()` helper: on dark bg, use `primaryColor` for text ONLY if light enough (luminance ≥ 128), else fall back to `#f1f5f9`
- [ ] `textColor`, `textMuted`, `borderColor`, `surfaceMuted` derived from `isDark` + `isLight(primaryColor)`
- [ ] `surfaceColor`, `surfaceTextColor`, `surfaceTextMuted` derived from `isHeaderDark` + `isLight(primaryColor)`
- [ ] **NO hardcoded Tailwind color classes** (`bg-white`, `text-slate-*`, `border-slate-*`) on visible elements — use `style={{}}` with derived colors
- [ ] Reads `currency_code` with fallback `'د.ج'`
- [ ] Reads `dzp_main_product_id` with fallback to `products?.[0]`
- [ ] Reads `template_hero_heading`, `template_hero_subtitle`, `template_button_text`
- [ ] Store logo display with initial fallback
- [ ] `useStoreDeliveryPrices(storeSlug)` hook called
- [ ] Wilaya dropdown renders all wilayas
- [ ] Cart system: add, remove, quantity tracking
- [ ] Customer form: name, phone, wilaya
- [ ] Order submission via `POST /api/orders/create` with ALL required fields
- [ ] Order success screen with order summary
- [ ] `contentEditable={canManage}` on text elements
- [ ] `handleTextEdit` sends `postMessage` to parent
- [ ] `canManage && products.length === 0` placeholder
- [ ] All images have fallbacks
- [ ] Mobile responsive (responsive grid, max-width wrappers)
- [ ] Registered in `index.tsx` (import, validIds, switch, export)
- [ ] Added to `TEMPLATE_PREVIEWS` in `GoldTemplateEditor.tsx`
- [ ] Added to `READY_TEMPLATE_IDS` in `GoldTemplateEditor.tsx`
- [ ] No local database calls
- [ ] All default text in Arabic
