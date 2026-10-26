import "dotenv/config";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { initRealtime } from "./realtime/wsServer";

/**
 * Server entry point.
 * - Loads environment variables.
 * - Fails clearly when required configuration (JWT_SECRET, MONGODB_URI) is missing.
 * - Connects to MongoDB before accepting traffic, so the app never pretends
 *   persistence works when it does not.
 */
async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is missing. Copy backend/.env.example to backend/.env and set it.");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("FATAL: MONGODB_URI is missing. Copy backend/.env.example to backend/.env and set it.");
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
  const closeRealtime = initRealtime(server);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down`);

    closeRealtime();
    server.close((err) => {
      if (err) {
        console.error("HTTP server shutdown failed:", err);
        process.exitCode = 1;
      }

      void disconnectDatabase()
        .then(() => console.log("MongoDB disconnected"))
        .catch((disconnectError: unknown) => {
          console.error("MongoDB shutdown failed:", disconnectError);
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("FATAL: server startup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});