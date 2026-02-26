import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { UpdateStudentInput, CreateClaimInput } from "../types";

// ----- STUDENT ROLE ENDPOINTS -----

export async function updateMyProfile(
    req: Request<{}, {}, UpdateStudentInput>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { githubUsername, linkedinUrl, resumeUrl, consentGiven } = req.body;

        const student = await prisma.student.update({
            where: { userId },
            data: {
                githubUsername,
                linkedinUrl,
                resumeUrl,
                consentGiven,
                consentDate: consentGiven ? new Date() : null,
            },
        });

        sendSuccess(res, { student });
    } catch (error) {
        next(error);
    }
}

export async function addClaim(
    req: Request<{}, {}, CreateClaimInput>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;

        const student = await prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            sendError(res, "Student profile not found", 404, "NOT_FOUND");
            return;
        }

        const { type, title, company, description, skills, startDate, endDate } = req.body;

        const claim = await prisma.resumeClaim.create({
            data: {
                studentId: student.id,
                type,
                title,
                company,
                description,
                skills,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
            },
        });

        sendSuccess(res, { claim }, 201);
    } catch (error) {
        next(error);
    }
}

export async function getMyProfile(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;

        const student = await prisma.student.findUnique({
            where: { userId },
            include: {
                claims: true,
                verificationRequests: {
                    include: {
                        result: true,
                    }
                }
            },
        });

        if (!student) {
            sendError(res, "Student profile not found", 404, "NOT_FOUND");
            return;
        }

        sendSuccess(res, { student });
    } catch (error) {
        next(error);
    }
}

// ----- RECRUITER ROLE ENDPOINTS -----

export async function listStudents(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const students = await prisma.student.findMany({
            include: {
                user: {
                    select: { name: true, email: true }
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        sendSuccess(res, { students });
    } catch (error) {
        next(error);
    }
}

export async function getStudentById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { id } = req.params;

        const student = await prisma.student.findUnique({
            where: { id },
            include: {
                user: { select: { name: true, email: true } },
                claims: true,
                verificationRequests: {
                    include: { result: true },
                    orderBy: { createdAt: 'desc' }
                },
            },
        });

        if (!student) {
            sendError(res, "Student not found", 404, "NOT_FOUND");
            return;
        }

        sendSuccess(res, { student });
    } catch (error) {
        next(error);
    }
}
