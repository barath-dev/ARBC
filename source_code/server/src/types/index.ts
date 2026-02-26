import { z } from "zod/v4";

// ─── Auth Schemas ────────────────────────────────────────

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["RECRUITER", "STUDENT"]),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

// ─── Student Schemas ─────────────────────────────────────

export const createStudentSchema = z.object({
  githubUsername: z.string().optional(),
  linkedinUrl: z.url().optional(),
  resumeUrl: z.url().optional(),
  consentGiven: z.boolean().default(false),
});

export const updateStudentSchema = createStudentSchema.partial();

// ─── Resume Claim Schemas ────────────────────────────────

export const createClaimSchema = z.object({
  type: z.enum(["INTERNSHIP", "PROJECT", "SKILL", "CERTIFICATE", "EDUCATION"]),
  title: z.string().min(1, "Title is required"),
  company: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).default([]),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
});

// ─── Verification Schemas ────────────────────────────────

export const createVerificationSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
});

// ─── Query Schemas ───────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Inferred Types ──────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type CreateVerificationInput = z.infer<typeof createVerificationSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── JWT Payload ─────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  role: "RECRUITER" | "STUDENT";
}

// ─── Express Request Extension ───────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
