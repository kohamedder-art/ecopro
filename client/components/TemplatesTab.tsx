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

const REAL_TEMPLATES: RealTemplate[] = [
  {
    id: 'dzshop',
    name: 'DZ Shop',
    nameAr: 'متجر DZ',
    descAr: 'قالب جزائري كلاسيكي مع ألوان بنفسجية — مثالي للمتاجر العامة',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #c4b5fd 100%)',
    accent: '#7c3aed',
    icon: <ShoppingBag className="w-5 h-5" />,
    tags: ['شائع', 'متجر عام'],
  },
  {
    id: 'dzpremium',
    name: 'DZ Premium',
    nameAr: 'DZ بريميوم',
    descAr: 'تصميم أخضر سريع — مبيعات وتحويل عالي',
    category: 'landing',
    imageType: 'both',
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 50%, #6ee7b7 100%)',
    accent: '#059669',
    icon: <Zap className="w-5 h-5" />,
    tags: ['تحويل عالي', 'صفحة هبوط'],
  },
  {
    id: 'luxedrop',
    name: 'Luxe Drop',
    nameAr: 'لوكس دروب',
    descAr: 'تصميم داكن أنيق — عرض منتجات فاخرة',
    category: 'landing',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #6366f1 100%)',
    accent: '#6366f1',
    icon: <Star className="w-5 h-5" />,
    tags: ['داكن', 'فاخر'],
  },

  {
    id: 'needdz',
    name: 'NeedDZ',
    nameAr: 'NeedDZ موبايل',
    descAr: 'تصميم تطبيق موبايل — يشبه التطبيقات الحديثة',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #93c5fd 100%)',
    accent: '#2563eb',
    icon: <Smartphone className="w-5 h-5" />,
    tags: ['موبايل', 'شائع'],
  },
  {
    id: 'novadz',
    name: 'Nova DZ',
    nameAr: 'نوفا DZ',
    descAr: 'قالب عصري مع تحويل مرتفع — الأكثر مبيعاً',
    category: 'landing',
    imageType: 'long',
    gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fdba74 100%)',
    accent: '#f97316',
    icon: <Zap className="w-5 h-5" />,
    tags: ['الأكثر مبيعاً', 'عصري'],
  },
  {
    id: 'minimalist',
    name: "L'Atelier",
    nameAr: 'لاتيليي (مينيمال)',
    descAr: 'تصميم نظيف بسيط — للبوتيكات والحرفيين',
    category: 'storefront',
    imageType: 'long',
    gradient: 'linear-gradient(135deg, #fafaf9 0%, #e7e5e4 50%, #78716c 100%)',
    accent: '#78716c',
    icon: <Layout className="w-5 h-5" />,
    tags: ['بسيط', 'بوتيك'],
  },
  {
    id: 'lumina',
    name: 'Lumina',
    nameAr: 'لومينا',
    descAr: 'صفحة هبوط منتج واحد — صور كبيرة وطلب سريع',
    category: 'landing',
    imageType: 'long',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #e11d48 100%)',
    accent: '#e11d48',
    icon: <Star className="w-5 h-5" />,
    tags: ['صفحة هبوط', 'منتج واحد'],
  },
  {
    id: 'zenith',
    name: 'Zenith',
    nameAr: 'زينيث',
    descAr: 'تصميم نظيف أبيض وأسود — صور طويلة كاملة وطلب مباشر',
    category: 'landing',
    imageType: 'long',
    gradient: 'linear-gradient(135deg, #111827 0%, #374151 50%, #f9fafb 100%)',
    accent: '#111827',
    icon: <Star className="w-5 h-5" />,
    tags: ['صفحة هبوط', 'منتج واحد'],
  },
  {
    id: 'boutique',
    name: 'Boutique',
    nameAr: 'بوتيك',
    descAr: 'متجر مجموعات أنيق — بطل + شبكة منتجات + سلة جانبية',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #f59e0b 100%)',
    accent: '#f59e0b',
    icon: <ShoppingBag className="w-5 h-5" />,
    tags: ['متجر', 'مجموعات'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    nameAr: 'أورورا',
    descAr: 'متجر فاخر داكن — بطاقات زجاجية وتصميم ذهبي عصري',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #080808 0%, #121212 50%, #E2B872 100%)',
    accent: '#E2B872',
    icon: <Crown className="w-5 h-5" />,
    tags: ['فاخر', 'داكن'],
  },
  {
    id: 'sculptor',
    name: 'Sculptor',
    nameAr: 'سكلبتور',
    descAr: 'عرض منتج واحد فاخر — معرض صور أفقي وتصميم ذهبي داكن',
    category: 'landing',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #0A0A0A 0%, #1a1a1a 50%, #D4AF37 100%)',
    accent: '#D4AF37',
    icon: <Star className="w-5 h-5" />,
    tags: ['فاخر', 'منتج واحد'],
  },
  {
    id: 'artisan',
    name: 'Artisan',
    nameAr: 'نسيج',
    descAr: 'متجر أنيق بطابع ترابي دافئ — سلة مشتريات ودفع سلس',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #fdfaf6 0%, #d4a574 50%, #7c4a32 100%)',
    accent: '#7c4a32',
    icon: <Sparkles className="w-5 h-5" />,
    tags: ['ترابي', 'متعدد المنتجات'],
  },
  {
    id: 'vera',
    name: 'Véra',
    nameAr: 'فيرا',
    descAr: 'واجهة سينمائية فاخرة — شبكة بينتو ونظام طلب أنيق',
    category: 'landing',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #d4af37 100%)',
    accent: '#d4af37',
    icon: <Crown className="w-5 h-5" />,
    tags: ['فاخر', 'سينمائي'],
  },
  {
    id: 'streetwear',
    name: 'Streetwear',
    nameAr: 'ستريت وير',
    descAr: 'متجر ملابس داكن مع اختيار مقاسات وسلة مشتريات جانبية',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #080808 0%, #111 50%, #D4AF37 100%)',
    accent: '#D4AF37',
    icon: <ShoppingBag className="w-5 h-5" />,
    tags: ['داكن', 'مقاسات'],
  },
  {
    id: 'gallery',
    name: 'Gallery',
    nameAr: 'غاليري',
    descAr: 'شبكة منتجات خفيفة مع شراء سريع وسلة ملتصقة بالأسفل',
    category: 'storefront',
    imageType: 'standard',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #facc15 100%)',
    accent: '#facc15',
    icon: <Layout className="w-5 h-5" />,
    tags: ['خفيف', 'شبكة'],
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

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REAL_TEMPLATES.map((tpl) => {
          const isActive = currentTemplateId === tpl.id;
          return (
            <div
              key={tpl.id}
              className={`group relative rounded-[20px] border-2 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] ${
                isActive
                  ? 'border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-400'
                  : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600'
              }`}
              onClick={() => openTemplateSwitch(tpl.id)}
            >
              {/* Gradient preview swatch */}
              <div
                className="h-28 w-full relative overflow-hidden"
                style={{ background: tpl.gradient }}
              >
                {/* Mini phone mockup inside the gradient */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-20 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg flex flex-col items-center justify-center gap-1 p-1.5">
                    <div className="w-full h-1.5 rounded-full bg-white/40" />
                    <div className="w-3/4 h-1 rounded-full bg-white/25" />
                    <div className="flex gap-0.5 mt-1">
                      <div className="w-3 h-3 rounded-[3px] bg-white/30" />
                      <div className="w-3 h-3 rounded-[3px] bg-white/30" />
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-[3px] bg-white/30" />
                      <div className="w-3 h-3 rounded-[3px] bg-white/30" />
                    </div>
                  </div>
                </div>
                {/* Active badge */}
                {isActive && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                    <Check className="w-3 h-3" />
                    مُفعّل
                  </div>
                )}
                {/* Category badge */}
                <div className="absolute top-2 right-2 text-[10px] font-medium bg-black/30 text-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  {tpl.category === 'landing' ? 'صفحة هبوط' : 'متجر'}
                </div>
                {/* Image type badge */}
                <div className={`absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-medium backdrop-blur-sm px-2 py-0.5 rounded-full ${
                  tpl.imageType === 'long'
                    ? 'bg-amber-500/30 text-amber-100'
                    : tpl.imageType === 'both'
                    ? 'bg-emerald-500/30 text-emerald-100'
                    : 'bg-white/20 text-white/80'
                }`}>
                  <ImageIcon className="w-3 h-3" />
                  {tpl.imageType === 'long' ? 'صور طويلة' : tpl.imageType === 'both' ? 'عادية + طويلة' : 'صور عادية'}
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 bg-white dark:bg-slate-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: tpl.accent }}
                  >
                    {tpl.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{tpl.nameAr}</h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{tpl.name}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{tpl.descAr}</p>
                <div className="flex flex-wrap gap-1">
                  {tpl.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
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
                    className="w-full mt-1 h-8 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl"
                    onClick={(e) => { e.stopPropagation(); openTemplateSwitch(tpl.id); }}
                  >
                    {t('templates.useThisTemplate') || 'استخدام هذا القالب'}
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
