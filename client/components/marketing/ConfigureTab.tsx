import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SectionHeader } from './SectionHeader';
import { TabShell } from './TabShell';
import { surfaceCard, surfaceMuted, inputClass, fmtCurrency } from './helpers';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { MkrPackage, MkrDollar, MkrDownload, MkrPlus, MkrTrash, MkrSave, MkrX, MkrUpload, MkrGear } from '@/components/icons/MarketingIcons';
import TikTokIcon from '@/components/icons/TikTokIcon';
import { MkrFacebook } from '@/components/icons/MarketingIcons';

interface ProductEcon {
  id: number; title: string; price: number; category: string | null;
  buy_cost: number; packaging_cost: number; handling_cost: number;
  fallback_shipping_cost: number; notes: string | null;
}

interface SpendEntry {
  id: number; entry_date: string; platform: string;
  product_id: number | null; product_title: string | null;
  campaign_name: string | null; adset_name: string | null;
  creative_name: string | null; creative_key: string | null;
  spend: number; impressions: number; clicks: number;
  link_clicks: number; notes: string | null; created_at: string;
}

interface OmniInputs {
  products: ProductEcon[];
  creativeCatalog: any[];
  spendEntries: SpendEntry[];
  importJobs: any[];
}

interface PixelItem {
  id: string; type: 'facebook' | 'tiktok'; pixel_id: string;
  access_token?: string; enabled: boolean; name?: string;
}

interface PixelSettings {
  pixels?: any[]; is_facebook_enabled?: boolean; is_tiktok_enabled?: boolean;
  facebook_pixel_id?: string | null; tiktok_pixel_id?: string | null;
}

interface ConfigureTabProps {
  inputs?: OmniInputs;
  settings?: PixelSettings;
  onSaveEconomics: (payload: { productId: number; buyCost: number; packagingCost: number; handlingCost: number; fallbackShippingCost: number; notes?: string }) => void;
  onSaveSpend: (payload: { entryDate: string; platform: string; productId?: number; campaignName: string; spend: number; impressions?: number; clicks?: number; notes?: string }) => void;
  onDeleteSpend: (id: number) => void;
  onRunBackfill: (days: number) => void;
  onSaveSettings: (payload: any) => void;
  savingSpend: boolean;
  runningBackfill: boolean;
  savingSettings: boolean;
}

export function ConfigureTab({ inputs, settings, onSaveEconomics, onSaveSpend, onDeleteSpend, onRunBackfill, onSaveSettings, savingSpend, runningBackfill, savingSettings }: ConfigureTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [econDraft, setEconDraft] = useState<Record<string, string>>({});
  const [spendDraft, setSpendDraft] = useState({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', productId: 'all', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
  const [pixels, setPixels] = useState<PixelItem[]>([]);
  const [newPixel, setNewPixel] = useState<Partial<PixelItem>>({ type: 'facebook', pixel_id: '', access_token: '', enabled: true, name: '' });

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

  const handleSaveEconomics = (p: ProductEcon) => {
    onSaveEconomics({
      productId: p.id,
      buyCost: parseFloat(econDraft.buy_cost) || 0,
      packagingCost: parseFloat(econDraft.packaging_cost) || 0,
      handlingCost: parseFloat(econDraft.handling_cost) || 0,
      fallbackShippingCost: parseFloat(econDraft.fallback_shipping_cost) || 0,
    });
    setEditingProduct(null);
  };

  const handleAddSpend = () => {
    if (!spendDraft.entryDate || !spendDraft.spend) return;
    onSaveSpend({
      entryDate: spendDraft.entryDate,
      platform: spendDraft.platform,
      productId: spendDraft.productId !== 'all' ? parseInt(spendDraft.productId) : undefined,
      campaignName: spendDraft.campaignName,
      spend: parseFloat(spendDraft.spend) || 0,
      impressions: parseInt(spendDraft.impressions) || undefined,
      clicks: parseInt(spendDraft.clicks) || undefined,
      notes: spendDraft.notes || undefined,
    });
    setSpendDraft({ entryDate: new Date().toISOString().slice(0, 10), platform: 'facebook', productId: 'all', campaignName: '', spend: '', impressions: '', clicks: '', notes: '' });
  };

  const handleSavePixels = () => {
    const fb = pixels.find(p => p.type === 'facebook' && p.id === 'fb-main');
    const tt = pixels.find(p => p.type === 'tiktok' && p.id === 'tt-main');
    const additional = pixels.filter(p => !p.id.endsWith('-main'));
    onSaveSettings({
      facebook_pixel_id: fb?.pixel_id || null,
      facebook_access_token: fb?.access_token || null,
      is_facebook_enabled: fb?.enabled ?? false,
      tiktok_pixel_id: tt?.pixel_id || null,
      tiktok_access_token: tt?.access_token || null,
      is_tiktok_enabled: tt?.enabled ?? false,
      additional_pixels: additional,
    });
  };

  const handleDownloadCsv = () => {
    if (!inputs?.products) return;
    const products = inputs.products;
    const headers = [t('marketing.inputs.col.product'), t('marketing.inputs.col.sellPrice'), t('marketing.inputs.col.buyCost'), t('marketing.inputs.col.packaging'), t('marketing.inputs.col.handling'), t('marketing.inputs.col.shipping')];
    const rows = products.map((p: ProductEcon) => [
      `"${(p.title || '').replace(/"/g, '""')}"`,
      p.price || 0, p.buy_cost || 0, p.packaging_cost || 0, p.handling_cost || 0, p.fallback_shipping_cost || 0,
    ].join(','));
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <TabShell
      isEmpty={false}
      emptyIcon={<MkrGear className="h-7 w-7" />}
      emptyGradient="from-blue-100 to-indigo-100"
      emptyTitle=""
    >
      <div className="space-y-[9px]">
        {inputs && (
          <>
            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrPackage className="h-[11px] w-[11px]" />} title={t('marketing.inputs.econTitle')} description={t('marketing.inputs.econDesc')} />
              <CardContent className="p-[13px] pt-0">
                {inputs.products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <MkrPackage className="h-5 w-5 text-blue-500 mb-[7px]" />
                    <p className="text-xs font-medium">{t('marketing.inputs.noProducts')}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end mb-[9px]">
                      <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-[5px]" onClick={handleDownloadCsv}>
                        <MkrDownload className="h-[11px] w-[11px]" />
                        {t('marketing.inputs.downloadCsv')}
                      </Button>
                    </div>
                    <div className="overflow-x-auto border border-slate-300 dark:border-slate-600 rounded-lg">
                      <Table className="[&_th]:border [&_th]:border-slate-300 [&_th]:dark:border-slate-600 [&_td]:border [&_td]:border-slate-300 [&_td]:dark:border-slate-600 [&_tr]:border-b-0">
                        <TableHeader>
                          <TableRow className="text-xs uppercase tracking-wider bg-slate-100 dark:bg-slate-800/60">
                            <TableHead>{t('marketing.inputs.col.product')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.sellPrice')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.buyCost')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.packaging')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.handling')}</TableHead>
                            <TableHead className="text-right">{t('marketing.inputs.col.shipping')}</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inputs.products.map((p: ProductEcon) => {
                            const isEditing = editingProduct === p.id;
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs font-medium max-w-[160px] truncate">{p.title}</TableCell>
                                <TableCell className="text-right text-xs">{fmtCurrency(p.price)}</TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.buy_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, buy_cost: e.target.value }))} />
                                  ) : (<span className="text-xs">{fmtCurrency(p.buy_cost)}</span>)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.packaging_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, packaging_cost: e.target.value }))} />
                                  ) : (<span className="text-xs">{fmtCurrency(p.packaging_cost)}</span>)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.handling_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, handling_cost: e.target.value }))} />
                                  ) : (<span className="text-xs">{fmtCurrency(p.handling_cost)}</span>)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <Input className={`${inputClass} w-20 text-right text-xs`} value={econDraft.fallback_shipping_cost ?? ''} onChange={e => setEconDraft(d => ({ ...d, fallback_shipping_cost: e.target.value }))} />
                                  ) : (<span className="text-xs">{fmtCurrency(p.fallback_shipping_cost)}</span>)}
                                </TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <div className="flex gap-[3px]">
                                      <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => handleSaveEconomics(p)}><MkrSave className="h-[11px] w-[11px]" /></Button>
                                      <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setEditingProduct(null)}><MkrX className="h-[11px] w-[11px]" /></Button>
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => {
                                      setEditingProduct(p.id);
                                      setEconDraft({ buy_cost: String(p.buy_cost || ''), packaging_cost: String(p.packaging_cost || ''), handling_cost: String(p.handling_cost || ''), fallback_shipping_cost: String(p.fallback_shipping_cost || '') });
                                    }}>{t('edit')}</Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrDollar className="h-[11px] w-[11px]" />} title={t('marketing.inputs.spendTitle')} description={t('marketing.inputs.spendDesc')} />
              <CardContent className="p-[13px] pt-0 space-y-[9px]">
                <div className={`${surfaceMuted} p-[11px] space-y-[7px]`}>
                  <p className="text-xs font-bold">{t('marketing.inputs.addEntry')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-[7px]">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.date')}</Label>
                      <Input type="date" className={inputClass} value={spendDraft.entryDate} onChange={e => setSpendDraft(d => ({ ...d, entryDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.product')}</Label>
                      <Select value={spendDraft.productId} onValueChange={v => setSpendDraft(d => ({ ...d, productId: v }))}>
                        <SelectTrigger className={inputClass}><SelectValue placeholder={t('marketing.inputs.allProducts')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('marketing.inputs.allProducts')}</SelectItem>
                          {inputs?.products?.map((p: ProductEcon) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.platform')}</Label>
                      <Select value={spendDraft.platform} onValueChange={v => setSpendDraft(d => ({ ...d, platform: v }))}>
                        <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="snapchat">Snapchat</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                          <SelectItem value="other">{t('marketing.platform.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.campaign')}</Label>
                      <Input className={inputClass} placeholder={t('marketing.inputs.campaignPlaceholder')} value={spendDraft.campaignName} onChange={e => setSpendDraft(d => ({ ...d, campaignName: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('marketing.inputs.col.spend')} (DZD)</Label>
                      <Input className={inputClass} type="number" placeholder="0" value={spendDraft.spend} onChange={e => setSpendDraft(d => ({ ...d, spend: e.target.value }))} />
                    </div>
                  </div>
                  <Button size="sm" className="h-9 rounded-xl text-xs" disabled={savingSpend} onClick={handleAddSpend}>
                    {savingSpend ? <span className="h-[11px] w-[11px] animate-spin block border-2 border-current border-t-transparent rounded-full mr-[5px]" /> : <MkrPlus className="h-[11px] w-[11px] mr-[5px]" />}
                    {t('marketing.inputs.addEntry')}
                  </Button>
                </div>

                {inputs.spendEntries.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs uppercase tracking-wider">
                          <TableHead>{t('marketing.inputs.col.date')}</TableHead>
                          <TableHead>{t('marketing.inputs.col.product')}</TableHead>
                          <TableHead>{t('marketing.inputs.col.platform')}</TableHead>
                          <TableHead>{t('marketing.inputs.col.campaign')}</TableHead>
                          <TableHead className="text-right">{t('marketing.inputs.col.spend')}</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inputs.spendEntries.map((entry: SpendEntry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs">{entry.entry_date}</TableCell>
                            <TableCell className="text-xs truncate max-w-[120px]">{entry.product_title || t('marketing.inputs.allProducts')}</TableCell>
                            <TableCell className="text-xs capitalize">{entry.platform}</TableCell>
                            <TableCell className="text-xs truncate max-w-[120px]">{entry.campaign_name || '—'}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{fmtCurrency(entry.spend)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onDeleteSpend(entry.id)}>
                                <MkrTrash className="h-[11px] w-[11px] text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={surfaceCard}>
              <SectionHeader icon={<MkrUpload className="h-[11px] w-[11px]" />} title={t('marketing.inputs.backfillTitle')} description={t('marketing.inputs.backfillDesc')} />
              <CardContent className="p-[13px] pt-0 flex items-center gap-[9px]">
                <Button size="sm" className="h-9 rounded-xl text-xs" disabled={runningBackfill} onClick={() => onRunBackfill(90)}>
                  {runningBackfill ? <span className="h-[11px] w-[11px] animate-spin block border-2 border-current border-t-transparent rounded-full mr-[5px]" /> : <MkrUpload className="h-[11px] w-[11px] mr-[5px]" />}
                  {t('marketing.inputs.backfillBtn')}
                </Button>
                {inputs.importJobs.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t('marketing.inputs.lastImport', { status: inputs.importJobs[0].status, rows: String(inputs.importJobs[0].processed_rows ?? 0) })}
                  </span>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {settings !== undefined && (
          <Card className={surfaceCard}>
            <SectionHeader icon={<MkrGear className="h-[11px] w-[11px]" />} title={t('marketing.settings.title')} description={t('marketing.settings.desc')} />
            <CardContent className="p-[13px] pt-0 space-y-[11px]">
              {pixels.length > 0 && (
                <div className="space-y-[7px]">
                  {pixels.map(px => (
                    <div key={px.id} className={`${surfaceMuted} p-[11px] flex items-center gap-[9px]`}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm flex-shrink-0" style={{ background: px.type === 'facebook' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
                        {px.type === 'facebook' ? <MkrFacebook className="h-[11px] w-[11px] text-white" /> : <TikTokIcon className="h-[11px] w-[11px] text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{px.name || `${px.type} Pixel`}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{px.pixel_id}</p>
                      </div>
                      <Switch checked={px.enabled} onCheckedChange={v => setPixels(prev => prev.map(p => p.id === px.id ? { ...p, enabled: v } : p))} />
                      {!px.id.endsWith('-main') && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPixels(prev => prev.filter(p => p.id !== px.id))}>
                          <MkrTrash className="h-[11px] w-[11px] text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className={`${surfaceMuted} p-[11px] space-y-[7px]`}>
                <p className="text-xs font-bold">{t('marketing.settings.addPixel')}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-[7px]">
                  <Select value={newPixel.type || 'facebook'} onValueChange={v => setNewPixel(d => ({ ...d, type: v as 'facebook' | 'tiktok' }))}>
                    <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className={inputClass} placeholder={t('marketing.settings.pixelId')} value={newPixel.pixel_id || ''} onChange={e => setNewPixel(d => ({ ...d, pixel_id: e.target.value }))} />
                  <Input className={inputClass} placeholder={t('marketing.settings.accessToken')} value={newPixel.access_token || ''} onChange={e => setNewPixel(d => ({ ...d, access_token: e.target.value }))} />
                  <Input className={inputClass} placeholder={t('marketing.settings.pixelName')} value={newPixel.name || ''} onChange={e => setNewPixel(d => ({ ...d, name: e.target.value }))} />
                </div>
                <Button size="sm" className="h-9 rounded-xl text-xs" onClick={handleAddPixel}>
                  <MkrPlus className="h-[11px] w-[11px] mr-[5px]" /> {t('marketing.settings.addPixel')}
                </Button>
              </div>

              <Button className="h-10 rounded-xl w-full text-sm" disabled={savingSettings} onClick={handleSavePixels}>
                {savingSettings ? <span className="h-4 w-4 animate-spin block border-2 border-current border-t-transparent rounded-full mr-[7px]" /> : <MkrSave className="h-4 w-4 mr-[7px]" />}
                {t('marketing.settings.save')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </TabShell>
  );
}
