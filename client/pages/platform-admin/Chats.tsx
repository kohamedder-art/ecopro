/**
 * Admin Chat Management
 * Same design as client ChatPage for consistency
 */

import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, Plus, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import Header from '@/components/layout/Header';

interface Chat {
  id: number;
  client_id: number;
  client_name: string;
  client_email: string;
  unread_count: number;
  last_message_at: string;
  status: string;
}

interface Message {
  id: number;
  sender_id: number;
  sender_type: 'admin' | 'client';
  message_content: string;
  message_type: string;
  metadata?: any;
  created_at: string;
  is_read?: boolean;
}

const TIERS = [
  { id: 'bronze', name: 'Bronze', bgColor: 'bg-amber-500' },
  { id: 'silver', name: 'Silver', bgColor: 'bg-slate-400' },
  { id: 'gold', name: 'Gold', bgColor: 'bg-yellow-500' },
];

export default function AdminChats() {
  const { t } = useTranslation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [issuingCode, setIssuingCode] = useState<string | null>(null);

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedChatId]);

  const loadChats = async () => {
    try {
      const response = await apiFetch<any>('/api/chat/admin/all-chats');
      if (response.chats) {
        setChats(response.chats);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load chats:', err);
      setError('Failed to load chats');
    }
  };

  const loadMessages = async () => {
    if (!selectedChatId) return;
    try {
      const response = await apiFetch<any>(`/api/chat/${selectedChatId}/messages`);
      if (response.items) {
        setMessages(response.items);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChatId) return;

    setLoading(true);
    try {
      await apiFetch(`/api/chat/${selectedChatId}/message`, {
        method: 'POST',
        body: JSON.stringify({
          chat_id: selectedChatId,
          message_content: input,
          message_type: 'text',
        }),
      });
      setInput('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCode = async (tier: string) => {
    if (!selectedChatId) return;

    const selectedChat = chats.find(c => c.id === selectedChatId);
    if (!selectedChat) {
      console.error('Selected chat not found');
      return;
    }

    setIssuingCode(tier);
    try {
      console.log('Issuing code for tier:', tier, 'Chat ID:', selectedChatId, 'Client ID:', selectedChat.client_id);
      
      const response = await apiFetch<any>('/api/codes/admin/issue', {
        method: 'POST',
        body: JSON.stringify({
          chat_id: selectedChatId,
          client_id: selectedChat.client_id,
          tier,
          payment_method: 'admin',
        }),
      });

      console.log('Code response:', response);

      if (response && response.success && response.code) {
        const message = `🎁 ${tier.toUpperCase()} Code Generated\n\n\`${response.code}\`\n\nValid for: 1 hour\n\nPlease send payment proof and I'll confirm.`;
        
        await apiFetch(`/api/chat/${selectedChatId}/message`, {
          method: 'POST',
          body: JSON.stringify({
            chat_id: selectedChatId,
            message_content: message,
            message_type: 'text',
          }),
        });

        await loadMessages();
        setShowCodePanel(false);
      } else {
        console.error('Invalid response structure:', response);
      }
    } catch (err: any) {
      console.error('Failed to issue code:', err);
      alert(`Failed to issue code: ${err.message || 'Unknown error'}`);
    } finally {
      setIssuingCode(null);
    }
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
  const filteredChats = chats.filter(chat =>
    chat.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.client_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <Header />
      <div className="flex flex-col md:flex-row w-full h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      {/* Chat List */}
      <div className="w-full md:w-1/3 bg-white border-r flex flex-col min-h-0 order-2 md:order-1">
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('admin.chats.title')}</h2>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.chats.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('admin.chats.noChats')}</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`w-full px-4 py-3 border-b text-left hover:bg-gray-50 transition ${
                  selectedChatId === chat.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {chat.client_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{chat.client_name}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{chat.client_email}</p>
                  </div>

                  {/* Unread Badge */}
                  {chat.unread_count > 0 && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {chat.unread_count}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-2/3 bg-white flex flex-col min-h-0 order-1 md:order-2 overflow-hidden">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{selectedChat.client_name}</h2>
                <p className="text-xs text-gray-500">{selectedChat.client_email}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.sender_type === 'admin'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message_content}</p>
                    {msg.metadata?.image_url && (
                      <img 
                        src={msg.metadata.image_url} 
                        alt="Upload" 
                        className="mt-2 max-w-xs rounded-lg"
                      />
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender_type === 'admin' ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-white space-y-3">
              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('admin.chats.messagePlaceholder')}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {input.trim() ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {t('admin.chats.send')}
                  </button>
                ) : null}
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-gray-500">
            <MessageCircle className="w-12 h-12 opacity-30" />
            <div className="text-center">
              <h3 className="font-semibold mb-1 text-gray-700">{t('admin.chats.selectChat')}</h3>
              <p className="text-sm">{t('admin.chats.selectChatDesc')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
