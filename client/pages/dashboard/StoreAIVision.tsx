import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export function AIVisionSuggest({
  imageUrl,
  onApply,
  locale = 'ar',
}: {
  imageUrl: string;
  locale?: string;
  onApply: (data: { title?: string; description?: string; category?: string; price?: number }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const handleAnalyze = async () => {
    if (!imageUrl || loading) return;
    setLoading(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const res = await fetch('/api/ai/vision/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ imageUrl, language: locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setOpen(true);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading || !imageUrl}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 text-purple-600 dark:text-purple-400 hover:from-purple-500/20 hover:to-fuchsia-500/20 border border-purple-200 dark:border-purple-800 disabled:opacity-40 transition-all"
        title="AI will analyze the image and suggest product details"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        AI Auto-Fill from Image
      </button>
      {open && result && (
        <div className="absolute left-0 top-full mt-2 z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 w-[320px]">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-1">AI Suggestions</p>
          <div className="space-y-2 text-xs">
            {result.title && (
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <span className="text-slate-500 dark:text-slate-400">Title:</span>
                  <span className="ml-1 text-slate-800 dark:text-slate-200">{result.title}</span>
                </div>
              </div>
            )}
            {result.description && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Description:</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-3">{result.description}</p>
              </div>
            )}
            {result.category && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Category:</span>
                <span className="ml-1 text-slate-800 dark:text-slate-200">{result.category}</span>
              </div>
            )}
            {result.estimated_price_dzd && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Est. Price:</span>
                <span className="ml-1 font-semibold text-emerald-600">{result.estimated_price_dzd} DZD</span>
              </div>
            )}
            {result.quality_score !== undefined && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Image Quality:</span>
                <span className={`ml-1 font-semibold ${result.quality_score >= 7 ? 'text-green-600' : result.quality_score >= 4 ? 'text-amber-600' : 'text-red-600'}`}>
                  {result.quality_score}/10
                </span>
                {result.quality_issues?.length > 0 && (
                  <span className="ml-1 text-amber-500">({result.quality_issues.join(', ')})</span>
                )}
              </div>
            )}
            {result.brand_detected && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Brand:</span>
                <span className="ml-1 text-slate-800 dark:text-slate-200">{result.brand_detected}</span>
              </div>
            )}
            {result.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {result.tags.slice(0, 5).map((tag: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px]">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                onApply({
                  title: result.title || result.title_ar,
                  description: result.description || result.description_ar,
                  category: result.category,
                  price: result.estimated_price_dzd,
                });
                setOpen(false);
              }}
              className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              Apply All
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
