import { Router } from "express";
import {
    updateMyProfile,
    addClaim,
    getMyProfile,
    updateClaim,
    deleteClaim,
    listStudents,
    getStudentById,
    disconnectGithub,
    verifyRepo,
    joinInstitution,
} from "../controllers/student.controller";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth";
import { updateStudentSchema, createClaimSchema, updateClaimSchema } from "../types";

const router = Router();

// Student routes (Profile management)
router.get("/me", requireAuth, requireRole(["STUDENT"]), getMyProfile);
router.put("/me", requireAuth, requireRole(["STUDENT"]), validate(updateStudentSchema), updateMyProfile);
router.delete("/me/github", requireAuth, requireRole(["STUDENT"]), disconnectGithub);
router.post("/me/join", requireAuth, requireRole(["STUDENT"]), joinInstitution);
router.get("/me/verify-repo", requireAuth, requireRole(["STUDENT"]), verifyRepo);
router.post("/me/claims", requireAuth, requireRole(["STUDENT"]), validate(createClaimSchema), addClaim);
router.put("/me/claims/:id", requireAuth, requireRole(["STUDENT"]), validate(updateClaimSchema), updateClaim);
router.delete("/me/claims/:id", requireAuth, requireRole(["STUDENT"]), deleteClaim);

// Recruiter routes (Viewing students)
router.get("/", requireAuth, requireRole(["RECRUITER"]), listStudents);
router.get("/:id", requireAuth, requireRole(["RECRUITER"]), getStudentById);

export default router;
