import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  listPendingRequests,
  pullJobToBoard,
  approveEntry,
  rejectEntry,
  removeEntry,
  pushJobToInstitution,
  listInstitutions,
  getJobBoardEntries,
} from "../controllers/board.controller";

const router = Router();

router.use(requireAuth);

// ─── Institution actions ───────────────────────────────────
router.get("/requests", requireRole(["INSTITUTION"]), listPendingRequests);
router.post("/pull/:jobId", requireRole(["INSTITUTION"]), pullJobToBoard);
router.patch("/entries/:entryId/approve", requireRole(["INSTITUTION"]), approveEntry);
router.patch("/entries/:entryId/reject", requireRole(["INSTITUTION"]), rejectEntry);
router.delete("/entries/:entryId", requireRole(["INSTITUTION"]), removeEntry);

// ─── Company actions ───────────────────────────────────────
router.get("/institutions", requireRole(["RECRUITER"]), listInstitutions);
router.get("/entries/job/:jobId", requireRole(["RECRUITER"]), getJobBoardEntries);
router.post("/push/:jobId/:institutionId", requireRole(["RECRUITER"]), pushJobToInstitution);

export default router;
