import "dotenv/config";
import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { initRealtime } from "./realtime/wsServer";

/**
 * Server entry point.
 * - Loads environment variables.
 * - Fails clearly when required configuration (JWT_SECRET, DATABASE_URL) is missing.
 * - Connects to PostgreSQL before accepting traffic, so the app never pretends
 *   persistence works when it does not.
 */
async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is missing. Copy backend/.env.example to backend/.env and set it.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL is missing. Copy backend/.env.example to backend/.env and set it.");
    process.exit(1);
  }

  await connectDatabase();

  const PORT = Number(process.env.PORT || 5000);
  const app = createApp();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`TaskFlow Pro API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Realtime task sync over WebSocket (same port, path /ws).
  initRealtime(server);

  const shutdown = async (): Promise<void> => {
    server.close();
    const { disconnectDatabase } = await import("./config/database");
    await disconnectDatabase();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("FATAL: server startup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
