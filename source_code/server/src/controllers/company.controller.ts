import { Request, Response } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { z } from "zod/v4";

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
});

// POST /api/companies — create company + join as member (atomic)
export async function createCompany(req: Request, res: Response): Promise<void> {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const userId = req.user!.userId;

  const existing = await prisma.companyMember.findUnique({ where: { userId } });
  if (existing) {
    sendError(res, "User is already a member of a company", 409, "ALREADY_MEMBER");
    return;
  }

  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({ data: parsed.data });
    await tx.companyMember.create({ data: { userId, companyId: c.id } });
    return c;
  });

  sendSuccess(res, { company }, 201);
}

// GET /api/companies/me — get own company profile
export async function getMyCompany(req: Request, res: Response): Promise<void> {
  const member = await prisma.companyMember.findUnique({
    where: { userId: req.user!.userId },
    include: { company: true },
  });

  if (!member) {
    sendError(res, "Not a member of any company", 404, "NOT_FOUND");
    return;
  }

  sendSuccess(res, { company: member.company });
}

// PUT /api/companies/me — update company profile
export async function updateMyCompany(req: Request, res: Response): Promise<void> {
  const parsed = createCompanySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    sendError(res, "Validation failed", 400, "VALIDATION_ERROR", parsed.error.issues);
    return;
  }

  const member = await prisma.companyMember.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!member) {
    sendError(res, "Not a member of any company", 403, "FORBIDDEN");
    return;
  }

  const company = await prisma.company.update({
    where: { id: member.companyId },
    data: parsed.data,
  });

  sendSuccess(res, { company });
}

// Helper — used in job controller to resolve companyId from request
export async function resolveCompanyId(userId: string): Promise<string | null> {
  const member = await prisma.companyMember.findUnique({ where: { userId } });
  return member?.companyId ?? null;
}
