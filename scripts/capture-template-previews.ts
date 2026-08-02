import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '../public/templates');

const PRODUCTS = [
  { name: 'غطاء هاتف آيفون 15 برو', price: '2,400', color: '#e74c3c', badge: '🔥 الأكثر مبيعاً' },
  { name: 'سماعات لاسلكية بلوتوث', price: '3,800', color: '#3498db', badge: 'جديد' },
  { name: 'حافظة هاتف جلد طبيعي', price: '1,900', color: '#2ecc71', badge: '' },
  { name: 'شاحن سريع 65 واط GaN', price: '4,500', color: '#9b59b6', badge: 'خصم 35%' },
  { name: 'ساعة ذكية رياضية', price: '8,900', color: '#e67e22', badge: '⭐ الأفضل' },
  { name: 'نظارة شمسية أنيقة', price: '3,200', color: '#1abc9c', badge: '' },
  { name: 'حقيبة ظهر مقاومة للماء', price: '5,600', color: '#34495e', badge: 'محدود' },
  { name: 'سماعة رأس gaming', price: '7,200', color: '#e91e63', badge: '🔥 سعر خاص' },
];

function generateProductGrid(): string {
  return PRODUCTS.map(p => `
    <div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      <div style="aspect-ratio:3/4;background:${p.color}22;display:flex;align-items:center;justify-content:center;position:relative;">
        <div style="width:60%;height:60%;background:${p.color}33;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${p.color}" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </div>
        ${p.badge ? `<span style="position:absolute;top:6px;left:6px;background:#e11d48;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:99px;">${p.badge}</span>` : ''}
      </div>
      <div style="padding:8px;">
        <div style="font-size:11px;font-weight:600;color:#1e293b;line-height:1.3;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
        <div style="display:flex;align-items:baseline;gap:4px;">
          <span style="font-size:13px;font-weight:900;color:#f59e0b;" dir="ltr">${p.price}</span>
          <span style="font-size:9px;color:#94a3b8;">د.ج</span>
        </div>
      </div>
    </div>
  `).join('');
}

function generateProductCards(): string {
  return PRODUCTS.slice(0, 6).map(p => `
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #f0f0f0;">
      <div style="aspect-ratio:10/13;background:linear-gradient(135deg,${p.color}22,${p.color}11);display:flex;align-items:center;justify-content:center;">
        <div style="width:50%;height:50%;background:${p.color}25;border-radius:12px;"></div>
      </div>
      <div style="padding:12px;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px;">${p.name}</div>
        <div style="font-size:14px;font-weight:900;color:#059669;">${p.price} <span style="font-size:10px;font-weight:600;">DA</span></div>
      </div>
    </div>
  `).join('');
}

interface TemplateConfig {
  id: string;
  name: string;
  html: string;
}

const templates: TemplateConfig[] = [
  {
    id: 'boutique',
    name: 'Boutique',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#fff;width:400px;min-height:500px;color:#1e293b;}</style></head><body>
      <div style="background:#dc2626;padding:6px 16px;text-align:center;"><span style="font-size:11px;font-weight:800;color:#fff;letter-spacing:0.5px;">⚡ عروض محدودة — خصم يصل إلى 50% ⚡</span></div>
      <header style="background:#0f172a;border-bottom:3px solid #f59e0b;padding:10px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#0f172a;">B</div>
            <span style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">BOUTIQUE</span>
          </div>
          <div style="display:flex;gap:8px;">
            <div style="width:28px;height:28px;border:1px solid #f59e0b;border-radius:4px;display:flex;align-items:center;justify-content:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <div style="width:28px;height:28px;border:1px solid #f59e0b;border-radius:4px;display:flex;align-items:center;justify-content:center;position:relative;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><div style="position:absolute;top:-4px;left:-4px;width:14px;height:14px;background:#e11d48;border-radius:50%;font-size:8px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">3</div></div>
          </div>
        </div>
        <div style="margin-top:8px;"><div style="background:#1a2536;border:2px solid #334155;border-radius:4px;padding:6px 10px;display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style="font-size:11px;color:#64748b;">ابحث عن منتج...</span></div></div>
      </header>
      <div style="padding:12px 8px 0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 4px;"><span style="font-size:13px;font-weight:900;">مجموعة المنتجات</span><span style="font-size:10px;color:#94a3b8;font-weight:600;">8 منتج</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">${generateProductGrid()}</div>
      </div>
      <footer style="margin-top:16px;padding:16px;text-align:center;background:#f1f5f9;"><p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">BOUTIQUE</p><p style="font-size:9px;color:#94a3b8;margin-top:4px;">صنع بشغف لزبائننا في الجزائر</p><p style="font-size:9px;color:#94a3b8;margin-top:8px;">صنع بواسطة <span style="color:#f59e0b;">Sahla4Eco</span></p></footer>
    </body></html>`,
  },
  {
    id: 'zenith',
    name: 'Zenith',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#b0b8c9;width:400px;min-height:500px;color:#1f2937;}</style></head><body>
      <div style="background:#fff;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;">Z</div>
          <span style="font-size:18px;font-weight:900;color:#1f2937;">ZENITH</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="text-align:left;"><div style="font-size:10px;font-weight:700;color:#6b7280;">السعر</div><div style="font-size:16px;font-weight:900;" dir="ltr">3,900 د.ج</div></div>
          <button style="background:#22c55e;color:#fff;padding:8px 16px;border-radius:99px;font-weight:700;font-size:12px;border:none;">اطلب الان</button>
        </div>
      </div>
      <div style="background:linear-gradient(180deg,#1a3a2a 0%,#2d5a3f 30%,#1a3a2a 100%);aspect-ratio:3/4;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;">
        <div style="background:rgba(255,255,255,0.1);border-radius:16px;padding:24px;width:80%;">
          <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:8px;">سماعات بلوتوث لاسلكية</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:16px;">جودة صوت عالية • مقاومة للماء • 30 ساعة عمل</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e;">3,900 <span style="font-size:14px;">د.ج</span></div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);text-decoration:line-through;margin-top:4px;">6,500 د.ج</div>
          <div style="margin-top:16px;background:#22c55e;color:#fff;padding:10px;border-radius:8px;font-weight:700;font-size:13px;">اطلب الآن</div>
        </div>
      </div>
      <div style="background:#fff;padding:12px 16px;">
        <div style="background:#f9fafb;border:2px solid #22c55e;border-radius:12px;padding:12px;text-align:center;">
          <div style="position:relative;top:-14px;background:#22c55e;color:#fff;display:inline-block;padding:2px 12px;border-radius:99px;font-size:10px;font-weight:700;">أكمل البيانات للطلب</div>
          <div style="font-size:14px;font-weight:900;color:#1f2937;margin-bottom:10px;">اطلب الان</div>
          <div style="background:#fff;border:1px solid #9ca3af;border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="font-size:11px;color:#9ca3af;">الاسم الكامل</span></div>
          <div style="background:#fff;border:1px solid #9ca3af;border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg><span style="font-size:11px;color:#9ca3af;">رقم الهاتف</span></div>
          <div style="background:#fff;border:1px solid #9ca3af;border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span style="font-size:11px;color:#9ca3af;">اختر الولاية</span></div>
          <div style="background:#22c55e;color:#fff;padding:10px;border-radius:8px;font-weight:700;font-size:12px;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px;">🛒 تأكيد الطلب</div>
          <div style="font-size:10px;color:#6b7280;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>الدفع يكون بعد استلام المنتج</div>
        </div>
      </div>
      <footer style="padding:12px;text-align:center;font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;">© 2026 ZENITH · صنع بواسطة <span style="color:#22c55e;">Sahla4Eco</span></footer>
    </body></html>`,
  },
  {
    id: 'needdz',
    name: 'NeedDZ',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#fff;width:400px;min-height:500px;color:#0f172a;}</style></head><body>
      <div style="background:#059669;color:#fff;padding:6px 16px;font-size:11px;font-weight:700;display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>عرض سريع: ينتهي خلال 44د 22ث</div><div style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;background:#f87171;border-radius:50%;animation:pulse 1s infinite;"></div>14 شخص يشاهد</div></div>
      <header style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;">
        <div style="display:flex;align-items:center;gap:8px;"><div style="width:32px;height:32px;border-radius:50%;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;">م</div><span style="font-size:16px;font-weight:900;color:#0f172a;">متجري</span></div>
        <div style="position:relative;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#ef4444;border-radius:50%;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">2</div></div>
      </header>
      <div style="display:flex;gap:12px;padding:12px 16px;justify-content:center;">
        <div style="display:flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #cbd5e1;border-radius:99px;padding:4px 10px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><span style="font-size:10px;font-weight:700;color:#0f172a;">توصيل 58 ولاية</span></div>
        <div style="display:flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #cbd5e1;border-radius:99px;padding:4px 10px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span style="font-size:10px;font-weight:700;color:#0f172a;">الدفع عند الاستلام</span></div>
        <div style="display:flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #cbd5e1;border-radius:99px;padding:4px 10px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span style="font-size:10px;font-weight:700;color:#0f172a;">ضمان 12 شهر</span></div>
      </div>
      <div style="padding:0 16px;">
        <div style="border-radius:24px;overflow:hidden;border:1px solid #cbd5e1;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
          <div style="aspect-ratio:10/13;background:linear-gradient(135deg,#059669 0%,#34d399 50%,#059669 100%);position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="background:rgba(255,255,255,0.15);border-radius:20px;padding:24px;text-align:center;width:75%;">
              <div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:8px;">شاحن GaN سريع 65 واط</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.7);">شحن لابتوب وهاتف في نفس الوقت</div>
            </div>
            <div style="position:absolute;top:16px;left:16px;background:#000;color:#fff;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:800;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Best Seller</div>
            <div style="position:absolute;bottom:16px;left:0;right:0;display:flex;justify-content:center;gap:6px;">
              <div style="width:24px;height:6px;background:#34d399;border-radius:99px;"></div>
              <div style="width:6px;height:6px;background:rgba(255,255,255,0.4);border-radius:99px;"></div>
              <div style="width:6px;height:6px;background:rgba(255,255,255,0.4);border-radius:99px;"></div>
            </div>
          </div>
          <div style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;"><h2 style="font-size:16px;font-weight:700;color:#0f172a;flex:2;">شاحن GaN سريع 65 واط</h2><div style="text-align:right;flex:1;"><div style="font-size:10px;color:#6b7280;text-decoration:line-through;">6,200 DA</div><div style="font-size:18px;font-weight:900;color:#059669;">4,500 DA</div></div></div>
            <div style="display:flex;gap:6px;margin-bottom:12px;"><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:#f9fafb;border:1px solid #cbd5e1;color:#6b7280;font-style:italic;"># 65W Fast Charge</span><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:#f9fafb;border:1px solid #cbd5e1;color:#6b7280;font-style:italic;"># Dual USB-C</span></div>
            <button style="width:100%;background:#059669;color:#fff;padding:12px;border-radius:16px;font-weight:900;font-size:14px;border:none;display:flex;align-items:center;justify-content:center;gap:8px;">اطلب الآن <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
            <div style="text-align:center;margin-top:8px;font-size:10px;color:#6b7280;display:flex;align-items:center;justify-content:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>+45 توصيل هذا الصباح في الجزائر</div>
          </div>
        </div>
      </div>
      <div style="height:16px;"></div>
    </body></html>`,
  },
  {
    id: 'dzshop',
    name: 'DZShop',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#f3f4f6;width:400px;min-height:500px;color:#111827;}</style></head><body>
      <div style="background:rgba(37,99,235,0.8);backdrop-filter:blur(8px);padding:8px;text-align:center;color:#fff;font-size:13px;font-weight:700;">التوصيل متوفر لـ 58 ولاية - الدفع عند الاستلام</div>
      <header style="background:#2563eb;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;">م</div>
          <span style="font-size:16px;font-weight:700;color:#fff;">متجري</span>
        </div>
        <div style="display:flex;gap:12px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
      </header>
      <div style="padding:12px;">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="background:rgba(255,255,255,0.6);backdrop-filter:blur(4px);border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
            <div style="aspect-ratio:1;height:200px;background:linear-gradient(135deg,#2563eb11,#2563eb22);display:flex;align-items:center;justify-content:center;">
              <div style="width:60%;height:60%;background:#2563eb15;border-radius:12px;"></div>
            </div>
            <div style="padding:12px;">
              <h1 style="font-size:16px;font-weight:900;color:#111827;margin-bottom:6px;">اسم المنتج المميز - جودة عالية</h1>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:20px;font-weight:900;color:#2563eb;">4,500 دج</span><span style="font-size:12px;color:#9ca3af;text-decoration:line-through;">6,200 دج</span><span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">-35%</span></div>
              <div style="background:rgba(255,255,255,0.5);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.3);border-radius:8px;padding:8px;margin-bottom:10px;"><p style="font-size:11px;font-weight:600;color:#4b5563;">🔥 عرض محدود: اطلب الآن واحصل على توصيل مجاني!</p></div>
              <div style="background:rgba(255,255,255,0.4);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.4);border-radius:16px;padding:12px;">
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div style="background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.4);border-radius:12px;padding:8px 12px;font-size:12px;color:#6b7280;">الاسم</div>
                  <div style="background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.4);border-radius:12px;padding:8px 12px;font-size:12px;color:#6b7280;">رقم الهاتف</div>
                  <div style="background:rgba(255,255,255,0.5);border:1px solid rgba(0,0,0,0.4);border-radius:12px;padding:8px 12px;font-size:12px;color:#6b7280;">اختر الولاية</div>
                </div>
                <div style="background:#2563eb;color:#fff;padding:10px;border-radius:12px;font-weight:700;font-size:13px;text-align:center;margin-top:10px;">أطلب الآن</div>
                <div style="text-align:center;margin-top:6px;font-size:10px;color:#6b7280;display:flex;align-items:center;justify-content:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>الدفع عند الاستلام</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>`,
  },
  {
    id: 'spiriluxe',
    name: 'Spiriluxe',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#ffffff;width:400px;min-height:500px;color:#1f2937;}</style></head><body>
      <div style="background:#ff6b35;padding:6px 16px;text-align:center;"><span style="font-size:11px;font-weight:800;color:#fff;">🔥 خصم حصري — اطلب الآن 🔥</span></div>
      <header style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #94a3b8;">
        <div style="display:flex;align-items:center;gap:8px;"><div style="width:30px;height:30px;background:#581c87;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12px;">S</div><span style="font-size:15px;font-weight:900;color:#1f2937;">SPIRILUXE</span></div>
        <div style="display:flex;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f2937" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
      </header>
      <div style="padding:0;">
        <div style="aspect-ratio:3/4;background:linear-gradient(135deg,#581c87 0%,#7c3aed 50%,#ff6b35 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;">
          <div style="background:rgba(255,255,255,0.12);border-radius:16px;padding:20px;width:85%;backdrop-filter:blur(8px);">
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;"> COLLECTION PREMIUM</div>
            <div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px;">ساعة ذكية فاخرة</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:16px;">تصميم أنيق • شاشة AMOLED • مقاومة للماء</div>
            <div style="font-size:26px;font-weight:900;color:#ff6b35;">8,900 <span style="font-size:12px;">د.ج</span></div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-decoration:line-through;margin-top:2px;">12,500 د.ج</div>
          </div>
        </div>
      </div>
      <div style="padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span style="font-size:14px;font-weight:900;">المنتجات المميزة</span><span style="font-size:10px;color:#6b7280;">عرض الكل</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${PRODUCTS.slice(0, 4).map(p => `
            <div style="background:#fff;border:1px solid #94a3b8;border-radius:12px;overflow:hidden;">
              <div style="aspect-ratio:1;background:${p.color}18;display:flex;align-items:center;justify-content:center;"><div style="width:50%;height:50%;background:${p.color}22;border-radius:8px;"></div></div>
              <div style="padding:8px;"><div style="font-size:11px;font-weight:600;color:#1f2937;margin-bottom:4px;">${p.name}</div><div style="font-size:12px;font-weight:900;color:#ff6b35;">${p.price} <span style="font-size:9px;">د.ج</span></div></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="padding:12px 16px;">
        <div style="background:#f9fafb;border:1px solid #94a3b8;border-radius:12px;padding:12px;">
          <div style="font-size:14px;font-weight:900;color:#1f2937;margin-bottom:8px;text-align:center;">أكمل طلبك</div>
          <div style="border:1px solid #9ca3af;border-radius:8px;padding:8px;margin-bottom:6px;font-size:11px;color:#9ca3af;">الاسم الكامل</div>
          <div style="border:1px solid #9ca3af;border-radius:8px;padding:8px;margin-bottom:6px;font-size:11px;color:#9ca3af;">رقم الهاتف</div>
          <div style="border:1px solid #9ca3af;border-radius:8px;padding:8px;margin-bottom:6px;font-size:11px;color:#9ca3af;">اختر الولاية</div>
          <div style="background:#ff6b35;color:#fff;padding:10px;border-radius:8px;font-weight:700;font-size:12px;text-align:center;">🛒 تأكيد الطلب</div>
        </div>
      </div>
    </body></html>`,
  },
  {
    id: 'leroi',
    name: 'LeRoi',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#f8fafc;width:400px;min-height:500px;color:#1e293b;}</style></head><body>
      <div style="background:#1e40af;padding:6px 16px;text-align:center;"><span style="font-size:11px;font-weight:800;color:#fff;">🎉 خصم 40% على جميع المنتجات — لفترة محدودة</span></div>
      <header style="background:#1e293b;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:10px;"><div style="width:32px;height:32px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;">LR</div><span style="font-size:16px;font-weight:900;color:#fff;">LE ROI SHOP</span></div>
        <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
      </header>
      <div style="display:flex;gap:4px;padding:8px;direction:ltr;">
        <div style="width:48px;height:48px;border-radius:8px;background:#1e40af;border:2px solid #3b82f6;flex-shrink:0;"></div>
        <div style="width:48px;height:48px;border-radius:8px;background:#e2e8f0;flex-shrink:0;"></div>
        <div style="width:48px;height:48px;border-radius:8px;background:#e2e8f0;flex-shrink:0;"></div>
        <div style="width:48px;height:48px;border-radius:8px;background:#e2e8f0;flex-shrink:0;"></div>
      </div>
      <div style="padding:0 12px;">
        <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <div style="aspect-ratio:1;background:linear-gradient(135deg,#1e40af22,#3b82f622);display:flex;align-items:center;justify-content:center;">
            <div style="width:50%;height:50%;background:#3b82f618;border-radius:12px;"></div>
          </div>
          <div style="padding:14px;">
            <h1 style="font-size:16px;font-weight:900;color:#111827;margin-bottom:4px;">سماعات لاسلكية برو ماكس</h1>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><div style="display:flex;gap:1px;">${[1,2,3,4,5].map(i => `<svg width="12" height="12" viewBox="0 0 20 20" fill="${i <= 4 ? '#f59e0b' : '#ddd'}"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`).join('')}</div><span style="font-size:10px;color:#64748b;">128 تقييم</span></div>
            <div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:20px;font-weight:900;color:#1e40af;">3,800</span><span style="font-size:10px;color:#64748b;">د.ج</span><span style="font-size:11px;color:#94a3b8;text-decoration:line-through;">6,500</span></div>
            <div style="display:flex;gap:6px;margin-top:6px;"><span style="font-size:9px;font-weight:800;padding:3px 8px;background:#fee2e2;color:#dc2626;border-radius:4px;">🔥 SAVINGS</span><span style="font-size:9px;font-weight:800;padding:3px 8px;background:#fff7ed;color:#ea580c;border-radius:4px;">Only 3 left</span></div>
            <div style="font-size:10px;color:#64748b;margin-top:6px;">★ Best-Selling in <span style="color:#94a3b8;">إلكترونيات</span></div>
          </div>
        </div>
      </div>
      <div style="height:12px;"></div>
    </body></html>`,
  },
  {
    id: 'iyco',
    name: 'IYCO',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#ffffff;width:400px;min-height:500px;color:#0f172a;}</style></head><body>
      <header style="background:#0f172a;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;background:#16a34a;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px;">I</div><span style="font-size:14px;font-weight:900;color:#fff;">IYCO</span></div>
        <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
      </header>
      <div style="padding:8px 16px;"><div style="background:#f1f5f9;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style="font-size:12px;color:#64748b;">ابحث عن منتج...</span></div></div>
      <div style="background:#0f172a;margin:0 16px;border-radius:12px;overflow:hidden;">
        <div style="aspect-ratio:16/9;background:linear-gradient(135deg,#16a34a33,#0f172a);display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;">
          <div><div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">عرض خاص</div><div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:4px;">أحسن جودة في السوق</div><div style="font-size:11px;color:#94a3b8;">التسليم خلال 24 ساعة — الدفع عند الاستلام</div><div style="margin-top:12px;background:#16a34a;color:#fff;padding:8px 16px;border-radius:8px;font-weight:700;font-size:12px;display:inline-block;">إشتري الآن</div></div>
        </div>
      </div>
      <div style="padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:13px;font-weight:900;">المنتجات</span><span style="font-size:10px;color:#64748b;">عرض الكل →</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${PRODUCTS.slice(0, 4).map(p => `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <div style="aspect-ratio:1;background:${p.color}15;display:flex;align-items:center;justify-content:center;"><div style="width:45%;height:45%;background:${p.color}20;border-radius:8px;"></div></div>
              <div style="padding:8px;"><div style="font-size:10px;font-weight:600;color:#0f172a;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div><div style="font-size:12px;font-weight:900;color:#16a34a;">${p.price} <span style="font-size:9px;">د.ج</span></div></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="padding:8px 16px;">
        <div style="background:#f1f5f9;border-radius:10px;padding:10px;">
          <div style="font-size:12px;font-weight:900;color:#0f172a;text-align:center;margin-bottom:8px;">🛒 سلّة المشتريات</div>
          <div style="display:flex;align-items:center;gap:8px;background:#fff;border-radius:8px;padding:8px;">
            <div style="width:40px;height:40px;background:#16a34a22;border-radius:6px;"></div>
            <div style="flex:1;"><div style="font-size:11px;font-weight:600;color:#0f172a;">سماعات بلوتوث</div><div style="font-size:11px;font-weight:900;color:#16a34a;">3,800 د.ج</div></div>
            <div style="display:flex;align-items:center;gap:4px;"><div style="width:24px;height:24px;border:1px solid #e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748b;">−</div><span style="font-size:12px;font-weight:700;">1</span><div style="width:24px;height:24px;border:1px solid #e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#16a34a;">+</div></div>
          </div>
        </div>
      </div>
    </body></html>`,
  },
  {
    id: 'primo',
    name: 'Primo',
    html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=400"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#fafafa;width:400px;min-height:500px;color:#0f172a;}</style></head><body>
      <header style="background:#fff;border-bottom:1px solid #e2e8f0;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;background:#f39c12;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px;">P</div><span style="font-size:14px;font-weight:900;color:#0f172a;">PRIMO</span></div>
        <div style="display:flex;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
      </header>
      <div style="padding:12px 16px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:#f39c12;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">⭐ PRIMO PREMIUM</div>
        <h1 style="font-size:18px;font-weight:900;color:#0f172a;margin-bottom:4px;">تسوق منتجاتنا</h1>
        <p style="font-size:11px;color:#64748b;">أفضل المنتجات بأسعار تنافسية</p>
      </div>
      <div style="padding:0 16px;">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
          <div style="aspect-ratio:4/3;background:linear-gradient(135deg,#f39c1211,#f39c1222);display:flex;align-items:center;justify-content:center;position:relative;">
            <div style="width:40%;height:50%;background:#f39c1218;border-radius:12px;"></div>
            <div style="position:absolute;top:8px;right:8px;background:#fee2e2;color:#dc2626;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;">خصم 30%</div>
          </div>
          <div style="padding:12px;">
            <div style="display:flex;gap:2px;margin-bottom:6px;">${[1,2,3,4,5].map(i => `<svg width="14" height="14" viewBox="0 0 20 20" fill="${i <= 4 ? '#f39c12' : '#ddd'}"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`).join('')}</div>
            <h2 style="font-size:15px;font-weight:900;color:#0f172a;margin-bottom:6px;">نظارة شمسية أنيقة UV400</h2>
            <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:8px;"><span style="font-size:20px;font-weight:900;color:#f39c12;">3,200</span><span style="font-size:10px;color:#64748b;">د.ج</span><span style="font-size:11px;color:#94a3b8;text-decoration:line-through;">4,800</span></div>
            <div style="display:flex;gap:6px;margin-bottom:10px;">
              <div style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="margin:0 auto 4px;"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                <div style="font-size:9px;font-weight:700;color:#64748b;">توصيل سريع</div>
              </div>
              <div style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="margin:0 auto 4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <div style="font-size:9px;font-weight:700;color:#64748b;">ضمان شامل</div>
              </div>
              <div style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="margin:0 auto 4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div style="font-size:9px;font-weight:700;color:#64748b;">دفع آمن</div>
              </div>
            </div>
            <button style="width:100%;background:#f39c12;color:#fff;padding:10px;border-radius:8px;font-weight:800;font-size:13px;border:none;display:flex;align-items:center;justify-content:center;gap:6px;">تأكيد الطلب الآن <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
          </div>
        </div>
      </div>
      <div style="padding:12px 16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${PRODUCTS.slice(0, 4).map(p => `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <div style="aspect-ratio:1;background:${p.color}12;display:flex;align-items:center;justify-content:center;"><div style="width:40%;height:40%;background:${p.color}18;border-radius:6px;"></div></div>
              <div style="padding:6px;"><div style="font-size:10px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div><div style="font-size:11px;font-weight:900;color:#f39c12;">${p.price} د.ج</div></div>
            </div>
          `).join('')}
        </div>
      </div>
    </body></html>`,
  },
];

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 400, height: 500 },
    deviceScaleFactor: 2,
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const template of templates) {
    console.log(`Capturing ${template.name}...`);
    const page = await context.newPage();
    await page.setContent(template.html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${template.id}.png`),
      clip: { x: 0, y: 0, width: 400, height: 500 },
    });
    await page.close();
    console.log(`  ✓ ${template.id}.png`);
  }

  await browser.close();
  console.log('\nAll 8 template previews captured!');
}

main().catch(console.error);
