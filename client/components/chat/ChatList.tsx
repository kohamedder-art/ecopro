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
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {userRole === 'admin' ? 'Tickets' : 'Messages'}
            </h2>
          </div>
          {userRole === 'client' && onCreateChat && (
            <button
              onClick={onCreateChat}
              className="p-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10 text-violet-500 transition"
              title="Start new chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search and Filter - Admin/Seller only */}
        {(userRole === 'admin' || userRole === 'seller') && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-[11px]"
              />
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setSortBy('recent')}
                className={`flex-1 text-[10px] font-semibold py-1 px-2 rounded-lg transition ${
                  sortBy === 'recent'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('unread')}
                className={`flex-1 text-[10px] font-semibold py-1 px-2 rounded-lg transition ${
                  sortBy === 'unread'
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
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
          <div className="p-2.5 m-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-200 border-t-violet-600 mx-auto mb-2"></div>
            <p className="text-slate-400 text-[11px]">Loading…</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 text-slate-200 dark:text-slate-700" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No chats yet</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {searchTerm ? 'Try a different search' : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full px-3 py-2.5 text-left transition-colors ${
                  selectedChatId === chat.id
                    ? 'bg-violet-50 dark:bg-violet-500/10 border-l-2 border-violet-500'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate text-xs">
                        {userRole === 'admin' || userRole === 'seller'
                          ? chat.client_name || 'Unknown'
                          : 'Support Team'}
                      </p>
                      {chat.unread_count! > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex-shrink-0">
                          {Math.min(chat.unread_count || 0, 9)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{chat.client_email}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {formatTime(chat.last_message_at)}
                  </span>
                </div>

                {/* Status and Tier */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {chat.status && chat.status !== 'active' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                        {chat.status}
                      </span>
                    )}
                    {chat.tier && getTierBadge(chat.tier)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
