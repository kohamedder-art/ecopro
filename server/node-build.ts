import { createServer } from "./index";
import http from "http";
import { ensureConnection, runPendingMigrations } from "./utils/database";
import { startScheduledMessageWorker, stopScheduledMessageWorker } from "./utils/scheduled-messages";
import { startBotMessageWorker, stopBotMessageWorker } from "./utils/bot-messaging";
import { startTelegramUpdatePoller, stopTelegramUpdatePoller } from "./utils/telegram-poller";
import { startGuardianWorker, stopGuardianWorker } from "./utils/guardian-worker";
import { startTrackingPollWorker, stopTrackingPollWorker } from "./utils/tracking-poll-worker";
import { initWebSocket } from "./utils/websocket";

async function startServer() {
  try {
    // Create and start server with WebSocket support
    const app = await createServer({ skipDbInit: true });
    const port = process.env.PORT || 3000;
    const server = http.createServer(app);
    
    // Initialize WebSocket server for real-time chat
    initWebSocket(server);

    // Warm up DB connection + run pending migrations before accepting requests
    try {
      await ensureConnection();
      console.log("✅ Database connection ready");
      await runPendingMigrations();
      console.log("✅ Migrations up to date");
    } catch (err) {
      console.error("❌ Database initialization failed:", (err as any)?.message);
      process.exit(1);
    }

    server.listen(port, () => {
      console.log(`\n🚀 EcoPro server running on port ${port}`);
      console.log(`📱 Frontend: http://localhost:${port}`);
      console.log(`🔧 API: http://localhost:${port}/api`);
      console.log(`🔌 WebSocket: ws://localhost:${port}/ws/chat`);
      console.log(`📊 Dashboard: http://localhost:${port}/dashboard\n`);
      
      // Start the scheduled message worker
      startScheduledMessageWorker();
      // Process bot_messages (Messenger instant/pin/confirmations, etc.)
      startBotMessageWorker({ intervalMs: 30 * 1000 });
      // Poll Telegram for updates (fallback when webhooks fail)
      startTelegramUpdatePoller({ intervalMs: 5 * 1000 });
      // Start the Guardian AI alert worker
      startGuardianWorker();
      // Start tracking poll worker for non-webhook couriers
      startTrackingPollWorker({ intervalMs: 3 * 60 * 1000 });
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("🛑 Received SIGTERM, shutting down gracefully");
      stopScheduledMessageWorker();
      stopBotMessageWorker();
      stopTelegramUpdatePoller();
      stopGuardianWorker();
      stopTrackingPollWorker();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.log("🛑 Received SIGINT, shutting down gracefully");
      stopScheduledMessageWorker();
      stopBotMessageWorker();
      stopTelegramUpdatePoller();
      stopGuardianWorker();
      stopTrackingPollWorker();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
