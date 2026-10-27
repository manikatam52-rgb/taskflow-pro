import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware";
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleComplete,
  deleteTask,
} from "../services/taskService";

const router = Router();
// Every task route requires a verified JWT. Ownership is derived from the token.
router.use(requireAuth);

/** GET /api/tasks?status=&priority=&category=&search=&sortBy= */
router.get("/", async (req: Request, res: Response) => {
  const tasks = await listTasks((req as AuthRequest).authUser!._id, req.query as Record<string, unknown>);
  res.json({ success: true, data: { tasks } });
});

/** POST /api/tasks */
router.post("/", async (req: Request, res: Response) => {
  const task = await createTask((req as AuthRequest).authUser!._id, (req.body ?? {}) as Record<string, unknown>);
  res.status(201).json({ success: true, data: { task } });
});

/** GET /api/tasks/:id */
router.get("/:id", async (req: Request, res: Response) => {
  const task = await getTaskById((req as AuthRequest).authUser!._id, req.params.id as string);
  res.json({ success: true, data: { task } });
});

/** PATCH /api/tasks/:id */
router.patch("/:id", async (req: Request, res: Response) => {
  const task = await updateTask(
    (req as AuthRequest).authUser!._id,
    req.params.id as string,
    (req.body ?? {}) as Record<string, unknown>
  );
  res.json({ success: true, data: { task } });
});

/** PATCH /api/tasks/:id/complete — body.status optionally forces pending/completed. */
router.patch("/:id/complete", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const status = body.status === "pending" || body.status === "completed" ? body.status : undefined;
  const task = await toggleComplete((req as AuthRequest).authUser!._id, req.params.id as string, status);
  res.json({ success: true, data: { task } });
});

/** DELETE /api/tasks/:id */
router.delete("/:id", async (req: Request, res: Response) => {
  await deleteTask((req as AuthRequest).authUser!._id, req.params.id as string);
  res.json({ success: true, data: { message: "Task deleted" } });
});

export default router;
