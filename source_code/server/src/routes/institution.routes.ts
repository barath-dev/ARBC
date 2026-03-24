import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  registerInstitution,
  getMyInstitution,
  updateMyInstitution,
  generateInviteCodes,
  listInviteCodes,
  renameBatch,
  listStudents,
} from "../controllers/institution.controller";

const router = Router();

// All institution routes require authentication
router.use(requireAuth);

// Register a new institution (any INSTITUTION-role user who isn't already a member)
router.post("/", requireRole(["INSTITUTION"]), registerInstitution);

// Own institution profile
router.get("/me", requireRole(["INSTITUTION"]), getMyInstitution);
router.put("/me", requireRole(["INSTITUTION"]), updateMyInstitution);

// Invite codes
router.post("/me/invite-codes", requireRole(["INSTITUTION"]), generateInviteCodes);
router.get("/me/invite-codes", requireRole(["INSTITUTION"]), listInviteCodes);
router.patch("/me/invite-codes/batch/:batchId", requireRole(["INSTITUTION"]), renameBatch);

// Student cohort
router.get("/me/students", requireRole(["INSTITUTION"]), listStudents);

export default router;
