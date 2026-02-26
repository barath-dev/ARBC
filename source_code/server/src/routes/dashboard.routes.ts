import { Router } from "express";
import { getDashboardStats, getRecentVerifications } from "../controllers/dashboard.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Dashboard routes are strictly for recruiters
router.use(requireAuth, requireRole(["RECRUITER"]));

router.get("/stats", getDashboardStats);
router.get("/recent", getRecentVerifications);

export default router;
