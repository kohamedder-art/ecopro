import React, { useState } from 'react';
import { useAI } from '@/hooks/useAI';
import { useTranslation } from '@/lib/i18n';
import { Loader2, Sparkles } from 'lucide-react';

export function AIGenerateDescription({
  title,
  category,
  onGenerate,
}: {
  title: string;
  category: string;
  onGenerate: (desc: string) => void;
}) {
  const { locale } = useTranslation();
  const { call, loading } = useAI('/api/ai/product/description');
  const handleClick = async () => {
    if (!title.trim()) return;
    const data = await call({ title, category, language: locale });
    if (data?.description) onGenerate(data.description);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || !title.trim()}
      className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
      title="Generate description with AI"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      AI Generate
    </button>
  );
}

export function AISuggestTitles({
  currentTitle,
  category,
  onSelect,
}: {
  currentTitle: string;
  category: string;
  onSelect: (title: string) => void;
}) {
  const { locale } = useTranslation();
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);
  const { call, loading } = useAI('/api/ai/product/title');

  const handleClick = async () => {
    if (!currentTitle.trim()) return;
    const data = await call({ currentTitle, category, language: locale });
    if (data?.suggestions?.length) {
      setSuggestions(data.suggestions);
      setOpen(true);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !currentTitle.trim()}
        className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 disabled:opacity-40 transition-colors"
        title="Suggest better titles with AI"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        AI Suggest
      </button>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-[200] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 w-[260px]">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 pb-1">Pick a title</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(s); setOpen(false); }}
              className="w-full text-right text-sm px-2 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-slate-700 dark:text-slate-200 transition-colors"
            >
              {s}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="w-full text-xs text-slate-400 mt-1 hover:text-slate-600 text-center">Cancel</button>
        </div>
      )}
    </div>
  );
}
