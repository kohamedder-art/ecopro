import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { MkrFacebook, MkrPlus, MkrTrash } from '@/components/icons/MarketingIcons';
import TikTokIcon from '@/components/icons/TikTokIcon';
import { Save, Plus, Trash2, RefreshCw } from 'lucide-react';

interface PixelItem {
  id: string; type: 'facebook' | 'tiktok'; pixel_id: string;
  access_token?: string; enabled: boolean; name?: string;
}

const inputCls = "w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all rtl:text-right";

function PixelCard({ px, onToggle, onDelete }: { px: PixelItem; onToggle: (id: string, v: boolean) => void; onDelete: (id: string) => void }) {
  return (
    <div className="bg-muted/30 rounded-xl border border-border/60 p-3 flex items-center gap-3 hover:border-primary/30 transition-all">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-sm"
        style={{ background: px.type === 'facebook' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
        {px.type === 'facebook' ? <MkrFacebook className="h-4 w-4 text-white" /> : <TikTokIcon className="h-4 w-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-foreground truncate">{px.name || `${px.type} Pixel`}</p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            px.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${px.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            {px.enabled ? 'نشط' : 'غير نشط'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{px.pixel_id}</p>
      </div>
      <Switch checked={px.enabled} onCheckedChange={v => onToggle(px.id, v)} />
      <button onClick={() => onDelete(px.id)}
        className="h-8 w-8 rounded-lg bg-muted text-red-400 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function PixelSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pixels, setPixels] = useState<PixelItem[]>([]);
  const [newPixel, setNewPixel] = useState<Partial<PixelItem>>({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['pixel-settings'],
    queryFn: () => apiFetch<any>('/api/pixels/settings'),
  });

  useEffect(() => {
    if (settings) {
      const loaded: PixelItem[] = [];
      if (settings.facebook_pixel_id) {
        loaded.push({ id: 'fb-main', type: 'facebook', pixel_id: settings.facebook_pixel_id, access_token: settings.facebook_access_token || '', enabled: settings.is_facebook_enabled || false, name: 'فيسبوك الرئيسي' });
      }
      if (settings.tiktok_pixel_id) {
        loaded.push({ id: 'tt-main', type: 'tiktok', pixel_id: settings.tiktok_pixel_id, access_token: settings.tiktok_access_token || '', enabled: settings.is_tiktok_enabled || false, name: 'تيك توك الرئيسي' });
      }
      if (settings.additional_pixels) loaded.push(...settings.additional_pixels);
      setPixels(loaded);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/settings', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixel-settings'] });
      toast({ title: 'تم حفظ الإعدادات' });
    },
    onError: () => toast({ title: 'خطأ في الحفظ', variant: 'destructive' }),
  });

  const buildPayload = (items: PixelItem[]) => {
    let mainFb: PixelItem | null = null;
    let mainTt: PixelItem | null = null;
    const additional: PixelItem[] = [];
    for (const px of items) {
      if (px.type === 'facebook') { if (!mainFb) mainFb = px; else additional.push(px); }
      else if (px.type === 'tiktok') { if (!mainTt) mainTt = px; else additional.push(px); }
    }
    return {
      facebook_pixel_id: mainFb?.pixel_id || null,
      facebook_access_token: mainFb?.access_token || null,
      is_facebook_enabled: mainFb?.enabled ?? false,
      tiktok_pixel_id: mainTt?.pixel_id || null,
      tiktok_access_token: mainTt?.access_token || null,
      is_tiktok_enabled: mainTt?.enabled ?? false,
      additional_pixels: additional,
    };
  };

  const handleDeletePixel = (id: string) => {
    if (saveSettings.isPending) return;
    const remaining = pixels.filter(p => p.id !== id);
    setPixels(remaining);
    saveSettings.mutate(buildPayload(remaining));
  };

  const handleAddPixel = () => {
    if (!newPixel.pixel_id?.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال معرف البكسل', variant: 'destructive' });
      return;
    }
    setPixels(prev => [...prev, {
      id: `${newPixel.type}-${Date.now()}`,
      type: (newPixel.type || 'facebook') as 'facebook' | 'tiktok',
      pixel_id: newPixel.pixel_id!.trim(),
      access_token: newPixel.access_token?.trim() || '',
      enabled: true,
      name: newPixel.name?.trim() || `${newPixel.type === 'tiktok' ? 'TikTok' : 'Facebook'} Pixel ${prev.filter(p => p.type === newPixel.type).length + 1}`,
    }]);
    setNewPixel({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });
  };

  const handleSavePixels = () => saveSettings.mutate(buildPayload(pixels));

  const activeCount = pixels.filter(p => p.enabled).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin border-[3px] border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">جاري التحميل...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-3 sm:px-5 lg:px-6 py-4 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <span className="text-white text-lg">📡</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
              إعدادات البكسل
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">ربط فيسبوك بكسل وتيك توك بكسل لمتجرك</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/40 border border-border/40 rounded-lg px-2.5 py-1.5">
            <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
            <span className="text-xs font-bold text-foreground tabular-nums">{activeCount}/{pixels.length}</span>
            <span className="text-[10px] text-muted-foreground">نشط</span>
          </div>
          <button onClick={handleSavePixels} disabled={saveSettings.isPending}
            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5">
            {saveSettings.isPending ? (
              <span className="h-3.5 w-3.5 animate-spin border-[2px] border-current border-t-transparent rounded-full" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            حفظ
          </button>
        </div>
      </div>

      {/* Pixels List */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" />
          <span className="text-sm font-bold text-foreground">البكسلات المضافة</span>
        </div>
        {pixels.length > 0 ? (
          <div className="space-y-2">
            {pixels.map(px => (
              <PixelCard
                key={px.id} px={px}
                onToggle={(id, v) => {
                  setPixels(prev => {
                    const next = prev.map(p => p.id === id ? { ...p, enabled: v } : p);
                    saveSettings.mutate(buildPayload(next));
                    return next;
                  });
                }}
                onDelete={handleDeletePixel}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">لا توجد بكسلات بعد</p>
            <p className="text-xs text-muted-foreground max-w-xs">أضف بكسل فيسبوك أو تيك توك لتتبع الطلبات والإعلانات</p>
          </div>
        )}
      </div>

      {/* Add New Pixel */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-block w-1 h-4 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
          <span className="text-sm font-bold text-foreground">إضافة بكسل جديد</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground mb-1 block">المنصة</label>
            <Select value={newPixel.type || 'facebook'} onValueChange={v => setNewPixel(d => ({ ...d, type: v as 'facebook' | 'tiktok' }))}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">
                  <span className="flex items-center gap-2"><MkrFacebook className="h-3 w-3" /> فيسبوك</span>
                </SelectItem>
                <SelectItem value="tiktok">
                  <span className="flex items-center gap-2"><TikTokIcon className="h-3 w-3" /> تيك توك</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground mb-1 block">معرف البكسل</label>
            <input className={inputCls} placeholder="مثال: 1234567890" value={newPixel.pixel_id || ''} onChange={e => setNewPixel(d => ({ ...d, pixel_id: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground mb-1 block">رمز الوصول</label>
            <input className={inputCls} placeholder="اختياري" value={newPixel.access_token || ''} onChange={e => setNewPixel(d => ({ ...d, access_token: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground mb-1 block">الاسم</label>
            <input className={inputCls} placeholder="اختياري" value={newPixel.name || ''} onChange={e => setNewPixel(d => ({ ...d, name: e.target.value }))} />
          </div>
        </div>
        <button onClick={handleAddPixel}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
          <Plus className="w-3.5 h-3.5" />
          إضافة بكسل
        </button>
      </div>
    </div>
  );
}
