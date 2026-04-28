# EcoPro AI Interaction Vision

**Last Updated:** April 21, 2026  
**Vision**: Three AI assistants tailored to each user type's unique needs and permissions.

---

## Overview

The EcoPro platform has **THREE separate AI assistants**, each designed for one user type:

1. **Admin AI** - Platform oversight, has access to everything but needs approval for critical actions
2. **Store Owner AI** - Complete store management via chat (chat replaces the UI)
3. **Customer AI** - Store-specific shopping assistant (each store has its own isolated AI)

---

## 1. Admin AI Assistant

### Purpose
Give admins full visibility into the platform and empower them to make informed decisions, but prevent critical mistakes by requiring confirmation on sensitive actions.

### What Admin AI Can Do

#### 📊 Full Platform Analytics & Monitoring
- View all store data (sales, revenue, orders, customer counts)
- Monitor fraud and suspicious activity patterns
- Track system health (database performance, errors, crashes)
- See user account activity and trends
- Payment transaction monitoring and failed charges
- Policy compliance and violation tracking
- Revenue optimization analysis

#### 🛡️ Account & User Management
- View any user account details (store owner or customer)
- See all orders across the platform (filtered by store, date, etc.)
- View customer information and history
- Analyze store performance metrics
- Identify and investigate accounts

#### ⚠️ CRITICAL ACTIONS (Requires Confirmation)
These actions require admin approval BEFORE execution:
- **Delete a store** - Permanently remove a storefront
- **Block/suspend a user** - Lock an account from accessing the platform
- **Issue refunds** - Send money back to customers
- **Change platform settings** - Update core business rules
- **Override policies** - Make exceptions to standard rules

### How Admin AI Talks

**Tone:** Professional, factual, direct

**Example Conversation:**
```
Admin: "What's happening with fraud today?"

Admin AI: "We have 3 suspicious patterns detected:
1. Store #452 - 15 orders from same IP in 2 hours ($2,340 total)
2. Customer @john_doe - 4 failed payment attempts across 2 stores
3. Bot activity detected on storefront #789

Would you like me to block any accounts or flag for manual review?"

Admin: "Block the IP for store #452"

Admin AI: "⚠️ CRITICAL ACTION REQUIRES CONFIRMATION
Ready to block IP 192.168.x.x from Store #452.
This will affect all current visitors from that IP.
Proceed? [Yes/No]"
```

### What Admin AI CANNOT Do Alone
- ❌ Delete stores (needs approval)
- ❌ Block users (needs approval)  
- ❌ Issue refunds (needs approval)
- ❌ Bypass payment gateways
- ❌ Access customer credit card data directly
- ❌ Make unilateral policy changes
- ❌ Contact users on admin's behalf

### Data Access
- ✅ All platform analytics and metrics
- ✅ All store data (products, orders, customer info)
- ✅ All user accounts and activity logs
- ✅ Payment transaction records (but NOT credit card details)
- ✅ System logs and error reports

---

## 2. Store Owner AI Assistant

### Purpose
Let store owners manage their ENTIRE account through natural chat - no UI needed. The AI becomes their operational dashboard and control panel.

### What Store Owner AI Can Do

Store owners manage everything through chat:

#### 🏪 Store Branding & Configuration
- View current store settings (colors, name, theme, description)
- Edit store colors and design (match UI template editor)
- Change store name and description
- Update store slug/URL
- Configure store policies and FAQs
- Enable/disable delivery to specific regions

#### 📦 Product Management
- List all products with current status
- Add new products (name, description, price, images)
- Edit product details (name, price, description, availability)
- Add product variants (sizes, colors, options)
- Upload product images
- Update product stock/inventory levels
- Delete or archive products
- View product performance (sales, views, reviews)

#### 📋 Order Management
- View all orders with filters (status, date, customer)
- Update order status (pending, shipped, delivered, cancelled)
- Upload orders to delivery system
- View customer details for each order
- Track shipments
- View refund requests

#### 💳 Delivery & Logistics
- Configure delivery regions (wilayas/provinces)
- Set delivery prices by region
- View delivery provider status
- Update shipping costs
- Manage pickup points (if applicable)

#### 🤖 Bot & Automation Control
- View active bots/automation rules
- Stop/pause bots from running
- Enable/disable specific automation
- View bot performance and logs
- Configure bot behavior

#### 💰 Pricing & Financial
- View revenue and sales trends
- Check payment balance
- View transaction history
- Update product pricing
- Set discounts or promotions
- View financial reports

#### 📊 Analytics & Insights
- View sales by product, day, week, month
- See customer demographics
- Track which products are trending
- Identify slow-moving inventory
- Understand customer search behavior

### How Store Owner AI Talks

**Tone:** Helpful, proactive, action-oriented

**Example Conversations:**

```
Store Owner: "Show me my sales today"

Store Owner AI: "📊 Today's Sales Summary:
- Total Orders: 12
- Total Revenue: 1,850 DZD
- Average Order Value: 154 DZD
- Top Product: Wireless Headphones (4 sales)
- Pending Fulfillment: 8 orders

What would you like to do?"
```

```
Store Owner: "Add a new product - blue sneakers, size 40-45, price 3500"

Store Owner AI: "I'll create a new product:
- Name: Blue Sneakers
- Sizes: 40, 41, 42, 43, 44, 45
- Price: 3,500 DZD

Ready to add. Do you have product images to upload?"

Store Owner: "Yes, here are 3 images"

Store Owner AI: "✅ Product created! 
- Product ID: #8934
- Variants: 6 (all sizes)
- Status: Active
- Visible to customers: Yes

Can I help with anything else?"
```

```
Store Owner: "Stop the discount bot"

Store Owner AI: "⚠️ You're about to disable the discount automation.
This bot currently affects 5 active products.
Proceed? [Yes/No]"

Store Owner: "Yes"

Store Owner AI: "✅ Discount bot disabled. No new discounts will apply until you restart it."
```

### What Store Owner AI CANNOT Do
- ❌ Access other stores' data
- ❌ See customer PII (beyond order info)
- ❌ Bypass their own permission levels
- ❌ Issue refunds (unless they have refund permission)
- ❌ Change platform-level settings
- ❌ View payment gateway credentials
- ❌ Modify platform policies

### Data Access (Own Store Only)
- ✅ Their store settings and configuration
- ✅ Their products and inventory
- ✅ Their orders and customer names/contact info (order-related only)
- ✅ Their sales analytics and performance
- ✅ Their delivery settings and costs
- ✅ Their active bots and automations
- ✅ Their balance and transaction history
- ❌ NO other stores' data
- ❌ NO platform-wide analytics
- ❌ NO customer credit card info

---

## 3. Customer AI Assistant

### Purpose
Provide store-specific shopping help. Each store has its own isolated AI that knows only that store's products and policies.

### What Customer AI Does

#### 🛍️ Shopping Assistance
- Answer questions about store products
- Describe product details (price, sizes, colors, stock)
- Recommend products based on customer interest
- Help find specific items
- Compare products within the store
- Explain availability and shipping

#### 🛒 Checkout Support
- Clarify shipping costs by region (wilaya)
- Explain delivery timeframes
- Answer questions about payment methods
- Confirm order details before purchase
- Help with promo codes or discounts
- Explain return/refund policies

#### 📦 Order Support (After Purchase)
- Provide order status and tracking
- Answer delivery timeline questions
- Help with returns or exchanges
- Escalate quality complaints to store owner
- Provide shipping address confirmation

### How Customer AI Talks

**Tone:** Friendly, helpful, professional

**Example Conversation:**

```
Customer: "Do you have blue sneakers in size 42?"

Customer AI: "Yes! We have Blue Sneakers in size 42.
- Price: 3,500 DZD
- In Stock: 5 available
- Shipping to Algiers: 300 DZD (2-3 days)

Would you like to add to cart?"
```

```
Customer: "Can I return this if I don't like it?"

Customer AI: "Yes! Our return policy:
✅ Returns accepted within 30 days of delivery
✅ Item must be unused and in original packaging
✅ Free return shipping to our warehouse
❌ No returns after 30 days

Need help with anything else?"
```

### What Customer AI CANNOT Do
- ❌ Share information about other stores
- ❌ Override the store's policies independently
- ❌ Issue refunds without store owner approval
- ❌ Negotiate prices or offer special deals alone
- ❌ Guarantee stock (stock changes constantly)
- ❌ Provide store owner contact info
- ❌ Process payments directly

### When to Escalate to Store Owner
Customer request goes directly to store owner when:
- Customer requests exception to policy (special discount, return after 30 days)
- Customer reports quality issue with product
- Customer wants custom or special order
- Complex complaints or disputes
- Bulk purchase requests
- Any request requiring human judgment

### Data Access (Store-Specific Only)
- ✅ This store's product catalog (names, prices, descriptions)
- ✅ This store's policies and FAQs
- ✅ Stock levels for this store
- ✅ Delivery costs for regions
- ✅ Customer's own order history (if logged in)
- ❌ NO other stores' products or data
- ❌ NO other customers' orders
- ❌ NO store owner financial info
- ❌ NO admin/backend information
- ❌ NO customer payment details

---

## 4. Core Rules (All Three AIs)

### Data Privacy & Isolation
```
Admin AI → Can see: ALL data
Store Owner AI → Can see: Only their store data
Customer AI → Can see: Only this store + their own orders

NO CROSS-CONTAMINATION: Data must not leak between user types
```

### Permission Enforcement
- **Admin AI**: Can do everything BUT requires approval for critical actions
- **Store Owner AI**: Can only do what the store owner permission level allows
- **Customer AI**: Cannot override store policies, can only provide information and escalate

### Response Quality Standards
| User Type | Tone | Response Time | Depth |
|-----------|------|---|---|
| Admin | Professional | 2 min | Detailed metrics |
| Store Owner | Helpful | 5 min | Actionable steps |
| Customer | Friendly | 2-3 min | Quick answers |

### What NO AI Should Ever Do (Universal Rules)
- ❌ Allow one user to access another user's data
- ❌ Make payments or financial transfers without approval
- ❌ Delete data without confirmation
- ❌ Bypass security or authentication
- ❌ Expose sensitive data (passwords, tokens, credit cards)
- ❌ Impersonate users
- ❌ Make decisions outside their permission scope

---

## 5. Implementation Roadmap

### Phase 1: Foundation
- [ ] Create `/api/chat/admin` - Admin chat endpoint (requires admin role)
- [ ] Create `/api/chat/store-owner` - Store owner chat endpoint (requires client role)
- [ ] Create `/api/chat/customer/:storeId` - Customer chat endpoint (public/user-scoped)
- [ ] Build permission middleware for each chat type
- [ ] Set up authentication verification

### Phase 2: Context & Memory
- [ ] Design conversation context schema
- [ ] Implement message history storage per chat
- [ ] Build user profile enrichment (load store data, orders, products)
- [ ] Set up role-based data access layer

### Phase 3: Store Owner Intelligence
- [ ] Map store owner actions to backend API calls
- [ ] Create "intent recognition" (understand what the store owner wants)
- [ ] Build product management handlers
- [ ] Build order management handlers
- [ ] Build bot control handlers
- [ ] Build delivery configuration handlers

### Phase 4: Customer AI
- [ ] Load store product catalog into AI context
- [ ] Build product recommendation logic
- [ ] Build escalation workflow
- [ ] Create FAQ & policy integration

### Phase 5: Admin AI
- [ ] Build analytics data aggregation
- [ ] Create critical action confirmation flow
- [ ] Build audit logging for all admin actions

### Phase 6: Monitoring & Quality
- [ ] Add analytics tracking (topics, resolution rate)
- [ ] Build admin dashboard for AI metrics
- [ ] Create feedback mechanism
- [ ] Set up alerts for failed requests

---

## 6. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   THREE ISOLATED AIs                    │
└─────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   ADMIN AI       │  │ STORE OWNER AI   │  │  CUSTOMER AI     │
│                  │  │                  │  │                  │
│ • Full platform  │  │ • Own store only │  │ • Store products │
│ • All analytics  │  │ • Manage all ops │  │ • Own orders     │
│ • User mgmt      │  │ • Chat-first UX  │  │ • Store policies │
│ • Needs approval │  │ • Full control   │  │ • Isolated data  │
│   for critical   │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
       │                      │                       │
       │                      │                       │
    Requires Admin         Requires Client          Public/
    Authentication         Authentication          User Auth
```

---

## 7. Success Metrics

- **Store Owner Adoption**: % of store owners using AI for daily tasks
- **Resolution Rate**: % of customer questions resolved by AI
- **Critical Action Approvals**: % of critical admin actions approved vs rejected
- **Escalation Rate**: % of customer issues escalated to store owner
- **User Satisfaction**: Rating on AI helpfulness by user type

