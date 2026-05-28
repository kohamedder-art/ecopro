import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { Package, Save, TrendingUp, TrendingDown, DollarSign, Edit3, X, Check } from 'lucide-react';

interface ProductEcon {
  id: number;
  title: string;
  price: number;
  category: string | null;
  buy_cost: number;
  packaging_cost: number;
  handling_cost: number;
  fallback_shipping_cost: number;
}

const inputCls = "w-full h-8 bg-background border border-border rounded-lg px-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-right";

export default function ProductCostsSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductEcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<any>('/api/pixels/omni/inputs');
        setProducts(data.products || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const startEdit = (p: ProductEcon) => {
    setEditingId(p.id);
    setDraft({
      buy_cost: String(p.buy_cost || ''),
      packaging_cost: String(p.packaging_cost || ''),
      handling_cost: String(p.handling_cost || ''),
      fallback_shipping_cost: String(p.fallback_shipping_cost || ''),
    });
  };

  const save = async (p: ProductEcon) => {
    setSaving(true);
    try {
      await apiFetch('/api/pixels/omni/product-economics', {
        method: 'PUT',
        body: JSON.stringify({
          productId: p.id,
          buyCost: parseFloat(draft.buy_cost) || 0,
          packagingCost: parseFloat(draft.packaging_cost) || 0,
          handlingCost: parseFloat(draft.handling_cost) || 0,
          fallbackShippingCost: parseFloat(draft.fallback_shipping_cost) || 0,
        }),
      });
      setProducts(prev => prev.map(prod =>
        prod.id === p.id
          ? {
              ...prod,
              buy_cost: parseFloat(draft.buy_cost) || 0,
              packaging_cost: parseFloat(draft.packaging_cost) || 0,
              handling_cost: parseFloat(draft.handling_cost) || 0,
              fallback_shipping_cost: parseFloat(draft.fallback_shipping_cost) || 0,
            }
          : prod
      ));
      setEditingId(null);
      toast({ title: 'تم الحفظ' });
    } catch {
      toast({ title: 'خطأ في الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalCost = (p: ProductEcon) =>
    (p.buy_cost || 0) + (p.packaging_cost || 0) + (p.handling_cost || 0) + (p.fallback_shipping_cost || 0);

  const profitMargin = (p: ProductEcon) => {
    if (!p.price || p.price === 0) return 0;
    return ((p.price - totalCost(p)) / p.price * 100);
  };

  const fmt = (n: number) => Math.round(n).toLocaleString('ar-DZ');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">لا توجد منتجات بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">تكاليف المنتجات</h3>
          <p className="text-xs text-muted-foreground mt-0.5">أدخل سعر الشراء لكل منتج لحساب الأرباح الحقيقية</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Package className="w-3.5 h-3.5" />
          {products.length} منتج
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">المنتج</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">سعر البيع</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">سعر الشراء</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">التغليف</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">المناولة</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">التوصيل</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">التكلفة</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">الربح</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const isEditing = editingId === p.id;
              const cost = totalCost(p);
              const margin = profitMargin(p);
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-foreground text-xs truncate max-w-[120px] block">{p.title}</span>
                    {p.category && <span className="text-[10px] text-muted-foreground">{p.category}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-bold text-foreground">{fmt(p.price)} دج</td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input className={inputCls} value={draft.buy_cost} onChange={e => setDraft(d => ({ ...d, buy_cost: e.target.value }))} type="number" />
                    ) : (
                      <span className="text-xs">{fmt(p.buy_cost)} دج</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input className={inputCls} value={draft.packaging_cost} onChange={e => setDraft(d => ({ ...d, packaging_cost: e.target.value }))} type="number" />
                    ) : (
                      <span className="text-xs">{fmt(p.packaging_cost)} دج</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input className={inputCls} value={draft.handling_cost} onChange={e => setDraft(d => ({ ...d, handling_cost: e.target.value }))} type="number" />
                    ) : (
                      <span className="text-xs">{fmt(p.handling_cost)} دج</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input className={inputCls} value={draft.fallback_shipping_cost} onChange={e => setDraft(d => ({ ...d, fallback_shipping_cost: e.target.value }))} type="number" />
                    ) : (
                      <span className="text-xs">{fmt(p.fallback_shipping_cost)} دج</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">{fmt(cost)} دج</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {margin >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                      <span className={`text-xs font-bold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {margin.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => save(p)}
                          disabled={saving}
                          className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(p)}
                        className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 hover:text-foreground transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <DollarSign className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{fmt(products.reduce((s, p) => s + totalCost(p), 0))}</p>
          <p className="text-[10px] text-muted-foreground">إجمالي التكاليف</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {products.filter(p => profitMargin(p) > 0).length}
          </p>
          <p className="text-[10px] text-muted-foreground">منتجات مربحة</p>
        </div>
        <div className="bg-muted/30 rounded-xl p-3 text-center">
          <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {products.filter(p => profitMargin(p) <= 0).length}
          </p>
          <p className="text-[10px] text-muted-foreground">منتجات خاسرة</p>
        </div>
      </div>
    </div>
  );
}
