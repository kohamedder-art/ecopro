// Chat Page - Main Chat Interface

import React, { useState, useEffect } from 'react';
import { ChatList, ChatWindow } from '../../components/chat';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface User {
  id: number;
  email: string;
  role: 'client' | 'seller';
  clientId?: number;
  sellerId?: number;
}

export function ChatPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingChat, setCreatingChat] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) {
            setUser({
              id: parsed.id,
              email: parsed.email,
              role: parsed.role === 'admin' ? 'seller' : 'client',
              clientId: parsed.role === 'admin' ? undefined : parsed.id,
              sellerId: undefined,
            });
            setLoading(false);
            return;
          }
        }

        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const me = await meRes.json();
          localStorage.setItem('user', JSON.stringify(me));
          setUser({
            id: me.id,
            email: me.email,
            role: me.role === 'admin' ? 'seller' : 'client',
            clientId: me.role === 'admin' ? undefined : me.id,
            sellerId: undefined,
          });
        }
      } catch (err) {
        console.error('Failed to bootstrap chat user:', err);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  // Auto-create admin chat for clients
  useEffect(() => {
    const autoCreateChat = async () => {
      if (!user || user.role !== 'client' || !user.clientId) return;
      
      setCreatingChat(true);
      try {
        // Try to create/get admin chat
        const response = await apiFetch<any>('/api/chat/create-admin-chat', {
          method: 'POST',
          body: JSON.stringify({ tier: 'bronze' })
        });
        
        if (response.chat?.id) {
          setSelectedChatId(response.chat.id);
        }
      } catch (err) {
        console.error('Failed to create admin chat:', err);
      } finally {
        setCreatingChat(false);
      }
    };

    if (user && user.role === 'client') {
      autoCreateChat();
    }
  }, [user]);

  if (loading || creatingChat) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{creatingChat ? (t("chat.connecting") || 'Connecting to support...') : (t("chat.loading") || 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 overflow-hidden">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to access chat</p>
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const userRole = user.clientId ? 'client' : 'seller';
  const userId = user.clientId || user.sellerId || 0;

  return (
    <div className="flex w-full h-full bg-white dark:bg-slate-950 overflow-hidden">
      {/* Sidebar — chat list */}
      <div className={`w-full md:w-[360px] lg:w-[380px] border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 flex-shrink-0 ${
        selectedChatId ? 'hidden md:flex' : 'flex'
      }`}>
        <ChatList
          userRole={userRole}
          selectedChatId={selectedChatId ?? undefined}
          onSelectChat={setSelectedChatId}
        />
      </div>

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${
        selectedChatId ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedChatId ? (
          <ChatWindow
            chatId={selectedChatId}
            userRole={userRole}
            userId={userId}
            onClose={() => setSelectedChatId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
            <div className="text-center px-6 max-w-sm">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/10 dark:to-purple-500/10 flex items-center justify-center mx-auto mb-5">
                <svg className="w-9 h-9 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1.5">
                {userRole === 'seller' ? 'Select a conversation' : 'Welcome to Support'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {userRole === 'seller'
                  ? 'Choose a customer from the sidebar to view and respond to their messages'
                  : 'Send us a message and we\'ll get back to you as soon as possible'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
