# EcoPro Platform - Simple Overview

## What This Platform Does
- Store owners create storefronts and list products
- Customers find products and place orders
- Orders show up in the store owner's dashboard
- That's it.

## Tech Stack
- **Frontend**: React 18 + React Router + TypeScript + TailwindCSS + Vite
- **Backend**: Express + TypeScript + PostgreSQL (Render)
- **Testing**: Vitest

## Project Structure
```
client/                  # React frontend
├── pages/              # Route pages (Index.tsx = home)
├── components/         # UI components and templates
│   ├── ui/            # Radix UI components
│   └── templates/     # Product templates (jewelry.tsx, electronics.tsx, etc)
├── App.tsx            # Router setup
└── global.css         # TailwindCSS theme

server/                # Express backend
├── index.ts           # Server setup & route registration
├── routes/            # API endpoints
│   ├── orders.ts      # Order endpoints
│   ├── public-store.ts  # Public storefront endpoints
│   └── ...
└── middleware/        # Auth middleware

shared/               # Shared types
└── api.ts            # TypeScript interfaces

Database: PostgreSQL
- store_orders         # All orders (id, product_id, client_id, customer_name, total_price, status, created_at)
- client_store_products # Client store products
- client_store_settings # Store configuration
```

## How Orders Work (The ONLY Thing That Matters)
1. Customer finds product on public storefront
2. Customer fills checkout form (name, phone, address)
3. Customer submits order
4. Order saved to `store_orders` table with `client_id = store_owner_id`
5. Store owner logs in to dashboard → Orders page
6. `/api/client/orders` returns orders WHERE `client_id = authenticated_user_id`
7. Orders display on Orders page

**Key Rule**: ALL orders are saved with the STORE OWNER's client_id, regardless of who places them.

## How Authentication Works
- Auth uses HttpOnly cookies (no localStorage tokens)
- Protected routes use the `authenticate` middleware (cookie-based)
- CSRF uses a double-submit cookie + `X-CSRF-Token` header
- Store owner's ID = the authenticated user's `id` that orders are filtered by

## Database Tables (Key Ones)
```sql
-- Main order table
store_orders(
  id, product_id, client_id, quantity, total_price,
  customer_name, customer_email, customer_phone, shipping_address,
  status, payment_status, created_at, updated_at
)

-- Products
client_store_products(
  id, client_id, title, price, description, images, created_at
)

-- Store settings
client_store_settings(
  id, client_id, store_slug, store_name, ...
)
```

## API Endpoints (The Important Ones)

### Public (No Auth)
- `GET /api/storefront/:storeSlug/products` - List store products
- `POST /api/storefront/:storeSlug/orders` - Create order from checkout

### Authenticated (Requires JWT token in Authorization header)
- `GET /api/client/orders` - Get all store owner's orders
- `POST /api/seller/products` - Create product
- `GET /api/seller/products` - List store owner's products

### Authenticated (Cookie-based)
- All authenticated endpoints require the auth cookie; state-changing endpoints also require `X-CSRF-Token`.

## Development
```bash
pnpm dev      # Start dev server (client + server on one port)
pnpm build    # Production build
pnpm test     # Run tests
```

## Common Tasks

### Add New Product Template
1. Create component in `client/components/templates/mytemplate.tsx`
2. Import and use in relevant pages
3. That's it - no database changes needed

### Change Theme Colors
Edit `client/global.css` and `tailwind.config.ts`

### Add New Order Field
1. Add column to `store_orders` table (SQL migration)
2. Update insert query in `server/routes/public-store.ts`
3. Update frontend form in checkout component
4. Display on Orders page

## Debugging Orders Not Showing
1. Check: Is user logged in? (auth cookie present)
2. Check: Is order in database? (`SELECT * FROM store_orders`)
3. Check: Does order have `client_id = user's ID`? 
4. If not → orders created with wrong client_id

## File Inventory
- `jewelry.tsx` - Jewelry product template
- `electronics.tsx` - Electronics product template
- `Checkout.tsx` - Checkout/payment page
- `Orders.tsx` - Admin order list page
- `ProductDetail.tsx` - Single product detail page
- `orders.ts` (server) - Order API handlers
- `public-store.ts` (server) - Public storefront handlers

**That's everything. Build on this.**
