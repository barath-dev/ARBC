import { Request, Response } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { notify, NotificationType } from "../services/notification.service";
import { resolveCompanyId } from "./company.controller";

// ─── Helper ───────────────────────────────────────────────

async function resolveInstitutionId(userId: string): Promise<string | null> {
  const member = await prisma.institutionMember.findUnique({
    where: { userId },
    select: { institutionId: true },
  });
  return member?.institutionId ?? null;
}

const JOB_WITH_COMPANY = {
  include: { job: { include: { company: { select: { id: true, name: true } } } } },
} as const;

// ═══════════════════════════════════════════════════════════
// ─── INSTITUTION ACTIONS ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

// GET /api/board/requests — pending company pushes waiting for institution approval
export async function listPendingRequests(req: Request, res: Response): Promise<void> {
  const institutionId = await resolveInstitutionId(req.user!.userId);
  if (!institutionId) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

  const entries = await prisma.jobBoardEntry.findMany({
    where: { institutionId, status: "PENDING_INSTITUTION", initiator: "COMPANY" },
    ...JOB_WITH_COMPANY,
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, { entries });
}

// POST /api/board/pull/:jobId — institution self-pulls a PUBLIC job onto their board
export async function pullJobToBoard(req: Request, res: Response): Promise<void> {
  const institutionId = await resolveInstitutionId(req.user!.userId);
  if (!institutionId) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

  const jobId = req.params.jobId as string;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "OPEN") {
    sendError(res, "Job not found or not open", 404, "NOT_FOUND");
    return;
  }
  if (job.visibility !== "PUBLIC") {
    sendError(res, "Only PUBLIC jobs can be self-pulled.", 400, "INVALID_VISIBILITY");
    return;
  }

  const entry = await prisma.jobBoardEntry.upsert({
    where: { jobId_institutionId: { jobId, institutionId } },
    update: { status: "APPROVED", initiator: "INSTITUTION" },
    create: { jobId, institutionId, status: "APPROVED", initiator: "INSTITUTION" },
  });

  sendSuccess(res, { entry }, 201);
}

// PATCH /api/board/entries/:entryId/approve — approve a company-pushed job
export async function approveEntry(req: Request, res: Response): Promise<void> {
  const institutionId = await resolveInstitutionId(req.user!.userId);
  if (!institutionId) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

  const entryId = req.params.entryId as string;

  const entry = await prisma.jobBoardEntry.findFirst({
    where: { id: entryId, institutionId, status: "PENDING_INSTITUTION" },
    include: {
      job: {
        select: { id: true, title: true, companyId: true },
      },
    },
  });
  if (!entry) { sendError(res, "Pending entry not found", 404, "NOT_FOUND"); return; }

  const updated = await prisma.jobBoardEntry.update({
    where: { id: entry.id },
    data: { status: "APPROVED" },
  });

  const companyUser = await prisma.companyMember.findFirst({
    where: { companyId: entry.job.companyId },
    select: { userId: true },
  });
  if (companyUser) {
    void notify(
      companyUser.userId,
      NotificationType.BOARD_APPROVED,
      "Job listing approved",
      `Your job "${entry.job.title}" was approved by the institution.`,
      { jobId: entry.job.id, entryId: entry.id }
    );
  }

  sendSuccess(res, { entry: updated });
}

// PATCH /api/board/entries/:entryId/reject — reject a company-pushed job
export async function rejectEntry(req: Request, res: Response): Promise<void> {
  const institutionId = await resolveInstitutionId(req.user!.userId);
  if (!institutionId) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

  const entryId = req.params.entryId as string;

  const entry = await prisma.jobBoardEntry.findFirst({
    where: { id: entryId, institutionId, status: "PENDING_INSTITUTION" },
    include: {
      job: {
        select: { id: true, title: true, companyId: true },
      },
    },
  });
  if (!entry) { sendError(res, "Pending entry not found", 404, "NOT_FOUND"); return; }

  const updated = await prisma.jobBoardEntry.update({
    where: { id: entry.id },
    data: { status: "REJECTED" },
  });

  const companyUser = await prisma.companyMember.findFirst({
    where: { companyId: entry.job.companyId },
    select: { userId: true },
  });
  if (companyUser) {
    void notify(
      companyUser.userId,
      NotificationType.BOARD_REJECTED,
      "Job listing rejected",
      `Your job "${entry.job.title}" was rejected by the institution.`,
      { jobId: entry.job.id, entryId: entry.id }
    );
  }

  sendSuccess(res, { entry: updated });
}

// DELETE /api/board/entries/:entryId — institution removes a job from their board
export async function removeEntry(req: Request, res: Response): Promise<void> {
  const institutionId = await resolveInstitutionId(req.user!.userId);
  if (!institutionId) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

  const entryId = req.params.entryId as string;

  const entry = await prisma.jobBoardEntry.findFirst({
    where: { id: entryId, institutionId },
  });
  if (!entry) { sendError(res, "Board entry not found", 404, "NOT_FOUND"); return; }
  if (entry.status === "PENDING_INSTITUTION") {
    sendError(res, "Use reject instead of remove for pending entries", 400, "USE_REJECT");
    return;
  }

  await prisma.jobBoardEntry.delete({ where: { id: entry.id } });
  sendSuccess(res, { id: entry.id });
}

// ═══════════════════════════════════════════════════════════
// ─── COMPANY ACTIONS ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// POST /api/board/push/:jobId/:institutionId — company pushes to institution (requires approval)
export async function pushJobToInstitution(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile found", 404, "NO_COMPANY"); return; }

  const jobId = req.params.jobId as string;
  const institutionId = req.params.institutionId as string;

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job || job.status !== "OPEN") {
    sendError(res, "Job not found or not open", 404, "NOT_FOUND");
    return;
  }

  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) { sendError(res, "Institution not found", 404, "NOT_FOUND"); return; }

  // Prevent duplicate pushes
  const existing = await prisma.jobBoardEntry.findUnique({
    where: { jobId_institutionId: { jobId, institutionId } },
  });
  if (existing && existing.status !== "WITHDRAWN" && existing.status !== "REJECTED") {
    sendError(res, "A board entry already exists for this job and institution", 409, "DUPLICATE_ENTRY");
    return;
  }

  const entry = await prisma.jobBoardEntry.upsert({
    where: { jobId_institutionId: { jobId, institutionId } },
    update: { status: "PENDING_INSTITUTION", initiator: "COMPANY" },
    create: { jobId, institutionId, status: "PENDING_INSTITUTION", initiator: "COMPANY" },
  });

  // Notify institution TPO
  const tpo = await prisma.institutionMember.findFirst({
    where: { institutionId },
    select: { userId: true },
  });
  if (tpo) {
    void notify(
      tpo.userId,
      NotificationType.BOARD_REQUEST,
      "New job listing request",
      `"${job.title}" has been pushed to your board for approval.`,
      { jobId: job.id, entryId: entry.id }
    );
  }

  sendSuccess(res, { entry }, 201);
}

// GET /api/board/institutions — company: list all institutions to push to
export async function listInstitutions(req: Request, res: Response): Promise<void> {
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true, domain: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  sendSuccess(res, { institutions });
}

// GET /api/board/entries/job/:jobId — company: get board entries for a specific job
export async function getJobBoardEntries(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile found", 404, "NO_COMPANY"); return; }

  const jobId = req.params.jobId as string;
  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) { sendError(res, "Job not found", 404, "NOT_FOUND"); return; }

  const entries = await prisma.jobBoardEntry.findMany({
    where: { jobId },
    select: {
      id: true,
      institutionId: true,
      status: true,
      initiator: true,
      createdAt: true,
      institution: { select: { id: true, name: true, domain: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, { entries });
}
