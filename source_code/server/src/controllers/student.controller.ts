import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { UpdateStudentInput, CreateClaimInput, UpdateClaimInput } from "../types";
import { decryptToken } from "../utils/github-token-crypto";
import { env } from "../config/environment";

// ----- STUDENT ROLE ENDPOINTS -----

export async function updateMyProfile(
    req: Request<{}, {}, UpdateStudentInput>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { linkedinUrl, resumeUrl, consentGiven } = req.body;

        const student = await prisma.student.update({
            where: { userId },
            data: {
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

export async function disconnectGithub(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;

        const student = await prisma.student.update({
            where: { userId },
            data: {
                githubUsername: null,
            },
        });

        sendSuccess(res, { message: "GitHub account disconnected successfully.", student });
    } catch (error) {
        next(error);
    }
}

export async function verifyRepo(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;
        const { url } = req.query;

        if (!url || typeof url !== "string") {
            sendError(res, "Missing 'url' query parameter", 400, "MISSING_PARAM");
            return;
        }

        // Parse owner/repo from the GitHub URL
        const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
        if (!match) {
            sendError(res, "Invalid GitHub repository URL", 400, "INVALID_URL");
            return;
        }
        const [, owner, repo] = match;

        // Get the student's linked GitHub username and stored access token
        const student = await prisma.student.findUnique({ where: { userId } });

        if (!student?.githubUsername) {
            sendError(res, "No GitHub account linked. Please connect GitHub first.", 400, "NO_GITHUB");
            return;
        }

        const githubUsername = student.githubUsername;
        const authHeaders: HeadersInit = {
            "User-Agent": "ARBC-Server",
            Accept: "application/vnd.github+json",
        };
        if (student.githubAccessToken) {
            try {
                const rawToken = env.GITHUB_TOKEN_ENCRYPTION_KEY
                    ? decryptToken(student.githubAccessToken)
                    : student.githubAccessToken; // plaintext in dev
                authHeaders["Authorization"] = `token ${rawToken}`;
            } catch {
                console.warn("Could not decrypt GitHub token for verifyRepo — skipping Authorization header.");
            }
        }

        // Check 1: Is the student the owner of the repo?
        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: authHeaders,
        });

        if (repoResponse.status === 404) {
            sendError(res, "Repository not found or is private", 404, "REPO_NOT_FOUND");
            return;
        }

        if (repoResponse.ok) {
            const repoData = await repoResponse.json();
            if (repoData.owner?.login?.toLowerCase() === githubUsername.toLowerCase()) {
                sendSuccess(res, { verified: true, reason: "owner" });
                return;
            }
        }

        // Check 2: Is the student a contributor?
        const contributorsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`,
            { headers: authHeaders }
        );

        if (contributorsResponse.ok) {
            const contributors: Array<{ login: string }> = await contributorsResponse.json();
            const isContributor = contributors.some(
                (c) => c.login?.toLowerCase() === githubUsername.toLowerCase()
            );
            if (isContributor) {
                sendSuccess(res, { verified: true, reason: "contributor" });
                return;
            }
        }

        // Not an owner or contributor
        sendSuccess(res, { verified: false, reason: "not_linked" });
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

        const { type, title, company, repoUrl, description, skills, startDate, endDate } = req.body;

        const claim = await prisma.resumeClaim.create({
            data: {
                studentId: student.id,
                type,
                title,
                company,
                repoUrl,
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

export async function updateClaim(
    req: Request<{ id: string }, {}, UpdateClaimInput>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;
        const claimId = req.params.id;

        const student = await prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            sendError(res, "Student profile not found", 404, "NOT_FOUND");
            return;
        }

        const existingClaim = await prisma.resumeClaim.findFirst({
            where: { id: claimId, studentId: student.id }
        });

        if (!existingClaim) {
            sendError(res, "Claim not found", 404, "NOT_FOUND");
            return;
        }

        const { type, title, company, repoUrl, description, skills, startDate, endDate } = req.body;

        const updatedClaim = await prisma.resumeClaim.update({
            where: { id: claimId },
            data: {
                ...(type !== undefined && { type }),
                ...(title !== undefined && { title }),
                ...(company !== undefined && { company }),
                ...(repoUrl !== undefined && { repoUrl }),
                ...(description !== undefined && { description }),
                ...(skills !== undefined && { skills }),
                ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
                ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
            },
        });

        sendSuccess(res, { claim: updatedClaim });
    } catch (error) {
        next(error);
    }
}

export async function deleteClaim(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user!.userId;
        const claimId = req.params.id;

        const student = await prisma.student.findUnique({
            where: { userId },
        });

        if (!student) {
            sendError(res, "Student profile not found", 404, "NOT_FOUND");
            return;
        }

        const existingClaim = await prisma.resumeClaim.findFirst({
            where: { id: claimId, studentId: student.id }
        });

        if (!existingClaim) {
            sendError(res, "Claim not found", 404, "NOT_FOUND");
            return;
        }

        await prisma.resumeClaim.delete({
            where: { id: claimId }
        });

        sendSuccess(res, { message: "Claim deleted successfully" });
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
            select: {
                id: true,
                userId: true,
                githubUsername: true,
                linkedinUrl: true,
                resumeUrl: true,
                consentGiven: true,
                consentDate: true,
                createdAt: true,
                updatedAt: true,
                institutionId: true,
                institution: {
                    select: { id: true, name: true, domain: true },
                },
                claims: true,
                verificationRequests: {
                    include: {
                        result: true,
                    }
                }
                // githubAccessToken intentionally omitted from API response
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
            select: {
                id: true,
                userId: true,
                githubUsername: true,
                linkedinUrl: true,
                resumeUrl: true,
                consentGiven: true,
                consentDate: true,
                createdAt: true,
                updatedAt: true,
                // githubAccessToken intentionally omitted
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
            select: {
                id: true,
                userId: true,
                githubUsername: true,
                linkedinUrl: true,
                resumeUrl: true,
                consentGiven: true,
                consentDate: true,
                createdAt: true,
                updatedAt: true,
                // githubAccessToken intentionally omitted
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

// POST /api/student/me/join — bind student to an institution via invite code
export async function joinInstitution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { code } = req.body as { code?: string };
        if (!code || typeof code !== "string") {
            sendError(res, "Invite code is required", 400, "VALIDATION_ERROR");
            return;
        }

        const userId = req.user!.userId;

        const student = await prisma.student.findUnique({ where: { userId } });
        if (!student) {
            sendError(res, "Student profile not found", 404, "NOT_FOUND");
            return;
        }

        if (student.institutionId) {
            sendError(res, "Already joined an institution", 409, "ALREADY_MEMBER");
            return;
        }

        // Atomic: find unused, non-expired code and mark it — prevents race conditions
        const updated = await prisma.$transaction(async (tx) => {
            const invite = await tx.inviteCode.findUnique({
                where: { code },
            });

            if (!invite) throw Object.assign(new Error("Invalid invite code"), { status: 404, code: "INVALID_CODE" });
            if (invite.usedById) throw Object.assign(new Error("Invite code already used"), { status: 409, code: "CODE_USED" });
            if (invite.expiresAt && invite.expiresAt < new Date()) {
                throw Object.assign(new Error("Invite code has expired"), { status: 410, code: "CODE_EXPIRED" });
            }

            // Mark code as used + bind student to institution atomically
            await tx.inviteCode.update({
                where: { id: invite.id },
                data: { usedById: student.id },
            });

            return tx.student.update({
                where: { id: student.id },
                data: { institutionId: invite.institutionId, inviteCodeId: invite.id },
            });
        });

        sendSuccess(res, { institutionId: updated.institutionId });
    } catch (error: any) {
        if (error?.status) {
            sendError(res, error.message, error.status, error.code);
            return;
        }
        next(error);
    }
}
