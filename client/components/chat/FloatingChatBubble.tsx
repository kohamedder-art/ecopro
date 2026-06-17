import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Zap, Sparkles, Send, Loader2, Check, AlertTriangle, Copy, ChevronRight, ImagePlus, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/contexts/NotificationContext';
import { useTranslation } from '@/lib/i18n';
import { safeJsonParse } from '@/utils/safeJson';
import { apiFetch } from '@/lib/api';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';

// AI chat history is persisted server-side at /api/ai/chat-history

export default function FloatingChatBubble() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadMessagesCount } = useNotifications();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const user = typeof window !== 'undefined' ? safeJsonParse(localStorage.getItem('user'), null as any) : null;
  const isAdmin = user?.role === 'admin' || user?.user_type === 'admin';
  const userRole: 'client' | 'admin' = isAdmin ? 'admin' : 'client';
  const userId: number = Number(user?.clientId || user?.id || 0);

  const isHiddenSurface = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/store/')) return true;
    if (p.startsWith('/kernel-portal')) return true;
    if (p === '/platform-admin/chat' || p === '/chat') return true;
    return false;
  }, [location.pathname]);

  const isEditorPage = location.pathname === '/template-editor' || location.pathname === '/my-store/template-editor';

  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);
  const [adminSelectedChatId, setAdminSelectedChatId] = useState<number | null>(null);
  const [bootingChat, setBootingChat] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // AI mode for client users
  type ChatMode = 'admin' | 'ai';
  const [chatMode, setChatMode] = useState<ChatMode>('admin');
  type AIMsg = { role: 'user' | 'assistant'; content: string; imageUrl?: string; sources?: { title: string; uri: string }[] };
  type AIAction = {
    type: string;
    orderId?: number;
    newStatus?: string;
    enable?: boolean;
    delayMinutes?: number;
    language?: string;
    tone?: string;
    intent?: string;
    channel?: string;
    productId?: number;
    title?: string;
    price?: number;
    stock?: number;
    category?: string;
    description?: string;
    field?: string;
    value?: string | number;
    changes?: Record<string, string | number | boolean>;
  };
  const [aiMessages, setAiMessages] = useState<AIMsg[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiAttachedImage, setAiAttachedImage] = useState<string | null>(null);
  const aiImageInputRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [alerts, setAlerts] = useState<{ id?: number; type: 'urgent' | 'warning' | 'info'; message: string; link: string; status?: string }[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMode === 'ai' && aiBottomRef.current) {
      aiBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, chatMode]);

  // Load proactive alerts when entering AI mode (once per session)
  useEffect(() => {
    if (chatMode !== 'ai' || alertsLoaded || isAdmin) return;
    setAlertsLoaded(true);
    const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    fetch('/api/ai/alerts', { credentials: 'include', headers: { 'X-CSRF-Token': csrf } })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.alerts)) {
          setAlerts(d.alerts);
          for (const alert of d.alerts) {
            if (alert.id && alert.status === 'unread') {
              fetch(`/api/ai/alerts/${alert.id}/read`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRF-Token': csrf },
              }).catch(() => {});
            }
          }
        }
      })
      .catch(() => {});
  }, [chatMode, alertsLoaded, isAdmin]);

  // Load chat history from DB when first entering AI mode
  useEffect(() => {
    if (chatMode !== 'ai' || historyLoaded) return;
    setHistoryLoaded(true);
    const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    fetch('/api/ai/chat-history', { credentials: 'include', headers: { 'X-CSRF-Token': csrf } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.messages?.length) setAiMessages(d.messages); })
      .catch(() => {});
  }, [chatMode, historyLoaded]);

  const SUGGESTED_QUESTIONS = [
    t('chat.suggest1'),
    t('chat.suggest2'),
    t('chat.suggest3'),
    t('chat.suggest4'),
  ];

  const handleAiImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Image is too large (max 4MB). Please choose a smaller one.' }]);
      return;
    }
    const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setAiAttachedImage(data.url);
      }
    } catch {
      setAiAttachedImage(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const sendAI = async (message?: string) => {
    const q = (message ?? aiInput).trim();
    const attachedImg = aiAttachedImage;
    if ((!q && !attachedImg) || aiLoading) return;
    if (!message) setAiInput('');
    setAiAttachedImage(null);
    setPendingAction(null);
    const userMsg: AIMsg = { role: 'user', content: q || '(image attached)', ...(attachedImg ? { imageUrl: attachedImg } : {}) };
    const next: AIMsg[] = [...aiMessages, userMsg];
    setAiMessages(next);
    setAiLoading(true);

    const attempt = async (): Promise<{ answer: string; action?: AIAction; sources?: { title: string; uri: string }[] }> => {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const endpoint = attachedImg ? '/api/ai/vision/chat' : '/api/ai/chat';
        const body: any = {
          question: q || 'What do you see in this image? Describe it in detail.',
          history: aiMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        };
        if (attachedImg) body.imageUrl = attachedImg;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok) {
          const ret: { answer: string; action?: AIAction; sources?: { title: string; uri: string }[] } = { answer: data.answer || data.text || 'No answer.', action: data.action, sources: data.sources };
          return ret;
        }
        if (res.status === 429) return { answer: 'Too many requests — please wait a moment and try again.' };
        return { answer: data.error || 'Could not get an answer. Please try again.' };
      } catch (e: any) {
        if (e?.name === 'AbortError') return { answer: 'The request timed out. Please try again.' };
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      let result: { answer: string; action?: AIAction; sources?: { title: string; uri: string }[] };
      try {
        result = await attempt();
      } catch {
        await new Promise(r => setTimeout(r, 1500));
        result = await attempt();
      }
      const assistantMsg: AIMsg = { role: 'assistant', content: result.answer, ...(result.sources?.length ? { sources: result.sources } : {}) };
      setAiMessages([...next, assistantMsg]);
      const csrfSave = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrfTok = csrfSave ? decodeURIComponent(csrfSave[1]) : '';
      fetch('/api/ai/chat-history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfTok },
        credentials: 'include',
        body: JSON.stringify({ messages: [{ role: 'user', content: q }, assistantMsg] }),
      }).catch(() => {});
      if (result.action?.type === 'update_order_status') {
        setPendingAction(result.action as AIAction);
      } else if (typeof result.action?.type === 'string' && result.action.type.startsWith('bot_')) {
        void executeBotAction(result.action as AIAction);
      } else if (typeof result.action?.type === 'string' &&
          ['create_product', 'edit_product', 'delete_product', 'update_store_settings', 'update_store_design'].includes(result.action.type)) {
        setPendingAction(result.action as AIAction);
      }
    } catch {
      setAiMessages([...next, { role: 'assistant', content: 'Could not reach the AI service. Please check your connection and try again.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const executeBotAction = async (action: AIAction) => {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    try {
      const res = await fetch('/api/ai/bot-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (res.ok) {
        const preview = data.preview ? `\n\n> ${data.preview}` : '';
        setAiMessages(prev => [...prev, { role: 'assistant', content: `✓ ${data.message}${preview}` }]);
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not apply bot action: ${data.error}` }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Failed to apply bot action. Please check your connection.' }]);
    }
  };

  const confirmOrderAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

      if (['create_product', 'edit_product', 'delete_product'].includes(pendingAction.type)) {
        const res = await fetch('/api/ai/product-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(pendingAction),
        });
        const data = await res.json();
        setAiMessages(prev => [...prev, { role: 'assistant', content: res.ok ? `✓ ${data.message}` : `Could not complete: ${data.error}` }]);
        setPendingAction(null);
        setActionLoading(false);
        return;
      }

      if (pendingAction.type === 'update_store_settings' || pendingAction.type === 'update_store_design') {
        const res = await fetch('/api/ai/store-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(pendingAction),
        });
        const data = await res.json();
        setAiMessages(prev => [...prev, { role: 'assistant', content: res.ok ? `✓ ${data.message}` : `Could not complete: ${data.error}` }]);
        if (res.ok) {
          // Refresh template editor preview if it's open
          queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
        }
        setPendingAction(null);
        setActionLoading(false);
        return;
      }

      const res = await fetch('/api/ai/order-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ orderId: pendingAction.orderId, newStatus: pendingAction.newStatus }),
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: 'assistant', content: res.ok ? `✓ Done — ${data.message}` : `Could not update the order: ${data.error}` }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Failed to complete action. Please check your connection.' }]);
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const copyAIMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }).catch(() => {});
  };

  // Ensure the client has an admin chat when opening
  useEffect(() => {
    const ensureChat = async () => {
      if (!open || !user || !userId) return;
      localStorage.setItem('chat_last_seen_at', new Date().toISOString());
      if (isAdmin || chatId) return;

      setBootingChat(true);
      try {
        const resp = await apiFetch<any>('/api/chat/create-admin-chat', {
          method: 'POST',
          body: JSON.stringify({ tier: 'support' }),
        });
        const id = Number(resp?.chat?.id ?? resp?.chat_id ?? resp?.chatId ?? resp?.id);
        if (Number.isFinite(id) && id > 0) setChatId(id);
      } catch {
        // ignore
      } finally {
        setBootingChat(false);
      }
    };
    void ensureChat();
  }, [open, user, userId, isAdmin, chatId]);

  // Mark support chat messages as read when bubble opens
  useEffect(() => {
    if (!open || !userId) return;
    const markRead = async () => {
      const csrfM = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
      const csrf = csrfM ? decodeURIComponent(csrfM[1]) : '';
      try {
        const res = await fetch('/api/chat/mark-all-read', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrf },
        });
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('ecopro:chat-seen'));
        }
      } catch {}
    };
    void markRead();
  }, [open, userId]);

  // Allow quick hide via Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const closeMessenger = () => setOpen(false);
  const activeChatId = isAdmin ? adminSelectedChatId : chatId;
  const shouldRender = !!user && !isHiddenSurface;

  if (!shouldRender) return null;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <div className={`fixed bottom-20 sm:bottom-4 z-[9999] ${isEditorPage ? 'left-4' : 'right-4'}`}>
        <div className="relative">
          {unreadMessagesCount > 0 && (
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-60 pointer-events-none" />
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center text-white border border-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              boxShadow: unreadMessagesCount > 0
                ? '0 0 0 4px rgba(99,102,241,0.25), 0 8px 32px rgba(99,102,241,0.55)'
                : '0 8px 24px rgba(99,102,241,0.4)',
            }}
            aria-label={t('chat.openAssistant')}
          >
            <Sparkles className="w-6 h-6" />
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          </button>
          {unreadMessagesCount > 0 && (
            <div
              className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg"
              aria-label={t('chat.unreadMessages', { count: unreadMessagesCount })}
            >
              {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat panel ── */}
      {open && (
        <>
          {/* Scrim (mobile tap-to-close) */}
          <div className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-[2px] sm:hidden" onClick={closeMessenger} />

          <div
            className={`fixed z-[10000] bottom-0 border border-white/20 dark:border-white/10 flex flex-col overflow-hidden ${isEditorPage ? 'left-0' : 'right-0'} ${
              expanded
                ? '!z-[99999] bg-white dark:bg-slate-900 backdrop-blur-2xl shadow-2xl w-full sm:!w-[576px] sm:!rounded-[24px] sm:!bottom-[88px] sm:!right-6 !rounded-t-[20px]'
                : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl w-full sm:w-96 sm:rounded-[24px] rounded-t-[20px] sm:right-6 sm:bottom-[88px]'
            }`}
            style={{
              ...(expanded ? { top: 'calc(64px + 8px)', maxHeight: '840px' } : { height: 'min(560px, calc(100dvh - 32px))' }),
              animation: 'fcb-slide-up 180ms ease',
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* ─ Header ─ */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                  {!isAdmin ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setChatMode('admin')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chatMode === 'admin' ? 'bg-emerald-500 text-white shadow-md' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{t('chat.support')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatMode('ai')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chatMode === 'ai' ? 'bg-violet-500 text-white shadow-md' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('chat.ai')}</span>
                      </button>
                    </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {activeChatId && (
                      <button
                        type="button"
                        onClick={() => setAdminSelectedChatId(null)}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                        aria-label="Back to chat list"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15,18 9,12 15,6" />
                        </svg>
                      </button>
                    )}
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">{t('chat.support')}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {chatMode === 'ai' && aiMessages.length > 0 && (
                  <button
                    onClick={() => {
                      setAiMessages([]);
                      setPendingAction(null);
                      const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
                      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
                      fetch('/api/ai/chat-history', { method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': csrf } }).catch(() => {});
                    }}
                    className="text-white/70 hover:text-white text-xs px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {t('chat.clear')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                  aria-label={expanded ? t('chat.minimize') : t('chat.expand')}
                  title={expanded ? t('chat.minimize') : t('chat.expand')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {expanded
                      ? <><polyline points="4,14 10,14 10,20" /><polyline points="20,10 14,10 14,4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
                      : <><polyline points="15,3 21,3 21,9" /><polyline points="9,21 3,21 3,15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                    }
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={closeMessenger}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                  aria-label={t('chat.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ─ Body ─ */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {(!isAdmin && chatMode === 'ai') ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Messages area */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
                    {aiMessages.length === 0 && (
                      <div className="space-y-4 pt-6">
                        <div className="text-center space-y-1.5">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <p className="text-[15px] font-semibold text-slate-800 dark:text-white">{t('chat.aiAssistant')}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{t('chat.aiGreeting')}</p>
                        </div>

                        {alerts.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  const csrfM = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
                                  const csrf = csrfM ? decodeURIComponent(csrfM[1]) : '';
                                  fetch('/api/ai/alerts/dismiss-all', {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'X-CSRF-Token': csrf },
                                  }).catch(() => {});
                                  setAlerts([]);
                                }}
                                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                              >
                                {t('chat.dismissAll')}
                              </button>
                            </div>
                            {alerts.map((alert, ai) => (
                              <div
                                key={ai}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium ${
                                  alert.type === 'urgent'
                                    ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                                    : alert.type === 'warning'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                                <button
                                  className="flex-1 text-left hover:opacity-70 transition-opacity"
                                  onClick={() => {
                                    const csrfM = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
                                    const csrf = csrfM ? decodeURIComponent(csrfM[1]) : '';
                                    if (alert.id) {
                                      fetch(`/api/ai/alerts/${alert.id}/follow`, {
                                        method: 'POST',
                                        credentials: 'include',
                                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                                        body: JSON.stringify({ actionTaken: 'clicked' }),
                                      }).catch(() => {});
                                    }
                                    navigate(alert.link);
                                    closeMessenger();
                                  }}
                                >
                                  <span className="flex items-center gap-1">
                                    {alert.message}
                                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                                  </span>
                                </button>
                                <button
                                  className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                                  title={t('chat.dismiss')}
                                  onClick={() => {
                                    const csrfM = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
                                    const csrf = csrfM ? decodeURIComponent(csrfM[1]) : '';
                                    if (alert.id) {
                                      fetch(`/api/ai/alerts/${alert.id}/dismiss`, {
                                        method: 'POST',
                                        credentials: 'include',
                                        headers: { 'X-CSRF-Token': csrf },
                                      }).catch(() => {});
                                    }
                                    setAlerts(prev => prev.filter((_, idx) => idx !== ai));
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          {SUGGESTED_QUESTIONS.map((sq, si) => (
                            <button
                              key={si}
                              onClick={() => void sendAI(sq)}
                              disabled={aiLoading}
                              className="w-full text-left text-[11px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                            >
                              {sq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'assistant' ? (
                          <div className="max-w-[85%] group relative">
                            <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 text-xs leading-relaxed">
                              {m.content}
                            </div>
                            {m.sources && m.sources.length > 0 && (
                              <div className="mt-1 px-1 space-y-0.5">
                                <p className="text-[9px] font-semibold text-violet-500 dark:text-violet-400 flex items-center gap-0.5">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {t('chat.sources', { count: m.sources.length })}
                                </p>
                                {m.sources.slice(0, 5).map((src, si) => (
                                  <a
                                    key={si}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[9px] text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 truncate transition-colors"
                                    title={src.uri}
                                  >
                                    {src.title}
                                  </a>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => copyAIMessage(m.content, i)}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              title={t('chat.copy')}
                            >
                              {copiedIdx === i ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                        ) : (
                          <div className="max-w-[85%] bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-2xl rounded-br-sm px-3 py-2 text-xs leading-relaxed">
                            {m.imageUrl && (
                              <img src={m.imageUrl} alt={t('chat.imageAttached')} className="max-w-full max-h-32 rounded-lg mb-2 object-cover" />
                            )}
                            {m.content !== '(image attached)' && m.content}
                          </div>
                        )}
                      </div>
                    ))}

                    {aiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{t('chat.thinking')}</span>
                        </div>
                      </div>
                    )}
                    <div ref={aiBottomRef} />
                  </div>

                  {pendingAction && (
                    <div className="mx-3 mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 flex items-center gap-2 flex-shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-[12px] text-amber-700 dark:text-amber-300 flex-1 leading-snug">
                        {pendingAction.type === 'create_product'
                          ? t('chat.confirmCreateProduct', { title: pendingAction.title, price: pendingAction.price })
                          : pendingAction.type === 'edit_product'
                          ? t('chat.confirmEditProduct', { field: pendingAction.field, productId: pendingAction.productId, value: pendingAction.value })
                          : pendingAction.type === 'delete_product'
                          ? t('chat.confirmDeleteProduct', { title: pendingAction.title })
                          : pendingAction.type === 'update_store_design'
                          ? t('chat.confirmDesignChanges', { count: Object.keys(pendingAction.changes || {}).length })
                          : pendingAction.type === 'update_store_settings'
                          ? t('chat.confirmSettingsChange', { field: pendingAction.field, value: pendingAction.value })
                          : t('chat.confirmUpdateOrder', { orderId: pendingAction.orderId, newStatus: pendingAction.newStatus })
                        }
                      </span>
                      <button onClick={() => void confirmOrderAction()} disabled={actionLoading} className="w-6 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0">
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setPendingAction(null)} disabled={actionLoading} className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors flex-shrink-0 hover:bg-slate-300 dark:hover:bg-white/20">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {aiAttachedImage && (
                    <div className="mx-4 mb-1 flex items-center gap-2.5">
                      <div className="relative">
                        <img src={aiAttachedImage} alt={t('chat.imageAttached')} className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-white/10" />
                        <button
                          onClick={() => setAiAttachedImage(null)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-800 dark:bg-slate-600 text-white flex items-center justify-center shadow-sm"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-400">{t('chat.imageAttached')}</span>
                    </div>
                  )}

                  {/* Input bar */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 flex-shrink-0">
                    <input type="file" ref={aiImageInputRef} accept="image/*" className="hidden" onChange={handleAiImageAttach} />
                    <button
                      onClick={() => aiImageInputRef.current?.click()}
                      disabled={aiLoading}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-40"
                      title={t('chat.attachImage')}
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendAI(); } }}
                      placeholder={aiAttachedImage ? t('chat.askAboutImage') : t('chat.askQuestion')}
                      disabled={aiLoading}
                      className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    />
                    <button
                      onClick={() => void sendAI()}
                      disabled={aiLoading || (!aiInput.trim() && !aiAttachedImage)}
                      className="p-2 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Support / Admin chat ── */
                <div className="flex-1 min-h-0 overflow-hidden" style={{ height: '100%' }}>
                  {isAdmin ? (
                    activeChatId ? (
                      <div className="h-full overflow-hidden"><ChatWindow chatId={activeChatId} userRole="admin" userId={userId} onClose={() => setAdminSelectedChatId(null)} /></div>
                    ) : (
                      <ChatList userRole="admin" selectedChatId={adminSelectedChatId ?? undefined} onSelectChat={(id) => setAdminSelectedChatId(id)} />
                    )
                  ) : bootingChat || !activeChatId ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-2">
                          <Zap className="w-4 h-4 text-white animate-pulse" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('chat.connecting')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-hidden"><ChatWindow chatId={activeChatId} userRole={userRole} userId={userId} onClose={closeMessenger} /></div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fcb-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
