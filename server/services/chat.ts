// Chat Service
// Handles all chat operations with security and validation

import { pool } from '../utils/database';
import {
  Chat,
  ChatMessage,
  CodeRequest,
  ChatResponse,
  ChatDetailResponse,
} from '../types/chat';
import crypto from 'crypto';

export class ChatService {
  /**
   * Get or create a chat between client and seller
   */
  async getOrCreateChat(clientId: number, sellerId: number, storeId?: number): Promise<Chat> {
    try {
      // Check if chat exists
      const existing = await pool.query(
        'SELECT * FROM chats WHERE client_id = $1 AND seller_id = $2',
        [clientId, sellerId]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Create new chat
      const result = await pool.query(
        `INSERT INTO chats (client_id, seller_id, store_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW())
         RETURNING *`,
        [clientId, sellerId, storeId || null]
      );

      return result.rows[0];
    } catch (error: any) {
      throw new Error(`Failed to get or create chat: ${error.message}`);
    }
  }

  /**
   * Get all chats for a client
   */
  async getClientChats(clientId: number): Promise<ChatResponse[]> {
    try {
      const result = await pool.query(
        `SELECT c.*, 
                COUNT(CASE WHEN cm.is_read = false THEN 1 END) as unread_count,
                MAX(cm.created_at) as last_message_at
         FROM chats c
         LEFT JOIN chat_messages cm ON c.id = cm.chat_id
         WHERE c.client_id = $1 AND c.status != 'closed'
         GROUP BY c.id
         ORDER BY last_message_at DESC NULLS LAST`,
        [clientId]
      );

      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to get client chats: ${error.message}`);
    }
  }

  /**
   * Get all chats for a seller (with client info)
   */
  async getSellerChats(sellerId: number): Promise<ChatResponse[]> {
    try {
      const result = await pool.query(
        `SELECT c.*, 
                cl.name as client_name,
                cl.email as client_email,
                COUNT(CASE WHEN cm.is_read = false AND cm.sender_type = 'client' THEN 1 END) as unread_count,
                MAX(cm.created_at) as last_message_at
         FROM chats c
         JOIN clients cl ON c.client_id = cl.id
         LEFT JOIN chat_messages cm ON c.id = cm.chat_id
         WHERE c.seller_id = $1 AND c.status != 'closed'
         GROUP BY c.id, cl.id
         ORDER BY last_message_at DESC NULLS LAST`,
        [sellerId]
      );

      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to get seller chats: ${error.message}`);
    }
  }

  /**
   * Get chat messages with pagination
   */
  async getChatMessages(
    chatId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM chat_messages
         WHERE chat_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [chatId, limit, offset]
      );

      return result.rows.reverse(); // Return oldest first
    } catch (error: any) {
      throw new Error(`Failed to get chat messages: ${error.message}`);
    }
  }

  /**
   * Send a message
   */
  async sendMessage(
    chatId: number,
    senderId: number,
    senderType: 'client' | 'seller' | 'admin',
    content: string,
    messageType: string = 'text',
    metadata?: Record<string, any>
  ): Promise<ChatMessage> {
    try {
      // Verify chat exists and user has access
      const chatCheck = await pool.query(
        'SELECT * FROM chats WHERE id = $1',
        [chatId]
      );

      if (chatCheck.rows.length === 0) {
        throw new Error('Chat not found');
      }

      const chat = chatCheck.rows[0];

      // Admin can send to any chat, clients/sellers can only send to their own
      if (senderType !== 'admin') {
        if (senderType === 'client' && Number(chat.client_id) !== senderId) {
          throw new Error('Unauthorized: client cannot access this chat');
        }
        if (senderType === 'seller' && Number(chat.seller_id) !== senderId) {
          throw new Error('Unauthorized: seller cannot access this chat');
        }
      }

      // Extract reply_to_id from metadata if present
      const replyToId = metadata?.reply_to_id || null;
      
      // Insert message
      const result = await pool.query(
        `INSERT INTO chat_messages 
         (chat_id, sender_id, sender_type, message_content, message_type, metadata, reply_to_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [chatId, senderId, senderType, content, messageType, metadata ? JSON.stringify(metadata) : null, replyToId]
      );

      // Update chat updated_at
      await pool.query(
        'UPDATE chats SET updated_at = NOW() WHERE id = $1',
        [chatId]
      );

      // Update client's last message timestamp
      if (senderType === 'client') {
        await pool.query(
          'UPDATE clients SET last_chat_message_at = NOW() WHERE id = $1',
          [senderId]
        );
      }

      return result.rows[0];
    } catch (error: any) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(chatId: number, readerId: number, readerType: 'client' | 'seller' | 'admin'): Promise<void> {
    try {
      // Verify user has access to this chat
      const chatCheck = await pool.query(
        'SELECT * FROM chats WHERE id = $1',
        [chatId]
      );

      if (chatCheck.rows.length === 0) {
        throw new Error('Chat not found');
      }

      const chat = chatCheck.rows[0];

      // Admin can access any chat, clients/sellers can only access their own
      if (readerType !== 'admin') {
        if (readerType === 'client' && Number(chat.client_id) !== Number(readerId)) {
          throw new Error('Unauthorized');
        }
        if (readerType === 'seller' && Number(chat.seller_id) !== Number(readerId)) {
          throw new Error('Unauthorized');
        }
      }

      // Mark unread messages as read (for admin, mark all; for client/seller, mark only from other party)
      if (readerType === 'admin') {
        await pool.query(
          `UPDATE chat_messages 
           SET is_read = true, updated_at = NOW()
           WHERE chat_id = $1 AND is_read = false`,
          [chatId]
        );
      } else {
        const otherPartyType = readerType === 'client' ? 'seller' : 'client';

        await pool.query(
          `UPDATE chat_messages 
           SET is_read = true, updated_at = NOW()
           WHERE chat_id = $1 AND sender_type = $2 AND is_read = false`,
          [chatId, otherPartyType]
        );
      }

      // Update client's unread count
      if (readerType === 'client') {
        const unreadResult = await pool.query(
          `SELECT COUNT(*) as count FROM chat_messages
           WHERE sender_type = 'seller' AND is_read = false
           AND chat_id IN (SELECT id FROM chats WHERE client_id = $1)`,
          [readerId]
        );

        await pool.query(
          'UPDATE clients SET unread_chat_count = $1 WHERE id = $2',
          [parseInt(unreadResult.rows[0].count), readerId]
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  /**
   * Mark all messages across all user's chats as read
   */
  async markAllAsRead(readerId: number, readerType: 'client' | 'seller' | 'admin'): Promise<void> {
    try {
      if (readerType === 'admin') {
        await pool.query(
          `UPDATE chat_messages SET is_read = true, updated_at = NOW()
           WHERE chat_id IN (SELECT id FROM chats) AND is_read = false`
        );
      } else if (readerType === 'client') {
        await pool.query(
          `UPDATE chat_messages SET is_read = true, updated_at = NOW()
           WHERE chat_id IN (SELECT id FROM chats WHERE client_id = $1)
           AND sender_type != 'client' AND is_read = false`,
          [readerId]
        );
        await pool.query(
          'UPDATE clients SET unread_chat_count = 0 WHERE id = $1',
          [readerId]
        );
      } else if (readerType === 'seller') {
        await pool.query(
          `UPDATE chat_messages SET is_read = true, updated_at = NOW()
           WHERE chat_id IN (SELECT id FROM chats WHERE seller_id = $1)
           AND sender_type != 'seller' AND is_read = false`,
          [readerId]
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  }

  /**
   * Request a code (client side)
   */
  async requestCode(chatId: number, clientId: number, codeType: string): Promise<CodeRequest> {
    try {
      // Verify chat and user access
      const chatCheck = await pool.query(
        'SELECT * FROM chats WHERE id = $1 AND client_id = $2',
        [chatId, clientId]
      );

      if (chatCheck.rows.length === 0) {
        throw new Error('Unauthorized or chat not found');
      }

      const chat = chatCheck.rows[0];

      // Create code request
      const result = await pool.query(
        `INSERT INTO code_requests 
         (chat_id, client_id, seller_id, requested_code_type, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())
         RETURNING *`,
        [chatId, clientId, chat.seller_id, codeType]
      );

      const codeRequest = result.rows[0];

      // Send system message to chat
      await this.sendMessage(
        chatId,
        clientId,
        'client',
        `Requested code: ${codeType}`,
        'code_request',
        { code_request_id: codeRequest.id, code_type: codeType }
      );

      return codeRequest;
    } catch (error: any) {
      throw new Error(`Failed to request code: ${error.message}`);
    }
  }

  /**
   * Issue a code (seller side)
   */
  async issueCode(requestId: number, code: string, expiryHours: number = 24): Promise<CodeRequest> {
    try {
      // Get the code request
      const result = await pool.query(
        'SELECT * FROM code_requests WHERE id = $1 AND status = $2',
        [requestId, 'pending']
      );

      if (result.rows.length === 0) {
        throw new Error('Code request not found or already processed');
      }

      const codeRequest = result.rows[0];

      // Update code request
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + expiryHours);

      const updateResult = await pool.query(
        `UPDATE code_requests 
         SET generated_code = $1, expiry_date = $2, status = 'issued', issued_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [code, expiryDate, requestId]
      );

      const updated = updateResult.rows[0];

      // Send code response message
      await this.sendMessage(
        codeRequest.chat_id,
        codeRequest.seller_id,
        'seller',
        `Code issued: ${code}`,
        'code_response',
        {
          code: code,
          expiry_date: expiryDate,
          code_request_id: requestId,
        }
      );

      return updated;
    } catch (error: any) {
      throw new Error(`Failed to issue code: ${error.message}`);
    }
  }

  /**
   * Get code requests for a chat
   */
  async getCodeRequests(chatId: number): Promise<CodeRequest[]> {
    try {
      const result = await pool.query(
        'SELECT * FROM code_requests WHERE chat_id = $1 ORDER BY created_at DESC',
        [chatId]
      );

      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to get code requests: ${error.message}`);
    }
  }

  /**
   * Update chat status
   */
  async updateChatStatus(chatId: number, userId: number, status: 'active' | 'archived' | 'closed'): Promise<Chat> {
    try {
      // Verify user owns this chat (client can only archive/close, seller has more control)
      const chatCheck = await pool.query(
        'SELECT * FROM chats WHERE id = $1',
        [chatId]
      );

      if (chatCheck.rows.length === 0) {
        throw new Error('Chat not found');
      }

      // Update status
      const result = await pool.query(
        'UPDATE chats SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, chatId]
      );

      return result.rows[0];
    } catch (error: any) {
      throw new Error(`Failed to update chat status: ${error.message}`);
    }
  }

  /**
   * Get unread chat count for client
   */
  async getUnreadCount(clientId: number): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM chat_messages
         WHERE sender_type IN ('seller','admin') AND is_read = false
         AND chat_id IN (SELECT id FROM chats WHERE client_id = $1)`,
        [clientId]
      );

      return parseInt(result.rows[0].count) || 0;
    } catch (error: any) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }

  /**
   * Get unread chat count for a seller
   */
  async getSellerUnreadCount(sellerId: number): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM chat_messages cm
         WHERE cm.is_read = false
           AND cm.sender_type = 'client'
           AND cm.chat_id IN (SELECT id FROM chats WHERE seller_id = $1)`,
        [sellerId]
      );
      return parseInt(result.rows[0].count) || 0;
    } catch (error: any) {
      throw new Error(`Failed to get seller unread count: ${error.message}`);
    }
  }

  /**
   * Get unread chat count for admin (support chats)
   */
  async getAdminUnreadCount(): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM chat_messages cm
         JOIN chats c ON c.id = cm.chat_id
         WHERE cm.is_read = false
           AND cm.sender_type = 'client'
           AND c.seller_id IS NULL`,
      );
      return parseInt(result.rows[0].count) || 0;
    } catch (error: any) {
      throw new Error(`Failed to get admin unread count: ${error.message}`);
    }
  }

  /**
   * Delete a chat (soft delete - archive it)
   */
  async deleteChat(chatId: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE chats SET status = $1, updated_at = NOW() WHERE id = $2',
        ['closed', chatId]
      );
    } catch (error: any) {
      throw new Error(`Failed to delete chat: ${error.message}`);
    }
  }

  /**
   * Edit a message (only by sender)
   */
  async editMessage(
    messageId: number,
    senderId: number,
    senderType: 'client' | 'seller' | 'admin',
    newContent: string
  ): Promise<ChatMessage> {
    try {
      // Verify message exists and belongs to sender
      const msgCheck = await pool.query(
        'SELECT * FROM chat_messages WHERE id = $1',
        [messageId]
      );

      if (msgCheck.rows.length === 0) {
        throw new Error('Message not found');
      }

      const message = msgCheck.rows[0];

      // Only the sender can edit their message
      if (Number(message.sender_id) !== senderId || message.sender_type !== senderType) {
        throw new Error('Unauthorized: You can only edit your own messages');
      }

      // Only allow editing text messages
      if (message.message_type !== 'text') {
        throw new Error('Only text messages can be edited');
      }

      // Update the message
      const result = await pool.query(
        `UPDATE chat_messages 
         SET message_content = $1, 
             metadata = COALESCE(metadata, '{}'::jsonb) || '{"edited": true, "edited_at": "${new Date().toISOString()}"}'::jsonb,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newContent, messageId]
      );

      return result.rows[0];
    } catch (error: any) {
      throw new Error(`Failed to edit message: ${error.message}`);
    }
  }

  /**
   * Delete a message (only by sender)
   */
  async deleteMessage(
    messageId: number,
    senderId: number,
    senderType: 'client' | 'seller' | 'admin'
  ): Promise<void> {
    try {
      // Verify message exists and belongs to sender
      const msgCheck = await pool.query(
        'SELECT * FROM chat_messages WHERE id = $1',
        [messageId]
      );

      if (msgCheck.rows.length === 0) {
        throw new Error('Message not found');
      }

      const message = msgCheck.rows[0];

      // Only the sender can delete their message
      if (Number(message.sender_id) !== senderId || message.sender_type !== senderType) {
        throw new Error('Unauthorized: You can only delete your own messages');
      }

      // Delete the message
      await pool.query('DELETE FROM chat_messages WHERE id = $1', [messageId]);
    } catch (error: any) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Toggle a reaction on a message
   */
  async toggleReaction(
    messageId: number,
    userId: number,
    reaction: string,
    action: 'add' | 'remove'
  ): Promise<{ reactions: Record<string, number[]> }> {
    try {
      // Get current reactions
      const msgCheck = await pool.query(
        'SELECT reactions FROM chat_messages WHERE id = $1',
        [messageId]
      );

      if (msgCheck.rows.length === 0) {
        throw new Error('Message not found');
      }

      let reactions: Record<string, number[]> = msgCheck.rows[0].reactions || {};

      if (action === 'add') {
        // Add reaction
        if (!reactions[reaction]) {
          reactions[reaction] = [];
        }
        if (!reactions[reaction].includes(userId)) {
          reactions[reaction].push(userId);
        }
      } else {
        // Remove reaction
        if (reactions[reaction]) {
          reactions[reaction] = reactions[reaction].filter(id => id !== userId);
          if (reactions[reaction].length === 0) {
            delete reactions[reaction];
          }
        }
      }

      // Update in database
      await pool.query(
        'UPDATE chat_messages SET reactions = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(reactions), messageId]
      );

      return { reactions };
    } catch (error: any) {
      throw new Error(`Failed to toggle reaction: ${error.message}`);
    }
  }

  /**
   * Get a message by ID (for reply context)
   */
  async getMessageById(messageId: number): Promise<ChatMessage | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM chat_messages WHERE id = $1',
        [messageId]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to get message: ${error.message}`);
    }
  }
}

export const chatService = new ChatService();
