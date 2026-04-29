# Local Development Setup

## ⚠️ REQUIREMENT: Render PostgreSQL Database

**Local PostgreSQL is no longer supported.** You must use your Render PostgreSQL database for all development.

## Database Setup

### 1. Get Your Render Database URL

1. Go to https://dashboard.render.com/databases
2. Select your PostgreSQL database
3. Copy the **Internal Database URL** (or External if connecting from outside Render)

### 2. Configure Environment

Update your `.env.local` file:

```env
# Required - Render PostgreSQL database
DATABASE_URL=postgresql://username:password@your-db-host.render.com:5432/database_name
```

### 3. Start Development Server

```bash
pnpm dev
```

The server will:
- Exit immediately if DATABASE_URL is not set
- Connect to your Render PostgreSQL database
- Run migrations automatically
- Start all background workers

## Troubleshooting

### Server exits with "DATABASE_URL is not set"
- Make sure `.env.local` exists in the project root
- Verify DATABASE_URL is properly set with your Render database URL
- The format should be: `postgresql://username:password@host:5432/database`

### Connection refused / timeout
- Check your Render database is running (not suspended)
- For external connections, use the External Database URL
- For Render-hosted services, use the Internal Database URL
- Verify your IP is allowed in Render dashboard (if using external URL)

### Migration errors
- The migrations will run automatically on first connect
- If you need to reset: use Render dashboard to connect with psql
