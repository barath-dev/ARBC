import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  createJob,
  listMyJobs,
  getJob,
  updateJob,
  deleteJob,
  publishJob,
  closeJob,
  listBoardJobs,
} from "../controllers/job.controller";

const router = Router();

router.use(requireAuth);

// Recruiter — own job management
router.post("/", requireRole(["RECRUITER"]), createJob);
router.get("/mine", requireRole(["RECRUITER"]), listMyJobs);
router.put("/:id", requireRole(["RECRUITER"]), updateJob);
router.delete("/:id", requireRole(["RECRUITER"]), deleteJob);
router.post("/:id/publish", requireRole(["RECRUITER"]), publishJob);
router.post("/:id/close", requireRole(["RECRUITER"]), closeJob);

// Board view — students and institutions see approved jobs
router.get("/board", requireRole(["STUDENT", "INSTITUTION"]), listBoardJobs);

// Per-job detail — any authenticated user
router.get("/:id", getJob);

export default router;