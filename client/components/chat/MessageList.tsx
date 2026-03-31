// Message List Component - Display Messages with Rich UI

import React, { useState } from 'react';
import { CheckCheck, Check, AlertCircle, Download, File, Pencil, Trash2, X, Check as CheckIcon, SmilePlus, Reply, CornerUpLeft } from 'lucide-react';

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_type: 'client' | 'seller' | 'admin';
  message_content: string;
  message_type: 'text' | 'code_request' | 'code_response' | 'system' | 'file_attachment' | 'voice';
  metadata?: any;
  is_read: boolean;
  created_at: string;
  reply_to_id?: number;
  reactions?: Record<string, number[]>;
}

interface MessageListProps {
  messages: ChatMessage[];
  userRole: 'client' | 'seller' | 'admin';
  userId: number;
  chatId?: number;
  onMessageEdit?: (messageId: number, newContent: string) => Promise<void>;
  onMessageDelete?: (messageId: number) => Promise<void>;
  onMessageReaction?: (messageId: number, reaction: string, action: 'add' | 'remove') => Promise<void>;
  onReply?: (message: ChatMessage) => void;
  searchHighlight?: string;
}

export function MessageList({ messages, userRole, userId, chatId, onMessageEdit, onMessageDelete, onMessageReaction, onReply, searchHighlight }: MessageListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

  // Find replied message
  const getReplyMessage = (replyToId?: number): ChatMessage | undefined => {
    if (!replyToId) return undefined;
    return messages.find(m => m.id === replyToId);
  };

  // Highlight search term in text
  const highlightText = (text: string, highlight?: string) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlight.toLowerCase() 
        ? <mark key={i} className="bg-yellow-400 text-black rounded px-0.5">{part}</mark>
        : part
    );
  };

  const handleReaction = async (messageId: number, reaction: string) => {
    if (!onMessageReaction) return;
    const message = messages.find(m => m.id === messageId);
    const hasReaction = message?.reactions?.[reaction]?.includes(userId);
    await onMessageReaction(messageId, reaction, hasReaction ? 'remove' : 'add');
    setShowReactionPicker(null);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Group messages by date
  const groupedMessages: { [key: string]: ChatMessage[] } = {};
  messages.forEach((msg) => {
    const date = formatDate(msg.created_at);
    if (!groupedMessages[date]) {
      groupedMessages[date] = [];
    }
    groupedMessages[date].push(msg);
  });

  const getSenderLabel = (senderType: string) => {
    if (senderType === 'admin') return '👨‍💼 Admin';
    if (senderType === 'seller') return '🏪 Seller';
    return '👤 You';
  };

  return (
    <div className="space-y-2">
      {Object.entries(groupedMessages).map(([date, dayMessages]) => (
        <div key={date}>
          {/* Date Divider */}
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50"></div>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-full">{date}</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50"></div>
          </div>

          {/* Messages */}
          <div className="space-y-1.5">
            {dayMessages.map((message, index) => {
              const isOwnMessage = 
                (userRole === 'client' && message.sender_type === 'client') ||
                (userRole === 'seller' && message.sender_type === 'seller') ||
                (userRole === 'admin' && message.sender_type === 'admin');

              const showSenderLabel = !isOwnMessage && (
                index === 0 || 
                dayMessages[index - 1]?.sender_type !== message.sender_type
              );

              return (
                <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`max-w-[78%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender Label */}
                    {showSenderLabel && !isOwnMessage && (
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5 ml-1">{getSenderLabel(message.sender_type)}</p>
                    )}

                    {/* Reply Preview */}
                    {message.reply_to_id && (
                      <div className={`text-[10px] mb-1 px-2 py-1 rounded-lg border-l-2 ${
                        isOwnMessage ? 'bg-violet-100 dark:bg-violet-400/10 border-violet-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                      }`}>
                        <div className="flex items-center gap-1 text-slate-400">
                          <CornerUpLeft className="w-2.5 h-2.5" />
                          <span>Replying to</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-300 truncate">
                          {getReplyMessage(message.reply_to_id)?.message_content || 'Deleted message'}
                        </p>
                      </div>
                    )}

                    {/* Edit/Delete/Reaction Actions - Only for own messages (edit/delete) or any message (react) */}
                    {editingId !== message.id && (
                      <div className={`flex items-center gap-1 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                        {/* Reaction button */}
                        <div className="relative">
                          <button
                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Add reaction"
                          >
                            <SmilePlus className="w-3 h-3" />
                          </button>
                          
                          {/* Reaction Picker */}
                          {showReactionPicker === message.id && (
                            <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1 flex gap-0.5 shadow-lg z-10`}>
                              {REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.id, emoji)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition text-sm"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reply button */}
                        {onReply && (
                          <button
                            onClick={() => onReply(message)}
                            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Reply"
                          >
                            <Reply className="w-3 h-3" />
                          </button>
                        )}

                        {/* Edit/Delete for own messages only */}
                        {isOwnMessage && message.message_type === 'text' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(message.id);
                                setEditContent(message.message_content);
                              }}
                              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition"
                              title="Edit message"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                if (deletingId === message.id) return;
                                setDeletingId(message.id);
                                try {
                                  await onMessageDelete?.(message.id);
                                } finally {
                                  setDeletingId(null);
                                }
                              }}
                              disabled={deletingId === message.id}
                              className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-400 hover:text-red-500 transition disabled:opacity-50"
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`px-3 py-2 rounded-2xl transition-all ${
                        isOwnMessage
                          ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                      }`}
                    >
                      {/* System Message */}
                      {message.message_type === 'system' && (
                        <p className={`text-xs italic text-center ${
                          isOwnMessage ? 'text-violet-100' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {message.message_content}
                        </p>
                      )}

                      {/* Regular Text Message - with edit mode */}
                      {message.message_type === 'text' && (
                        editingId === message.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditContent('');
                                }}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (editContent.trim() && editContent !== message.message_content) {
                                    await onMessageEdit?.(message.id, editContent.trim());
                                  }
                                  setEditingId(null);
                                  setEditContent('');
                                }}
                                disabled={!editContent.trim()}
                                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition disabled:opacity-50"
                                title="Save"
                              >
                                <CheckIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs break-words leading-relaxed whitespace-pre-wrap">
                              {highlightText(message.message_content, searchHighlight)}
                            </p>
                            {message.metadata?.edited && (
                              <span className="text-xs opacity-60 italic">(edited)</span>
                            )}
                          </div>
                        )
                      )}

                      {/* Code Request Message */}
                      {message.message_type === 'code_request' && (
                        <div className={`text-xs space-y-2 ${isOwnMessage ? 'text-violet-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          <div className="flex items-center gap-2 font-bold">
                            <span className="text-lg">📋</span>
                            <span>Code Request</span>
                          </div>
                          <div className={`space-y-1 text-xs ${isOwnMessage ? 'text-blue-50' : 'text-gray-400'}`}>
                            <p><strong>Type:</strong> {message.metadata?.code_type || 'General'}</p>
                            {message.metadata?.description && (
                              <p className="italic">{message.metadata.description}</p>
                            )}
                            <p className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-current"></span>
                              Status: Pending Review
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Code Response Message */}
                      {message.message_type === 'code_response' && (
                        <div className={`text-xs space-y-2 ${isOwnMessage ? 'text-violet-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          <div className="flex items-center gap-2 font-bold text-emerald-500 dark:text-emerald-400">
                            <span className="text-lg">✅</span>
                            <span>Code Issued!</span>
                          </div>
                          {message.metadata?.code && (
                            <div className={`mt-2 p-3 rounded-lg font-mono text-center text-xs font-bold tracking-wider ${
                              isOwnMessage 
                                ? 'bg-violet-400/30 text-violet-50' 
                                : 'bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                            }`}>
                              {message.metadata.code}
                            </div>
                          )}
                          {message.metadata?.expiry_at && (
                            <p className="text-xs opacity-75">
                              Expires: {new Date(message.metadata.expiry_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      {/* File Attachment Message */}
                      {message.message_type === 'file_attachment' && (
                        <div className={`text-xs space-y-2 ${isOwnMessage ? 'text-violet-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {(() => {
                            console.log('[MessageList] File attachment metadata:', message.metadata);
                            return null;
                          })()}
                          {message.metadata?.isImage ? (
                            // Image Preview
                            <div className="space-y-2">
                              <img
                                src={message.metadata.fileUrl}
                                alt={message.metadata.fileName || 'Shared image'}
                                className="w-full max-w-[220px] rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition block"
                                onClick={() => window.open(message.metadata.fileUrl, '_blank')}
                              />
                              <div className="flex items-center justify-between gap-1 text-xs mt-1">
                                <span className="truncate max-w-[140px] opacity-70" title={message.metadata.fileName}>{message.metadata.fileName}</span>
                                <a
                                  href={message.metadata.fileUrl}
                                  download
                                  className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition"
                                  title="Download file"
                                >
                                  <Download className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          ) : (
                            // File Attachment (non-image)
                            <div className="flex items-center gap-2 font-bold mb-2">
                              <File className="w-5 h-5" />
                              <span>File Shared</span>
                            </div>
                          )}
                          {!message.metadata?.isImage && (
                            <div className={`p-2.5 rounded-lg flex items-center gap-2 ${
                              isOwnMessage 
                                ? 'bg-violet-400/30' 
                                : 'bg-slate-50 dark:bg-slate-700'
                            }`}>
                              <File className="w-8 h-8 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{message.metadata?.fileName || message.message_content}</p>
                                <p className="text-xs opacity-75">
                                  {message.metadata?.size ? `${(message.metadata.size / 1024 / 1024).toFixed(2)} MB` : 'File'}
                                </p>
                              </div>
                              <a
                                href={message.metadata?.fileUrl}
                                download
                                className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition"
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Voice Message */}
                      {message.message_type === 'voice' && (
                        <div className={`text-xs ${isOwnMessage ? 'text-violet-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">🎤</span>
                            <span className="font-medium">Voice Message</span>
                          </div>
                          <audio
                            src={message.metadata?.fileUrl}
                            controls
                            className="w-full max-w-full h-8"
                          />
                          {message.metadata?.duration && (
                            <p className="text-xs opacity-75 mt-1">
                              Duration: {Math.floor(message.metadata.duration / 60)}:{String(message.metadata.duration % 60).padStart(2, '0')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions Display */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(message.reactions).map(([emoji, userIds]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(message.id, emoji)}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition ${
                              userIds.includes(userId)
                                ? 'bg-violet-100 dark:bg-violet-500/20 border border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300'
                                : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-medium">{userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Time and Read Status */}
                    <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] font-medium ${
                      isOwnMessage ? 'text-violet-400 dark:text-violet-300' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      <span>{formatTime(message.created_at)}</span>
                      {isOwnMessage && (
                        message.is_read ? (
                          <CheckCheck className="w-3 h-3 text-green-500" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
