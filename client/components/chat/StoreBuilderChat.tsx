import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GeneratedTemplate } from '@/pages/my-store/AiStoreBuilder';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  onTemplateGenerated: (template: GeneratedTemplate) => void;
  onGenerateStart?: () => void;
  onGenerateEnd?: () => void;
  currentSettings?: GeneratedTemplate['settings'] | null;
  disabled?: boolean;
};

const SUGGESTED = [
  'أبيع ملابس رياضية للرجال والنساء — ألوان داكنة',
  'متجر مجوهرات فضية — تصميم أنيق كلاسيكي',
  'متجر إلكترونيات — تصميم عصري مع أزرق',
  'مطعم — ألوان دافئة و аппتيت.',
];

export default function StoreBuilderChat({ onTemplateGenerated, onGenerateStart, onGenerateEnd, currentSettings, disabled }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '**مرحباً بك!** 👋 أنا مساعد بناء المتجر.\n\n**صف لي متجرك** — ما نوع المنتجات؟ ما الأسلوب اللي تحبه (داكن، فاتح، كلاسيكي، عصري)؟\n\nسأعدّ التصميم ويعرض مباشرة.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (message?: string) => {
    const q = (message ?? input).trim();
    if (!q || loading || disabled) return;
    if (!message) setInput('');

    const userMsg: Message = { role: 'user', content: q };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    onGenerateStart?.();

    try {
      const res = await fetch('/api/ai/template-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: q,
          currentSettings: currentSettings || undefined,
        }),
      });
      const data = await res.json();

      if (data.template) {
        onTemplateGenerated(data.template);
        setMessages([...updated, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages([...updated, { role: 'assistant', content: data.answer || 'حدث خطأ. حاول مرة أخرى.' }]);
      }
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'تعذر الاتصال. تحقق من الشبكة وحاول مرة أخرى.' }]);
    } finally {
      setLoading(false);
      onGenerateEnd?.();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">مساعد المتجر</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">صف متجرك وسأعدّ التصميم</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 mt-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              </div>
            )}
            <div className={`max-w-[85%] ${m.role === 'user' ? 'order-first' : ''}`}>
              {m.role === 'assistant' ? (
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed">
                  <div className="chat-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed">
                  {m.content}
                </div>
              )}
            </div>
          </div>
        ))}

        {messages.length === 1 && !loading && (
          <div className="space-y-1.5 pt-2">
            {SUGGESTED.map((sq, si) => (
              <button
                key={si}
                onClick={() => send(sq)}
                className="w-full text-left text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">جاري الإعداد...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="صف المتجر أو عدّل التصميم..."
            disabled={loading || disabled}
            className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim() || disabled}
            className="p-2 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
