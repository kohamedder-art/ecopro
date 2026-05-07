import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  requestNotificationPermission, 
  notifyNewOrder, 
  notifyNewMessage,
  getNotificationPermission 
} from '@/utils/browserNotifications';
import { useTranslation } from '@/lib/i18n';
import { Bell, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { safeJsonParse } from '@/utils/safeJson';

interface NotificationContextType {
  notificationPermission: NotificationPermission | 'unsupported';
  newOrdersCount: number;
  unreadMessagesCount: number;
  requestPermission: () => Promise<NotificationPermission>;
  showPrompt: boolean;
  dismissPrompt: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Storage keys
const ORDERS_LAST_SEEN_KEY = 'orders_last_seen_at';
const CHAT_LAST_SEEN_KEY = 'chat_last_seen_at';
const PERMISSION_ASKED_KEY = 'notification_permission_asked';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const user = typeof window !== 'undefined' ? safeJsonParse(localStorage.getItem('user'), null as any) : null;
  const isAdmin = user?.role === 'admin' || user?.user_type === 'admin';
  const isClient = !!user && !isAdmin;
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  
  const prevOrdersCount = useRef(0);
  const prevMessagesCount = useRef(0);
  const ordersInFlight = useRef(false);
  const unreadInFlight = useRef(false);

  // Check permission on mount
  useEffect(() => {
    const permission = getNotificationPermission();
    setNotificationPermission(permission);
    
    // Show prompt if permission hasn't been asked yet
    const hasAsked = localStorage.getItem(PERMISSION_ASKED_KEY);
    if (permission === 'default' && !hasAsked) {
      setTimeout(() => setShowPrompt(true), 3000);
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    localStorage.setItem(PERMISSION_ASKED_KEY, 'true');
    setShowPrompt(false);
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  // Dismiss prompt
  const dismissPrompt = useCallback(() => {
    localStorage.setItem(PERMISSION_ASKED_KEY, 'true');
    setShowPrompt(false);
  }, []);

  // Fetch new orders count
  const fetchNewOrdersCount = useCallback(async () => {
    if (!isClient) return;
    if (ordersInFlight.current) return;
    ordersInFlight.current = true;
    try {
      const lastSeen = localStorage.getItem(ORDERS_LAST_SEEN_KEY);
      const params = lastSeen ? `?since=${encodeURIComponent(lastSeen)}` : '';
      const res = await fetch(`/api/orders/new-count${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const newCount = data.count || 0;
        
        // Show browser notification if there are new orders
        if (newCount > prevOrdersCount.current && newCount > 0) {
          notifyNewOrder(newCount, () => navigate('/dashboard/orders'), locale);
          toast({
            title: newCount === 1
              ? (locale === 'ar' ? 'طلب جديد' : 'New order')
              : (locale === 'ar' ? `${newCount} طلبات جديدة` : `${newCount} new orders`),
            description: locale === 'ar' ? 'افتح الطلبات لمراجعتها.' : 'Open Orders to review them.',
          });
        }
        
        prevOrdersCount.current = newCount;
        setNewOrdersCount(newCount);
      }
    } catch (err) {
      console.error('Failed to fetch new orders count:', err);
    } finally {
      ordersInFlight.current = false;
    }
  }, [isClient, navigate]);

  // Fetch unread messages count
  const fetchUnreadCount = useCallback(async () => {
    if (unreadInFlight.current) return;
    unreadInFlight.current = true;
    try {
      const res = await fetch('/api/chat/unread-count', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const newCount = data.unread_count || 0;
        const chatPath = isAdmin ? '/platform-admin/chat' : '/chat';
        
        // Show browser notification if there are new messages
        if (newCount > prevMessagesCount.current && newCount > 0) {
          notifyNewMessage(newCount, () => navigate(chatPath), locale);
          toast({
            title: newCount === 1
              ? (locale === 'ar' ? 'رسالة جديدة' : 'New message')
              : (locale === 'ar' ? `${newCount} رسائل غير مقروءة` : `${newCount} unread messages`),
            description: locale === 'ar' ? 'افتح الدعم للرد.' : 'Open Support to reply.',
          });
        }
        
        prevMessagesCount.current = newCount;
        setUnreadMessagesCount(newCount);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    } finally {
      unreadInFlight.current = false;
    }
  }, [isAdmin, navigate]);

  // Allow non-route-based chat experiences (floating messenger overlay) to clear badges immediately
  useEffect(() => {
    if (!user) return;

    const onChatSeen = () => {
      localStorage.setItem(CHAT_LAST_SEEN_KEY, new Date().toISOString());
      setUnreadMessagesCount(0);
      // Prevent re-firing notifications during the immediate re-sync.
      prevMessagesCount.current = Number.MAX_SAFE_INTEGER;
      // Re-sync from server quickly
      void fetchUnreadCount();
    };

    window.addEventListener('ecopro:chat-seen', onChatSeen as EventListener);
    return () => window.removeEventListener('ecopro:chat-seen', onChatSeen as EventListener);
  }, [fetchUnreadCount, user]);

  // Mark orders/chat as seen when visiting related pages
  useEffect(() => {
    if (location.pathname.startsWith('/dashboard/orders')) {
      localStorage.setItem(ORDERS_LAST_SEEN_KEY, new Date().toISOString());
      setNewOrdersCount(0);
      prevOrdersCount.current = 0;
    }

    if (
      location.pathname === '/chat' ||
      location.pathname.startsWith('/chat/') ||
      location.pathname === '/platform-admin/chat' ||
      location.pathname.startsWith('/platform-admin/chat/')
    ) {
      localStorage.setItem(CHAT_LAST_SEEN_KEY, new Date().toISOString());
      setUnreadMessagesCount(0);
      prevMessagesCount.current = 0;
    }
  }, [location.pathname]);

  // Poll for updates
  useEffect(() => {
    // Poll on any logged-in non-storefront page.
    const shouldPoll = !location.pathname.startsWith('/store/');
    if (!shouldPoll) return;
    if (!user) return;

    // Initial fetch
    fetchNewOrdersCount();
    fetchUnreadCount();
    
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchNewOrdersCount();
      fetchUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchNewOrdersCount, fetchUnreadCount, location.pathname, user]);

  return (
    <NotificationContext.Provider value={{
      notificationPermission,
      newOrdersCount,
      unreadMessagesCount,
      requestPermission,
      showPrompt,
      dismissPrompt,
    }}>
      {children}
      
      {/* Global Notification Permission Prompt */}
      {showPrompt && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
          <div 
            className="bg-white rounded-xl shadow-2xl border border-blue-200 p-4 max-w-sm"
            style={{ boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)' }}
          >
            <button 
              onClick={dismissPrompt}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">
                  {locale === 'ar' ? 'تفعيل الإشعارات' : 'Enable Notifications'}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {locale === 'ar' 
                    ? 'احصل على إشعارات فورية للطلبات الجديدة والرسائل'
                    : 'Get instant alerts for new orders and messages'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={requestPermission}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    {locale === 'ar' ? 'تفعيل' : 'Enable'}
                  </button>
                  <button
                    onClick={dismissPrompt}
                    className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg transition-colors text-sm"
                  >
                    {locale === 'ar' ? 'لاحقاً' : 'Later'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
