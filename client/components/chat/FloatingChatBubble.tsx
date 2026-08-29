import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Zap, Sparkles, Send, Loader2, Check, AlertTriangle, Copy, ChevronRight, ExternalLink, Paperclip, MessageCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/contexts/NotificationContext';
import { useTranslation } from '@/lib/i18n';
import { safeJsonParse } from '@/utils/safeJson';
import { apiFetch } from '@/lib/api';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CONTACT_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  messenger: '#1877F2',
  instagram: '#E4405F',
  email: '#EA4335',
  phone: '#10b981',
  viber: '#7B519D',
  custom: '#6366f1',
};

const CONTACT_ICONS: Record<string, React.ReactNode> = {
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  ),
  messenger: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.2l3.131 3.259L19.752 8.2l-6.561 6.763z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 1 1-2.882 0 1.441 1.441 0 0 1 2.882 0z"/>
    </svg>
  ),
  email: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>,
  viber: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M3.006 7.236c.143-1.084.828-2.059 1.749-2.59.922-.532 2.061-.532 2.983 0l2.23 1.288c1.843 1.063 4.115 1.063 5.958 0l2.23-1.288c.922-.532 2.061-.532 2.983 0 .921.531 1.606 1.506 1.749 2.59.143 1.084-.095 2.18-.67 3.048v4.832c0 .826-.393 1.603-1.055 2.108-.661.505-1.514.588-2.268.225l-1.868-1.078c-.922-.532-2.061-.532-2.983 0l-1.115.644c-.922.531-2.061.531-2.983 0l-1.115-.644c-.922-.532-2.061-.532-2.983 0l-1.869 1.078c-.753.362-1.606.279-2.267-.226-.662-.505-1.055-1.282-1.055-2.107V10.284c-.575-.867-.813-1.964-.67-3.048z"/>
    </svg>
  ),
};

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

  type ChatMode = 'admin' | 'ai' | 'contact';
  const [chatMode, setChatMode] = useState<ChatMode>('admin');

  // Admin contacts state
  type AdminContact = { platform: string; label: string; url: string; icon_url?: string };
  const [adminContacts, setAdminContacts] = useState<AdminContact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  type AIMsg = { role: 'user' | 'assistant'; content: string; imageUrl?: string; sources?: { title: string; uri: string }[]; createdAt?: number };
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

  // Fetch admin contacts when bubble opens
  useEffect(() => {
    if (!open || contactsLoaded) return;
    setContactsLoaded(true);
    fetch('/api/admin-contacts/public')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.contacts?.length) setAdminContacts(d.contacts); })
      .catch(() => {});
  }, [open, contactsLoaded]);

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
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Image is too large (max 4MB). Please choose a smaller one.', createdAt: Date.now() }]);
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
    const userMsg: AIMsg = { role: 'user', content: q || '(image attached)', ...(attachedImg ? { imageUrl: attachedImg } : {}), createdAt: Date.now() };
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
      const assistantMsg: AIMsg = { role: 'assistant', content: result.answer, ...(result.sources?.length ? { sources: result.sources } : {}), createdAt: Date.now() };
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
      } else if (typeof result.action?.type === 'string' &&
          (result.action.type.startsWith('get_') || result.action.type.startsWith('search_') || result.action.type.startsWith('list_'))) {
        void executeReadOnlyAction(result.action as AIAction);
      }
    } catch {
      setAiMessages([...next, { role: 'assistant', content: 'Could not reach the AI service. Please check your connection and try again.', createdAt: Date.now() }]);
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
        setAiMessages(prev => [...prev, { role: 'assistant', content: `✓ ${data.message}${preview}`, createdAt: Date.now() }]);
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not apply bot action: ${data.error}`, createdAt: Date.now() }]);
      }
    } catch {
        setAiMessages(prev => [...prev, { role: 'assistant', content: 'Failed to apply bot action. Please check your connection.', createdAt: Date.now() }]);
    }
  };

  const executeReadOnlyAction = async (action: AIAction) => {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)ecopro_csrf=([^;]*)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    try {
      const res = await fetch('/api/ai/exec-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setAiMessages(prev => [...prev, { role: 'assistant', content: data.message, createdAt: Date.now() }]);
      } else if (!res.ok) {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `Could not fetch data: ${data.error || 'Unknown error'}`, createdAt: Date.now() }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Failed to fetch data. Please check your connection.', createdAt: Date.now() }]);
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
        setAiMessages(prev => [...prev, { role: 'assistant', content: res.ok ? `✓ ${data.message}` : `Could not complete: ${data.error}`, createdAt: Date.now() }]);
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
        setAiMessages(prev => [...prev, { role: 'assistant', content: res.ok ? `✓ ${data.message}` : `Could not complete: ${data.error}`, createdAt: Date.now() }]);
        if (res.ok) {
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
      setAiMessages(prev => [...prev, { role: 'assistant', content: res.ok ? `✓ Done — ${data.message}` : `Could not update the order: ${data.error}`, createdAt: Date.now() }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Failed to complete action. Please check your connection.', createdAt: Date.now() }]);
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
      } finally {
        setBootingChat(false);
      }
    };
    void ensureChat();
  }, [open, user, userId, isAdmin, chatId]);

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
      {/* Floating contact bubbles — fan out vertically above the main button */}
      {!isAdmin && open && adminContacts.length > 0 && (
        <div className={`fixed z-[9999] flex flex-col-reverse gap-3 ${isEditorPage ? 'left-4' : 'right-4'}`} style={{ bottom: '88px' }}>
          {adminContacts.map((ch, i) => (
            <a
              key={ch.platform + ch.url}
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all"
              style={{
                backgroundColor: CONTACT_COLORS[ch.platform] || '#6366f1',
                animation: `fcb-bubble-in 200ms ease ${i * 50}ms both`,
                boxShadow: `0 4px 14px ${CONTACT_COLORS[ch.platform] || '#6366f1'}44`,
              }}
              title={ch.label}
            >
              {CONTACT_ICONS[ch.platform] || <MessageCircle className="w-5 h-5" />}
            </a>
          ))}
        </div>
      )}

      {/* Floating trigger button */}
      <div className={`fixed bottom-20 sm:bottom-4 z-[9999] ${isEditorPage ? 'left-4' : 'right-4'}`}>
        <div className="relative">
          {unreadMessagesCount > 0 && (
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-60 pointer-events-none" />
          )}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="relative w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-slate-900 dark:bg-black flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              boxShadow: unreadMessagesCount > 0
                ? '0 0 0 4px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.12)'
                : '0 8px 24px rgba(0,0,0,0.1)',
            }}
            aria-label={t('chat.openAssistant')}
          >
            {open ? <X className="w-5 h-5" /> : <MessageBubbleIcon />}
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

      {/* Chat panel */}
      {open && adminContacts.length === 0 && (
        <>
          <div className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-[2px] sm:hidden" onClick={closeMessenger} />

          <div
            className={
              'fixed z-[10000] bottom-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 transition-all duration-300 ease-out '
              + (isEditorPage ? 'left-0' : 'right-0')
              + ' '
              + (expanded
                ? '!z-[99999] shadow-2xl w-full sm:!w-[576px] sm:!rounded-2xl sm:!bottom-[88px] sm:!right-6 !rounded-t-2xl'
                : 'shadow-2xl w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl sm:right-6 sm:bottom-[88px]'
              )
              + ' '
              + (open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')
            }
            style={{
              ...(expanded ? { top: '72px', bottom: '88px', maxHeight: 'calc(100dvh - 160px)' } : { height: 'min(650px, calc(100dvh - 120px))' }),
              animation: 'fcb-slide-up 180ms ease',
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* ── Header (Render-style) ── */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 flex-shrink-0 bg-slate-900 dark:bg-black">
              <div className="flex items-center gap-2.5">
                {/* Back arrow (only in AI mode when admin is viewing or on support sub-view) */}
                {!isAdmin && chatMode === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setChatMode('ai')}
                    className="p-1 -ml-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    aria-label="Back"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15,18 9,12 15,6" />
                    </svg>
                  </button>
                )}
                {isAdmin && activeChatId && (
                  <button
                    type="button"
                    onClick={() => setAdminSelectedChatId(null)}
                    className="p-1 -ml-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    aria-label="Back to chat list"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15,18 9,12 15,6" />
                    </svg>
                  </button>
                )}
                {/* Logo */}
                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                </div>
                {/* Title + subtitle */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-white leading-tight truncate">
                    Sahla4Eco
                  </span>
                  <span className="text-[11px] text-slate-400 leading-tight truncate">
                    The team can also help
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {/* More options (three dots) */}
                <button
                  type="button"
                  onClick={() => setExpanded(v => !v)}
                  className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  aria-label="More options"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
                {/* Close */}
                <button
                  type="button"
                  onClick={closeMessenger}
                  className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  aria-label={t('chat.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Mode tabs (subtle, below header) ── */}
            {!isAdmin && (
              <div className="flex border-b border-slate-800 flex-shrink-0 bg-slate-900 dark:bg-black">
                <button
                  type="button"
                  onClick={() => setChatMode('admin')}
                  className={`flex-1 py-2 text-[12px] font-medium relative transition-colors ${
                    chatMode === 'admin'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('chat.support')}
                  {chatMode === 'admin' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode('ai')}
                  className={`flex-1 py-2 text-[12px] font-medium relative transition-colors ${
                    chatMode === 'ai'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('chat.ai')}
                  {chatMode === 'ai' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-slate-900 dark:bg-white rounded-full" />
                  )}
                </button>
              </div>
            )}

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
              {(!isAdmin && chatMode === 'ai') ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Messages area */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-0 scroll-smooth">
                    {aiMessages.length === 0 && (
                      <div className="space-y-4 pt-6">
                        {/* Wave emoji greeting */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                            👋 How can we help you today?
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                            To help us assist you more efficiently, please describe your issue in detail.
                          </div>
                        </div>

                        {/* Bold details */}
                        <div className="flex justify-start">
                          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                            <p className="font-semibold text-slate-900 dark:text-white">Make sure to include details about what you're seeing, any service-specific details, serviceIDs, custom domains, log output etc.</p>
                          </div>
                        </div>

                        {/* Info message */}
                        <div className="flex justify-start">
                          <div className="space-y-1.5 max-w-[85%]">
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                              As a <span className="font-semibold">Hobby</span> workspace customer, you will receive responses from an AI agent and can talk to the team if needed.
                            </div>
                            <div className="flex items-center gap-1.5 px-1">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">Sahla4Eco</span>
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">AI Assistant</span>
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">Just now</span>
                            </div>
                          </div>
                        </div>

                        {alerts.length > 0 && (
                          <div className="space-y-2 pt-2">
                            {alerts.map((alert, ai) => (
                              <div
                                key={ai}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium ${
                                  alert.type === 'urgent'
                                    ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20'
                                    : alert.type === 'warning'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20'
                                }`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                                <button
                                  className="flex-1 text-left hover:opacity-70 transition-opacity"
                                  onClick={() => {
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
                                  onClick={() => setAlerts(prev => prev.filter((_, idx) => idx !== ai))}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2 pt-2">
                          {SUGGESTED_QUESTIONS.map((sq, si) => (
                            <button
                              key={si}
                              onClick={() => void sendAI(sq)}
                              disabled={aiLoading}
                              className="w-full text-left text-[13px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-40 truncate overflow-hidden whitespace-nowrap"
                            >
                              {sq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiMessages.map((m, i) => {
                      const showTimestamp = m.createdAt && (i === aiMessages.length - 1 || aiMessages[i + 1]?.role !== m.role);
                      return (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${i > 0 ? 'mt-2' : ''}`}>
                          {m.role === 'assistant' ? (
                            <div className="space-y-1 max-w-[85%]">
                              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                                {m.imageUrl && (
                                  <img src={m.imageUrl} alt={t('chat.imageAttached')} className="max-w-full max-h-32 rounded-lg mb-2 object-cover" />
                                )}
                                <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                              </div>
                              {showTimestamp && (
                                <div className="flex items-center gap-1.5 px-1">
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Sahla4Eco</span>
                                  <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">AI Assistant</span>
                                  <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Just now</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1 max-w-[85%]">
                              <div className="bg-slate-900 dark:bg-slate-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] leading-relaxed">
                                {m.imageUrl && (
                                  <img src={m.imageUrl} alt={t('chat.imageAttached')} className="max-w-full max-h-32 rounded-lg mb-2 object-cover" />
                                )}
                                {m.content !== '(image attached)' && <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>}
                              </div>
                            </div>
                          )}
                          {m.sources && m.sources.length > 0 && (
                            <div className="mt-1.5 px-1 space-y-0.5 max-w-[85%]">
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <ExternalLink className="w-2.5 h-2.5" />
                                {t('chat.sources', { count: m.sources.length })}
                              </p>
                              {m.sources.slice(0, 5).map((src, si) => (
                                <a
                                  key={si}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 truncate transition-colors"
                                  title={src.uri}
                                >
                                  {src.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {aiLoading && (
                      <div className="flex justify-start mt-2">
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={aiBottomRef} />
                  </div>

                  {pendingAction && (
                    <div className="mx-4 mb-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 flex items-center gap-2.5 flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
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
                      <button onClick={() => void confirmOrderAction()} disabled={actionLoading} className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0">
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setPendingAction(null)} disabled={actionLoading} className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors flex-shrink-0 hover:bg-slate-300 dark:hover:bg-white/20">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {aiAttachedImage && (
                    <div className="mx-4 mb-2 flex items-center gap-2.5">
                      <div className="relative">
                        <img src={aiAttachedImage} alt={t('chat.imageAttached')} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                        <button
                          onClick={() => setAiAttachedImage(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-600 text-white flex items-center justify-center shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[12px] text-slate-400">{t('chat.imageAttached')}</span>
                    </div>
                  )}

                  {/* ── Input bar (Render-style) ── */}
                  <div className="px-3 pb-3 pt-1 flex-shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5">
                      <button
                        onClick={() => aiImageInputRef.current?.click()}
                        disabled={aiLoading}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 flex-shrink-0"
                        title={t('chat.attachImage')}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input type="file" ref={aiImageInputRef} accept="image/*" className="hidden" onChange={handleAiImageAttach} />

                      <textarea
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendAI(); } }}
                        placeholder="Ask a question..."
                        disabled={aiLoading}
                        rows={1}
                        className="flex-1 text-[13px] bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none overflow-hidden min-h-[36px] py-1.5"
                      />

                      <button
                        onClick={() => void sendAI()}
                        disabled={aiLoading || (!aiInput.trim() && !aiAttachedImage)}
                        className={`p-1.5 rounded-md transition-all flex-shrink-0 ${(aiInput.trim() || aiAttachedImage) ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${(aiInput.trim() || aiAttachedImage) ? 'bg-slate-200 dark:bg-slate-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5,12 12,5 19,12" />
                          </svg>
                        </div>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center mt-2">
                      AI responses may be inaccurate. Verify important information.
                    </p>
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
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-[13px]">{t('chat.connecting')}</p>
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
        @keyframes fcb-bubble-in {
          from { opacity: 0; transform: scale(0.3) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}

function MessageBubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
