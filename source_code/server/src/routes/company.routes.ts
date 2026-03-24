import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  createCompany,
  getMyCompany,
  updateMyCompany,
} from "../controllers/company.controller";

const router = Router();

router.use(requireAuth);

router.post("/", requireRole(["RECRUITER"]), createCompany);
router.get("/me", requireRole(["RECRUITER"]), getMyCompany);
router.put("/me", requireRole(["RECRUITER"]), updateMyCompany);

export default router;
