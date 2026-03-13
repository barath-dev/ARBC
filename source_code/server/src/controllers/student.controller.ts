import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { sendSuccess, sendError } from "../utils/api-response";
import { UpdateStudentInput, CreateClaimInput, UpdateClaimInput } from "../types";

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
            authHeaders["Authorization"] = `token ${student.githubAccessToken}`;
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
