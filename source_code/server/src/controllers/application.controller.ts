import { Request, Response } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { z } from "zod/v4";
import { resolveCompanyId } from "./company.controller";
import { notify, notifyWithEmail, NotificationType } from "../services/notification.service";
import { scheduleVerification } from "../services/job-queue.service";

// ─── Validation Schemas ───────────────────────────────────

const applySchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
  claimIds: z.array(z.string()).min(0).default([]), // disclosed claim IDs
  coverNote: z.string().max(2000).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "OFFERED", "WITHDRAWN"]),
});

// ═══════════════════════════════════════════════════════════
// ─── STUDENT ENDPOINTS ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// POST /api/applications — student applies to a job
export async function applyToJob(req: Request, res: Response): Promise<void> {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const userId = req.user!.userId;
  const { jobId, claimIds, coverNote } = parsed.data;

  // Resolve student profile
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    sendError(res, "Student profile not found", 404, "NOT_FOUND");
    return;
  }

  // Job must be OPEN
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!job || job.status !== "OPEN") {
    sendError(res, "Job not found or no longer accepting applications", 404, "NOT_FOUND");
    return;
  }

  // Validate that disclosed claims belong to this student
  if (claimIds.length > 0) {
    const ownedClaims = await prisma.resumeClaim.findMany({
      where: { id: { in: claimIds }, studentId: student.id },
      select: { id: true },
    });
    if (ownedClaims.length !== claimIds.length) {
      sendError(res, "One or more claim IDs are invalid or do not belong to you", 400, "INVALID_CLAIMS");
      return;
    }
  }

  // Create application + disclosed claims atomically
  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        studentId: student.id,
        jobId,
        coverNote,
        status: "APPLIED",
        // Create ApplicationClaim join records
        disclosedClaims: claimIds.length > 0
          ? { create: claimIds.map((claimId) => ({ claimId })) }
          : undefined,
      },
      include: {
        disclosedClaims: { include: { claim: { select: { id: true, type: true, title: true } } } },
      },
    });
    return app;
  });

  // Notify recruiter (first company member) - best effort, non-blocking
  const recruiter = await prisma.companyMember.findFirst({
    where: { companyId: job.companyId },
    select: { userId: true },
  });
  if (recruiter) {
    void notify(
      recruiter.userId,
      NotificationType.APPLICATION_RECEIVED,
      "New application received",
      `A student has applied to "${job.title}".`,
      { applicationId: application.id, jobId }
    );
  }

  sendSuccess(res, { application }, 201);
}

// GET /api/applications/mine — student's own applications
export async function listMyApplications(req: Request, res: Response): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { userId: req.user!.userId },
    select: { id: true },
  });
  if (!student) {
    sendError(res, "Student profile not found", 404, "NOT_FOUND");
    return;
  }

  const applications = await prisma.application.findMany({
    where: { studentId: student.id },
    include: {
      job: { include: { company: { select: { id: true, name: true, logoUrl: true } } } },
      disclosedClaims: {
        include: { claim: { select: { id: true, type: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, { applications });
}

// DELETE /api/applications/:id — student withdraws application
export async function withdrawApplication(req: Request, res: Response): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { userId: req.user!.userId },
    select: { id: true },
  });
  if (!student) { sendError(res, "Student profile not found", 404, "NOT_FOUND"); return; }

  const app = await prisma.application.findFirst({
    where: { id: req.params.id as string, studentId: student.id },
  });
  if (!app) { sendError(res, "Application not found", 404, "NOT_FOUND"); return; }
  if (!["APPLIED", "UNDER_REVIEW"].includes(app.status)) {
    sendError(res, "Cannot withdraw at this stage", 400, "INVALID_STATUS");
    return;
  }

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: { status: "WITHDRAWN" },
  });

  sendSuccess(res, { application: updated });
}

// ═══════════════════════════════════════════════════════════
// ─── RECRUITER ENDPOINTS ──────────────────────────────────
// ═══════════════════════════════════════════════════════════

// GET /api/applications/job/:jobId — recruiter lists all applications for their job
export async function listJobApplications(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile", 404, "NO_COMPANY"); return; }

  const jobId = req.params.jobId as string;

  // Verify job belongs to this company
  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) { sendError(res, "Job not found", 404, "NOT_FOUND"); return; }

  const applications = await prisma.application.findMany({
    where: { jobId },
    include: {
      student: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      disclosedClaims: {
        include: { claim: { select: { id: true, type: true, title: true, skills: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, { applications });
}

// GET /api/applications/:id — recruiter views a single application (triggers lazy ARBC on first view)
export async function viewApplication(req: Request, res: Response): Promise<void> {
  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile", 404, "NO_COMPANY"); return; }

  const appId = req.params.id as string;

  // Fetch the application (verifying the job belongs to this company)
  const app = await prisma.application.findFirst({
    where: { id: appId, job: { companyId } },
    include: {
      student: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          claims: true, // full claims for context
        },
      },
      job: { select: { id: true, title: true, companyId: true } },
      disclosedClaims: {
        include: {
          claim: true, // full claim details on recruiter view
        },
      },
    },
  });

  if (!app) { sendError(res, "Application not found", 404, "NOT_FOUND"); return; }

  // ─── Lazy ARBC Trigger ─────────────────────────────────
  // On first recruiter view, check if ARBC has already been triggered for this application.
  // If not, schedule it. This scopes verification to ONLY the disclosed claims.
  const existingVerification = await prisma.verificationRequest.findFirst({
    where: { applicationId: appId },
  });

  if (!existingVerification) {
    // Create the scoped VerificationRequest immediately so we don't double-schedule
    await prisma.verificationRequest.create({
      data: {
        studentId: app.student.id,
        createdById: req.user!.userId,
        applicationId: appId,
        status: "PENDING",
      },
    });

    // Schedule background job to run scoped ARBC
    await scheduleVerification(appId);

    // Move application to UNDER_REVIEW automatically
    if (app.status === "APPLIED") {
      await prisma.application.update({
        where: { id: appId },
        data: { status: "UNDER_REVIEW" },
      });

      // Notify student their application is being reviewed
      void notifyWithEmail(
        app.student.userId,
        NotificationType.STATUS_CHANGED,
        "Your application is under review",
        `Your application for "${app.job.title}" is now under review.`,
        { applicationId: appId, status: "UNDER_REVIEW" }
      );
    }
  }

  sendSuccess(res, { application: app });
}

// PATCH /api/applications/:id/status — recruiter updates application status
export async function updateApplicationStatus(req: Request, res: Response): Promise<void> {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const companyId = await resolveCompanyId(req.user!.userId);
  if (!companyId) { sendError(res, "No company profile", 404, "NO_COMPANY"); return; }

  const appId = req.params.id as string;
  const { status } = parsed.data;

  const app = await prisma.application.findFirst({
    where: { id: appId, job: { companyId } },
    include: {
      student: { select: { id: true, userId: true } },
      job: { select: { title: true } },
    },
  });
  if (!app) { sendError(res, "Application not found", 404, "NOT_FOUND"); return; }

  // Prevent updating withdrawn applications
  if (app.status === "WITHDRAWN") {
    sendError(res, "Cannot update a withdrawn application", 400, "INVALID_STATUS");
    return;
  }

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: { status },
  });

  // Notify student of status change
  void notifyWithEmail(
    app.student.userId,
    NotificationType.STATUS_CHANGED,
    "Application status updated",
    `Your application for "${app.job.title}" is now ${status.replace("_", " ").toLowerCase()}.`,
    { applicationId: app.id, status }
  );

  sendSuccess(res, { application: updated });
}
