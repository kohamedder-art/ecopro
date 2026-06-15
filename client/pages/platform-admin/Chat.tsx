/**
 * Admin Chat Page - Full Screen
 * Clean, dedicated chat interface for admin
 */

import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, Send, AlertCircle, Plus, UserPlus, X, Tag, Percent, DollarSign, Gift, CheckCircle, Sparkles, Loader2, Paperclip } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Header from '@/components/layout/Header';
import { useAI } from '@/hooks/useAI';
import { useAISettings } from '@/hooks/useAISettings';
import { useToast } from '@/components/ui/use-toast';
import { FileUploadUI } from '../../components/chat/FileUploadUI';

declare global {
  interface Window {
    __ADMIN_CHAT_INSTANCE__?: {
      generateReplySuggestions: () => void;
    };
  }
}

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

interface SearchedClient {
  id: number;
  name: string;
  email: string;
  has_chat: number;
}

interface AffiliateInfo {
  client_id: number;
  client_name: string;
  has_affiliate: boolean;
  affiliate?: {
    id: number;
    name: string;
    voucher_code: string;
    payment_amount: number;
    earn_per_referral: number;
    commission_months: number;
  };
}

const TIERS = [
  { id: 'bronze', name: 'Bronze', bgColor: 'bg-amber-500' },
  { id: 'silver', name: 'Silver', bgColor: 'bg-slate-400' },
  { id: 'gold', name: 'Gold', bgColor: 'bg-yellow-500' },
];

export default function AdminChat() {
  const { toast } = useToast();
  const { data: aiSettings } = useAISettings();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expose function to child components
  useEffect(() => {
    (window as any).__ADMIN_CHAT_INSTANCE__ = {
      generateReplySuggestions,
    };
    return () => {
      delete (window as any).__ADMIN_CHAT_INSTANCE__;
    };
  }, [messages, aiSettings]);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [issuingCode, setIssuingCode] = useState<string | null>(null);
  
  // Affiliate info state
  const [affiliateInfo, setAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [loadingAffiliateInfo, setLoadingAffiliateInfo] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  
  // New chat modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [searchedClients, setSearchedClients] = useState<SearchedClient[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      loadMessages();
      setPaymentRecorded(false);
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedChatId]);

  // Load affiliate info when chat is selected and chats are loaded
  useEffect(() => {
    if (selectedChatId && chats.length > 0) {
      loadAffiliateInfo();
    }
  }, [selectedChatId, chats]);

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

  const loadAffiliateInfo = async () => {
    const selectedChat = chats.find(c => Number(c.id) === selectedChatId);
    if (!selectedChat?.client_id) return;
    
    setLoadingAffiliateInfo(true);
    try {
      const response = await apiFetch<AffiliateInfo>(`/api/affiliates/admin/client/${selectedChat.client_id}`);
      setAffiliateInfo(response);
    } catch (err) {
      console.error('Failed to load affiliate info:', err);
      setAffiliateInfo(null);
    } finally {
      setLoadingAffiliateInfo(false);
    }
  };

  const recordAffiliatePayment = async () => {
    if (!affiliateInfo || !affiliateInfo.has_affiliate) return;
    
    setRecordingPayment(true);
    try {
      const response = await apiFetch<any>('/api/affiliates/admin/record-payment', {
        method: 'POST',
        body: JSON.stringify({
          client_id: affiliateInfo.client_id,
          amount_paid: affiliateInfo.pricing.final_price,
          payment_method: 'manual',
        }),
      });
      
      if (response.success) {
        setPaymentRecorded(true);
        // Reload affiliate info to update payment count
        await loadAffiliateInfo();
      }
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChatId) return;

    const chatId = Number(selectedChatId);
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/chat/${chatId}/message`, {
        method: 'POST',
        body: JSON.stringify({
          chat_id: chatId,
          message_content: input,
          message_type: 'text',
        }),
      });
      console.log('Message sent:', response);
      setInput('');
      await loadMessages();
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = e.clipboardData?.files?.[0];
    if (!file || !file.type.startsWith('image/') || !selectedChatId) return;
    e.preventDefault();

    const chatId = Number(selectedChatId);
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/chat/${chatId}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }
      await loadMessages();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload pasted image');
    } finally {
      setLoading(false);
    }
  };

  const generateReplySuggestions = async () => {
    if (!aiSettings?.reply_suggestions || !messages.length) return;
    
    try {
      const lastMessage = messages[messages.length - 1];
      const situation = lastMessage.sender_type === 'client' 
        ? `Customer: ${lastMessage.message_content}`
        : `Last reply: ${lastMessage.message_content}`;
      
      const res = await fetch('/api/ai/order/reply-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ situation }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.templates && data.templates.length > 0) {
          // Show suggestions in toast or small modal
          toast({ 
            title: 'Reply Suggestions', 
            description: data.templates.join(' | '),
            duration: 10000 
          });
        }
      }
    } catch (e) {
      console.error('Failed to generate suggestions:', e);
    }
  };

  const handleIssueCode = async (tier: string) => {
    if (!selectedChatId) return;

    const selectedChat = chats.find(c => Number(c.id) === selectedChatId);
    if (!selectedChat) return;

    setIssuingCode(tier);
    try {
      const response = await apiFetch<any>('/api/codes/admin/issue', {
        method: 'POST',
        body: JSON.stringify({
          chat_id: selectedChatId,
          client_id: selectedChat.client_id,
          tier,
          admin_id: (window as any).currentUser?.id,
        }),
      });

      if (response.success) {
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
      }
    } catch (err) {
      console.error('Failed to issue code:', err);
    } finally {
      setIssuingCode(null);
    }
  };

  // Search for clients by email/name
  const searchClients = async (query: string) => {
    if (query.length < 2) {
      setSearchedClients([]);
      return;
    }
    
    setSearchingClients(true);
    try {
      const response = await apiFetch<any>(`/api/chat/admin/search-clients?q=${encodeURIComponent(query)}`);
      setSearchedClients(response.clients || []);
    } catch (err) {
      console.error('Failed to search clients:', err);
    } finally {
      setSearchingClients(false);
    }
  };

  // Debounced client search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (clientSearch) {
        searchClients(clientSearch);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  // Create chat with a client
  const createChatWithClient = async (clientId: number) => {
    setCreatingChat(true);
    try {
      const response = await apiFetch<any>('/api/chat/admin/create-for-client', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId })
      });
      
      if (response.chat?.id) {
        await loadChats();
        setSelectedChatId(response.chat.id);
        setShowNewChatModal(false);
        setClientSearch('');
        setSearchedClients([]);
      }
    } catch (err: any) {
      console.error('Failed to create chat:', err);
      setError(err.message || 'Failed to create chat');
    } finally {
      setCreatingChat(false);
    }
  };

  const selectedChat = chats.find(c => Number(c.id) === selectedChatId);
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
      <div className="w-full h-[calc(100vh-64px)] flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar - Chat List */}
      <div className="w-72 bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-xl border-r border-slate-700/50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              Messages
            </h2>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              title="Start new chat"
            >
              <UserPlus className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-700/40 backdrop-blur border border-slate-600/50 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-400 transition-all text-sm"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent min-h-0">
          {error && (
            <div className="m-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 backdrop-blur">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(Number(chat.id))}
                  className={`w-full px-2 py-2 rounded-lg text-left transition-all duration-200 group ${
                    selectedChatId === Number(chat.id) 
                      ? 'bg-gradient-to-r from-blue-600/40 to-blue-500/30 border border-blue-500/50' 
                      : 'bg-slate-700/20 border border-transparent hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                      {chat.client_name.charAt(0).toUpperCase()}
                    </div>
                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-semibold text-white truncate text-sm">{chat.client_name}</h3>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatTime(chat.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{chat.client_email}</p>
                    </div>
                    {/* Unread Badge */}
                    {chat.unread_count > 0 && (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {chat.unread_count}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Start New Chat
              </h3>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setClientSearch('');
                  setSearchedClients([]);
                }}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {searchingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
                  </div>
                ) : clientSearch.length < 2 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">
                    Enter at least 2 characters to search
                  </p>
                ) : searchedClients.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">
                    No clients found
                  </p>
                ) : (
                  <div className="space-y-2">
                    {searchedClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => createChatWithClient(client.id)}
                        disabled={creatingChat}
                        className="w-full p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-left transition-colors flex items-center gap-3 disabled:opacity-50"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{client.name}</p>
                          <p className="text-sm text-slate-400 truncate">{client.email}</p>
                        </div>
                        {client.has_chat > 0 && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                            Has chat
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 bg-slate-900/50 flex flex-col overflow-hidden">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    {selectedChat.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-white">{selectedChat.client_name}</h2>
                    <p className="text-xs text-slate-400">{selectedChat.client_email}</p>
                  </div>
                </div>
                
                {/* Affiliate Badge */}
                {affiliateInfo?.has_affiliate && (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/40 rounded-full flex items-center gap-2">
                      <Tag className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-emerald-300 font-medium">{affiliateInfo.affiliate?.voucher_code}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Affiliate Info */}
              {affiliateInfo?.has_affiliate && (
                <div className="mt-3 p-3 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Percent className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-xs text-emerald-300 font-medium">
                          تمت الإحالة بواسطة <strong>{affiliateInfo.affiliate?.name}</strong> ({affiliateInfo.affiliate?.voucher_code})
                        </p>
                        <p className="text-xs text-emerald-400/80 mt-1">
                          أرباح التاجر: {affiliateInfo.affiliate?.earn_per_referral?.toFixed(0)} دج/شهرياً × {affiliateInfo.affiliate?.commission_months} أشهر
                        </p>
                      </div>
                    </div>
                    
                    {!paymentRecorded ? (
                      <button
                        onClick={recordAffiliatePayment}
                        disabled={recordingPayment}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-colors"
                      >
                        {recordingPayment ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            جاري التسجيل...
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-3 h-3" />
                            تسجيل الدفع
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" />
                        تم تسجيل العمولة
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-900/30 scrollbar-thin scrollbar-thumb-slate-600/50 scrollbar-track-transparent min-h-0">
              {error && (
                <div className="mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">
                  {error}
                </div>
              )}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-xl backdrop-blur-sm transition-all ${
                      msg.sender_type === 'admin'
                        ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white'
                        : 'bg-slate-700/60 text-slate-100 border border-slate-600/50'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message_content}</p>
                    {msg.metadata?.isImage && msg.metadata?.fileUrl && (
                      <img 
                        src={msg.metadata.fileUrl} 
                        alt={msg.metadata.fileName || 'Shared image'} 
                        className="mt-2 max-w-[200px] rounded-lg border border-white/10 cursor-pointer hover:opacity-90"
                        onClick={() => window.open(msg.metadata.fileUrl, '_blank')}
                      />
                    )}
                    {msg.metadata?.fileUrl && !msg.metadata?.isImage && (
                      <a 
                        href={msg.metadata.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-2 text-blue-300 hover:text-blue-200 text-xs"
                      >
                        📎 {msg.metadata.fileName || 'Download file'}
                      </a>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender_type === 'admin' ? 'text-blue-100/70' : 'text-slate-400'
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
            <div className="p-3 border-t border-slate-700/50 bg-gradient-to-t from-slate-800/90 to-slate-900/80 backdrop-blur flex-shrink-0 space-y-2">
              {/* Code Panel */}
              {showCodePanel && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/30 backdrop-blur">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-white">🎁 Issue Code</h4>
                    <button
                      onClick={() => setShowCodePanel(false)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TIERS.map(tier => (
                      <button
                        key={tier.id}
                        onClick={() => handleIssueCode(tier.id)}
                        disabled={issuingCode === tier.id}
                        className={`px-3 py-2 rounded-lg font-bold text-sm text-white transition-all disabled:opacity-50 ${tier.bgColor} hover:brightness-110`}
                      >
                        {issuingCode === tier.id ? '⏳' : tier.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File Upload */}
              {showFileUpload && selectedChatId && (
                <FileUploadUI
                  chatId={Number(selectedChatId)}
                  onClose={() => setShowFileUpload(false)}
                  onSuccess={() => {
                    setShowFileUpload(false);
                    loadMessages();
                  }}
                />
              )}

              {/* Message Input */}
              <AIDraftReplyBar
                selectedChat={selectedChat}
                messages={messages}
                input={input}
                setInput={setInput}
                loading={loading}
                onSubmit={handleSendMessage}
                onPaste={handlePaste}
                showFileUpload={showFileUpload}
                onToggleFileUpload={() => setShowFileUpload(!showFileUpload)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-400">
            <div className="p-4 bg-slate-800/40 backdrop-blur rounded-2xl border border-slate-700/50">
              <MessageCircle className="w-10 h-10 opacity-20 mx-auto" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-white mb-1">Select a chat</h3>
              <p className="text-xs text-slate-400">Choose a client to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ─── AI Draft Reply Bar ────────────────────────────────────────────────────
function AIDraftReplyBar({
  selectedChat,
  messages,
  input,
  setInput,
  loading,
  onSubmit,
  showFileUpload,
  onToggleFileUpload,
  onPaste,
}: {
  selectedChat: any;
  messages: any[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  showFileUpload: boolean;
  onToggleFileUpload: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
}) {
  const { call, loading: drafting } = useAI('/api/ai/admin/draft-reply');

  const handleDraft = async () => {
    const lastClientMsg = [...messages].reverse().find((m) => m.sender_type === 'client');
    if (!lastClientMsg) return;
    const data = await call({
      messageContent: lastClientMsg.message_content,
      clientName: selectedChat?.client_name || '',
    });
    if (data?.draft) setInput(data.draft);
  };

  return (
    <div className="space-y-1.5">
      {messages.some((m) => m.sender_type === 'client') && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
          >
            {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Draft Reply
          </button>
          <button
            type="button"
            onClick={() => {
              const parentComponent = window.__ADMIN_CHAT_INSTANCE__;
              if (parentComponent?.generateReplySuggestions) {
                parentComponent.generateReplySuggestions();
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Reply Ideas
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFileUpload}
          className={`p-2 rounded-lg transition-colors ${
            showFileUpload
              ? 'text-blue-400 bg-blue-500/10'
              : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'
          }`}
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={onPaste}
          placeholder="Type your message..."
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-700/40 backdrop-blur border border-slate-600/50 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-400 disabled:opacity-50 transition-all text-sm"
        />
        {input.trim() ? (
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg disabled:from-slate-600 disabled:to-slate-500 font-bold transition-all flex items-center gap-2 text-sm"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        ) : null}
      </form>
    </div>
  );
}
