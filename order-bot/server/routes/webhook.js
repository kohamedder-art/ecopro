import express from 'express';
import { Order } from '../models/Order.js';
import { Buyer } from '../models/Buyer.js';
import { Client } from '../models/Client.js';

const router = express.Router();

// Simple API key verification
function requireApiKey(req: any, res: any, next: any) {
  const key = req.headers['x-api-key'];
  const expected = process.env.WEBHOOK_API_KEY;
  if (!expected || key !== expected) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

// Webhook endpoint for external stores to create orders
// This is called when a buyer completes checkout on Facebook, Instagram, or any integrated store
router.post('/order', requireApiKey, async (req, res) => {
  try {
    const {
      client_id,
      order_number,
      buyer,
      product_name,
      quantity,
      total_price,
      notes,
    } = req.body;

    // Validate required fields
    if (!client_id || !order_number || !buyer || !product_name || !quantity || !total_price) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['client_id', 'order_number', 'buyer', 'product_name', 'quantity', 'total_price']
      });
    }

    // Verify client exists
    const client = await Client.findById(client_id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check if buyer exists, create if not
    let existingBuyer = await Buyer.findByPhone(buyer.phone, client_id);
    
    if (!existingBuyer) {
      // Create new buyer
      existingBuyer = await Buyer.create({
        client_id,
        name: buyer.name,
        phone: buyer.phone,
        email: buyer.email || null,
        address: buyer.address || null,
      });
      console.log(`✨ New buyer created: ${buyer.name} (${buyer.phone})`);
    }

    // Create order
    const order = await Order.create({
      order_number,
      client_id,
      buyer_id: existingBuyer.id,
      product_name,
      quantity,
      total_price,
      notes: notes || null,
    });

    console.log(`📦 New order received: #${order_number} from ${buyer.name}`);
    console.log(`   → Bot will detect and process this order within 30 seconds`);

    res.status(201).json({ 
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        buyer_name: existingBuyer.name,
      },
      message: 'Order created successfully. Verification messages will be sent automatically.'
    });

  } catch (error) {
    console.error('Webhook order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

export default router;
