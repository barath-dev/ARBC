import { prisma } from "../config/database";
import { logger } from "../utils/logger";
import { githubAnalyzer } from "./github-analyzer";
import { companyVerifier } from "./company-verification";
import { documentAnalyzer } from "./document-analyzer";
import { temporalConsistency } from "./temporal-consistency";
import { skillsCrossValidator } from "./skills-cross-validator";
import { fraudScorer } from "./fraud-scoring";

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

            // 2. LAYER 2: Data Collection (Parallel Execution)
            // Collect any GitHub project repo URLs the student has claimed
            const claimedRepoUrls = student.claims
                .filter((c) => c.type === "PROJECT" || c.type === "INTERNSHIP")
                .map((c) => (c as any).repoUrl as string | null)
                .filter((url): url is string => !!url);

            const [githubResult, docResult] = await Promise.all([
                student.githubUsername ? githubAnalyzer.analyzeProfile(student.githubUsername, claimedRepoUrls).catch(e => {
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
                                description: r.description
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
