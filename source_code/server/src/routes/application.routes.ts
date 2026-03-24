import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  applyToJob,
  listMyApplications,
  withdrawApplication,
  listJobApplications,
  viewApplication,
  updateApplicationStatus,
} from "../controllers/application.controller";

const router = Router();

router.use(requireAuth);

// ─── Student ──────────────────────────────────────────────
router.post("/", requireRole(["STUDENT"]), applyToJob);
router.get("/mine", requireRole(["STUDENT"]), listMyApplications);
router.delete("/:id", requireRole(["STUDENT"]), withdrawApplication);

// ─── Recruiter ────────────────────────────────────────────
router.get("/job/:jobId", requireRole(["RECRUITER"]), listJobApplications);
router.get("/:id", requireRole(["RECRUITER"]), viewApplication);           // lazy ARBC trigger
router.patch("/:id/status", requireRole(["RECRUITER"]), updateApplicationStatus);

export default router;
