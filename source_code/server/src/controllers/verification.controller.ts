import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { verificationOrchestrator } from "../services/verification-orchestrator";

export async function triggerVerification(
    req: Request<{ studentId: string }>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { studentId } = req.params;
        const recruiterId = req.user!.userId; // Assumes requireRole("RECRUITER") middleware

        // Check if student exists
        const student = await prisma.student.findUnique({ where: { id: studentId } });
        if (!student) {
            sendError(res, "Student not found", 404, "NOT_FOUND");
            return;
        }

        // Run the pipeline (Async in background or await depending on design. We await for MVP)
        const verificationRequest = await verificationOrchestrator.runVerification(studentId, recruiterId);

        sendSuccess(res, { verificationRequest }, 201);
    } catch (error) {
        next(error);
    }
}

export async function getVerificationResult(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { id } = req.params;

        const request = await prisma.verificationRequest.findUnique({
            where: { id },
            include: {
                result: {
                    include: {
                        inconsistencyFlags: true,
                        skillVerifications: true,
                    }
                },
                githubAnalysis: true,
                companyVerification: true,
                documentAnalyses: true,
            }
        });

        if (!request) {
            sendError(res, "Verification request not found", 404, "NOT_FOUND");
            return;
        }

        sendSuccess(res, { request });
    } catch (error) {
        next(error);
    }
}
