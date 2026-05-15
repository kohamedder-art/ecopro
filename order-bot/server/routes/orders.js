import express from 'express';
import { Order } from '../models/Order.js';
import { Buyer } from '../models/Buyer.js';
import { Client } from '../models/Client.js';
import { scheduleOrderMessages } from '../queue/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOrderNotification } from '../utils/email.js';
import { broadcastOrderUpdate } from '../index.js';

const router = express.Router();

// Get orders for a client (protected route)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const clientId = req.clientId;
    const { status, payment_status, delivery_status, start_date, end_date, search } = req.query;

    let orders;
    
    // If any filters are provided, use search function
    if (status || payment_status || delivery_status || start_date || end_date || search) {
      orders = await Order.search(clientId, {
        status,
        payment_status,
        delivery_status,
        start_date,
        end_date,
        search,
      });
    } else {
      orders = await Order.findByClientId(clientId);
    }

    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get single order details (protected route)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.clientId;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.client_id !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Public endpoint: Get order by confirmation token
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const order = await Order.findByToken(token);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only expose non-sensitive fields
    res.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        product_name: order.product_name,
        quantity: order.quantity,
        total_price: order.total_price,
        status: order.status,
        buyer_name: order.buyer_name,
        client_name: order.client_name,
        created_at: order.created_at,
      }
    });
  } catch (error) {
    console.error('Get order by token error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Public endpoint: Update order status (from confirmation page)
router.post('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { status, notes } = req.body;

    // Validate status
    if (!['approved', 'declined', 'changed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findByToken(token);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order
    const updatedOrder = await Order.updateStatus(order.id, status, notes);

    // Get client and buyer details for notification
    const client = await Client.findById(order.client_id);
    const buyer = await Buyer.findById(order.buyer_id);

    // Send email notification to client
    if (client && buyer) {
      await sendOrderNotification(client, updatedOrder, buyer, status);
    }

    // Broadcast real-time update
    broadcastOrderUpdate(updatedOrder);

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Update order details (protected route)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.clientId;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.client_id !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = req.body;
    const updatedOrder = await Order.update(id, updates);

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
