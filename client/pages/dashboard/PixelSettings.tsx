import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { MkrFacebook, MkrSave, MkrPlus, MkrTrash } from '@/components/icons/MarketingIcons';
import TikTokIcon from '@/components/icons/TikTokIcon';
import { surfaceMuted, inputClass } from '@/components/marketing/helpers';

interface PixelItem {
  id: string; type: 'facebook' | 'tiktok'; pixel_id: string;
  access_token?: string; enabled: boolean; name?: string;
}

interface PixelSettingsData {
  pixels?: any[]; is_facebook_enabled?: boolean; is_tiktok_enabled?: boolean;
  facebook_pixel_id?: string | null; tiktok_pixel_id?: string | null;
}

function PixelCard({ px, onToggle, onDelete, t }: { px: PixelItem; onToggle: (id: string, v: boolean) => void; onDelete: (id: string) => void; t: (key: string) => string }) {
  return (
    <div className={`${surfaceMuted} p-3 flex items-center gap-3 transition-all hover:shadow-sm`}>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm flex-shrink-0"
        style={{ background: px.type === 'facebook' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
      >
        {px.type === 'facebook' ? <MkrFacebook className="h-4 w-4 text-white" /> : <TikTokIcon className="h-4 w-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold truncate">{px.name || `${px.type} Pixel`}</p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${px.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-300/50 text-slate-500 dark:text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${px.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {px.enabled ? t('pixels.active') : t('pixels.inactive')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">{px.pixel_id}</p>
      </div>
      <Switch checked={px.enabled} onCheckedChange={v => onToggle(px.id, v)} />
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onDelete(px.id)}>
        <MkrTrash className="h-3.5 w-3.5 text-red-400 hover:text-red-600 transition-colors" />
      </Button>
    </div>
  );
}

export default function PixelSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pixels, setPixels] = useState<PixelItem[]>([]);
  const [newPixel, setNewPixel] = useState<Partial<PixelItem>>({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });

  const { data: settings, isLoading } = useQuery<PixelSettingsData>({
    queryKey: ['pixel-settings'],
    queryFn: () => apiFetch<PixelSettingsData>('/api/pixels/settings'),
  });

  useEffect(() => {
    if (settings) {
      const loaded: PixelItem[] = [];
      if (settings.facebook_pixel_id) {
        loaded.push({ id: 'fb-main', type: 'facebook', pixel_id: settings.facebook_pixel_id, access_token: (settings as any).facebook_access_token || '', enabled: settings.is_facebook_enabled || false, name: t('pixels.mainFacebookPixel') });
      }
      if (settings.tiktok_pixel_id) {
        loaded.push({ id: 'tt-main', type: 'tiktok', pixel_id: settings.tiktok_pixel_id, access_token: (settings as any).tiktok_access_token || '', enabled: settings.is_tiktok_enabled || false, name: t('pixels.mainTiktokPixel') });
      }
      if ((settings as any).additional_pixels) loaded.push(...(settings as any).additional_pixels);
      setPixels(loaded);
    }
  }, [settings, t]);

  const saveSettings = useMutation({
    mutationFn: (payload: any) => apiFetch('/api/pixels/settings', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pixel-settings'] });
      toast({ title: t('marketing.toast.settingsSaved') });
    },
    onError: () => toast({ title: t('marketing.toast.error'), description: t('marketing.toast.settingsFailed'), variant: 'destructive' }),
  });

  const handleAddPixel = () => {
    if (!newPixel.pixel_id?.trim()) {
      toast({ title: t('marketing.toast.error'), description: t('marketing.toast.enterPixelId'), variant: 'destructive' });
      return;
    }
    setPixels(prev => [...prev, {
      id: `${newPixel.type}-${Date.now()}`,
      type: (newPixel.type || 'facebook') as 'facebook' | 'tiktok',
      pixel_id: newPixel.pixel_id!.trim(),
      access_token: newPixel.access_token?.trim() || '',
      enabled: true,
      name: newPixel.name?.trim() || `${newPixel.type === 'tiktok' ? 'TikTok' : 'Facebook'} Pixel ${pixels.filter(p => p.type === newPixel.type).length + 1}`,
    }]);
    setNewPixel({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });
  };

  const handleSavePixels = () => {
    let mainFb: PixelItem | null = null;
    let mainTt: PixelItem | null = null;
    const additional: PixelItem[] = [];

    for (const px of pixels) {
      if (px.type === 'facebook') {
        if (!mainFb) mainFb = px;
        else additional.push(px);
      } else if (px.type === 'tiktok') {
        if (!mainTt) mainTt = px;
        else additional.push(px);
      }
    }

    saveSettings.mutate({
      facebook_pixel_id: mainFb?.pixel_id || null,
      facebook_access_token: mainFb?.access_token || null,
      is_facebook_enabled: mainFb?.enabled ?? false,
      tiktok_pixel_id: mainTt?.pixel_id || null,
      tiktok_access_token: mainTt?.access_token || null,
      is_tiktok_enabled: mainTt?.enabled ?? false,
      additional_pixels: additional,
    });
  };

  const activeCount = pixels.filter(p => p.enabled).length;

  return (
    <div className="space-y-4 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <MkrSave className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-foreground">{t('marketing.settings.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('marketing.settings.desc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-foreground">{activeCount}/{pixels.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{t('pixels.active').toLowerCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-5 space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 space-y-4">
            {pixels.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-foreground">{t('pixels.yourPixels')}</h2>
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{pixels.length} {t('pixels.total')}</span>
                </div>
                <div className="space-y-2">
                  {pixels.map(px => (
                    <PixelCard
                      key={px.id}
                      px={px}
                      t={t}
                      onToggle={(id, v) => setPixels(prev => prev.map(p => p.id === id ? { ...p, enabled: v } : p))}
                      onDelete={(id) => setPixels(prev => prev.filter(p => p.id !== id))}
                    />
                  ))}
                </div>
              </div>
            )}

            {pixels.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-4">
                  <MkrPlus className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-sm font-bold text-foreground mb-1">{t('pixels.noPixelsYet')}</p>
                <p className="text-xs text-muted-foreground max-w-xs">{t('pixels.addFirstPixelDesc')}</p>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <h2 className="text-sm font-bold text-foreground mb-3">{t('marketing.settings.addPixel')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{t('pixels.platform')}</label>
                  <Select value={newPixel.type || 'facebook'} onValueChange={v => setNewPixel(d => ({ ...d, type: v as 'facebook' | 'tiktok' }))}>
                    <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">
                        <span className="flex items-center gap-2"><MkrFacebook className="h-3 w-3" /> {t('pixels.facebook')}</span>
                      </SelectItem>
                      <SelectItem value="tiktok">
                        <span className="flex items-center gap-2"><TikTokIcon className="h-3 w-3" /> {t('pixels.tiktok')}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{t('pixels.pixelId')}</label>
                  <Input className={inputClass} placeholder={t('marketing.settings.pixelId')} value={newPixel.pixel_id || ''} onChange={e => setNewPixel(d => ({ ...d, pixel_id: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{t('pixels.accessToken')}</label>
                  <Input className={inputClass} placeholder={t('marketing.settings.accessToken')} value={newPixel.access_token || ''} onChange={e => setNewPixel(d => ({ ...d, access_token: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{t('pixels.pixelName')}</label>
                  <Input className={inputClass} placeholder={t('marketing.settings.pixelName')} value={newPixel.name || ''} onChange={e => setNewPixel(d => ({ ...d, name: e.target.value }))} />
                </div>
              </div>
              <Button size="sm" className="h-9 rounded-xl text-xs font-bold" onClick={handleAddPixel}>
                <MkrPlus className="h-3.5 w-3.5 mr-1.5" /> {t('marketing.settings.addPixel')}
              </Button>
            </div>

            {pixels.length > 0 && (
              <div className="border-t border-border pt-4">
                <Button className="h-11 rounded-xl w-full text-sm font-bold" disabled={saveSettings.isPending} onClick={handleSavePixels}>
                  {saveSettings.isPending ? (
                    <span className="h-4 w-4 animate-spin block border-2 border-current border-t-transparent rounded-full mr-2" />
                  ) : (
                    <MkrSave className="h-4 w-4 mr-2" />
                  )}
                  {t('marketing.settings.save')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
