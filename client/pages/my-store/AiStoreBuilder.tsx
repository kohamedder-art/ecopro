import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Check, Code, Sparkles, Loader2, Smartphone, Palette, ShoppingBag } from 'lucide-react';
import StoreBuilderChat from '@/components/chat/StoreBuilderChat';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { RenderStorefront } from '@/pages/storefront/templates/index';
import type { TemplateProps } from '@/pages/storefront/templates/types';

type Step = 'chat' | 'preview' | 'done';

export type GeneratedTemplate = {
  templateId: string;
  storeName: string;
  description: string;
  settings: {
    storeName: string;
    primary_color: string;
    template_accent_color: string;
    template_bg_color: string;
    template_hero_heading: string;
    template_hero_subtitle: string;
    template_button_text: string;
  };
};

const STEPS = [
  { id: 'chat' as Step, label: 'المحادثة', icon: Sparkles },
  { id: 'preview' as Step, label: 'المعاينة', icon: Eye },
  { id: 'done' as Step, label: 'تم النشر', icon: Check },
];

const MOCK_PRODUCTS = [
  { id: 1, title: 'سماعة بلوتوث لاسلكية', price: 2500, slug: 'bt-headset', stock_quantity: 99, is_featured: true, views: 120, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'], category: 'إلكترونيات', description: 'سماعة بلوتوث عالية الجودة', variants: [
    { id: 1, product_id: 1, color: 'أسود', size: null, size2: null, variant_name: 'أسود', price: 2500, stock_quantity: 50, images: [], is_active: true, sort_order: 0 },
    { id: 2, product_id: 1, color: 'أبيض', size: null, size2: null, variant_name: 'أبيض', price: 2800, stock_quantity: 30, images: [], is_active: true, sort_order: 1 },
  ]},
  { id: 2, title: 'ساعة ذكية رياضية', price: 4500, slug: 'smartwatch', stock_quantity: 45, is_featured: true, views: 89, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'], category: 'إلكترونيات', description: 'ساعة ذكية مقاومة للماء', variants: [] },
  { id: 3, title: 'شاحن لاسلكي سريع', price: 1800, slug: 'wireless-charger', stock_quantity: 120, is_featured: false, views: 56, images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400'], category: 'إلكترونيات', description: 'شاحن لاسلكي سريع 15 واط', variants: [] },
  { id: 4, title: 'نظارات شمسية أنيقة', price: 3200, slug: 'sunglasses', stock_quantity: 35, is_featured: false, views: 42, images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400'], category: 'أزياء', description: 'نظارات شمسية بتصميم عصري', variants: [] },
  { id: 5, title: 'حقيبة ظهر رياضية', price: 3500, slug: 'backpack', stock_quantity: 60, is_featured: true, views: 78, images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'], category: 'حقائب', description: 'حقيبة ظهر مريحة وعملية', variants: [] },
  { id: 6, title: 'سماعات أذن لاسلكية', price: 1500, slug: 'earbuds', stock_quantity: 80, is_featured: false, views: 95, images: ['https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400'], category: 'إلكترونيات', description: 'سماعات أذن صغيرة وخفيفة', variants: [] },
];

export default function AiStoreBuilder() {
  const navigate = useNavigate();
  const { storeSlug } = useStoreSettings({ enabled: true });
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [step, setStep] = useState<Step>('chat');
  const [applying, setApplying] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleTemplateGenerated = useCallback((template: GeneratedTemplate) => {
    setGeneratedTemplate(template);
    setGenerating(false);
    setStep('preview');
  }, []);

  const handleGenerateStart = useCallback(() => {
    setGenerating(true);
  }, []);

  const handleGenerateEnd = useCallback(() => {
    setGenerating(false);
  }, []);

  const handleApply = async () => {
    if (!generatedTemplate) return;
    setApplying(true);
    try {
      const res = await fetch('/api/ai/store-builder/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: generatedTemplate.settings,
          storeName: generatedTemplate.settings.storeName,
          template: 'zenith',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
      }
    } catch {
      // ignore
    } finally {
      setApplying(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  const templateProps: TemplateProps | null = generatedTemplate ? {
    storeSlug: 'preview-store',
    products: MOCK_PRODUCTS,
    filtered: [],
    settings: {
      store_name: generatedTemplate.settings.storeName,
      template: 'zenith',
      primary_color: generatedTemplate.settings.primary_color,
      template_accent_color: generatedTemplate.settings.template_accent_color,
      template_bg_color: generatedTemplate.settings.template_bg_color,
      template_hero_heading: generatedTemplate.settings.template_hero_heading,
      template_hero_subtitle: generatedTemplate.settings.template_hero_subtitle,
      template_button_text: generatedTemplate.settings.template_button_text,
    },
    categories: ['إلكترونيات', 'أزياء', 'حقائب'],
    searchQuery: '',
    setSearchQuery: () => {},
    categoryFilter: '',
    setCategoryFilter: () => {},
    sortOption: 'featured',
    setSortOption: () => {},
    viewMode: 'grid',
    setViewMode: () => {},
    formatPrice: (n: number) => Math.round(n).toLocaleString('ar-DZ') + ' دج',
    primaryColor: generatedTemplate.settings.primary_color,
    secondaryColor: generatedTemplate.settings.template_accent_color,
    bannerUrl: null,
    navigate: () => {},
    canManage: false,
  } : null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Code className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white">منشئ القوالب بالذكاء الاصطناعي</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">صف متجرك — أعدّ الألوان والتصميم مباشرة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {storeSlug && (
            <button
              onClick={() => navigate(`/store/${storeSlug}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">معاينة مباشرة</span>
            </button>
          )}
          {step === 'preview' && generatedTemplate && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20"
            >
              {applying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جاري النشر...</>
              ) : (
                <><Check className="w-4 h-4" /> نشر القالب</>
              )}
            </button>
          )}
          {step === 'done' && (
            <button
              onClick={() => navigate('/my-store')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              العودة للمتجر
            </button>
          )}
        </div>
      </header>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-0 px-4 lg:px-6 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 shrink-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isPast = stepIndex > i;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-110'
                      : isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 hidden sm:inline ${
                  isActive ? 'text-violet-700 dark:text-violet-300' : isPast ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 sm:w-12 h-px mx-2 transition-colors duration-300 ${
                  isPast || isActive ? 'bg-violet-300 dark:bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Left: preview panel */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
          {/* Intro placeholder */}
          {step === 'chat' && !generatedTemplate && !generating && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-lg">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/30">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">أنشئ قالب متجرك بالذكاء الاصطناعي</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-sm mx-auto">
                  صف متجرك في المحادثة — أعدّ الألوان والتصميم ويعرض مباشرة هنا.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                  {[
                    { icon: Smartphone, label: 'متجاوب', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
                    { icon: Palette, label: 'ألوان ذكية', color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20' },
                    { icon: ShoppingBag, label: 'متكامل', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
                  ].map(({ icon: ItemIcon, label, color }) => (
                    <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                        <ItemIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Generating state */}
          {generating && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 animate-pulse" />
                  <div className="absolute inset-1 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">جاري إعداد المتجر...</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">الذكاء الاصطناعي يختار التصميم المناسب</p>
              </div>
            </div>
          )}

          {/* Live preview — real template rendered directly */}
          {templateProps && (step === 'preview' || step === 'done') && (
            <div className="flex-1 min-h-0 overflow-auto">
              {RenderStorefront('zenith', templateProps)}
            </div>
          )}

          {/* Done overlay banner */}
          {step === 'done' && generatedTemplate && (
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-emerald-600 via-emerald-600/95 to-transparent pointer-events-none z-10">
              <div className="flex items-center justify-between pointer-events-auto bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-2xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">تم النشر بنجاح</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">قالب "{generatedTemplate.settings.storeName}" جاهز</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/template-editor')}
                    className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    فتح المحرر
                  </button>
                  <button
                    onClick={() => navigate('/my-store')}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    لوحة التحكم
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: chat panel */}
        <div className="lg:w-[420px] border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          <StoreBuilderChat
            onTemplateGenerated={handleTemplateGenerated}
            onGenerateStart={handleGenerateStart}
            onGenerateEnd={handleGenerateEnd}
            currentSettings={generatedTemplate?.settings || null}
            disabled={step === 'done'}
          />
        </div>
      </div>
    </div>
  );
}
