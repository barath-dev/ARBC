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
import institutionRoutes from "./institution.routes";
import companyRoutes from "./company.routes";
import jobRoutes from "./job.routes";
import boardRoutes from "./board.routes";
import applicationRoutes from "./application.routes";

// Auth endpoints
router.use("/auth", authRoutes);

// Feature endpoints
router.use("/student", studentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/verification", verificationRoutes);
router.use("/institutions", institutionRoutes);
router.use("/companies", companyRoutes);
router.use("/jobs", jobRoutes);
router.use("/board", boardRoutes);
router.use("/applications", applicationRoutes);

export default router;
