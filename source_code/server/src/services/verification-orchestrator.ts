import { prisma } from "../config/database";
import { logger } from "../utils/logger";
import { githubAnalyzer } from "./github-analyzer";
import { companyVerifier } from "./company-verification";
import { documentAnalyzer } from "./document-analyzer";
import { temporalConsistency } from "./temporal-consistency";
import { skillsCrossValidator } from "./skills-cross-validator";
import { fraudScorer } from "./fraud-scoring";
import { decryptToken } from "../utils/github-token-crypto";
import { env } from "../config/environment";

export class VerificationOrchestratorService {
    /**
     * Main entry point to orchestrate the 5-layer ARBC pipeline.
     */
    public async runVerification(studentId: string, requestedById: string): Promise<any> {
        logger.info(`Starting verification pipeline for student: ${studentId}`);

        // 1. Initialize Request
        const request = await prisma.verificationRequest.create({
            data: {
                studentId,
                createdById: requestedById,
                status: "PENDING",
            }
        });

        try {
            const student = await prisma.student.findUnique({
                where: { id: studentId },
                include: { claims: true },
            });

            if (!student) throw new Error("Student not found");

            // Decrypt the stored GitHub OAuth token so the analyzer can use it
            // to access private repositories. Falls back to undefined if not set.
            let decryptedGithubToken: string | undefined;
            if (student.githubAccessToken) {
                try {
                    decryptedGithubToken = env.GH_TOKEN_ENCRYPTION_KEY
                        ? decryptToken(student.githubAccessToken)
                        : student.githubAccessToken; // plaintext in dev (no key set)
                } catch (err) {
                    logger.warn(`Could not decrypt GitHub token for student ${studentId}. Falling back to public-only analysis.`);
                }
            }

            // 2. LAYER 2: Data Collection (Parallel Execution)
            // Collect any GitHub project repo URLs the student has claimed
            const claimedRepoUrls = student.claims
                .filter((c) => c.type === "PROJECT" || c.type === "INTERNSHIP")
                .map((c) => (c as any).repoUrl as string | null)
                .filter((url): url is string => !!url);

            const [githubResult, docResult] = await Promise.all([
                student.githubUsername ? githubAnalyzer.analyzeProfile(student.githubUsername, claimedRepoUrls, decryptedGithubToken).catch(e => {
                    logger.warn(`GitHub analysis failed: ${e.message}`);
                    return null;
                }) : Promise.resolve(null),

                student.resumeUrl ? documentAnalyzer.analyzeDocument(Buffer.from("stub"), "application/pdf", "RESUME").catch(e => {
                    logger.warn(`Document analysis failed: ${e.message}`);
                    return null;
                }) : Promise.resolve(null)
            ]);

            // Company Verification for Employment Claims
            const employmentClaims = student.claims.filter(c => c.type === "INTERNSHIP" || c.type === "PROJECT");
            const companyResults = [];
            for (const claim of employmentClaims) {
                if (claim.company) {
                    const res = await companyVerifier.verifyEmployment({ studentId, requestId: request.id }, claim.company, claim.title);
                    companyResults.push({ claim, result: res });
                }
            }

            // 3. Save Raw Analysis to DB Layer
            if (githubResult) {
                await prisma.gitHubAnalysis.create({
                    data: {
                        verificationRequestId: request.id,
                        username: githubResult.username,
                        totalRepos: githubResult.totalRepos,
                        totalCommits: githubResult.totalCommits,
                        forkedRepos: githubResult.forkedRepos,
                        originalRepos: githubResult.originalRepos,
                        languages: githubResult.languages,
                        contributionScore: githubResult.contributionScore,
                        accountCreatedAt: githubResult.accountCreatedAt,
                        githubRisk: githubResult.githubRisk,
                        rFork: githubResult.riskBreakdown.rFork,
                        rPattern: githubResult.riskBreakdown.rPattern,
                        rComplexity: githubResult.riskBreakdown.rComplexity,
                        repositories: {
                            create: githubResult.repositories.map(r => ({
                                name: r.name,
                                url: r.url,
                                isFork: r.isFork,
                                stars: r.stars,
                                language: r.language,
                                commitCount: r.commitCount,
                                firstCommitAt: r.firstCommitAt,
                                lastCommitAt: r.lastCommitAt,
                                description: r.description,
                                repoRisk: r.repoRisk,
                            }))
                        }
                    }
                });
            }

            if (docResult) {
                await prisma.documentAnalysis.create({
                    data: {
                        verificationRequestId: request.id,
                        documentType: "OTHER",
                        fileName: "resume.pdf",
                        extractedText: docResult.extractedText,
                        authenticityScore: docResult.authenticityScore,
                        flags: docResult.flags
                    }
                });
            }

            for (const cr of companyResults) {
                await prisma.companyVerification.create({
                    data: {
                        verificationRequestId: request.id,
                        companyName: cr.claim.company!,
                        claimedRole: cr.claim.title,
                        claimedStartDate: cr.claim.startDate,
                        claimedEndDate: cr.claim.endDate,
                        verified: cr.result.verified,
                        responseReceived: cr.result.responseReceived,
                        responseNotes: cr.result.notes
                    }
                });
            }

            // 4. LAYER 3 & 4: Core Verification & Cross-Validation Algorithms
            const temporalResult = temporalConsistency.validateTimeline(student.claims, docResult ? [docResult] : []);
            const skillsResult = skillsCrossValidator.validateSkills(student.claims, githubResult);

            // 5. LAYER 5: Fraud Scoring
            const companyScore = companyResults.length > 0
                ? companyResults.filter(c => c.result.verified).length / companyResults.length
                : 0.5; // neutral if no companies to verify

            const fraudResult = fraudScorer.calculateRisk({
                // githubRisk IS rG (0.0 = legit, 1.0 = fraud). Convert to trust score (1 - rG).
                githubScore: githubResult ? 1.0 - githubResult.githubRisk : 0.5,
                companyScore: companyScore,
                documentScore: docResult?.authenticityScore || 0.8,
                temporalScore: temporalResult.score
            });

            // 6. Save Final Verification Result
            const finalResult = await prisma.verificationResult.create({
                data: {
                    verificationRequestId: request.id,
                    overallRiskScore: fraudResult.overallRiskScore,
                    riskLevel: fraudResult.riskLevel,
                    summary: fraudResult.summary,
                    githubScore: githubResult ? 1.0 - githubResult.githubRisk : 0.5,
                    companyScore: companyScore,
                    documentScore: docResult?.authenticityScore || 0.8,
                    temporalScore: temporalResult.score,
                    inconsistencyFlags: {
                        create: temporalResult.flags.map(f => ({
                            severity: f.severity,
                            message: f.message,
                            claimId: f.claimId === "unknown" ? null : f.claimId,
                            category: "TIMELINE",
                            evidenceSources: f.sources
                        }))
                    },
                    skillVerifications: {
                        create: skillsResult.verifiedSkills.map(sv => ({
                            skillName: sv.skillName,
                            status: sv.status,
                            confidenceScore: sv.confidenceScore,
                            evidenceRepos: sv.evidenceRepos
                        }))
                    }
                },
                include: {
                    inconsistencyFlags: true,
                    skillVerifications: true
                }
            });

            // Mark Request as Completed
            const completedRequest = await prisma.verificationRequest.update({
                where: { id: request.id },
                data: { status: "COMPLETED", completedAt: new Date() },
                include: { result: true }
            });

            logger.info(`Verification pipeline completed for student: ${studentId}. Risk: ${fraudResult.riskLevel}`);
            return completedRequest;

        } catch (error) {
            logger.error(`Verification pipeline failed for request ${request.id}:`, error as any);
            await prisma.verificationRequest.update({
                where: { id: request.id },
                data: { status: "FAILED" }
            });
            throw error;
        }
    }
}

export const verificationOrchestrator = new VerificationOrchestratorService();

/**
 * pg-boss worker handler — Phase 4 TASK-10.
 *
 * Runs the ARBC pipeline scoped to the claims the student disclosed in their
 * application. The VerificationRequest is already created (with applicationId)
 * by the application controller when the recruiter first views the application.
 */
export async function verifyApplicationJob(job: { data: { applicationId: string } | null }): Promise<void> {
    const applicationId = job.data?.applicationId;
    if (!applicationId) {
        logger.warn("[Queue] verifyApplicationJob called without applicationId");
        return;
    }
    logger.info(`[Queue] verifyApplicationJob starting for applicationId=${applicationId}`);

    // 1. Load the scoped verification request (created in viewApplication controller)
    const request = await prisma.verificationRequest.findFirst({
        where: { applicationId, status: "PENDING" },
    });
    if (!request) {
        logger.warn(`[Queue] No PENDING VerificationRequest for applicationId=${applicationId}. Skipping.`);
        return;
    }

    // 2. Load the application with disclosed claims + student data
    const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
            disclosedClaims: { include: { claim: true } },
            student: {
                include: {
                    user: { select: { id: true } },
                },
            },
            job: { select: { title: true, companyId: true } },
        },
    });

    if (!application) {
        logger.error(`[Queue] Application ${applicationId} not found. Marking request FAILED.`);
        await prisma.verificationRequest.update({
            where: { id: request.id },
            data: { status: "FAILED" },
        });
        return;
    }

    try {
        await prisma.verificationRequest.update({
            where: { id: request.id },
            data: { status: "IN_PROGRESS", startedAt: new Date() },
        });

        const student = application.student;
        const disclosedClaims = application.disclosedClaims.map((dc) => dc.claim);

        // 3. Decrypt GitHub token (same logic as runVerification)
        let decryptedGithubToken: string | undefined;
        if (student.githubAccessToken) {
            try {
                decryptedGithubToken = env.GH_TOKEN_ENCRYPTION_KEY
                    ? decryptToken(student.githubAccessToken)
                    : student.githubAccessToken;
            } catch {
                logger.warn(`[Queue] Could not decrypt GitHub token for student ${student.id}`);
            }
        }

        // 4. Collect repo URLs from ONLY disclosed claims
        const claimedRepoUrls = disclosedClaims
            .filter((c) => c.type === "PROJECT" || c.type === "INTERNSHIP")
            .map((c) => c.repoUrl)
            .filter((url): url is string => !!url);

        // 5. Run analysis pipeline (parallel where possible)
        const [githubResult, docResult] = await Promise.all([
            student.githubUsername
                ? githubAnalyzer.analyzeProfile(student.githubUsername, claimedRepoUrls, decryptedGithubToken).catch((e) => {
                    logger.warn(`[Queue] GitHub analysis failed: ${e.message}`);
                    return null;
                })
                : Promise.resolve(null),
            student.resumeUrl
                ? documentAnalyzer.analyzeDocument(Buffer.from("stub"), "application/pdf", "RESUME").catch((e) => {
                    logger.warn(`[Queue] Document analysis failed: ${e.message}`);
                    return null;
                })
                : Promise.resolve(null),
        ]);

        // 6. Company verification for disclosed employment claims only
        const employmentClaims = disclosedClaims.filter(
            (c) => c.type === "INTERNSHIP" || c.type === "PROJECT"
        );
        const companyResults = [];
        for (const claim of employmentClaims) {
            if (claim.company) {
                const res = await companyVerifier.verifyEmployment(
                    { studentId: student.id, requestId: request.id },
                    claim.company,
                    claim.title
                );
                companyResults.push({ claim, result: res });
            }
        }

        // 7. Save GitHub analysis
        if (githubResult) {
            await prisma.gitHubAnalysis.create({
                data: {
                    verificationRequestId: request.id,
                    username: githubResult.username,
                    totalRepos: githubResult.totalRepos,
                    totalCommits: githubResult.totalCommits,
                    forkedRepos: githubResult.forkedRepos,
                    originalRepos: githubResult.originalRepos,
                    languages: githubResult.languages,
                    contributionScore: githubResult.contributionScore,
                    accountCreatedAt: githubResult.accountCreatedAt,
                    githubRisk: githubResult.githubRisk,
                    rFork: githubResult.riskBreakdown.rFork,
                    rPattern: githubResult.riskBreakdown.rPattern,
                    rComplexity: githubResult.riskBreakdown.rComplexity,
                    repositories: {
                        create: githubResult.repositories.map((r) => ({
                            name: r.name,
                            url: r.url,
                            isFork: r.isFork,
                            stars: r.stars,
                            language: r.language,
                            commitCount: r.commitCount,
                            firstCommitAt: r.firstCommitAt,
                            lastCommitAt: r.lastCommitAt,
                            description: r.description,
                            repoRisk: r.repoRisk,
                        })),
                    },
                },
            });
        }

        if (docResult) {
            await prisma.documentAnalysis.create({
                data: {
                    verificationRequestId: request.id,
                    documentType: "OTHER",
                    fileName: "resume.pdf",
                    extractedText: docResult.extractedText,
                    authenticityScore: docResult.authenticityScore,
                    flags: docResult.flags,
                },
            });
        }

        for (const cr of companyResults) {
            await prisma.companyVerification.create({
                data: {
                    verificationRequestId: request.id,
                    companyName: cr.claim.company!,
                    claimedRole: cr.claim.title,
                    claimedStartDate: cr.claim.startDate,
                    claimedEndDate: cr.claim.endDate,
                    verified: cr.result.verified,
                    responseReceived: cr.result.responseReceived,
                    responseNotes: cr.result.notes,
                },
            });
        }

        // 8. Fraud scoring (same as runVerification)
        const temporalResult = temporalConsistency.validateTimeline(disclosedClaims, docResult ? [docResult] : []);
        const skillsResult = skillsCrossValidator.validateSkills(disclosedClaims, githubResult);

        const companyScore =
            companyResults.length > 0
                ? companyResults.filter((c) => c.result.verified).length / companyResults.length
                : 0.5;

        const fraudResult = fraudScorer.calculateRisk({
            githubScore: githubResult ? 1.0 - githubResult.githubRisk : 0.5,
            companyScore,
            documentScore: docResult?.authenticityScore ?? 0.8,
            temporalScore: temporalResult.score,
        });

        // 9. Save final result
        await prisma.verificationResult.create({
            data: {
                verificationRequestId: request.id,
                overallRiskScore: fraudResult.overallRiskScore,
                riskLevel: fraudResult.riskLevel,
                summary: fraudResult.summary,
                githubScore: githubResult ? 1.0 - githubResult.githubRisk : 0.5,
                companyScore,
                documentScore: docResult?.authenticityScore ?? 0.8,
                temporalScore: temporalResult.score,
                inconsistencyFlags: {
                    create: temporalResult.flags.map((f) => ({
                        severity: f.severity,
                        message: f.message,
                        claimId: f.claimId === "unknown" ? null : f.claimId,
                        category: "TIMELINE",
                        evidenceSources: f.sources,
                    })),
                },
                skillVerifications: {
                    create: skillsResult.verifiedSkills.map((sv) => ({
                        skillName: sv.skillName,
                        status: sv.status,
                        confidenceScore: sv.confidenceScore,
                        evidenceRepos: sv.evidenceRepos,
                    })),
                },
            },
        });

        // 10. Mark COMPLETED
        await prisma.verificationRequest.update({
            where: { id: request.id },
            data: { status: "COMPLETED", completedAt: new Date() },
        });

        logger.info(`[Queue] verifyApplicationJob COMPLETED for applicationId=${applicationId}. Risk: ${fraudResult.riskLevel}`);

        // 11. Notify recruiter (first company member) that results are ready
        const recruiter = await prisma.companyMember.findFirst({
            where: { companyId: application.job.companyId },
            select: { userId: true },
        });
        if (recruiter) {
            const { notify: notifyFn } = await import("../services/notification.service");
            void notifyFn(
                recruiter.userId,
                "VERIFICATION_COMPLETE",
                "ARBC verification complete",
                `Verification for the application to "${application.job.title}" is complete. Risk: ${fraudResult.riskLevel}.`,
                { applicationId, riskLevel: fraudResult.riskLevel }
            );
        }
    } catch (error) {
        logger.error(`[Queue] verifyApplicationJob FAILED for applicationId=${applicationId}:`, error as any);
        await prisma.verificationRequest.update({
            where: { id: request.id },
            data: { status: "FAILED" },
        });
        throw error; // pg-boss will retry based on retryLimit
    }
}
