import { useState, useEffect } from 'react';
import {
  Sparkles, Loader2, Download, Image as ImageIcon,
  ShoppingBag, Palette, RefreshCw, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getCurrentUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  images: string[];
}

export default function LandingPageGenerator() {
  const { locale } = useTranslation();
  const { toast } = useToast();
  const isRtl = locale === 'ar';
  const user = getCurrentUser();
  const clientId = user?.clientId || user?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/client/store/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        if (data.length > 0) setSelectedProduct(data[0]);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProduct) {
      toast({ title: isRtl ? 'الرجاء اختيار منتج' : 'Please select a product', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setGeneratedImage(null);

    try {
      const res = await fetch('/api/ai/landing/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          product_name: selectedProduct.title,
          product_description: selectedProduct.description,
          product_images: selectedProduct.images,
          prompt: prompt.trim() || `Create a professional landing page for ${selectedProduct.title}`,
          price: selectedProduct.price,
          currency: 'د.م.',
        }),
      });
      const data = await res.json();
      if (res.ok && data.image_url) {
        setGeneratedImage(data.image_url);
      } else {
        toast({ title: data?.error || 'Generation failed', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: err?.message || 'Network error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `landing-${selectedProduct?.title?.slice(0, 20) || 'page'}.png`;
    link.click();
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            {isRtl ? 'مولد الصفحات التسويقية' : 'Landing Page Generator'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isRtl ? 'أنشئ صفحات هبوط احترافية بلمسة واحدة' : 'One-click AI landing pages'}
          </p>
        </div>
        <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20">
          {isRtl ? 'نسخة تجريبية' : 'Beta'}
        </Badge>
      </div>

      {/* Main — 50/50 split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Left — Controls (scrollable) */}
        <div className="lg:w-1/2 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* Product Selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                {isRtl ? 'المنتج' : 'Product'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const p = products.find(x => x.id === Number(e.target.value));
                  setSelectedProduct(p || null);
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">{isRtl ? 'اختر منتجاً...' : 'Select a product...'}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>

              {selectedProduct && (
                <div className="flex gap-3">
                  {selectedProduct.images?.[0] && (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                      <img src={selectedProduct.images[0]} alt={selectedProduct.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{selectedProduct.title}</p>
                    <p>{selectedProduct.price} د.م.</p>
                    <p className="line-clamp-2">{selectedProduct.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" />
                {isRtl ? 'تعليمات إضافية' : 'Additional instructions'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isRtl
                  ? 'اختياري: صِف الألوان، النصوص، التفاصيل الإضافية...'
                  : 'Optional: describe colors, text, extra details...'
                }
                className="min-h-[80px] resize-none"
              />
            </CardContent>
          </Card>

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedProduct}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-200 dark:shadow-purple-900/30"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {isRtl ? 'جارٍ الإنشاء...' : 'Generating...'}</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {isRtl ? 'أنشئ الصفحة' : 'Generate Page'}</>
            )}
          </Button>

          {/* Tips */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {isRtl
                ? 'الذكاء الاصطناعي يكتب النصوص والتصميم تلقائياً. يمكنك إضافة ملاحظات لتخصيص النتيجة'
                : 'AI writes the copy and layout automatically. Add notes to customize the result'}
            </p>
          </div>

          {/* Cost */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isRtl ? 'التكلفة' : 'Cost'}</span>
            <span className="font-medium text-purple-600 dark:text-purple-400">{isRtl ? '~0.3 سنت' : '~$0.003'}</span>
          </div>
        </div>

        {/* Right — Preview (full height) */}
        <div className="lg:w-1/2 bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          {generating ? (
            <div className="flex flex-col items-center text-slate-400">
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-purple-500" />
              <p className="text-sm font-medium">{isRtl ? 'جارٍ إنشاء الصفحة...' : 'Generating...'}</p>
              <p className="text-xs mt-1 opacity-60">{isRtl ? 'التصميم + النصوص + الصور...' : 'Layout + copy + images...'}</p>
            </div>
          ) : generatedImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className="relative w-full max-h-[calc(100vh-200px)] rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700">
                <img
                  src={generatedImage}
                  alt="Generated landing page"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 'calc(100vh - 260px)' }}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
                  <Download className="w-4 h-4" />
                  {isRtl ? 'تحميل' : 'Download'}
                </Button>
                <Button variant="outline" onClick={() => setGeneratedImage(null)} size="lg">
                  <RefreshCw className="w-4 h-4" />
                  {isRtl ? 'إعادة' : 'Reset'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-300 dark:text-slate-600">
              <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
              <p className="text-lg font-medium">{isRtl ? 'المعاينة هنا' : 'Preview Here'}</p>
              <p className="text-sm mt-1 opacity-50">
                {isRtl ? 'اختر منتجاً ثم اضغط "أنشئ"' : 'Select a product and generate'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
