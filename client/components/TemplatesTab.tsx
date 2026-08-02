import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { markOnboardingStepComplete } from '@/lib/onboarding';
import { useTranslation } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Sparkles, Smartphone, ShoppingBag, Palette, Zap, Star, Layout, Crown, Store, Globe, Link as LinkIcon, Image as ImageIcon, Settings } from 'lucide-react';
import { storeNameToSlug } from '@/utils/storeUrl';

function getCsrfToken(): string {
  const m = document.cookie.match(/ecopro_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

interface RealTemplate {
  id: string;
  name: string;
  nameAr: string;
  descAr: string;
  category: 'storefront' | 'landing';
  imageType: 'standard' | 'long' | 'both';
  gradient: string;
  accent: string;
  icon: React.ReactNode;
  image?: string;
  tags: string[];
}

const REAL_TEMPLATES: RealTemplate[] = [
  {
    id: 'dzshop',
    name: 'DZ Shop',
    nameAr: 'متجر DZ',
    descAr: 'قالب جزائري كلاسيكي مع ألوان بنفسجية',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #c4b5fd 100%)',
    accent: '#7c3aed',
    icon: <ShoppingBag className="w-4 h-4" />,
    tags: ['شائع', 'متجر'],
  },
  {
    id: 'needdz',
    name: 'NeedDZ',
    nameAr: 'NeedDZ موبايل',
    descAr: 'تصميم تطبيق موبايل حديث',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #93c5fd 100%)',
    accent: '#2563eb',
    icon: <Smartphone className="w-4 h-4" />,
    tags: ['موبايل', 'شائع'],
  },
  {
    id: 'zenith',
    name: 'Zenith',
    nameAr: 'زينيث',
    descAr: 'تصميم نظيف أبيض وأسود',
    category: 'landing',
    imageType: 'long',
    gradient: 'linear-gradient(135deg, #111827 0%, #374151 50%, #f9fafb 100%)',
    accent: '#111827',
    icon: <Star className="w-4 h-4" />,
    tags: ['هبوط', 'منتج واحد'],
  },
  {
    id: 'boutique',
    name: 'Boutique',
    nameAr: 'بوتيك',
    descAr: 'متجر مجموعات أنيق مع سلة جانبية',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #f59e0b 100%)',
    accent: '#f59e0b',
    icon: <ShoppingBag className="w-4 h-4" />,
    tags: ['متجر', 'مجموعات'],
  },
  {
    id: 'spiriluxe',
    name: 'Spiriluxe',
    nameAr: 'سبيريلوكس',
    descAr: 'صفحة هبوط فاخرة مع عروض',
    category: 'landing',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #581c87 0%, #7c3aed 50%, #a78bfa 100%)',
    accent: '#7c3aed',
    icon: <Sparkles className="w-4 h-4" />,
    tags: ['فاخر', 'عروض'],
  },
  {
    id: 'leroishop',
    name: 'Le Roi Shop',
    nameAr: 'لو روا شوب',
    descAr: 'متجر تقليدي شبكة منتجات 5 أعمدة',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
    accent: '#1e40af',
    icon: <Layout className="w-4 h-4" />,
    tags: ['تقليدي', 'شبكة'],
  },
  {
    id: 'iyco',
    name: 'IYCO',
    nameAr: 'أيكو',
    descAr: 'صفحة هبوط منتج واحد عصري',
    category: 'landing',
    imageType: 'long',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #312e81 50%, #6366f1 100%)',
    accent: '#6366f1',
    icon: <Zap className="w-4 h-4" />,
    tags: ['هبوط', 'عصري'],
  },
  {
    id: 'primo',
    name: 'Primo',
    nameAr: 'بريمو',
    descAr: 'صفحة هبوط منتج واحد أنيقة',
    category: 'landing',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)',
    accent: '#f59e0b',
    icon: <Star className="w-4 h-4" />,
    tags: ['هبوط', 'أنيق'],
  },
];

interface TemplatesTabProps {
  storeSettings: any;
  setStoreSettings: (fn: (s: any) => any) => void;
}

type FilterTab = 'all' | 'storefront' | 'landing';

export function TemplatesTab({ storeSettings, setStoreSettings }: TemplatesTabProps) {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const isRTL = locale === 'ar';

  useEffect(() => {
    markOnboardingStepComplete('templates_opened');
  }, []);

  const [switchOpen, setSwitchOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [switchMode, setSwitchMode] = useState<'defaults' | 'import'>('import');
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({
    hero_text: true,
    hero_media: false,
    accent: true,
  });
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [savingSettings, setSavingSettings] = useState(false);
  const [localName, setLocalName] = useState(storeSettings?.store_name || '');
  const [localSlug, setLocalSlug] = useState(storeSettings?.store_slug || '');
  const [localSubdomain, setLocalSubdomain] = useState(storeSettings?.subdomain || '');
  const [localDescription, setLocalDescription] = useState(storeSettings?.store_description || '');
  const [slugEdited, setSlugEdited] = useState(false);

  const importGroups = [
    {
      id: 'hero_text',
      label: t('templates.importGroup.heroText'),
      keys: ['template_hero_heading', 'template_hero_subtitle', 'template_button_text'],
    },
    {
      id: 'accent',
      label: t('templates.importGroup.accentColor'),
      keys: ['template_accent_color'],
    },
    {
      id: 'hero_media',
      label: t('templates.importGroup.heroImages'),
      keys: ['hero_main_url', 'hero_tile1_url', 'hero_tile2_url', 'store_images'],
    },
  ];

  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'all') return REAL_TEMPLATES;
    return REAL_TEMPLATES.filter((tpl) => tpl.category === activeFilter);
  }, [activeFilter]);

  const computeImportKeys = () => {
    const keys: string[] = [];
    for (const g of importGroups) {
      if (!selectedGroups[g.id]) continue;
      for (const k of g.keys) keys.push(k);
    }
    return Array.from(new Set(keys));
  };

  const normalizeTemplateId = (id: any): string => {
    const raw = String(id || '')
      .trim()
      .toLowerCase()
      .replace(/^gold-/, '')
      .replace(/-gold$/, '');
    if (raw === 'baby' || raw === 'babyos') return 'kids';
    if (raw === 'shiro-hana') return 'pro';
    if (raw === 'simple') return 'minimal';
    if (raw === 'traditional') return 'classic';
    if (raw === 'bold') return 'modern';
    if (!raw) return 'pro';
    return raw;
  };

  const currentTemplateId = normalizeTemplateId(storeSettings?.template);

  const openTemplateSwitch = (templateId: string) => {
    const nextId = normalizeTemplateId(templateId);
    if (currentTemplateId === nextId) return;
    setPendingTemplateId(nextId);
    setSwitchMode('import');
    setSwitchError(null);
    setSwitchOpen(true);
  };

  const applyTemplateSwitch = async () => {
    if (!pendingTemplateId) return;
    setSwitchError(null);
    try {
      setSavingSwitch(true);
      const importKeys = switchMode === 'import' ? computeImportKeys() : [];
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          __templateSwitch: {
            toTemplate: pendingTemplateId,
            mode: switchMode,
            importKeys,
          },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Switch failed (${res.status})`);
      }
      const data = await res.json();
      if (data.template !== pendingTemplateId) {
        console.warn('Template mismatch: expected', pendingTemplateId, 'got', data.template);
      }
      setStoreSettings(() => data);
      setSwitchOpen(false);
      setPendingTemplateId(null);
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
      markOnboardingStepComplete('template_switched');
    } catch (e: any) {
      console.error('Template switch failed:', e);
      setSwitchError(e.message || 'Failed to switch template. Please try again.');
    } finally {
      setSavingSwitch(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          store_name: localName || null,
          store_slug: localSlug || null,
          subdomain: localSubdomain || null,
          store_description: localDescription || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      const data = await res.json();
      setStoreSettings(() => data);
      queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
    } catch (e) {
      console.error('Failed to save store settings:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Switch Template Dialog */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('templates.switchTemplate')}</DialogTitle>
            <DialogDescription>{t('templates.switchTemplateDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="templateSwitchMode" checked={switchMode === 'defaults'} onChange={() => setSwitchMode('defaults')} />
                {t('templates.startFromDefaults')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="templateSwitchMode" checked={switchMode === 'import'} onChange={() => setSwitchMode('import')} />
                {t('templates.importSelected')}
              </label>
            </div>
            {switchMode === 'import' && (
              <div className="space-y-2">
                <div className="text-sm font-medium">{t('templates.importGroups')}</div>
                {importGroups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!selectedGroups[g.id]} onChange={(e) => setSelectedGroups((prev) => ({ ...prev, [g.id]: e.target.checked }))} />
                    {g.label}
                  </label>
                ))}
              </div>
            )}
            {switchError && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md">{switchError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSwitchOpen(false); setPendingTemplateId(null); }} disabled={savingSwitch}>
              {t('templates.cancel')}
            </Button>
            <Button onClick={applyTemplateSwitch} disabled={savingSwitch}>
              {savingSwitch ? t('templates.switching') : t('templates.switch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="text-center space-y-1.5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Palette className="w-4 h-4 text-white" />
          </div>
          {t('templates.chooseTemplate')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {t('templates.chooseTemplateDesc')}
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit mx-auto">
        {([
          { id: 'all' as FilterTab, label: 'الكل', icon: <Globe className="w-3.5 h-3.5" /> },
          { id: 'storefront' as FilterTab, label: 'متجر', icon: <Store className="w-3.5 h-3.5" /> },
          { id: 'landing' as FilterTab, label: 'هبوط', icon: <Zap className="w-3.5 h-3.5" /> },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeFilter === tab.id
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredTemplates.map((tpl) => {
          const isActive = currentTemplateId === tpl.id;
          return (
            <div
              key={tpl.id}
              className={`group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/20 scale-[1.02]'
                  : 'hover:shadow-xl hover:shadow-slate-200 dark:hover:shadow-slate-900/50 hover:-translate-y-1'
              }`}
              onClick={() => openTemplateSwitch(tpl.id)}
            >
              {/* Image */}
              <div className="relative w-full aspect-[4/5] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {tpl.image ? (
                  <img
                    src={tpl.image}
                    alt={tpl.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full transition-transform duration-500 group-hover:scale-110" style={{ background: tpl.gradient }} />
                )}

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />

                {/* Top badges */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                  {isActive ? (
                    <span className="flex items-center gap-1 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                      <Check className="w-3 h-3" />
                      مُفعّل
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="text-[10px] font-semibold bg-white/20 text-white backdrop-blur-md px-2 py-1 rounded-full">
                    {tpl.category === 'landing' ? 'هبوط' : 'متجر'}
                  </span>
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-0 inset-x-0 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-lg"
                      style={{ backgroundColor: tpl.accent }}
                    >
                      {tpl.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-white drop-shadow-lg truncate">{tpl.nameAr}</h4>
                      <p className="text-[11px] text-white/70 leading-tight line-clamp-1">{tpl.descAr}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {tpl.tags.slice(0, 1).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/15 text-white/90 backdrop-blur-sm"
                      >
                        {tag}
                      </span>
                    ))}
                    {!isActive && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 text-[10px] px-3 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border-0 rounded-full ml-auto transition-all duration-200"
                        onClick={(e) => { e.stopPropagation(); openTemplateSwitch(tpl.id); }}
                      >
                        استخدام
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Store Identity Settings */}
      <div className="bg-gradient-to-br from-slate-50 to-purple-50/50 dark:from-slate-800/50 dark:to-purple-900/10 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-white" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{t('templates.settings')}</h4>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Store Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Store className="w-3 h-3" />
              {isRTL ? 'اسم المتجر' : 'Store Name'}
            </Label>
            <Input
              placeholder={isRTL ? 'أدخل اسم المتجر' : 'Enter store name'}
              value={localName}
              onChange={(e) => {
                setLocalName(e.target.value);
                if (!slugEdited) {
                  setLocalSlug(storeNameToSlug(e.target.value));
                }
              }}
              className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          {/* Store Slug */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <LinkIcon className="w-3 h-3" />
              {isRTL ? 'رابط المتجر' : 'Store Slug'}
            </Label>
            <div className="flex items-center h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 overflow-hidden">
              <span className="text-xs text-slate-400 dark:text-slate-500 px-3 whitespace-nowrap border-r border-slate-200 dark:border-slate-600 h-full flex items-center bg-slate-50 dark:bg-slate-800">
                /store/
              </span>
              <Input
                placeholder="my-store"
                value={localSlug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setLocalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                }}
                className="h-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-xs"
              />
            </div>
          </div>

          {/* Subdomain */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              {isRTL ? 'النطاق الفرعي' : 'Subdomain'}
            </Label>
            <div className="flex items-center h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 overflow-hidden">
              <Input
                placeholder={isRTL ? 'متجري' : 'mystore'}
                value={localSubdomain}
                onChange={(e) => setLocalSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="h-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-xs"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 px-3 whitespace-nowrap border-l border-slate-200 dark:border-slate-600 h-full flex items-center bg-slate-50 dark:bg-slate-800">
                .sahla4eco.com
              </span>
            </div>
          </div>

          {/* Store Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3 h-3" />
              {isRTL ? 'وصف المتجر' : 'Store Description'}
            </Label>
            <Input
              placeholder={isRTL ? 'وصف مختصر للمتجر' : 'Short store description'}
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>
        </div>

        {/* URL Preview */}
        {(localSubdomain || localSlug) && (
          <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-3">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              {isRTL ? 'معاينة الرابط' : 'URL Preview'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono truncate">
              {localSubdomain
                ? `https://${localSubdomain}.sahla4eco.com`
                : `${typeof window !== 'undefined' ? window.location.origin : ''}/store/${localSlug || '...'}`
              }
            </p>
          </div>
        )}

        <Button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="w-full h-11 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5"
        >
          {savingSettings ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              جاري الحفظ...
            </span>
          ) : (
            t('common.save') || 'حفظ الإعدادات'
          )}
        </Button>
      </div>
    </div>
  );
}
