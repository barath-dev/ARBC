import { Request, Response } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { z } from "zod/v4";
import { resolveCompanyId } from "./company.controller";
import { cleanRegex } from "zod/v4/core/util.cjs";

// ─── Validation Schemas ───────────────────────────────────

const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  skills: z.array(z.string()).default([]),
  location: z.string().optional(),
  isRemote: z.boolean().default(false),
  jobType: z.enum(["INTERNSHIP", "FULL_TIME", "PART_TIME", "CONTRACT"]),
  visibility: z.enum(["PUBLIC", "INSTITUTION_SPECIFIC"]).default("PUBLIC"),
  deadline: z.iso.datetime().optional(),
  openPositions: z.coerce.number().int().min(1).default(1),
});

const updateJobSchema = createJobSchema.partial();

// ─── Helpers ──────────────────────────────────────────────

const JOB_COMPANY_SELECT = {
  company: { select: { id: true, name: true, logoUrl: true } },
} as const;

async function getJobForCompany(jobId: string, companyId: string) {
  return prisma.job.findFirst({ where: { id: jobId, companyId } });
}

// ─── POST /api/jobs — create a new job (DRAFT) ────────────

export async function createJob(req: Request, res: Response): Promise<void> {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) {
    sendError(res, "No company profile found. Create one first.", 404, "NO_COMPANY");
    return;
  }

  const job = await prisma.job.create({
    data: { ...parsed.data, companyId, status: "DRAFT" },
  });

  sendSuccess(res, { job }, 201);
}

// ─── GET /api/jobs/mine — list recruiter's own jobs ───────

export async function listMyJobs(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) {
    sendError(res, "No company profile found", 404, "NO_COMPANY");
    return;
  }

  const jobs = await prisma.job.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true, boardEntries: true } } },
  });

  sendSuccess(res, { jobs });
}

// ─── GET /api/jobs/:id — get a single job ─────────────────

export async function getJob(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  const job = await prisma.job.findUnique({
    where: { id },
    include: JOB_COMPANY_SELECT,
  });

  if (!job) {
    sendError(res, "Job not found", 404, "NOT_FOUND");
    return;
  }

  sendSuccess(res, { job });
}

// ─── PUT /api/jobs/:id — update a job (must be DRAFT) ─────

export async function updateJob(req: Request, res: Response): Promise<void> {
  const parsed = updateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile found", 404, "NO_COMPANY"); return; }

  const existing = await getJobForCompany(req.params.id as string, companyId);
  if (!existing) { sendError(res, "Job not found", 404, "NOT_FOUND"); return; }
  if (existing.status === "CLOSED") {
    sendError(res, "Cannot edit a CLOSED job", 400, "INVALID_STATUS");
    return;
  }

  const job = await prisma.job.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  sendSuccess(res, { job });
}

// ─── DELETE /api/jobs/:id — delete a DRAFT job ────────────

export async function deleteJob(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile found", 404, "NO_COMPANY"); return; }

  const existing = await getJobForCompany(req.params.id as string, companyId);
  if (!existing) { sendError(res, "Job not found", 404, "NOT_FOUND"); return; }
  if (existing.status !== "DRAFT") {
    sendError(res, "Only DRAFT jobs can be deleted", 400, "INVALID_STATUS");
    return;
  }

  await prisma.job.delete({ where: { id: existing.id } });
  sendSuccess(res, { id: existing.id });
}

// ─── POST /api/jobs/:id/publish — publish job (DRAFT→OPEN) ─

export async function publishJob(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile found", 404, "NO_COMPANY"); return; }

  const existing = await getJobForCompany(req.params.id as string, companyId);
  if (!existing) { sendError(res, "Job not found", 404, "NOT_FOUND"); return; }
  if (existing.status !== "DRAFT") {
    sendError(res, "Job is already published or closed", 400, "INVALID_STATUS");
    return;
  }

  // For PUBLIC jobs: auto-create APPROVED board entries for all existing institutions
  const job = await prisma.$transaction(async (tx) => {
    const updated = await tx.job.update({
      where: { id: existing.id },
      data: { status: "OPEN" },
    });

    if (updated.visibility === "PUBLIC") {
      const institutions = await tx.institution.findMany({ select: { id: true } });
      if (institutions.length > 0) {
        await tx.jobBoardEntry.createMany({
          data: institutions.map((inst: { id: string }) => ({
            jobId: updated.id,
            institutionId: inst.id,
            status: "APPROVED",
            initiator: "COMPANY",
          })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  });

  sendSuccess(res, { job });
}

// ─── POST /api/jobs/:id/close — close an open job ─────────

export async function closeJob(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile found", 404, "NO_COMPANY"); return; }

  const existing = await getJobForCompany(req.params.id as string, companyId);
  if (!existing) { sendError(res, "Job not found", 404, "NOT_FOUND"); return; }
  if (existing.status !== "OPEN") {
    sendError(res, "Only OPEN jobs can be closed", 400, "INVALID_STATUS");
    return;
  }

  const job = await prisma.job.update({
    where: { id: existing.id },
    data: { status: "CLOSED" },
  });

  sendSuccess(res, { job });
}

// ─── GET /api/jobs/board — board view (STUDENT / INSTITUTION) ──

export async function listBoardJobs(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true, institutionId: true },
    });

    if (!student?.institutionId) {
      // No institution — show only PUBLIC open jobs
      const jobs = await prisma.job.findMany({
        where: { status: "OPEN", visibility: "PUBLIC" },
        include: JOB_COMPANY_SELECT,
        orderBy: { createdAt: "desc" },
      });
      sendSuccess(res, { jobs });
      return;
    }

    // Institution-bound: show approved board entries for their institution
    const entries = await prisma.jobBoardEntry.findMany({
      where: { institutionId: student.institutionId, status: "APPROVED" },
      include: { job: { include: JOB_COMPANY_SELECT } },
      orderBy: { createdAt: "desc" },
    });

    // Filter to only OPEN jobs (don't filter inside include — do it in JS)
    const jobs = entries
      .map((e) => e.job)
      .filter((j) => j.status === "OPEN");

    sendSuccess(res, { jobs });
    return;
  }

  if (role === "INSTITUTION") {
    const member = await prisma.institutionMember.findUnique({
      where: { userId },
      select: { institutionId: true },
    });
    if (!member) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

    const entries = await prisma.jobBoardEntry.findMany({
      where: { institutionId: member.institutionId },
      include: { job: { include: JOB_COMPANY_SELECT } },
      orderBy: { updatedAt: "desc" },
    });

    sendSuccess(res, { entries });
    return;
  }

  sendError(res, "Forbidden", 403, "FORBIDDEN");
}
