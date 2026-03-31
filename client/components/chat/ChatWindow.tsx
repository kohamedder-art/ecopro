// Chat Window Component - Main Chat Area with Rich UI

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Upload, AlertCircle, Loader, Smile, Paperclip, Phone, Plus, Search, Mic, X, ArrowLeft, Sparkles } from 'lucide-react';
import { MessageList } from './MessageList';
import { FileUploadUI } from './FileUploadUI';
import { VoiceRecorder } from './VoiceRecorder';
import { useWebSocket, ChatMessageWS } from '../../hooks/useWebSocket';

interface ChatMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_type: 'client' | 'seller' | 'admin';
  message_content: string;
  message_type: 'text' | 'code_request' | 'code_response' | 'system' | 'file_attachment' | 'voice';
  metadata?: any;
  is_read: boolean;
  created_at: string;
  reply_to_id?: number;
  reactions?: Record<string, number[]>; // emoji -> userIds
}

interface Chat {
  id: number;
  client_id: number;
  seller_id?: number;
  store_id?: number;
  status: 'active' | 'open' | 'archived' | 'closed' | string;
  created_at: string;
}

interface TypingUser {
  userId: number;
  userName?: string;
  timestamp: number;
}

interface ChatWindowProps {
  chatId: number;
  userRole: 'client' | 'seller' | 'admin';
  userId: number;
  onClose?: () => void;
}

export function ChatWindow({ chatId, userRole, userId, onClose }: ChatWindowProps) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<number, TypingUser>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef<number>(0);
  const isUserScrollingRef = useRef<boolean>(false);
  const shouldScrollRef = useRef<boolean>(true);
  const scrollRafRef = useRef<number | null>(null);

  // WebSocket connection for real-time updates
  const {
    isConnected,
    sendTyping,
    sendStopTyping,
  } = useWebSocket({
    chatId,
    autoConnect: true,
    onMessage: useCallback((msg: ChatMessageWS) => {
      // Add new message from WebSocket
      setMessages(prev => {
        // Check if message already exists
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg as ChatMessage];
      });
    }, []),
    onTyping: useCallback((typingUserId: number, userName?: string) => {
      if (typingUserId === userId) return; // Ignore our own typing
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(typingUserId, { userId: typingUserId, userName, timestamp: Date.now() });
        return newMap;
      });
    }, [userId]),
    onStopTyping: useCallback((typingUserId: number) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(typingUserId);
        return newMap;
      });
    }, []),
    onEdit: useCallback((messageId: number, newContent: string) => {
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, message_content: newContent, metadata: { ...m.metadata, edited: true } }
          : m
      ));
    }, []),
    onDelete: useCallback((messageId: number) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }, []),
    onReaction: useCallback((messageId: number, reaction: string, reactUserId: number, action: 'add' | 'remove') => {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        if (action === 'add') {
          if (!reactions[reaction]) reactions[reaction] = [];
          if (!reactions[reaction].includes(reactUserId)) {
            reactions[reaction] = [...reactions[reaction], reactUserId];
          }
        } else {
          if (reactions[reaction]) {
            reactions[reaction] = reactions[reaction].filter(id => id !== reactUserId);
            if (reactions[reaction].length === 0) delete reactions[reaction];
          }
        }
        return { ...m, reactions };
      }));
    }, []),
    onRead: useCallback((readerId: number) => {
      if (readerId === userId) return;
      setMessages(prev => prev.map(m => 
        m.sender_id === userId && !m.is_read ? { ...m, is_read: true } : m
      ));
    }, [userId]),
  });

  // Clear typing indicators after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        for (const [id, user] of newMap) {
          if (now - user.timestamp > 5000) {
            newMap.delete(id);
          }
        }
        return newMap;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = (options?: { force?: boolean; behavior?: ScrollBehavior }) => {
    const force = options?.force ?? false;
    const behavior = options?.behavior ?? 'smooth';
    if (force || shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  const scheduleScrollToBottom = (options?: { force?: boolean; behavior?: ScrollBehavior }) => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      scrollToBottom(options);
    });
  };

  // Check if user is near bottom of chat
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Handle scroll to detect if user is scrolling up
  const handleScroll = () => {
    if (isNearBottom()) {
      isUserScrollingRef.current = false;
      shouldScrollRef.current = true;
    } else {
      isUserScrollingRef.current = true;
      shouldScrollRef.current = false;
    }
  };

  // Handle input focus - scroll to bottom when user clicks on input
  const handleInputFocus = () => {
    isUserScrollingRef.current = false;
    shouldScrollRef.current = true;
    scheduleScrollToBottom({ force: true, behavior: 'smooth' });
  };

  useEffect(() => {
    loadChat();
    loadMessages();
    shouldScrollRef.current = true; // Scroll on initial load
    
    // Fallback polling when WebSocket is not connected (every 5 seconds instead of 3)
    const interval = setInterval(() => {
      if (!isConnected) {
        loadMessages();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [chatId, isConnected]);

  useEffect(() => {
    // Only auto-scroll if:
    // 1. It's the initial load (prevMessagesLength was 0)
    // 2. User just sent a message (new message from current user)
    // 3. User is near the bottom of the chat
    const isInitialLoad = prevMessagesLengthRef.current === 0 && messages.length > 0;
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;
    
    if (isInitialLoad) {
      scrollToBottom({ force: true });
    } else if (hasNewMessages && !isUserScrollingRef.current) {
      scrollToBottom();
    }
    
    prevMessagesLengthRef.current = messages.length;
    
    // Mark messages as read when viewing
    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages]);

  const loadChat = async () => {
    try {
      const endpoint = userRole === 'admin' ? '/api/chat/admin/all-chats' : '/api/chat/list';
      const response = await fetch(endpoint);
      const data = await response.json();
      const currentChat = data.chats?.find((c: Chat) => c.id === chatId);
      if (currentChat) {
        setChat(currentChat);
      } else {
        // Some chat types (e.g. admin support chats) may not appear in list endpoints.
        // Still render the window so messages can load + send.
        setChat({
          id: chatId,
          client_id: Number(userId) || 0,
          status: 'open',
          created_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error('Failed to load chat:', err);
      setChat({
        id: chatId,
        client_id: Number(userId) || 0,
        status: 'open',
        created_at: new Date().toISOString(),
      });
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${chatId}/messages?limit=50&offset=0`);

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      setMessages(data.items || data.messages || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      const unreadIds = messages
        .filter(m => !m.is_read && m.sender_type !== userRole)
        .map(m => m.id);

      if (unreadIds.length === 0) return;

      const res = await fetch(`/api/chat/${chatId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          chat_id: chatId,
          message_ids: unreadIds 
        })
      });

      if (res.ok) {
        // Let global notification state refresh immediately
        window.dispatchEvent(new CustomEvent('ecopro:chat-seen'));
      }
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  };

  const handleEditMessage = async (messageId: number, newContent: string) => {
    try {
      const response = await fetch(`/api/chat/${chatId}/message/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message_content: newContent })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to edit message');
      }

      await loadMessages();
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      setError(err.message || 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      const response = await fetch(`/api/chat/${chatId}/message/${messageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete message');
      }

      await loadMessages();
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      setError(err.message || 'Failed to delete message');
    }
  };

  const handleMessageReaction = async (messageId: number, reaction: string, action: 'add' | 'remove') => {
    try {
      const response = await fetch(`/api/chat/${chatId}/message/${messageId}/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reaction, action })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add reaction');
      }

      // Update local state immediately for responsiveness
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        if (action === 'add') {
          if (!reactions[reaction]) reactions[reaction] = [];
          if (!reactions[reaction].includes(userId)) {
            reactions[reaction] = [...reactions[reaction], userId];
          }
        } else {
          if (reactions[reaction]) {
            reactions[reaction] = reactions[reaction].filter(id => id !== userId);
            if (reactions[reaction].length === 0) delete reactions[reaction];
          }
        }
        return { ...m, reactions };
      }));
    } catch (err: any) {
      console.error('Failed to add reaction:', err);
      setError(err.message || 'Failed to add reaction');
    }
  };

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    const messageContent = messageInput.trim();
    setSending(true);
    setError(null);

    // Stop typing indicator when sending
    if (isConnected) {
      sendStopTyping();
    }

    try {
      const payload: any = {
        chat_id: Number(chatId),
        message_content: messageContent,
        message_type: 'text'
      };

      // Add reply_to_id if replying to a message
      if (replyingTo) {
        payload.metadata = { reply_to_id: replyingTo.id };
      }

      const response = await fetch(`/api/chat/${chatId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details?.[0]?.message || `Failed: ${response.status}`);
      }

      setMessageInput('');
      setReplyingTo(null); // Clear reply state
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      await loadMessages();
    } catch (err: any) {
      console.error('Send message error:', err.message);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    // Auto-grow textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    // Send typing indicator via WebSocket
    if (e.target.value.trim() && isConnected) {
      sendTyping();
    } else if (!e.target.value.trim() && isConnected) {
      sendStopTyping();
    }

    // If the user is typing, keep the chat pinned to the newest messages.
    // (This avoids the situation where the user scrolls up, focuses input, then types while still not at bottom.)
    if (document.activeElement === inputRef.current) {
      isUserScrollingRef.current = false;
      shouldScrollRef.current = true;
      scheduleScrollToBottom({ force: true, behavior: 'auto' });
    }
  };

  const addEmoji = (emoji: string) => {
    setMessageInput(messageInput + emoji);
    setShowEmojiPicker(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-2">
              <Loader className="w-4 h-4 text-white animate-spin" />
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-sm">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // If chat metadata couldn't be loaded, we still allow rendering (messages endpoint is authoritative)
  const effectiveChat: Chat =
    chat ??
    ({
      id: chatId,
      client_id: Number(userId) || 0,
      status: 'open',
      created_at: new Date().toISOString(),
    } as Chat);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Minimal inline toolbar — no big header */}
      <div className="flex items-center justify-between h-9 px-3 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {userRole === 'admin' ? 'Support Chat' : 'Support Agent'}
            {effectiveChat.status === 'active' || effectiveChat.status === 'open'
              ? ' — online'
              : ` — ${effectiveChat.status ?? 'offline'}`}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded-md transition ${showSearch ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'}`}
            title="Search messages"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[10px] text-slate-400">
              {messages.filter(m => m.message_content.toLowerCase().includes(searchQuery.toLowerCase())).length}
            </span>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth bg-white dark:bg-slate-900">
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-white">No messages yet</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            <MessageList 
              messages={searchQuery 
                ? messages.filter(m => m.message_content.toLowerCase().includes(searchQuery.toLowerCase()))
                : messages
              } 
              userRole={userRole} 
              userId={userId} 
              chatId={chatId}
              onMessageEdit={handleEditMessage}
              onMessageDelete={handleDeleteMessage}
              onMessageReaction={handleMessageReaction}
              onReply={handleReply}
              searchHighlight={searchQuery}
            />
            <div ref={messagesEndRef} />
          </>
        )}
        
        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span>
              {Array.from(typingUsers.values()).map(u => u.userName || `User ${u.userId}`).join(', ')} typing…
            </span>
          </div>
        )}
      </div>

      {/* File Upload UI */}
      {showFileUpload && (userRole === 'client' || userRole === 'admin') && (
        <div className="border-t border-slate-100 dark:border-white/5 bg-violet-50/50 dark:bg-violet-500/5 p-3">
          <FileUploadUI
            chatId={chatId}
            onClose={() => setShowFileUpload(false)}
            onSuccess={() => {
              setShowFileUpload(false);
              loadMessages();
            }}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        {/* Reply Preview */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-violet-50 dark:bg-violet-500/10 rounded-lg p-2 mb-2 border-l-2 border-violet-500">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400">Replying to {replyingTo.sender_type}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{replyingTo.message_content}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          <div className="flex gap-2">
            {(userRole === 'client' || userRole === 'admin') && (
              <button
                type="button"
                onClick={() => setShowFileUpload(!showFileUpload)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                title="Upload file"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={messageInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                placeholder="Type message…"
                disabled={sending}
                rows={1}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-9 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 resize-none overflow-hidden"
              />

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition"
                title="Emoji"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={sending || !messageInput.trim()}
              className="p-2 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {sending ? (
                <Loader className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Voice Message Button */}
            <button
              type="button"
              onClick={() => setShowVoiceRecorder(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              title="Record voice message"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Voice Recorder */}
          {showVoiceRecorder && (
            <div className="mt-1">
              <VoiceRecorder
                chatId={chatId}
                onSuccess={() => {
                  setShowVoiceRecorder(false);
                  loadMessages();
                }}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            </div>
          )}

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="grid grid-cols-8 gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 max-h-24 overflow-y-auto">
              {['😀', '😂', '😍', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '✨', '🎉', '🎈', '🎁', '💡', '🚀'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => addEmoji(emoji)}
                  className="p-1 text-base hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
