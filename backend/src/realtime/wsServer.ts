import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import jwt from "jsonwebtoken";
import type { TaskDTO } from "../models/Task";

/**
 * Realtime layer (WebSocket).
 *
 * Every authenticated user gets a channel keyed by their user id. When any
 * device performs a task mutation (create/update/complete/delete), all other
 * signed-in devices of the same user receive the event instantly, so the
 * task list stays in sync across phone, tablet and web.
 *
 * Protocol (JSON messages):
 *   client -> server : { type: "ping" }
 *   server -> client : { type: "task.created" | "task.updated" | "task.deleted",
 *                        task?: TaskDTO, id?: string, at: string }
 *                        plus an initial { type: "connected" } on open.
 *
 * Auth: the JWT is passed as `?token=<jwt>` on the websocket URL, or via the
 * Authorization header. Connections without a valid token are rejected.
 */

export type TaskEventType = "task.created" | "task.updated" | "task.deleted";

interface TaskEvent {
  type: TaskEventType;
  task?: TaskDTO;
  id?: string;
  at: string;
}

const clientsByUser = new Map<string, Set<WebSocket>>();

function verifyToken(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const token = url.searchParams.get("token");
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(
        header.slice(7).trim(),
        process.env.JWT_SECRET as string
      ) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export function initRealtime(server: HttpServer): () => void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const userId = verifyToken(req);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      let set = clientsByUser.get(userId);
      if (!set) {
        set = new Set();
        clientsByUser.set(userId, set);
      }
      set.add(ws);
      ws.on("close", () => {
        set!.delete(ws);
        if (set!.size === 0) clientsByUser.delete(userId);
      });
      ws.on("message", (data) => {
        // heartbeat: respond to ping so clients can detect liveness
        try {
          const msg = JSON.parse(String(data)) as { type?: string };
          if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", at: new Date().toISOString() }));
        } catch {
          /* ignore malformed messages */
        }
      });
      ws.send(JSON.stringify({ type: "connected", at: new Date().toISOString() }));
    });
  });

  return () => {
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
  };
}

/** Broadcast a task event to every connected device of the task's owner. */
export function broadcastTaskEvent(event: TaskEvent, userId: string): void {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
