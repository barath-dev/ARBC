import { Request, Response } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { z } from "zod/v4";
import crypto from "crypto";

const createInstitutionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

const generateCodesSchema = z.object({
  count: z.coerce.number().int().min(1).max(50).default(1),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

// POST /api/institutions — register a new institution + make caller the admin
export async function registerInstitution(req: Request, res: Response): Promise<void> {
  const parsed = createInstitutionSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const userId = req.user!.userId;

  // Prevent a user from creating multiple institutions
  const existing = await prisma.institutionMember.findUnique({ where: { userId } });
  if (existing) {
    sendError(res, "User is already a member of an institution", 409, "ALREADY_MEMBER");
    return;
  }

  const institution = await prisma.$transaction(async (tx) => {
    const inst = await tx.institution.create({ data: parsed.data });
    await tx.institutionMember.create({ data: { userId, institutionId: inst.id } });
    return inst;
  });

  sendSuccess(res, { institution }, 201);
}

// GET /api/institutions/me — get your own institution profile
export async function getMyInstitution(req: Request, res: Response): Promise<void> {
  const member = await prisma.institutionMember.findUnique({
    where: { userId: req.user!.userId },
    include: { institution: true },
  });

  if (!member) {
    sendError(res, "Not a member of any institution", 404, "NOT_FOUND");
    return;
  }

  sendSuccess(res, { institution: member.institution });
}

// PUT /api/institutions/me — update institution profile
export async function updateMyInstitution(req: Request, res: Response): Promise<void> {
  const parsed = createInstitutionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const member = await prisma.institutionMember.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!member) {
    sendError(res, "Not a member of any institution", 403, "FORBIDDEN");
    return;
  }

  const institution = await prisma.institution.update({
    where: { id: member.institutionId },
    data: parsed.data,
  });

  sendSuccess(res, { institution });
}

// POST /api/institutions/me/invite-codes — generate N invite codes
export async function generateInviteCodes(req: Request, res: Response): Promise<void> {
  const parsed = generateCodesSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const member = await prisma.institutionMember.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!member) {
    sendError(res, "Not a member of any institution", 403, "FORBIDDEN");
    return;
  }

  const { count, expiresInDays } = parsed.data;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000)
    : undefined;

  // All codes in one request share the same batchId for grouping/renaming
  const batchId = crypto.randomUUID();

  const codes = await prisma.$transaction(
    Array.from({ length: count }, () =>
      prisma.inviteCode.create({
        data: {
          code: crypto.randomBytes(8).toString("hex"),
          institutionId: member.institutionId,
          batchId,
          expiresAt,
        },
      })
    )
  );

  sendSuccess(res, { codes, batchId }, 201);
}

// GET /api/institutions/me/invite-codes — list all codes with usage status
export async function listInviteCodes(req: Request, res: Response): Promise<void> {
  const member = await prisma.institutionMember.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!member) {
    sendError(res, "Not a member of any institution", 403, "FORBIDDEN");
    return;
  }

  const codes = await prisma.inviteCode.findMany({
    where: { institutionId: member.institutionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      batchId: true,
      batchName: true,
      expiresAt: true,
      createdAt: true,
      usedById: true,
    },
  });

  sendSuccess(res, { codes });
}

// PATCH /api/institutions/me/invite-codes/batch/:batchId — rename a batch
export async function renameBatch(req: Request, res: Response): Promise<void> {
  const batchId = req.params.batchId as string;
  const { name } = req.body as { name?: string };

  if (typeof name !== "string" || !name.trim()) {
    sendError(res, "name is required", 400, "VALIDATION_ERROR");
    return;
  }

  const member = await prisma.institutionMember.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!member) {
    sendError(res, "Not a member of any institution", 403, "FORBIDDEN");
    return;
  }

  // Verify the batch belongs to this institution
  const sample = await prisma.inviteCode.findFirst({
    where: { batchId, institutionId: member.institutionId },
  });
  if (!sample) {
    sendError(res, "Batch not found", 404, "NOT_FOUND");
    return;
  }

  await prisma.inviteCode.updateMany({
    where: { batchId, institutionId: member.institutionId },
    data: { batchName: name.trim() },
  });

  sendSuccess(res, { batchId, batchName: name.trim() });
}

// GET /api/institutions/me/students — view student cohort
export async function listStudents(req: Request, res: Response): Promise<void> {
  const member = await prisma.institutionMember.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!member) {
    sendError(res, "Not a member of any institution", 403, "FORBIDDEN");
    return;
  }

  const students = await prisma.student.findMany({
    where: { institutionId: member.institutionId },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, { students });
}
