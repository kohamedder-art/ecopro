// Chat List Component - Side Panel with Rich UI

import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, Search, ArrowLeft, Zap, AlertCircle } from 'lucide-react';

interface ChatPreview {
  id: number;
  client_id?: number;
  client_name?: string;
  client_email?: string;
  unread_count?: number;
  last_message_at?: string;
  status: string;
  tier?: string;
}

interface ChatListProps {
  userRole: 'client' | 'seller' | 'admin';
  selectedChatId?: number;
  onSelectChat: (chatId: number) => void;
  onCreateChat?: () => void;
}

export function ChatList({ userRole, selectedChatId, onSelectChat, onCreateChat }: ChatListProps) {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'unread'>('recent');

  useEffect(() => {
    loadChats();
    // Refresh chats every 30 seconds
    const interval = setInterval(loadChats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter and sort chats based on search and sort preference
    let filtered = chats.filter((chat) => {
      const searchText = searchTerm.toLowerCase();
      if (userRole === 'admin' || userRole === 'seller') {
        return (
          (chat.client_name?.toLowerCase().includes(searchText) ||
          chat.client_email?.toLowerCase().includes(searchText))
        );
      }
      return true;
    });

    // Sort chats
    if (sortBy === 'unread') {
      filtered = filtered.sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0));
    }

    setFilteredChats(filtered);
  }, [chats, searchTerm, sortBy, userRole]);

  const loadChats = async () => {
    setLoading(true);
    try {
      const endpoint = userRole === 'admin' ? '/api/chat/admin/all-chats' : '/api/chat/list';
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to load chats');
      }

      const data = await response.json();
      setChats(data.chats || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load chats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'No messages';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTierBadge = (tier?: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
      silver: 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-300',
      gold: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    };
    const icons: Record<string, string> = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
    };
    
    if (!tier) return null;
    return (
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors[tier] || 'bg-gray-700 text-gray-200'}`}>
        {icons[tier]} {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {userRole === 'admin' ? 'Tickets' : 'Messages'}
          </h2>
          {userRole === 'client' && onCreateChat && (
            <button
              onClick={onCreateChat}
              className="w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition shadow-sm"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        {(userRole === 'admin' || userRole === 'seller') && (
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-0"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('recent')}
                className={`text-xs font-medium py-1.5 px-3.5 rounded-full transition ${
                  sortBy === 'recent'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('unread')}
                className={`text-xs font-medium py-1.5 px-3.5 rounded-full transition ${
                  sortBy === 'unread'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Unread ({chats.reduce((sum, c) => sum + (c.unread_count || 0), 0)})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-3 mx-4 mb-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-200 border-t-violet-600 mx-auto mb-3"></div>
            <p className="text-slate-400 text-sm">Loading…</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-slate-400 dark:text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No conversations</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {searchTerm ? 'Try a different search' : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          <div>
            {filteredChats.map((chat) => {
              const isSelected = selectedChatId === chat.id;
              const hasUnread = (chat.unread_count || 0) > 0;
              const displayName = (userRole === 'admin' || userRole === 'seller')
                ? (chat.client_name || 'Unknown')
                : 'Support Team';
              const initials = displayName.slice(0, 2).toUpperCase();

              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full px-4 py-3.5 text-left flex items-center gap-3 transition-colors ${
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    (userRole === 'admin' || userRole === 'seller')
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                  }`}>
                    {(userRole === 'admin' || userRole === 'seller') ? initials : '🛟'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={`truncate text-sm ${hasUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                        {displayName}
                      </p>
                      <span className={`text-[11px] flex-shrink-0 ${hasUnread ? 'text-violet-600 dark:text-violet-400 font-semibold' : 'text-slate-400'}`}>
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${hasUnread ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        {chat.tier ? `${chat.tier.charAt(0).toUpperCase() + chat.tier.slice(1)} Plan` : (chat.client_email || 'Tap to view messages')}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {chat.status && chat.status !== 'active' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            {chat.status}
                          </span>
                        )}
                        {hasUnread && (
                          <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {Math.min(chat.unread_count || 0, 9)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
