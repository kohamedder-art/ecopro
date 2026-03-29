import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, ArrowLeft, Zap, Pin, PinOff, Sparkles, Send, Loader2, Check, AlertTriangle, Copy, RotateCcw, ChevronRight } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { safeJsonParse } from '@/utils/safeJson';
import { apiFetch } from '@/lib/api';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';

const PHONE_POS_KEY = 'floating_chat_phone_pos_v1';
const PHONE_SIZE_KEY = 'floating_chat_phone_size_v1';
// AI chat history is persisted server-side at /api/ai/chat-history

type Pos = { x: number; y: number };
type Size = { w: number; h: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function FloatingChatBubble() {
  const location = useLocation();
  const { unreadMessagesCount } = useNotifications();

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

  const [hidden, setHidden] = useState<boolean>(false);

  // Fixed position — no longer draggable
  const pos = { x: 0, y: 0 }; // unused, kept for openFromRef compat

  const [docked, setDocked] = useState<boolean>(true);

  const [phoneSize, setPhoneSize] = useState<Size>(() => {
    const saved = localStorage.getItem(PHONE_SIZE_KEY);
    const parsed = safeJsonParse(saved, null as any);
    if (parsed && typeof parsed.w === 'number' && typeof parsed.h === 'number') {
      return { w: parsed.w, h: parsed.h };
    }
    return { w: 360, h: 620 };
  });

  const [phonePos, setPhonePos] = useState<Pos>(() => {
    const saved = localStorage.getItem(PHONE_POS_KEY);
    const parsed = safeJsonParse(saved, null as any);
    if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
    // Default: open above-left of the fixed bottom-right bubble
    return { x: Math.max(20, window.innerWidth - 460), y: Math.max(20, window.innerHeight - 680) };
  });

  const bubblePosRef = useRef<Pos>({ x: 0, y: 0 });

  const [open, setOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const openFromRef = useRef<{ x: number; y: number } | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [adminSelectedChatId, setAdminSelectedChatId] = useState<number | null>(null);
  const [bootingChat, setBootingChat] = useState(false);

  // AI mode for client users
  type ChatMode = 'admin' | 'ai';
  const [chatMode, setChatMode] = useState<ChatMode>('admin');
  type AIMsg = { role: 'user' | 'assistant'; content: string };
  type AIAction = {
    type: string;
    // order action fields
    orderId?: number;
    newStatus?: string;
    // bot action fields
    enable?: boolean;
    delayMinutes?: number;
    language?: string;
    tone?: string;
    intent?: string;
    channel?: string;
    // product action fields
    productId?: number;
    title?: string;
    price?: number;
    stock?: number;
    category?: string;
    description?: string;
    field?: string;
    value?: string | number;
  };
  const [aiMessages, setAiMessages] = useState<AIMsg[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [alerts, setAlerts] = useState<{ id?: number; type: 'urgent' | 'warning' | 'info'; message: string; link: string; status?: string }[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
          // Auto-mark unread alerts as read (they've been shown to the owner)
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
    '📦 Show me my pending orders',
    '📊 How is my store doing this week?',
    '✏️ Write me a WhatsApp broadcast message',
    '🔔 Any out-of-stock or low-stock alerts?',
  ];

  const sendAI = async (message?: string) => {
    const q = (message ?? aiInput).trim();
    if (!q || aiLoading) return;
    if (!message) setAiInput('');
    setPendingAction(null);
    const next: AIMsg[] = [...aiMessages, { role: 'user', content: q }];
    setAiMessages(next);
    setAiLoading(true);

    const attempt = async (): Promise<{ answer: string; action?: AIAction }> => {
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
            history: aiMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok) return { answer: data.answer || data.text || 'No answer.', action: data.action };
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
      let result: { answer: string; action?: AIAction };
      try {
        result = await attempt();
      } catch {
        await new Promise(r => setTimeout(r, 1500));
        result = await attempt();
      }
      const assistantMsg: AIMsg = { role: 'assistant', content: result.answer };
      setAiMessages([...next, assistantMsg]);
      // Persist the exchange to the DB (fire-and-forget)
      const csrfSave = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/) ;
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
        // bot_send_message needs confirmation before queuing; others execute immediately
        if (result.action.type === 'bot_send_message') {
          setPendingAction(result.action as AIAction);
        } else {
          // Fire-and-forget: execute immediately, no confirm needed for settings changes
          void executeBotAction(result.action as AIAction, [...next]);
        }
      } else if (typeof result.action?.type === 'string' &&
          ['create_product', 'edit_product', 'delete_product', 'update_store_settings'].includes(result.action.type)) {
        setPendingAction(result.action as AIAction);
      }
    } catch {
      setAiMessages([...next, { role: 'assistant', content: 'Could not reach the AI service. Please check your connection and try again.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const executeBotAction = async (action: AIAction, msgHistory: AIMsg[]) => {
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

      // Product actions
      if (['create_product', 'edit_product', 'delete_product'].includes(pendingAction.type)) {
        const res = await fetch('/api/ai/product-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(pendingAction),
        });
        const data = await res.json();
        if (res.ok) {
          setAiMessages(prev => [...prev, { role: 'assistant', content: `✓ ${data.message}` }]);
        } else {
          setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not complete: ${data.error}` }]);
        }
        setPendingAction(null);
        setActionLoading(false);
        return;
      }

      // Store settings action
      if (pendingAction.type === 'update_store_settings') {
        const res = await fetch('/api/ai/store-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(pendingAction),
        });
        const data = await res.json();
        if (res.ok) {
          setAiMessages(prev => [...prev, { role: 'assistant', content: `✓ ${data.message}` }]);
        } else {
          setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not complete: ${data.error}` }]);
        }
        setPendingAction(null);
        setActionLoading(false);
        return;
      }

      // Bot send message
      if (pendingAction.type === 'bot_send_message') {
        const res = await fetch('/api/ai/bot-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(pendingAction),
        });
        const data = await res.json();
        if (res.ok) {
          const preview = data.preview ? `\n\n> ${data.preview}` : '';
          setAiMessages(prev => [...prev, { role: 'assistant', content: `✓ ${data.message}${preview}` }]);
        } else {
          setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not send message: ${data.error}` }]);
        }
        setPendingAction(null);
        setActionLoading(false);
        return;
      }

      // Order status update
      const res = await fetch('/api/ai/order-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ orderId: pendingAction.orderId, newStatus: pendingAction.newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `✓ Done — ${data.message}` }]);
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not update the order: ${data.error}` }]);
      }
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

  const phoneDraggingRef = useRef(false);
  const phoneDragStartRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const phonePointerIdRef = useRef<number | null>(null);

  const resizingRef = useRef(false);
  const resizeStartRef = useRef<{ px: number; py: number; ow: number; oh: number } | null>(null);
  const resizePointerIdRef = useRef<number | null>(null);

  // Auto-unhide is no longer needed (bubble is always visible)

  // Ensure the client has an admin chat when opening
  useEffect(() => {
    const ensureChat = async () => {
      if (!open) return;
      if (!user || !userId) return;

      // Mark chat as "seen" when opening messenger
      localStorage.setItem('chat_last_seen_at', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('ecopro:chat-seen'));

      if (isAdmin) return;
      if (chatId) return;

      setBootingChat(true);
      try {
        const resp = await apiFetch<any>('/api/chat/create-admin-chat', {
          method: 'POST',
          body: JSON.stringify({ tier: 'support' }),
        });
        const id = Number(resp?.chat?.id ?? resp?.chat_id ?? resp?.chatId ?? resp?.id);
        if (Number.isFinite(id) && id > 0) {
          setChatId(id);
        }
      } catch {
        // ignore
      } finally {
        setBootingChat(false);
      }
    };

    void ensureChat();
  }, [open, user, userId, isAdmin, chatId]);

  // Keep position in bounds on resize
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPhonePos((p) => ({
        x: clamp(p.x, 8, Math.max(8, w - phoneSize.w - 8)),
        y: clamp(p.y, 8, Math.max(8, h - phoneSize.h - 8)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phoneSize.h, phoneSize.w]);

  useEffect(() => {
    localStorage.setItem(PHONE_POS_KEY, JSON.stringify(phonePos));
  }, [phonePos]);

  useEffect(() => {
    localStorage.setItem(PHONE_SIZE_KEY, JSON.stringify(phoneSize));
  }, [phoneSize]);

  useEffect(() => {
  }, [/* removed localStorage sync — history is now server-side */]);

  // If docked, keep the phone tethered to bubble.
  useEffect(() => {
    if (!docked) return;
    setPhonePos((p) => {
      // If user already positioned it once, keep relative offset.
      const offsetX = p.x - bubblePosRef.current.x;
      const offsetY = p.y - bubblePosRef.current.y;
      // If offset is tiny/invalid, choose a nice default.
      const ox = Number.isFinite(offsetX) && Math.abs(offsetX) > 12 ? offsetX : 72;
      const oy = Number.isFinite(offsetY) && Math.abs(offsetY) > 12 ? offsetY : -20;
      const w = window.innerWidth;
      const h = window.innerHeight;
      return {
        x: clamp(bubblePosRef.current.x + ox, 8, Math.max(8, w - phoneSize.w - 8)),
        y: clamp(bubblePosRef.current.y + oy, 8, Math.max(8, h - phoneSize.h - 8)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docked]);

  const shouldRender = !!user && !isHiddenSurface;

  const openBubble = () => {
    // record approximate bubble position (bottom-right corner) for open animation
    openFromRef.current = { x: window.innerWidth - 36, y: window.innerHeight - 36 };
    setOpen(true);
  };

  const closeMessenger = () => {
    setOpen(false);
    setAnimateIn(false);
  };

  const activeChatId = isAdmin ? adminSelectedChatId : chatId;

  // Kick off animation after open
  useEffect(() => {
    if (!open) return;
    setAnimateIn(false);
    const raf = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Allow quick hide via Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMessenger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const phoneCenter = {
    x: phonePos.x + phoneSize.w / 2,
    y: phonePos.y + phoneSize.h / 2,
  };

  const from = openFromRef.current;
  const openTransform = from
    ? `translate(${from.x - phoneCenter.x}px, ${from.y - phoneCenter.y}px) scale(0.18)`
    : 'scale(0.18)';

  const onPhonePointerDown = (e: React.PointerEvent) => {
    // Don't start dragging when interacting with header controls
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input, textarea, select')) return;
    // only drag with primary button/touch
    phoneDraggingRef.current = false;
    phonePointerIdRef.current = e.pointerId;
    phoneDragStartRef.current = { px: e.clientX, py: e.clientY, ox: phonePos.x, oy: phonePos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPhonePointerMove = (e: React.PointerEvent) => {
    if (phonePointerIdRef.current !== e.pointerId) return;
    const start = phoneDragStartRef.current;
    if (!start) return;

    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) phoneDraggingRef.current = true;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const nextPhone = {
      x: clamp(start.ox + dx, 8, Math.max(8, w - phoneSize.w - 8)),
      y: clamp(start.oy + dy, 8, Math.max(8, h - phoneSize.h - 8)),
    };

    setPhonePos(nextPhone);


  };

  const onPhonePointerUp = (e: React.PointerEvent) => {
    if (phonePointerIdRef.current !== e.pointerId) return;
    phonePointerIdRef.current = null;
    phoneDragStartRef.current = null;
  };

  const onResizeHandleDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    resizingRef.current = true;
    resizePointerIdRef.current = e.pointerId;
    resizeStartRef.current = { px: e.clientX, py: e.clientY, ow: phoneSize.w, oh: phoneSize.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizeHandleMove = (e: React.PointerEvent) => {
    if (resizePointerIdRef.current !== e.pointerId) return;
    const start = resizeStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const nextSize = {
      w: clamp(start.ow + dx, 300, Math.max(300, w - phonePos.x - 8)),
      h: clamp(start.oh + dy, 380, Math.max(380, h - phonePos.y - 8)),
    };
    setPhoneSize(nextSize);
  };

  const onResizeHandleUp = (e: React.PointerEvent) => {
    if (resizePointerIdRef.current !== e.pointerId) return;
    resizePointerIdRef.current = null;
    resizeStartRef.current = null;
    resizingRef.current = false;
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* Fixed bottom-right sparkle bubble */}
      <div className="fixed bottom-6 right-6 z-[9999]">
        <div className="relative">
          {/* Pulse ring when unread */}
          {unreadMessagesCount > 0 && (
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-60 pointer-events-none" />
          )}

          <button
            type="button"
            onClick={openBubble}
            className="relative w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center text-white border border-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              boxShadow: unreadMessagesCount > 0
                ? '0 0 0 4px rgba(99,102,241,0.25), 0 8px 32px rgba(99,102,241,0.55)'
                : '0 8px 24px rgba(99,102,241,0.4)',
            }}
            aria-label="Open assistant"
          >
            <Sparkles className="w-6 h-6" />
            {/* Online dot */}
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          </button>

          {unreadMessagesCount > 0 && (
            <div
              className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg"
              aria-label={`${unreadMessagesCount} unread messages`}
            >
              {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
            </div>
          )}
        </div>
      </div>

      {/* Compact popover card */}
      {open && (
        <div
          className="fixed bottom-[88px] right-6 z-[10000] w-80 sm:w-96 rounded-[24px] border border-white/20 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl flex flex-col"
          style={{ height: '480px', animation: 'chatPopIn 180ms ease' }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Mode tabs — clients only */}
              {!isAdmin ? (
                <div className="flex items-center gap-0.5 bg-white/15 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setChatMode('admin')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${chatMode === 'admin' ? 'bg-white/25 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}
                  >
                    <Zap className="w-3 h-3" /> Support
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatMode('ai')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${chatMode === 'ai' ? 'bg-white/25 text-white shadow-sm' : 'text-white/70 hover:text-white'}`}
                  >
                    <Sparkles className="w-3 h-3" /> AI
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white">Support</span>
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
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={closeMessenger}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex flex-col" style={{ overflow: 'hidden' }}>
            {/* ── AI mode ── */}
            {(!isAdmin && chatMode === 'ai') ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                  {aiMessages.length === 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="text-center space-y-1">
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center mx-auto shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">AI Assistant</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Ask anything about your store</p>
                      </div>
                      {alerts.length > 0 && (
                        <div className="space-y-1.5">
                          {alerts.map((alert, ai) => (
                            <div key={ai} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left ${
                              alert.type === 'urgent' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' :
                              alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                              'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                            }`}>
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              <button
                                className="flex-1 text-left hover:opacity-80 transition-opacity"
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
                                <span className="flex items-center gap-1">{alert.message}<ChevronRight className="w-3 h-3 flex-shrink-0" /></span>
                              </button>
                              <button
                                className="ml-1 flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                                title="Dismiss"
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
                          <button
                            onClick={() => copyAIMessage(m.content, i)}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            title="Copy"
                          >
                            {copiedIdx === i ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      ) : (
                        <div className="max-w-[85%] bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-2xl rounded-br-sm px-3 py-2 text-xs leading-relaxed">
                          {m.content}
                        </div>
                      )}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">Thinking…</span>
                      </div>
                    </div>
                  )}
                  <div ref={aiBottomRef} />
                </div>

                {/* Confirm strip */}
                {pendingAction && (
                  <div className="mx-3 mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-center gap-2 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-800 dark:text-amber-200 flex-1 leading-snug">
                      {pendingAction.type === 'bot_send_message'
                        ? <>Send bot message to order <strong>#{pendingAction.orderId}</strong>?</>
                        : pendingAction.type === 'create_product'
                        ? <>Create product <strong>"{pendingAction.title}"</strong> at <strong>{pendingAction.price} DZD</strong>?</>
                        : pendingAction.type === 'edit_product'
                        ? <>Update <strong>{pendingAction.field}</strong> of product <strong>#{pendingAction.productId}</strong> to <strong>"{pendingAction.value}"</strong>?</>
                        : pendingAction.type === 'delete_product'
                        ? <>Archive product <strong>"{pendingAction.title}"</strong>? (reversible)</>
                        : pendingAction.type === 'update_store_settings'
                        ? <>Change <strong>{pendingAction.field}</strong> to <strong>"{pendingAction.value}"</strong>?</>
                        : <>Update order <strong>#{pendingAction.orderId}</strong> → <strong>{pendingAction.newStatus}</strong>?</>
                      }
                    </span>
                    <button onClick={() => void confirmOrderAction()} disabled={actionLoading} className="w-6 h-6 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0">
                      {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </button>
                    <button onClick={() => setPendingAction(null)} disabled={actionLoading} className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors flex-shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 flex-shrink-0">
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendAI(); } }}
                    placeholder="Ask a question…"
                    disabled={aiLoading}
                    className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => void sendAI()}
                    disabled={aiLoading || !aiInput.trim()}
                    className="p-2 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* ── Support / Admin chat mode ── */
              <div className="flex-1 min-h-0 overflow-hidden" style={{ height: '100%' }}>
                {isAdmin ? (
                  activeChatId ? (
                    <div className="h-full overflow-hidden"><ChatWindow chatId={activeChatId} userRole="admin" userId={userId} onClose={closeMessenger} /></div>
                  ) : (
                    <ChatList userRole="admin" selectedChatId={adminSelectedChatId ?? undefined} onSelectChat={(id) => setAdminSelectedChatId(id)} />
                  )
                ) : bootingChat || !activeChatId ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-2">
                        <Zap className="w-4 h-4 text-white animate-pulse" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Connecting…</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full overflow-hidden"><ChatWindow chatId={activeChatId} userRole={userRole} userId={userId} onClose={closeMessenger} /></div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
