import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../app";
import { connectDatabase, disconnectDatabase } from "../config/database";

let mongod: MongoMemoryServer;
const app = () => createApp();

beforeAll(async () => {
  // In-memory MongoDB: no external services, no data pollution.
  mongod = await MongoMemoryServer.create();
  process.env.JWT_SECRET = "test_secret_for_jest_only";
  process.env.JWT_EXPIRES_IN = "7d";
  process.env.MONGODB_URI = mongod.getUri("taskflow-test");
  await connectDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod.stop();
});

let tokenA = "";
let tokenB = "";

const register = (email: string, password = "Passw0rd123", name = "Test User") =>
  request(app()).post("/api/auth/register").send({ email, password, confirmPassword: password, name });

const login = (email: string, password = "Passw0rd123") =>
  request(app()).post("/api/auth/login").send({ email, password });

const createTask = (t: string, body: Record<string, unknown>, auth = tokenA) =>
  request(app()).post("/api/tasks").set("Authorization", `Bearer ${auth}`).send(body);

describe("POST /api/auth/register", () => {
  it("creates an account and returns token + safe user", async () => {
    const res = await register("a@example.com");
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe("a@example.com");
    expect(res.body.data.user).not.toHaveProperty("password"); // hash never leaks
  });

  it("rejects an invalid email with 400", async () => {
    const res = await register("not-an-email");
    expect(res.status).toBe(400);
  });

  it("rejects a weak password with 400", async () => {
    const res = await register("weak@example.com", "short");
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    await register("dup@example.com");
    const res = await register("dup@example.com");
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const res = await login("a@example.com");
    expect(res.status).toBe(200);
    tokenA = res.body.data.token;
    expect(tokenA).toBeTruthy();
  });

  it("rejects wrong password with 401 and generic message", async () => {
    const res = await login("a@example.com", "WrongPass1");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects unknown email with 401 (no user enumeration)", async () => {
    const res = await login("ghost@example.com");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user", async () => {
    const res = await request(app()).get("/api/auth/me").set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("a@example.com");
  });

  it("rejects missing token with 401", async () => {
    const res = await request(app()).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a tampered token with 401", async () => {
    const res = await request(app()).get("/api/auth/me").set("Authorization", `Bearer ${tokenA}xyz`);
    expect(res.status).toBe(401);
  });
});

describe("task endpoints", () => {
  let idHighOverdue = "";
  let idLowFuture = "";
  let idNoDeadline = "";

  it("rejects unauthenticated task access with 401", async () => {
    const res = await request(app()).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("creates tasks", async () => {
    const auth = `Bearer ${tokenA}`;
    const r1 = await createTask("t1", { title: "Overdue high", priority: "high", deadline: new Date(Date.now() - 3600_000).toISOString() });
    expect(r1.status).toBe(201);
    idHighOverdue = r1.body.data.task._id;

    const r2 = await createTask("t2", { title: "Future low", priority: "low", deadline: new Date(Date.now() + 48 * 3600_000).toISOString() });
    idLowFuture = r2.body.data.task._id;

    const r3 = await createTask("t3", { title: "No deadline", priority: "medium", tags: ["x", "y"] });
    idNoDeadline = r3.body.data.task._id;

    expect(r3.body.data.task.tags).toEqual(["x", "y"]);
  });

  it("rejects a task without title with 400", async () => {
    const res = await createTask("t4", { priority: "high" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid priority with 400", async () => {
    const res = await createTask("t5", { title: "x", priority: "urgent" });
    expect(res.status).toBe(400);
  });

  it("never allows the client to set userId (protected field)", async () => {
    const res = await request(app())
      .post("/api/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "injected", userId: "000000000000000000000000" });
    expect(res.status).toBe(201);
    expect(res.body.data.task.userId).not.toBe("000000000000000000000000");
    const removed = await request(app())
      .delete(`/api/tasks/${res.body.data.task._id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(removed.status).toBe(200);
  });

  it("returns tasks sorted by smart urgency", async () => {
    const res = await request(app()).get("/api/tasks").set("Authorization", `Bearer ${tokenA}`);
    const titles = res.body.data.tasks.map((t: { title: string }) => t.title);
    expect(titles[0]).toBe("Overdue high");
    expect(titles).toEqual(["Overdue high", "Future low", "No deadline"]);
  });

  it("filters by status, priority, and search", async () => {
    const byPrio = await request(app()).get("/api/tasks?priority=high").set("Authorization", `Bearer ${tokenA}`);
    expect(byPrio.body.data.tasks).toHaveLength(1);

    const bySearch = await request(app()).get("/api/tasks?search=future").set("Authorization", `Bearer ${tokenA}`);
    expect(bySearch.body.data.tasks).toHaveLength(1);
    expect(bySearch.body.data.tasks[0].title).toBe("Future low");
  });

  it("gets a single task by id", async () => {
    const res = await request(app()).get(`/api/tasks/${idHighOverdue}`).set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe("Overdue high");
  });

  it("rejects an invalid id with 400 and a missing id with 404", async () => {
    const bad = await request(app()).get("/api/tasks/not-an-id").set("Authorization", `Bearer ${tokenA}`);
    expect(bad.status).toBe(400);
    const missing = await request(app())
      .get("/api/tasks/65f0a1b2c3d4e5f6a7b8c9d0")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(missing.status).toBe(404);
  });

  it("updates only editable fields", async () => {
    const res = await request(app())
      .patch(`/api/tasks/${idLowFuture}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "Renamed", description: "updated", userId: "000000000000000000000000" });
    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe("Renamed");
    expect(res.body.data.task.userId).not.toBe("000000000000000000000000");
  });

  it("completes a task and sets completedAt", async () => {
    const res = await request(app())
      .patch(`/api/tasks/${idNoDeadline}/complete`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe("completed");
    expect(res.body.data.task.completedAt).toBeTruthy();
  });

  it("toggles a completed task back to pending", async () => {
    const res = await request(app())
      .patch(`/api/tasks/${idNoDeadline}/complete`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});
    expect(res.body.data.task.status).toBe("pending");
    expect(res.body.data.task.completedAt).toBeNull();
  });

  it("prevents user B from seeing, updating, or deleting user A's tasks", async () => {
    const reg = await register("b@example.com");
    tokenB = reg.body.data.token;
    const authB = `Bearer ${tokenB}`;

    const list = await request(app()).get("/api/tasks").set("Authorization", authB);
    expect(list.body.data.tasks).toHaveLength(0); // user isolation

    const get = await request(app()).get(`/api/tasks/${idHighOverdue}`).set("Authorization", authB);
    expect(get.status).toBe(404);

    const upd = await request(app())
      .patch(`/api/tasks/${idHighOverdue}`)
      .set("Authorization", authB)
      .send({ title: "hijack" });
    expect(upd.status).toBe(404);

    const del = await request(app()).delete(`/api/tasks/${idHighOverdue}`).set("Authorization", authB);
    expect(del.status).toBe(404);
  });

  it("deletes own tasks and returns 404 afterwards", async () => {
    const del = await request(app()).delete(`/api/tasks/${idLowFuture}`).set("Authorization", `Bearer ${tokenA}`);
    expect(del.status).toBe(200);
    const again = await request(app()).get(`/api/tasks/${idLowFuture}`).set("Authorization", `Bearer ${tokenA}`);
    expect(again.status).toBe(404);
  });

  it("rejects invalid JSON bodies with 400", async () => {
    const res = await request(app())
      .post("/api/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("GET /api/health", () => {
  it("reports healthy with db status", async () => {
    const res = await request(app()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.db).toBe("connected");
  });

  it("reports unavailable when the database is disconnected", async () => {
    await disconnectDatabase();
    try {
      const res = await request(app()).get("/api/health");
      expect(res.status).toBe(503);
      expect(res.body.status).toBe("unhealthy");
      expect(res.body.db).toBe("disconnected");
    } finally {
      await connectDatabase();
    }
  });
});
