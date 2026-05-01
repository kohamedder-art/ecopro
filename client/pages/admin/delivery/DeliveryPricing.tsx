import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { formatPriceForInput } from '@/lib/formatPrice';
import { getAlgeriaWilayas, AlgeriaWilaya, formatWilayaLabel } from "@/lib/algeriaGeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, Save, Truck, MapPin, Search, Check, X, 
  DollarSign, Clock, RefreshCw, Upload, Download,
  Home, Building2, ChevronDown, ChevronUp, Settings2
} from "lucide-react";

interface DeliveryPrice {
  id?: number;
  wilaya_id: number;
  wilaya_name?: string;
  delivery_company_id: number | null;
  home_delivery_price: number;
  desk_delivery_price: number | null;
  is_active: boolean;
  estimated_days: number;
  notes: string | null;
}

// Algeria wilayas with their codes
const WILAYAS = getAlgeriaWilayas();

export default function DeliveryPricing() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [prices, setPrices] = useState<Record<number, DeliveryPrice>>({});
  const [defaultPrice, setDefaultPrice] = useState(500);
  const [defaultDeskPrice, setDefaultDeskPrice] = useState<number | null>(400);
  const [defaultDays, setDefaultDays] = useState(3);

  // Initialize prices with defaults for all wilayas
  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery-prices');
      if (res.ok) {
        const data = await res.json();
        const pricesMap: Record<number, DeliveryPrice> = {};
        
        // Initialize all wilayas with defaults
        WILAYAS.forEach(w => {
          pricesMap[w.id] = {
            wilaya_id: w.id,
            wilaya_name: w.name,
            delivery_company_id: null,
            home_delivery_price: defaultPrice,
            desk_delivery_price: defaultDeskPrice,
            is_active: true,
            estimated_days: defaultDays,
            notes: null
          };
        });
        
        // Override with saved prices
        data.prices?.forEach((p: DeliveryPrice) => {
          pricesMap[p.wilaya_id] = { ...pricesMap[p.wilaya_id], ...p };
        });
        
        setPrices(pricesMap);
      }
    } catch (error) {
      console.error('Failed to load delivery prices:', error);
      toast({
        title: t('error') || "Error",
        description: t('delivery.loadError') || "Failed to load delivery prices",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePrice = (wilayaId: number, field: keyof DeliveryPrice, value: any) => {
    setPrices(prev => ({
      ...prev,
      [wilayaId]: { ...prev[wilayaId], [field]: value }
    }));
  };

  const applyDefaultToAll = () => {
    const updated: Record<number, DeliveryPrice> = {};
    WILAYAS.forEach(w => {
      updated[w.id] = {
        ...prices[w.id],
        home_delivery_price: defaultPrice,
        desk_delivery_price: defaultDeskPrice,
        estimated_days: defaultDays
      };
    });
    setPrices(updated);
    toast({
      title: t('success') || "Success",
      description: t('delivery.defaultApplied') || "Default prices applied to all wilayas"
    });
  };

  const saveAllPrices = async () => {
    setSaving(true);
    try {
      const pricesToSave = Object.values(prices).map(p => ({
        wilaya_id: p.wilaya_id,
        home_delivery_price: p.home_delivery_price,
        desk_delivery_price: p.desk_delivery_price,
        is_active: p.is_active,
        estimated_days: p.estimated_days,
        notes: p.notes
      }));

      const res = await fetch('/api/delivery-prices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: pricesToSave })
      });

      if (res.ok) {
        toast({
          title: t('success') || "Success",
          description: t('delivery.pricesSaved') || "Delivery prices saved successfully"
        });
        loadPrices(); // Reload to get IDs
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save delivery prices:', error);
      toast({
        title: t('error') || "Error",
        description: t('delivery.saveError') || "Failed to save delivery prices",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter wilayas by search
  const filteredWilayas = useMemo(() => {
    if (!searchQuery.trim()) return WILAYAS;
    const q = searchQuery.toLowerCase();
    return WILAYAS.filter(w => 
      w.name.toLowerCase().includes(q) || 
      w.code.toString().includes(q) ||
      w.arabic_name?.includes(searchQuery)
    );
  }, [searchQuery]);

  const activeCount = Object.values(prices).filter(p => p.is_active).length;
  const inactiveCount = WILAYAS.length - activeCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Truck className="w-4 h-4" />
            </span>
            {t('delivery.pricingTitle') || 'أسعار التوصيل'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
            {t('delivery.pricingDesc') || 'حدد أسعار التوصيل لكل ولاية — يراها العميل عند الدفع'}
          </p>
        </div>
        <Button
          onClick={saveAllPrices}
          disabled={saving}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white px-3 flex-shrink-0"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{t('delivery.saveAllPrices') || 'حفظ الكل'}</span>
          <span className="sm:hidden">{t('save') || 'حفظ'}</span>
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('delivery.totalWilayas') || 'إجمالي الولايات'}</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">{WILAYAS.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3">
          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{t('delivery.active') || 'مفعّل'}</p>
          <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('delivery.inactive') || 'معطّل'}</p>
          <p className="text-xl font-bold tabular-nums text-muted-foreground mt-0.5">{inactiveCount}</p>
        </div>
      </div>

      {/* ── Default settings card ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <Settings2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{t('delivery.defaultSettings') || 'الإعدادات الافتراضية'}</span>
          <span className="text-xs text-muted-foreground mr-1">{t('delivery.defaultSettingsHint') || '— تطبّق على جميع الولايات دفعة واحدة'}</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Home className="w-3 h-3 text-primary" />
                {t('delivery.homePrice') || 'توصيل للمنزل (د.ج)'}
              </Label>
              <Input
                type="number"
                min={0}
                value={defaultPrice ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = raw === '' ? undefined : Number(raw);
                  setDefaultPrice(typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined);
                }}
                className="h-8 text-sm text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-amber-500" />
                {t('delivery.deskPrice') || 'توصيل للمكتب (د.ج)'}
              </Label>
              <Input
                type="number"
                min={0}
                value={defaultDeskPrice ?? ''}
                onChange={(e) => setDefaultDeskPrice(e.target.value ? Number(e.target.value) : null)}
                placeholder="—"
                className="h-8 text-sm text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {t('delivery.estimatedDays') || 'مدة التوصيل (أيام)'}
              </Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={defaultDays}
                onChange={(e) => setDefaultDays(Number(e.target.value) || 3)}
                className="h-8 text-sm text-center"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={applyDefaultToAll}
                className="w-full h-8 text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('delivery.applyToAll') || 'تطبيق على الكل'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Wilayas table card ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('delivery.searchWilaya') || "بحث عن ولاية..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7 text-xs border-border bg-background focus-visible:ring-1"
            />
          </div>
          <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
            {filteredWilayas.length}/{WILAYAS.length}
          </span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-12">#</th>
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t('delivery.wilaya') || 'الولاية'}</th>
                <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28">
                  <span className="flex items-center justify-center gap-1"><Home className="w-3 h-3" />{t('delivery.home') || 'منزل'}</span>
                </th>
                <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28">
                  <span className="flex items-center justify-center gap-1"><Building2 className="w-3 h-3" />{t('delivery.desk') || 'مكتب'}</span>
                </th>
                <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-24">
                  <span className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{t('delivery.days') || 'أيام'}</span>
                </th>
                <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-20">{t('delivery.active') || 'مفعّل'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredWilayas.map((wilaya) => {
                const price = prices[wilaya.id] || {
                  wilaya_id: wilaya.id,
                  home_delivery_price: defaultPrice,
                  desk_delivery_price: defaultDeskPrice,
                  is_active: true,
                  estimated_days: defaultDays,
                  delivery_company_id: null,
                  notes: null,
                };
                return (
                  <tr key={wilaya.id} className={`group hover:bg-muted/40 transition-colors ${!price.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-[11px] font-mono text-muted-foreground">
                      {String(wilaya.code).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{wilaya.name}</p>
                          {wilaya.arabic_name && (
                            <p className="text-[11px] text-muted-foreground leading-tight">{wilaya.arabic_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={formatPriceForInput(price.home_delivery_price)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === '' ? undefined : Number(raw);
                          updatePrice(wilaya.id, 'home_delivery_price', typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined);
                        }}
                        className="h-7 text-xs text-center w-full"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={formatPriceForInput(price.desk_delivery_price)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === '' ? undefined : Number(raw);
                          updatePrice(wilaya.id, 'desk_delivery_price', typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null);
                        }}
                        placeholder="—"
                        className="h-7 text-xs text-center w-full"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={price.estimated_days}
                        onChange={(e) => updatePrice(wilaya.id, 'estimated_days', Number(e.target.value) || 3)}
                        className="h-7 text-xs text-center w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={price.is_active}
                        onCheckedChange={(checked) => updatePrice(wilaya.id, 'is_active', checked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-border/60">
          {filteredWilayas.map((wilaya) => {
            const price = prices[wilaya.id] || {
              wilaya_id: wilaya.id,
              home_delivery_price: defaultPrice,
              desk_delivery_price: defaultDeskPrice,
              is_active: true,
              estimated_days: defaultDays,
              delivery_company_id: null,
              notes: null,
            };
            return (
              <div key={wilaya.id} className={`px-3 py-3 ${!price.is_active ? 'opacity-50' : ''}`}>
                {/* Row header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {String(wilaya.code).padStart(2, '0')}
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{wilaya.name}</p>
                      {wilaya.arabic_name && (
                        <p className="text-[11px] text-muted-foreground leading-tight">{wilaya.arabic_name}</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={price.is_active}
                    onCheckedChange={(checked) => updatePrice(wilaya.id, 'is_active', checked)}
                  />
                </div>
                {/* Inputs */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                      <Home className="w-3 h-3" /> منزل
                    </p>
                    <Input
                      type="number"
                      min={0}
                      value={formatPriceForInput(price.home_delivery_price)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? undefined : Number(raw);
                        updatePrice(wilaya.id, 'home_delivery_price', typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined);
                      }}
                      className="h-8 text-xs text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                      <Building2 className="w-3 h-3" /> مكتب
                    </p>
                    <Input
                      type="number"
                      min={0}
                      value={formatPriceForInput(price.desk_delivery_price)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? undefined : Number(raw);
                        updatePrice(wilaya.id, 'desk_delivery_price', typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null);
                      }}
                      placeholder="—"
                      className="h-8 text-xs text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> أيام
                    </p>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={price.estimated_days}
                      onChange={(e) => updatePrice(wilaya.id, 'estimated_days', Number(e.target.value) || 3)}
                      className="h-8 text-xs text-center"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
            {' '}{t('delivery.active') || 'مفعّل'} · <span className="font-semibold text-foreground">{WILAYAS.length}</span> {t('delivery.total') || 'إجمالي'}
          </span>
          <Button
            onClick={saveAllPrices}
            disabled={saving}
            size="sm"
            className="h-7 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-white px-3"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {t('delivery.saveAllPrices') || 'حفظ الكل'}
          </Button>
        </div>
      </div>
    </div>
  );
}
