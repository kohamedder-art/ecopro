// Chat API Routes
// Handles all chat operations with role-based access control

import { Router, Request, Response } from 'express';
import { chatService } from '../services/chat';
import { pool } from '../utils/database';
import { upload } from './uploads';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileTypeFromFile } from 'file-type';
import { scanFileForMalware } from '../utils/malware-scan';
import { signUploadPath, isSafeUploadName } from '../utils/upload-signing';
import { isCloudinaryConfigured, uploadToCloudinary } from '../utils/cloudinary';
import {
  SendMessageSchema,
  CreateChatSchema,
  RequestCodeSchema,
  IssueCodeSchema,
  MarkMessagesReadSchema,
  UpdateChatStatusSchema,
} from '../types/chat';
import { ZodError } from 'zod';
import { 
  notifyNewMessage, 
  notifyMessageEdit, 
  notifyMessageDelete,
  notifyMessagesRead 
} from '../utils/websocket';

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), 'uploads');
const serverError = (res: Response, error: any) => {
  const message = isProduction ? 'Internal server error' : (error?.message || String(error));
  return res.status(500).json({ error: message });
};

// Middleware to verify user role
const getUserRole = (req: Request): { userId: number; role: 'client' | 'seller' | 'admin' | null } => {
  const user = (req.user as any);
  if (!user) {
    return { userId: 0, role: null };
  }

  // Check if user is an admin
  if (user.role === 'admin' || user.user_type === 'admin') {
    return { userId: parseInt(user.id), role: 'admin' };
  }

  // Check if user is a client
  if (user.clientId) {
    return { userId: user.clientId, role: 'client' };
  }

  // Check if user is a regular client (using id field)
  if (user.user_type === 'client' && user.id) {
    return { userId: parseInt(user.id), role: 'client' };
  }

  // Check if user is a seller
  if (user.sellerId) {
    return { userId: user.sellerId, role: 'seller' };
  }

  return { userId: 0, role: null };
};

/**
 * GET /api/chat/list
 * Get list of chats for current user
 */
router.get('/list', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let chats;
    if (role === 'client') {
      chats = await chatService.getClientChats(userId);
    } else {
      chats = await chatService.getSellerChats(userId);
    }

    res.json({ chats, total: chats.length });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/create
 * Create a new chat (client initiates)
 */
router.post('/create', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);

  if (role !== 'client') {
    return res.status(403).json({ error: 'Only clients can create chats' });
  }

  try {
    const data = CreateChatSchema.parse(req.body);

    if (data.client_id !== userId) {
      return res.status(403).json({ error: 'Cannot create chat for another client' });
    }

    const chat = await chatService.getOrCreateChat(
      data.client_id,
      data.seller_id,
      data.store_id
    );

    res.json({ chat, message: 'Chat created or retrieved' });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json(isProduction ? { error: 'Invalid request' } : { error: 'Invalid request', details: error.errors });
    }
    return serverError(res, error);
  }
});

/**
 * GET /api/chat/:chatId/messages
 * Get messages from a chat
 */
router.get('/:chatId/messages', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify user has access to this chat
    const chatCheck = await pool.query('SELECT * FROM chats WHERE id = $1', [chatId]);

    if (chatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatCheck.rows[0];

    // Admin can access any chat, clients/sellers can only access their own
    if (role !== 'admin') {
      if (role === 'client' && Number(chat.client_id) !== userId) {
        return res.status(403).json({ error: 'Unauthorized access to chat' });
      }
      if (role === 'seller' && Number(chat.seller_id) !== userId) {
        return res.status(403).json({ error: 'Unauthorized access to chat' });
      }
    }

    const messages = await chatService.getChatMessages(
      Number(chatId),
      Number(limit),
      Number(offset)
    );

    res.json({ items: messages, total: messages.length });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/:chatId/message
 * Send a message
 */
router.post('/:chatId/message', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = SendMessageSchema.parse(req.body);

    if (data.chat_id !== Number(chatId)) {
      return res.status(400).json({ error: 'Chat ID mismatch' });
    }

    const message = await chatService.sendMessage(
      data.chat_id,
      userId,
      role,
      data.message_content,
      data.message_type,
      data.metadata
    );

    // Broadcast new message to room via WebSocket
    notifyNewMessage(Number(chatId), message, userId);

    res.json({ message });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/mark-all-read
 * Mark all messages as read across all user's chats
 */
router.post('/mark-all-read', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await chatService.markAllAsRead(userId, role as 'client' | 'seller' | 'admin');
    res.json({ success: true });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/:chatId/mark-read
 * Mark messages as read
 */
router.post('/:chatId/mark-read', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await chatService.markMessagesAsRead(Number(chatId), userId, role);
    
    // Notify others that messages were read
    notifyMessagesRead(Number(chatId), userId);
    
    res.json({ success: true });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * PATCH /api/chat/:chatId/message/:messageId
 * Edit a message (only sender can edit their own message)
 */
router.patch('/:chatId/message/:messageId', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId, messageId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { message_content } = req.body;

    if (!message_content || typeof message_content !== 'string' || !message_content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const message = await chatService.editMessage(
      Number(messageId),
      userId,
      role,
      message_content.trim()
    );

    // Notify via WebSocket
    notifyMessageEdit(Number(chatId), Number(messageId), message_content.trim(), userId);

    res.json({ message });
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return serverError(res, error);
  }
});

/**
 * DELETE /api/chat/:chatId/message/:messageId
 * Delete a message (only sender can delete their own message)
 */
router.delete('/:chatId/message/:messageId', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId, messageId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await chatService.deleteMessage(Number(messageId), userId, role);
    
    // Notify via WebSocket
    notifyMessageDelete(Number(chatId), Number(messageId), userId);
    
    res.json({ success: true, deleted: Number(messageId) });
  } catch (error: any) {
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/:chatId/message/:messageId/reaction
 * Add or remove a reaction to a message
 */
router.post('/:chatId/message/:messageId/reaction', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId, messageId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { reaction, action } = req.body;

    if (!reaction || typeof reaction !== 'string') {
      return res.status(400).json({ error: 'Reaction emoji is required' });
    }

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "add" or "remove"' });
    }

    const result = await chatService.toggleReaction(
      Number(messageId),
      userId,
      reaction,
      action
    );

    // Notify via WebSocket
    const { notifyMessageReaction } = await import('../utils/websocket');
    notifyMessageReaction(Number(chatId), Number(messageId), reaction, userId, action);

    res.json({ success: true, reactions: result.reactions });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/:chatId/request-code
 * Request a code (client)
 */
router.post('/:chatId/request-code', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (role !== 'client') {
    return res.status(403).json({ error: 'Only clients can request codes' });
  }

  try {
    const data = RequestCodeSchema.parse(req.body);

    if (data.chat_id !== Number(chatId)) {
      return res.status(400).json({ error: 'Chat ID mismatch' });
    }

    const codeRequest = await chatService.requestCode(
      data.chat_id,
      userId,
      data.code_type
    );

    res.json({ code_request: codeRequest });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/code-request/:requestId/issue
 * Issue a code (seller)
 */
router.post('/code-request/:requestId/issue', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { requestId } = req.params;

  if (role !== 'seller') {
    return res.status(403).json({ error: 'Only sellers can issue codes' });
  }

  try {
    const data = IssueCodeSchema.parse(req.body);

    // Verify seller owns this code request
    const requestCheck = await pool.query(
      'SELECT * FROM code_requests WHERE id = $1',
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Code request not found' });
    }

    const codeReq = requestCheck.rows[0];

    if (codeReq.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await chatService.issueCode(
      Number(requestId),
      data.code,
      24 // 24 hours default expiry
    );

    res.json({ code_request: updated });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    return serverError(res, error);
  }
});

/**
 * GET /api/chat/:chatId/codes
 * Get code requests for a chat
 */
router.get('/:chatId/codes', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify access
    const chatCheck = await pool.query('SELECT * FROM chats WHERE id = $1', [chatId]);

    if (chatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatCheck.rows[0];

    if (role === 'client' && chat.client_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (role === 'seller' && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const codes = await chatService.getCodeRequests(Number(chatId));
    res.json({ codes });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/:chatId/status
 * Update chat status (archive/close)
 */
router.post('/:chatId/status', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = UpdateChatStatusSchema.parse(req.body);

    if (data.chat_id !== Number(chatId)) {
      return res.status(400).json({ error: 'Chat ID mismatch' });
    }

    const updated = await chatService.updateChatStatus(
      Number(chatId),
      userId,
      data.status
    );

    res.json({ chat: updated });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    return serverError(res, error);
  }
});

/**
 * GET /api/chat/unread-count
 * Get unread message count (client/seller/admin)
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);

  try {
    if (!userId || !role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (role === 'client') {
      const count = await chatService.getUnreadCount(userId);
      return res.json({ unread_count: count });
    }

    if (role === 'seller') {
      const count = await chatService.getSellerUnreadCount(userId);
      return res.json({ unread_count: count });
    }

    if (role === 'admin') {
      const count = await chatService.getAdminUnreadCount();
      return res.json({ unread_count: count });
    }

    return res.json({ unread_count: 0 });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * DELETE /api/chat/:chatId
 * Delete a chat (soft delete)
 */
router.delete('/:chatId', async (req: Request, res: Response) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify ownership
    const chatCheck = await pool.query('SELECT * FROM chats WHERE id = $1', [chatId]);

    if (chatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatCheck.rows[0];

    if (role === 'client' && chat.client_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (role === 'seller' && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await chatService.deleteChat(Number(chatId));
    res.json({ success: true, message: 'Chat archived' });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * GET /api/chat/admin/all-chats
 * Get all client chats for admin panel
 * Admin only - lists all code requests from clients
 */
router.get('/admin/all-chats', async (req: Request, res: Response) => {
  const user = (req.user as any);
  
  // Verify admin access
  if (!user || (user.role !== 'admin' && user.user_type !== 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.client_id,
        u.name as client_name,
        u.email as client_email,
        c.status,
        c.created_at,
        (SELECT COUNT(*) FROM chat_messages cm 
         WHERE cm.chat_id = c.id AND cm.is_read = false AND cm.sender_type = 'client') as unread_count,
        (SELECT MAX(created_at) FROM chat_messages cm WHERE cm.chat_id = c.id) as last_message_at
      FROM chats c
      JOIN clients u ON u.id = c.client_id
      WHERE c.client_id IS NOT NULL
      ORDER BY last_message_at DESC NULLS LAST
    `);

    const chats = result.rows.map(row => ({
      id: row.id,
      client_id: row.client_id,
      client_name: row.client_name,
      client_email: row.client_email,
      status: row.status,
      created_at: row.created_at,
      unread_count: parseInt(row.unread_count) || 0,
      last_message_at: row.last_message_at,
    }));

    res.json({ chats, total: chats.length });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/create-admin-chat
 * Client creates/initiates chat with admin to request code
 */
router.post('/create-admin-chat', async (req: Request, res: Response) => {
  const user = (req.user as any);
  
  // For regular clients: use id field
  // For staff: use clientId field
  const clientId = user?.clientId || (user?.user_type === 'client' ? parseInt(user?.id) : null);

  if (!clientId) {
    return res.status(401).json({ error: 'Client authentication required' });
  }

  try {
    const { tier } = req.body;

    // Get or create chat with admin (client_id set, seller_id = null for admin)
    const existing = await pool.query(
      `SELECT * FROM chats WHERE client_id = $1 AND seller_id IS NULL LIMIT 1`,
      [clientId]
    );

    let chat;
    if (existing.rows.length > 0) {
      chat = existing.rows[0];
    } else {
      // Create new admin chat
      const result = await pool.query(
        `INSERT INTO chats (client_id, seller_id, status, tier, created_at)
         VALUES ($1, NULL, 'open', $2, NOW())
         RETURNING id, client_id, seller_id, status, tier, created_at`,
        [clientId, tier || 'bronze']
      );
      chat = result.rows[0];
    }

    res.json({ 
      chat,
      message: 'Chat with admin created/retrieved'
    });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * POST /api/chat/:chatId/upload
 * Upload a file to a chat
 */
router.post('/:chatId/upload', (req: Request, res: Response, next) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('[chat upload] multer error:', isProduction ? (err as any)?.message : err);
      const message = isProduction ? 'Upload failed' : `Upload failed: ${err.message}`;
      return res.status(400).json({ error: message });
    }
    handleChatFileUpload(req, res, next);
  });
});

const handleChatFileUpload = async (req: Request, res: Response, next: Function) => {
  const { userId, role } = getUserRole(req);
  const { chatId } = req.params;

  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Verify user has access to this chat
    const chatCheck = await pool.query(
      'SELECT * FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = chatCheck.rows[0];

    // Verify sender is part of this chat
    if (role === 'client' && Number(chat.client_id) !== userId) {
      return res.status(403).json({ error: 'Unauthorized: client cannot access this chat' });
    }
    if (role === 'seller' && Number(chat.seller_id) !== userId) {
      return res.status(403).json({ error: 'Unauthorized: seller cannot access this chat' });
    }

    // Secure upload finalization (magic bytes + allowlist + malware scan + signed URL)
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']);
    const detected = await fileTypeFromFile(req.file.path);
    if (!detected || !allowed.has(detected.mime)) {
      await fs.unlink(req.file.path).catch(() => null);
      return res.status(400).json({ error: 'File contents not allowed' });
    }

    const scan = await scanFileForMalware(req.file.path);
    if (scan.ok === false) {
      await fs.unlink(req.file.path).catch(() => null);
      return res.status(400).json({ error: scan.reason });
    }

    let fileUrl: string;
    const isCloudinary = isCloudinaryConfigured();
    if (isCloudinary) {
      try {
        const cloudResult = await uploadToCloudinary(req.file.path, {
          folder: `ecopro/chat_${chatId}`,
          resourceType: detected.mime.startsWith('video/') ? 'video' : 'image',
        });
        await fs.unlink(req.file.path).catch(() => null);
        fileUrl = cloudResult.url;
      } catch (cloudErr) {
        console.error('[chat upload] Cloudinary upload failed, falling back to local:', cloudErr);
      }
    }
    if (!fileUrl) {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const finalName = `${crypto.randomUUID()}.${detected.ext}`;
      if (!isSafeUploadName(finalName)) {
        await fs.unlink(req.file.path).catch(() => null);
        return res.status(400).json({ error: 'Invalid filename' });
      }
      const finalPath = path.join(UPLOAD_DIR, finalName);
      await fs.rename(req.file.path, finalPath);
      const { exp, sig } = signUploadPath({ filename: finalName, expiresInSeconds: 10 * 60 });
      fileUrl = `/uploads/${finalName}?exp=${exp}&sig=${sig}`;
    }
    const fileName = req.file.originalname;
    const fileType = detected.mime;
    const isImage = fileType.startsWith('image/');
    const isVoice = fileType.startsWith('audio/');
    const msgType = isVoice ? 'voice' : 'file_attachment';

    // Create message with file metadata
    const result = await pool.query(
      `INSERT INTO chat_messages 
       (chat_id, sender_id, sender_type, message_content, message_type, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        Number(chatId),
        userId,
        role,
        fileName,
        msgType,
        JSON.stringify({ 
          fileUrl, 
          fileName,
          fileType,
          isImage,
          size: req.file.size
        })
      ]
    );

    // Update chat updated_at
    if (role === 'client') {
      await pool.query(
        'UPDATE chats SET updated_at = NOW() WHERE id = $1 AND client_id = $2',
        [chatId, userId]
      );
    } else {
      await pool.query(
        'UPDATE chats SET updated_at = NOW() WHERE id = $1 AND seller_id = $2',
        [chatId, userId]
      );
    }

    res.json({ 
      message: 'File uploaded successfully',
      file: result.rows[0]
    });
  } catch (error: any) {
    return serverError(res, error);
  }
};

/**
 * POST /api/chat/admin/create-for-client
 * Admin creates a chat with a specific client (by client_id or email)
 */
router.post('/admin/create-for-client', async (req: Request, res: Response) => {
  const user = (req.user as any);
  
  // Verify admin access
  if (!user || (user.role !== 'admin' && user.user_type !== 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { client_id, email } = req.body;

    let targetClientId = client_id;

    // If email provided, find the client
    if (!targetClientId && email) {
      const clientResult = await pool.query(
        'SELECT id FROM clients WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
      );
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found with that email' });
      }
      
      targetClientId = clientResult.rows[0].id;
    }

    if (!targetClientId) {
      return res.status(400).json({ error: 'client_id or email is required' });
    }

    // Check if chat already exists
    const existing = await pool.query(
      'SELECT * FROM chats WHERE client_id = $1 AND seller_id IS NULL',
      [targetClientId]
    );

    if (existing.rows.length > 0) {
      return res.json({ chat: existing.rows[0], message: 'Chat already exists' });
    }

    // Create new chat
    const result = await pool.query(
      `INSERT INTO chats (client_id, seller_id, status, created_at)
       VALUES ($1, NULL, 'open', NOW())
       RETURNING *`,
      [targetClientId]
    );

    res.status(201).json({ chat: result.rows[0], message: 'Chat created' });
  } catch (error: any) {
    return serverError(res, error);
  }
});

/**
 * GET /api/chat/admin/search-clients
 * Admin search for clients by email or name to start a chat
 */
router.get('/admin/search-clients', async (req: Request, res: Response) => {
  const user = (req.user as any);
  
  // Verify admin access
  if (!user || (user.role !== 'admin' && user.user_type !== 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;

    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.created_at,
        (SELECT COUNT(*) FROM chats ch WHERE ch.client_id = c.id AND ch.seller_id IS NULL) as has_chat
      FROM clients c
      WHERE LOWER(c.email) LIKE $1 OR LOWER(c.name) LIKE $1
      ORDER BY c.name ASC
      LIMIT 20
    `, [searchTerm]);

    res.json({ clients: result.rows });
  } catch (error: any) {
    return serverError(res, error);
  }
});

export default router;
