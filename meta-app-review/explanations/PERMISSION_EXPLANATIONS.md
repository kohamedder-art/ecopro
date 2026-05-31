# Permission Explanations (paste these in Meta review form)

## 1. pages_messaging
**Why we need this permission:**
Our platform (Sahla4Eco) is an e-commerce builder for Algerian store owners. When a customer visits a store and sends a message on Facebook Messenger asking about a product, price, or order status, our AI chatbot automatically responds to help the customer. Store owners also use this to send order confirmations, delivery updates, and track shipment status to their customers via Messenger.

**How we use it:**
- Receive customer messages via webhook
- Send AI-powered auto-replies about products, prices, and availability
- Send order confirmation messages
- Send delivery status updates
- Allow store owners to reply manually from their dashboard

---

## 2. pages_show_list
**Why we need this permission:**
Store owners connect multiple Facebook Pages to our platform. We need to list their connected pages so they can select which page to use for their store's customer support. This allows them to manage different stores or business lines from one dashboard.

**How we use it:**
- Display list of pages the store owner manages
- Let them select which page to connect to their store
- Show page name and status in the dashboard

---

## 3. pages_manage_metadata
**Why we need this permission:**
We need to read and update page settings to properly configure the Messenger integration. This includes setting up the webhook URL, configuring greeting messages, and ensuring the bot is properly connected to respond to customer messages.

**How we use it:**
- Set up webhook subscription for incoming messages
- Configure page greeting text
- Update page description and auto-reply settings
- Enable Messenger platform features

---

## 4. pages_read_engagement
**Why we need this permission:**
We need to read engagement data to show store owners how many customers are messaging them, response times, and message volume. This helps them understand their customer support performance and improve their service.

**How we use it:**
- Display message statistics in dashboard
- Show response time metrics
- Track customer interaction history
- Generate analytics reports for store owners

---

## 5. pages_utility_messaging
**Why we need this permission:**
This permission allows us to send important transactional messages to customers, such as order confirmations, delivery updates, and shipping notifications. These are essential utility messages that customers expect to receive after making a purchase.

**How we use it:**
- Send order confirmation after purchase
- Send delivery status updates (shipped, out for delivery, delivered)
- Send tracking number notifications
- Send payment confirmation messages

---

## 6. business_management
**Why we need this permission:**
Store owners connect their Facebook Business accounts to our platform. We need this permission to access their business assets (pages, ad accounts) so they can manage everything from one place. This is required for the Facebook Login integration.

**How we use it:**
- Access business pages during Facebook Login
- Link business pages to store accounts
- Manage page connections from the dashboard
- Support multiple store locations under one business
