# PROJECT_MAP.md — EcoPro Platform

## [TECH_STACK]

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | React | 18.3.1 | SPA, all pages lazy-loaded |
| Routing | React Router DOM | 6.30.1 | v7 future flags enabled |
| Styling | Tailwind CSS | 3.4.17 | + shadcn/ui + Radix primitives |
| State | React Context + React Query | 5.84.2 | Cart in Context, server data in Query |
| Build | Vite | 7.2.4 | SWC plugin for React |
| Backend | Express | 5.1.0 | ES modules, single entry point |
| Database | PostgreSQL | — | Raw `pg` pool (Prisma schema = doc only) |
| Auth | JWT in HttpOnly cookies | — | + CSRF double-submit + TOTP 2FA |
| Validation | Zod + express-validator | 3.25.76 | Server-side, route-level |
| Email | Resend + Nodemailer | 6.7.0 / 7.0.12 | Resend primary, Nodemailer fallback |
| File Upload | Multer + Cloudinary | 2.0.2 / 2.8.0 | Local staging, Cloudinary CDN |
| Messaging | Twilio, Telegram Bot API, Meta Graph API | — | WhatsApp, Telegram, Messenger |
| AI | Google Gemini | 0.24.1 | AI settings, color intelligence, store-owner AI |
| Payment (subs) | RedotPay | — | Crypto payments for store subscriptions |
| i18n | i18next + react-i18next | 25.7.3 / 16.5.1 | Browser language detection |
| Testing | Vitest + Testing Library | 3.2.4 / 16.3.1 | Unit + component tests |
| PM | pnpm | 10.14.0 | Workspace overrides for security patches |

---

## [SYSTEM_FLOW]

### Actor Roles (6)
1. **Platform Admin** — Full system control, user management, billing, kernel access
2. **Store Owner (Client)** — Creates/manages store, products, orders, staff, bots
3. **Staff** — Assigned to store, limited order management
4. **Customer** — Browses storefront, places COD orders, confirms via bot
5. **Affiliate** — Referral tracking, commission dashboard
6. **Kernel (root)** — Internal system API, deep access

### Core User Journeys

#### Journey A: Store Owner Lifecycle
```
Landing → Signup → Email Verification → Login → Dashboard → Pick Template
  → Customize Store → Add Products → Configure Bots → Invite Staff → Publish
```

#### Journey B: Customer Purchase (COD — Algeria Model)
```
/store/:slug → Browse Products → Click Product → Checkout Form
  → Fill Name/Phone/Address → Submit Order → /order/:id/confirm → Bot Notification
```

#### Journey C: Order Fulfillment
```
Store Owner Dashboard → Orders List → View Order → Update Status
  → Status Transition Triggers Bot Notification → Customer Receives Update → Delivery
```

#### Journey D: Subscription Billing
```
Store Owner → Billing Page → Select Tier → RedotPay Checkout → Crypto Payment
  → Webhook Confirms → Subscription Activated → Expiry Auto-locks Store
```

### Key System Boundaries
- **No customer payment gateway** — Cash on delivery only
- **No shopping cart** — Single product per order
- **No email notifications for customers** — Messenger/Telegram/WhatsApp bots
- **No product search/filtering** — Stores have 1-3 products typically
- **Multi-tenant isolation** — Each store is scoped to `client_id`

---

## [ARCHITECTURE]

```
ecopro/
├── server/
│   ├── index.ts                 # Express app bootstrap (~1600 lines)
│   ├── dev.ts                   # Dev server entry
│   ├── node-build.ts            # Production build entry
│   ├── routes/                  # 45 route files — domain endpoints
│   │   ├── auth.ts              # Login, register, 2FA, password reset
│   │   ├── admin.ts             # Platform admin CRUD
│   │   ├── billing.ts           # Subscriptions, RedotPay, checkout
│   │   ├── orders.ts            # Order CRUD, risk detection
│   │   ├── public-store.ts      # Storefront public APIs
│   │   ├── storefront.ts        # Product management (auth required)
│   │   ├── order-confirmation.ts # Order confirmation flow
│   │   ├── bot.ts               # Bot settings (Telegram/Messenger/WhatsApp)
│   │   ├── telegram.ts          # Telegram webhook + public endpoints
│   │   ├── messenger.ts         # Facebook Messenger webhook
│   │   ├── whatsapp-cloud.ts    # WhatsApp Cloud API webhook
│   │   ├── stock.ts             # Inventory management
│   │   ├── client-store.ts      # Store settings, categories, media
│   │   ├── dashboard.ts         # Analytics/stats
│   │   ├── staff.ts             # Staff management + auth
│   │   ├── templates.ts         # Template catalog
│   │   ├── delivery.ts          # Delivery companies, assignments
│   │   ├── delivery-prices.ts   # Delivery pricing by zone
│   │   ├── chat.ts              # In-app messaging
│   │   ├── customer-bot.ts      # Store owner → customer messaging
│   │   ├── ai.ts                # AI endpoints
│   │   ├── ai-settings.ts       # AI autopilot settings
│   │   ├── color-intelligence.ts # AI color matching
│   │   ├── pixels.ts            # Pixel tracking (FB, TikTok, GA)
│   │   ├── affiliates.ts        # Affiliate/referral system
│   │   ├── codes.ts             # Subscription codes
│   │   ├── google-sheets.ts     # Google Sheets integration
│   │   ├── intel.ts             # IP intelligence
│   │   ├── kernel.ts            # Root-only internal API
│   │   ├── oauth.ts             # Social login
│   │   ├── facebook-oauth.ts    # Facebook OAuth
│   │   ├── messenger.ts         # Messenger webhook
│   │   ├── uploads.ts           # File upload handling
│   │   ├── users.ts             # Client profile APIs
│   │   ├── announcements.ts     # Public announcements
│   │   ├── admin-announcements.ts # Admin announcement management
│   │   ├── legal.ts             # Privacy/terms pages
│   │   ├── health.ts            # Health check
│   │   ├── db-check.ts          # DB connectivity check
│   │   ├── telemetry.ts         # Client error telemetry
│   │   ├── traps.ts             # Honeypot endpoints
│   │   └── demo.ts              # Demo mode
│   ├── services/                # 13 service modules
│   │   ├── ai-customer.ts       # AI customer interaction
│   │   ├── chat.ts              # Chat service
│   │   ├── color-intelligence.ts # Color matching AI
│   │   ├── courier-service.ts   # Courier orchestration
│   │   ├── couriers/            # Courier implementations
│   │   ├── delivery.ts          # Delivery logic
│   │   ├── email.ts             # Email service
│   │   ├── gemini.ts            # Gemini AI wrapper
│   │   ├── google-sheets.ts     # Sheets API integration
│   │   ├── ip-intelligence.ts   # IP geolocation/reputation
│   │   ├── omni-intelligence.ts # Cross-platform intelligence
│   │   ├── store-owner-ai.ts    # AI for store owners
│   │   └── store-owner-chat-handler.ts # Chat routing
│   ├── middleware/              # 3 middleware modules
│   │   ├── auth.ts              # JWT + cookie auth
│   │   ├── subscription-check.ts # Active subscription enforcement
│   │   └── validation.ts        # Request validation wrapper
│   ├── utils/                   # 20+ utility modules
│   │   ├── database.ts          # pg pool + migrations
│   │   ├── security.ts          # GeoIP blocking, event logging
│   │   ├── traffic.ts           # In-memory traffic capture
│   │   ├── auth.ts              # Password hashing, token generation
│   │   ├── bot-messaging.ts     # Bot message worker
│   │   ├── scheduled-messages.ts # Message queue worker
│   │   ├── telegram-poller.ts   # Telegram update poller
│   │   ├── guardian-worker.ts   # Security guardian worker
│   │   ├── subscription-enforcement.ts # Auto-lock expired subs
│   │   ├── client-provisioning.ts # Store provisioning
│   │   └── ...
│   ├── migrations/              # SQL migration files
│   ├── lib/                     # validators.ts
│   ├── types/                   # Server-side type definitions
│   ├── data/                    # Seed/static data
│   └── logs/                    # Runtime log files
├── client/
│   ├── App.tsx                  # Router + providers + guards (~600 lines)
│   ├── main.tsx                 # React entry point
│   ├── pages/                   # ~50 page components
│   │   ├── Index.tsx            # Landing page
│   │   ├── Login.tsx, Signup.tsx, ForgotPassword.tsx, ResetPassword.tsx
│   │   ├── PlatformAdmin.tsx    # Platform admin dashboard
│   │   ├── Kernel.tsx           # Kernel portal
│   │   ├── admin/               # Store owner dashboard pages
│   │   │   ├── Dashboard.tsx, EnhancedDashboard.tsx
│   │   │   ├── Orders.tsx, BotSettings.tsx, AISettings.tsx, etc.
│   │   │   ├── delivery/        # Delivery management pages
│   │   │   └── orders/          # Order sub-pages
│   │   ├── customer/            # Customer-facing pages
│   │   │   └── StockManagement.tsx
│   │   ├── storefront/          # Storefront pages
│   │   │   ├── ProductDetail.tsx, ProductCheckout.tsx
│   │   │   ├── Checkout.tsx, OrderConfirmation.tsx
│   │   ├── seller/              # Seller pages
│   │   │   └── StaffManagement.tsx
│   │   ├── affiliate/           # Affiliate portal
│   │   │   ├── AffiliateLogin.tsx, AffiliateDashboard.tsx
│   │   ├── my-store/            # Store preview/editor
│   │   │   ├── Index.tsx, TemplateEditor.tsx, StorefrontPreview.tsx
│   │   └── ...
│   ├── components/              # Reusable UI components
│   ├── state/                   # CartContext, etc.
│   ├── contexts/                # Theme, Permission, Notification
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Auth, i18n, security probes
│   ├── utils/                   # Client utilities
│   └── data/                    # Static data
├── shared/                      # Shared between client + server
│   ├── types.ts                 # Core types (stale — needs sync)
│   ├── api.ts                   # Shared API contracts
│   ├── staff.ts                 # Staff permission types
│   ├── template-edits-contract.ts # Template editing contract
│   ├── theme-presets.ts         # Theme preset definitions
│   ├── apply-theme-preset.ts    # Theme application logic
│   └── universal-store-schema.ts # Store schema definition
├── prisma/
│   └── schema.prisma            # DB schema documentation (not runtime)
├── order-bot/                   # Bot infrastructure
├── scripts/                     # Build/deploy scripts
├── migrations/                  # Additional migration files
└── uploads/                     # Local upload staging (signed URLs)
```

### Data Flow Diagram

```
Customer Browser
     │
     ├─ GET  /store/:slug          → public-store.ts → pg pool → storefront HTML
     ├─ GET  /store/:slug/:product → public-store.ts → pg pool → product JSON
     └─ POST /store/:slug/orders   → public-store.ts → pg pool → order created
                                          │
                                          └─→ bot-messaging worker → Telegram/Messenger/WhatsApp

Store Owner Dashboard
     │
     ├─ GET  /api/client/orders    → orders.ts → auth middleware → pg pool
     ├─ PATCH /api/client/orders/:id/status → orders.ts → status change → bot notification
     └─ POST /api/client/store/products → storefront.ts → upload images → Cloudinary

Platform Admin
     │
     ├─ /api/admin/*               → admin.ts → requireAdmin → pg pool
     └─ /api/kernel/*              → kernel.ts → root-only auth → deep system access

Subscription Flow
     │
     ├─ POST /api/billing/checkout → billing.ts → RedotPay API → payment URL
     └─ POST /api/billing/webhook/redotpay → billing.ts → verify signature → update subscription
```

---

## [ORPHANS & PENDING]

### Orphaned Files (Safe to Delete)
| File | Reason |
|---|---|
| `*.cjs` (30+ files) | One-off scripts, should be in `scripts/` or deleted |
| `temp_*.tsx` (6 files) | Temp dashboard/profile dumps |
| `*.bak` files | Backup copies |
| `ql -h localhost...` | Shell command accidentally saved as file |
| `t pg = require('pg');` | Partial code snippet file |
| `check_bot_debug.cjs`, `check_bot_messages.js` | Debug scripts |
| `add_magic.cjs`, `compress_*.cjs`, `fix_*.cjs`, `upgrade_*.cjs` | UI tweak scripts |
| `test-*.cjs` (12 files) | Test scripts (some duplicated by vitest) |
| `ghosts-to-delete.txt` | Cleanup list |
| `tsc_errors.txt`, `build_output.txt` | Build output logs |
| `server.log` | Runtime log |

### Pending Work (From PLATFORM_AUDIT_AND_STRATEGY.md + Current Gaps)

| Priority | Item | Status | Notes |
|---|---|---|---|
| **CRITICAL** | Structured logging system | Not started | Replace console.* with proper logger |
| **CRITICAL** | `shared/types.ts` sync | Not started | Stale — contains marketplace leftovers |
| **CRITICAL** | `server/index.ts` fat file | Not started | 1600 lines — split into bootstrap modules |
| **HIGH** | Route consolidation | Not started | `orders.ts` + `order-confirmation.ts` + `public-store.ts` overlap |
| **HIGH** | Clean orphan files | Not started | 30+ temp/script files in root |
| **MEDIUM** | Error boundary coverage | Partial | App.tsx has one — per-route boundaries needed |
| **MEDIUM** | Request correlation IDs | Not started | Add to all API responses for tracing |
| **LOW** | Prisma runtime vs raw pg | Decision needed | Schema exists but not used at runtime |
| **LOW** | Test coverage | Partial | Vitest configured, limited test files |

### Known Issues
- `shared/types.ts` contains `Product` with `sellerId`, `likes: Set<string>` — marketplace model, not current store model
- `server/index.ts` mounts 45+ routers in one file — hard to trace middleware order
- No request ID / trace correlation across client error telemetry → server logs
- Bot message workers log with `console.log` — no structured format
- Production env validation exists but is not comprehensive

---

## [MILESTONES]

### Milestone 1: Foundation Cleanup (Week 1)
- [ ] Create `server/lib/logger.ts` — structured logging with levels + request correlation
- [ ] Sync `shared/types.ts` with actual application types
- [ ] Delete all orphaned files from repo root
- [ ] Extract route mounting from `server/index.ts` into `server/routes/index.ts`
- [ ] Verify: `pnpm run typecheck` passes, `pnpm run dev` starts clean

### Milestone 2: Route Consolidation (Week 2)
- [ ] Merge overlapping order routes (orders + order-confirmation + public-store order logic)
- [ ] Consolidate bot/webhook routes (telegram + messenger + whatsapp-cloud under unified `/api/bots`)
- [ ] Verify: All existing API endpoints still respond correctly (test with existing test scripts)

### Milestone 3: Observability (Week 2-3)
- [ ] Add request ID middleware — attach to all responses, include in logs
- [ ] Migrate all `console.*` in services/ to new logger
- [ ] Add client error telemetry correlation with server-side request IDs
- [ ] Verify: Logs are structured JSON in production, human-readable in dev

### Milestone 4: Polish & Documentation (Week 3)
- [ ] Update `PLATFORM_AUDIT_AND_STRATEGY.md` with current status
- [ ] Document remaining TODO items with priority
- [ ] Verify: `pnpm test` passes, `pnpm run build` succeeds

---

*Generated: 2026-05-07*
*Next action: Await approval before executing Milestone 1*
