import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import taskRoutes from "./routes/taskRoutes";
import { isDbConnected } from "./config/database";
import { errorMiddleware } from "./middleware/errorMiddleware";

/** Express app factory. Kept separate from server.ts so tests can import it. */
export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const dbConnected = isDbConnected();
    res.status(dbConnected ? 200 : 503).json({
      success: dbConnected,
      status: dbConnected ? "healthy" : "unhealthy",
      db: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/tasks", taskRoutes);

  // Unknown API routes.
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, message: "Endpoint not found" });
  });

  app.use(errorMiddleware);
  return app;
}
