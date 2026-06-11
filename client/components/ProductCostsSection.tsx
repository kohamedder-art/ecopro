import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { Package, TrendingUp, TrendingDown, DollarSign, Edit3, X, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface ProductEcon {
  id: number;
  title: string;
  price: number;
  category: string | null;
  buy_cost: number;
  packaging_cost: number;
  handling_cost: number;
  fallback_shipping_cost: number;
  call_center_cost: number;
  return_cost: number;
  other_costs: number;
}

const inputCls = "h-11 bg-white dark:bg-zinc-800 border border-border/60 rounded-lg px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-right tabular-nums w-full";

const costFields = [
  { key: 'buy_cost', label: 'شراء' },
  { key: 'packaging_cost', label: 'تغليف' },
  { key: 'handling_cost', label: 'مناولة' },
  { key: 'fallback_shipping_cost', label: 'توصيل' },
  { key: 'call_center_cost', label: 'مركز اتصال' },
  { key: 'return_cost', label: 'ترجيع' },
  { key: 'other_costs', label: 'أخرى' },
] as const;

export default function ProductCostsSection({ onSave }: { onSave?: () => void }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductEcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setShowAdvanced(false);
    setDraft({
      buy_cost: String(p.buy_cost || ''),
      packaging_cost: String(p.packaging_cost || ''),
      handling_cost: String(p.handling_cost || ''),
      fallback_shipping_cost: String(p.fallback_shipping_cost || ''),
      call_center_cost: String(p.call_center_cost || ''),
      return_cost: String(p.return_cost || ''),
      other_costs: String(p.other_costs || ''),
      quantity: '1',
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
          callCenterCost: parseFloat(draft.call_center_cost) || 0,
          returnCost: parseFloat(draft.return_cost) || 0,
          otherCosts: parseFloat(draft.other_costs) || 0,
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
              call_center_cost: parseFloat(draft.call_center_cost) || 0,
              return_cost: parseFloat(draft.return_cost) || 0,
              other_costs: parseFloat(draft.other_costs) || 0,
            }
          : prod
      ));
      setEditingId(null);
      onSave?.();
      toast({ title: 'تم الحفظ' });
    } catch {
      toast({ title: 'خطأ في الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const num = (v: any) => Number(v) || 0;
  const totalCost = (p: ProductEcon) =>
    num(p.buy_cost) + num(p.packaging_cost) + num(p.handling_cost) + num(p.fallback_shipping_cost) + num(p.call_center_cost) + num(p.other_costs);

  const profitMargin = (p: ProductEcon) => {
    if (!p.price || p.price === 0) return 0;
    return ((p.price - totalCost(p)) / p.price * 100);
  };

  const fmt = (n: number) => String(Math.round(n));
  const costVal = (v: number) => v ? fmt(v) : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
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
          <p className="text-xs text-muted-foreground mt-0.5">أدخل تكاليف كل منتج لحساب الأرباح الحقيقية</p>
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
              {costFields.map(({ label }) => (
                <th key={label} className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">{label}</th>
              ))}
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
              const qty = parseInt(draft.quantity) || 1;
              return (
                <>
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-foreground text-xs truncate max-w-[120px] block">{p.title}</span>
                      {p.category && <span className="text-[10px] text-muted-foreground">{p.category}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-foreground">{fmt(p.price)} دج</td>
                    {costFields.map(({ key }) => (
                      <td key={key} className="px-3 py-2.5">
                        <span className="text-xs font-bold text-foreground">{costVal(p[key as keyof ProductEcon] as number)} دج</span>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-xs font-bold text-foreground">{costVal(cost)} دج</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-bold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {margin.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => startEdit(p)}
                        className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 hover:text-foreground transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr key={`${p.id}-edit`}>
                      <td colSpan={12} className="p-0">
                        <div className="bg-muted/20 border-t border-b border-border px-4 py-4">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-sm font-bold text-foreground">{p.title}</span>
                            <span className="text-xs text-muted-foreground">سعر البيع: {fmt(p.price)} دج</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            <div>
                              <label className="block text-[11px] font-semibold text-foreground mb-1">سعر الشراء</label>
                              <input
                                className={inputCls}
                                value={draft.buy_cost || ''}
                                onChange={e => setDraft(d => ({ ...d, buy_cost: e.target.value }))}
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">الكمية للحسبة</label>
                              <input
                                className={inputCls}
                                value={draft.quantity ?? ''}
                                onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))}
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                placeholder="1"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => setShowAdvanced(s => !s)}
                                className="h-11 px-3 rounded-lg bg-muted text-muted-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-muted/80 transition-colors w-full justify-center">
                                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {showAdvanced ? 'إخفاء التكاليف الإضافية' : 'تكاليف إضافية'}
                              </button>
                            </div>
                          </div>

                          {showAdvanced && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 mb-4 p-3 bg-background/50 rounded-xl">
                              {costFields.slice(1).map(({ key, label }) => (
                                <div key={key}>
                                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</label>
                                  <input
                                    className={inputCls}
                                    value={draft[key] || ''}
                                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                                    type="text"
                                    inputMode="numeric"
                                    dir="ltr"
                                    placeholder="0"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              <span className="text-muted-foreground">تكلفة الوحدة: </span>
                              <span className="font-bold text-foreground">{fmt(cost)} دج</span>
                              <span className="mx-2 text-muted-foreground">×</span>
                              <span className="font-bold text-foreground">{qty}</span>
                              <span className="mx-2 text-muted-foreground">=</span>
                              <span className="font-bold text-lg text-primary">{fmt(cost * qty)} دج</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => save(p)} disabled={saving}
                                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                حفظ
                              </button>
                              <button onClick={() => { setEditingId(null); setShowAdvanced(false); }}
                                className="h-9 px-4 rounded-lg bg-muted text-muted-foreground text-sm font-bold flex items-center gap-1.5 hover:bg-muted/80 transition-colors">
                                <X className="w-4 h-4" />
                                إلغاء
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
