import { useState, useEffect } from 'react';
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
import { Check, Sparkles, Smartphone, ShoppingBag, Palette, Zap, Star, Layout, ImageIcon, Crown } from 'lucide-react';

function getCsrfToken(): string {
  const m = document.cookie.match(/ecopro_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* ─── 7 real production templates ─── */
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
  tags: string[];
}

// NOTE: Disabled templates (files kept but not selectable):
// dzpremium, minimalist, aurora, sculptor, artisan, gallery, jewelheart, classicshop, vera, luxedrop, streetwear, novadz, lumina

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
  // NOTE: luxedrop disabled - see index.tsx
  // {
  //   id: 'luxedrop',
  //   name: 'Luxe Drop',
  //   nameAr: 'لوكس دروب',
  //   descAr: 'تصميم داكن أنيق — عرض منتجات فاخرة',
  //   category: 'landing',
  //   imageType: 'standard',
  //   gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #6366f1 100%)',
  //   accent: '#6366f1',
  //   icon: <Star className="w-4 h-4" />,
  //   tags: ['داكن', 'فاخر'],
  // },
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
  // NOTE: novadz, lumina, luxedrop, streetwear disabled - see index.tsx
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
  // NOTE: streetwear disabled - see index.tsx
  // {
  //   id: 'streetwear',
  //   name: 'Streetwear',
  //   nameAr: 'ستريت وير',
  //   descAr: 'متجر ملابس داكن مع اختيار مقاسات',
  //   category: 'storefront',
  //   imageType: 'standard',
  //   gradient: 'linear-gradient(135deg, #080808 0%, #111 50%, #D4AF37 100%)',
  //   accent: '#D4AF37',
  //   icon: <ShoppingBag className="w-4 h-4" />,
  //   tags: ['داكن', 'مقاسات'],
  // },

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
    id: 'bassem28',
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

export function TemplatesTab({ storeSettings, setStoreSettings }: TemplatesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-4">
      {/* Switch Template Dialog */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent>
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
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" />
          {t('templates.chooseTemplate')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('templates.chooseTemplateDesc')}</p>
      </div>

      {/* Template Grid - Compact 4-column layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {REAL_TEMPLATES.map((tpl) => {
          const isActive = currentTemplateId === tpl.id;
          return (
            <div
              key={tpl.id}
              className={`group relative rounded-xl border-2 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${
                isActive
                  ? 'border-purple-500 shadow-md shadow-purple-500/20 ring-1 ring-purple-400'
                  : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600'
              }`}
              onClick={() => openTemplateSwitch(tpl.id)}
            >
              {/* Gradient preview swatch - smaller */}
              <div
                className="h-16 w-full relative overflow-hidden"
                style={{ background: tpl.gradient }}
              >
                {/* Mini phone mockup - smaller */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-14 rounded-md bg-white/20 backdrop-blur-sm border border-white/30 shadow flex flex-col items-center justify-center gap-0.5 p-1">
                    <div className="w-full h-1 rounded-full bg-white/40" />
                    <div className="w-2/3 h-0.5 rounded-full bg-white/25" />
                    <div className="flex gap-0.5 mt-0.5">
                      <div className="w-2 h-2 rounded-[2px] bg-white/30" />
                      <div className="w-2 h-2 rounded-[2px] bg-white/30" />
                    </div>
                  </div>
                </div>
                {/* Active badge - smaller */}
                {isActive && (
                  <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                    <Check className="w-2.5 h-2.5" />
                    مُفعّل
                  </div>
                )}
                {/* Category badge - smaller */}
                <div className="absolute top-1 right-1 text-[9px] font-medium bg-black/30 text-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                  {tpl.category === 'landing' ? 'هبوط' : 'متجر'}
                </div>
              </div>

              {/* Card body - compact */}
              <div className="p-2 bg-white dark:bg-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: tpl.accent }}
                  >
                    {tpl.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{tpl.nameAr}</h4>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight line-clamp-1">{tpl.descAr}</p>
                <div className="flex flex-wrap gap-0.5">
                  {tpl.tags.slice(0, 1).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${tpl.accent}15`, color: tpl.accent }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {!isActive && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full mt-0.5 h-6 text-[10px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg"
                    onClick={(e) => { e.stopPropagation(); openTemplateSwitch(tpl.id); }}
                  >
                    استخدام
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Template Customization */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-500" />
          {t('templates.settings')}
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('templates.heroHeadingLabel')}</Label>
            <Input
              placeholder={t('templates.heroHeadingPlaceholder')}
              value={storeSettings.template_hero_heading || ''}
              onChange={(e) => setStoreSettings((s: any) => ({ ...s, template_hero_heading: e.target.value }))}
              className="mt-1.5 h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600"
            />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('templates.heroSubtitleLabel')}</Label>
            <Input
              placeholder={t('templates.heroSubtitlePlaceholder')}
              value={storeSettings.template_hero_subtitle || ''}
              onChange={(e) => setStoreSettings((s: any) => ({ ...s, template_hero_subtitle: e.target.value }))}
              className="mt-1.5 h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600"
            />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('templates.buttonTextLabel')}</Label>
            <Input
              placeholder={t('templates.buttonTextPlaceholder')}
              value={storeSettings.template_button_text || ''}
              onChange={(e) => setStoreSettings((s: any) => ({ ...s, template_button_text: e.target.value }))}
              className="mt-1.5 h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600"
            />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('templates.accentColorLabel')}</Label>
            <div className="flex gap-2 mt-1.5">
              <input
                type="color"
                value={storeSettings.template_accent_color || '#000000'}
                onChange={(e) => setStoreSettings((s: any) => ({ ...s, template_accent_color: e.target.value }))}
                className="h-9 w-14 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer"
              />
              <Input
                type="text"
                value={storeSettings.template_accent_color || '#000000'}
                onChange={(e) => setStoreSettings((s: any) => ({ ...s, template_accent_color: e.target.value }))}
                className="flex-1 h-9 font-mono text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
