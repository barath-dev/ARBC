import { Router } from "express";
import { triggerVerification, getVerificationResult } from "../controllers/verification.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Only recruiters can trigger and view detailed verifications
router.use(requireAuth, requireRole(["RECRUITER"]));

router.post("/student/:studentId", triggerVerification);
router.get("/:id", getVerificationResult);

export default router;
