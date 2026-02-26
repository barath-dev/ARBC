import { Router, Request, Response } from "express";
import authRoutes from "./auth.routes";
import { sendSuccess } from "../utils/api-response";

const router = Router();

// Health check
router.get("/health", (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

import studentRoutes from "./student.routes";
import dashboardRoutes from "./dashboard.routes";
import verificationRoutes from "./verification.routes";

// Auth endpoints
router.use("/auth", authRoutes);

// Feature endpoints
router.use("/student", studentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/verification", verificationRoutes);

export default router;
