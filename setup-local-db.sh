#!/bin/bash
# ⚠️ LOCAL DATABASE SETUP DISABLED
# 
# Local PostgreSQL database is no longer supported.
# You must use the Render PostgreSQL database for all environments.
#
# To set up your development environment:
# 1. Get your Render PostgreSQL Internal Database URL from:
#    https://dashboard.render.com/databases
# 2. Add it to your .env.local file:
#    DATABASE_URL=postgresql://username:password@host.render.com:5432/database
# 3. Run: pnpm dev
#
# The server will now exit if DATABASE_URL is not set.

echo "⚠️  Local database setup is DISABLED"
echo ""
echo "Please use your Render PostgreSQL database instead."
echo ""
echo "Steps to configure:"
echo "1. Go to https://dashboard.render.com/databases"
echo "2. Copy the 'Internal Database URL'"
echo "3. Add to .env.local: DATABASE_URL=your-render-db-url"
echo "4. Run: pnpm dev"
echo ""
echo "The server requires DATABASE_URL to start."

exit 1
