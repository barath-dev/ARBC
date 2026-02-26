import { Router } from "express";
import {
    updateMyProfile,
    addClaim,
    getMyProfile,
    listStudents,
    getStudentById
} from "../controllers/student.controller";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth";
import { updateStudentSchema, createClaimSchema } from "../types";

const router = Router();

// Student routes (Profile management)
router.get("/me", requireAuth, requireRole(["STUDENT"]), getMyProfile);
router.put("/me", requireAuth, requireRole(["STUDENT"]), validate(updateStudentSchema), updateMyProfile);
router.post("/me/claims", requireAuth, requireRole(["STUDENT"]), validate(createClaimSchema), addClaim);

// Recruiter routes (Viewing students)
router.get("/", requireAuth, requireRole(["RECRUITER"]), listStudents);
router.get("/:id", requireAuth, requireRole(["RECRUITER"]), getStudentById);

export default router;
