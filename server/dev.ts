import { createServer } from "./index";
import http from "http";
import { initializeDatabase, runPendingMigrations, ensureConnection } from "./utils/database";
import { processPendingMessages, cleanupOldOrders } from "./utils/bot-messaging";
import { cleanupExpiredCodes } from "./utils/code-utils";
import { initWebSocket } from "./utils/websocket";
import { startTrackingPollWorker } from "./utils/tracking-poll-worker";

const PORT = Number(process.env.PORT || 8080);

async function startServer() {
  // Require DATABASE_URL for all environments
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Please set your Render PostgreSQL database URL.");
    console.error("   Example: DATABASE_URL=postgresql://username:password@host.render.com:5432/database");
    process.exit(1);
  }

  // Warm up DB connection before starting server to avoid first-request timeout
  console.log("🔄 Warming up database connection...");
  try {
    await ensureConnection();
    console.log("✅ Database connection ready");
  } catch (err) {
    console.error("❌ Database connection failed:", (err as any)?.message);
    console.error("   Please check your DATABASE_URL points to a valid Render PostgreSQL database.");
    process.exit(1);
  }

  // Start server immediately (don't block boot on remote DB + migrations).
  const app = await createServer({ skipDbInit: true });
  const server = http.createServer(app);
  
  // Initialize WebSocket server for real-time chat
  initWebSocket(server);
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket available at ws://localhost:${PORT}/ws/chat`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}/dashboard\n`);
  });

  // Initialize DB + migrations + background jobs asynchronously.
  (async () => {
    try {
      if (process.env.DATABASE_URL) {
        const url = process.env.DATABASE_URL || '';
        const masked = url.replace(/:(.*?)@/, ':****@');
        console.log("🔄 Initializing database... using DATABASE_URL=", masked);
        await initializeDatabase();
        await runPendingMigrations();
        console.log('✅ Database ready');

        setInterval(() => {
          processPendingMessages().catch(err => console.error("Bot message processor error:", err));
        }, 5 * 60 * 1000);
        console.log("🤖 Bot message processor started (runs every 5 minutes)");

        setInterval(() => {
          cleanupOldOrders().catch(err => console.error("Order cleanup error:", err));
        }, 60 * 60 * 1000);
        console.log("🧹 Order cleanup started (runs every 1 hour)");

        setInterval(() => {
          cleanupExpiredCodes().catch(err => console.error("Code cleanup error:", err));
        }, 10 * 60 * 1000);
        console.log("📋 Subscription code cleanup started (runs every 10 minutes)");

        startTrackingPollWorker({ intervalMs: 10 * 60 * 1000 });
        console.log("📦 Tracking poll worker started (runs every 10 minutes)");
      }
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
      process.exit(1);
    }
  })();
}

startServer();
