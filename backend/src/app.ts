    import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes";
import taskRoutes from "./routes/taskRoutes";
import { errorMiddleware } from "./middleware/errorMiddleware";

/** Express app factory. Kept separate from server.ts so tests can import it. */
export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      status: "healthy",
      db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
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
