import { Router, type Request, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware";
import { register, login } from "../services/authService";

const router = Router();

/** POST /api/auth/register — creates an account, returns token + safe user. */
router.post("/register", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { email, password, name } = body;

  if (typeof password === "string" && typeof body.confirmPassword === "string" && password !== body.confirmPassword) {
    return void res.status(400).json({ success: false, message: "Passwords do not match" });
  }

  const result = await register(email, password, name);
  res.status(201).json({ success: true, data: result });
});

/** POST /api/auth/login — authenticates, returns token + safe user. */
router.post("/login", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await login(body.email, body.password);
  res.json({ success: true, data: result });
});

/** GET /api/auth/me — returns the currently authenticated user. */
router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { user: req.authUser } });
});

export default router;
