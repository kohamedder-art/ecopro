import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, HelpCircle, ChevronDown, Check, Copy } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIFAQWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const send = async (overrideMessage?: string) => {
    const q = (overrideMessage ?? input).trim();
    if (!q || loading) return;
    if (!overrideMessage) setInput('');
    const next: Message[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setLoading(true);

    const attempt = async (): Promise<string> => {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify({
            question: q,
            history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok) return data.answer || data.text || 'No answer.';
        if (res.status === 429) return 'Too many requests — please wait a moment and try again.';
        return data.error || 'Could not get an answer. Please try again.';
      } catch (e: any) {
        if (e?.name === 'AbortError') return 'The request timed out. Please try again.';
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      let answer: string;
      try {
        answer = await attempt();
      } catch {
        await new Promise(r => setTimeout(r, 1500));
        answer = await attempt();
      }
      setMessages([...next, { role: 'assistant', content: answer }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Could not reach the AI service. Please check your connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const copyMsg = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }).catch(() => {});
  };

  const ADMIN_SUGGESTED_QUESTIONS = [
    '📊 How many active stores do we have?',
    '💰 What is the total platform revenue?',
    '📦 How many orders were placed this month?',
    '⚠️ Are there any suspended or at-risk stores?',
  ];

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9990] flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 sm:w-96 rounded-[24px] border border-white/20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '420px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">Platform Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-white/70 hover:text-white text-xs px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[160px]">
            {messages.length === 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-center text-xs space-y-1.5">
                  <HelpCircle className="w-7 h-7 mx-auto text-purple-400/60" />
                  <p className="font-medium text-slate-500 dark:text-slate-400">Ask anything about the platform</p>
                </div>
                <div className="space-y-1.5">
                  {ADMIN_SUGGESTED_QUESTIONS.map((sq, si) => (
                    <button
                      key={si}
                      onClick={() => void send(sq)}
                      disabled={loading}
                      className="w-full text-left text-[11px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' ? (
                  <div className="max-w-[85%] group relative">
                    <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 text-xs leading-relaxed">
                      {m.content}
                    </div>
                    <button
                      onClick={() => copyMsg(m.content, i)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      title="Copy"
                    >
                      {copiedIdx === i ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-sm">
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                  <span className="text-xs text-slate-500">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question…"
              disabled={loading}
              className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
            <button
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-purple-500/30 hover:scale-105 transition-all flex items-center justify-center"
        title="AI Platform Assistant"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>
    </div>
  );
}
