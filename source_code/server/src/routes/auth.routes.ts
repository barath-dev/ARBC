import { Router } from "express";
import { register, login, getMe, githubOAuth, githubOAuthCallback } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth";
import { registerSchema, loginSchema } from "../types";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, getMe);

// GitHub OAuth routes
router.get("/github", requireAuth, githubOAuth);
router.get("/github/callback", githubOAuthCallback);

export default router;
