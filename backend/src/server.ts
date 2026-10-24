import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app";
import { connectDatabase } from "./config/database";

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TaskFlow Pro API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error("FATAL: server startup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});