import { Prisma } from "@prisma/client";
import { GitHubAnalysisResult } from "./github-analyzer";

type ResumeClaim = Prisma.ResumeClaimGetPayload<{}>;

export interface SkillsVerificationResult {
    score: number;
    verifiedSkills: Array<{
        skillName: string;
        status: "VERIFIED" | "PARTIAL" | "UNVERIFIED";
        confidenceScore: number;
        evidenceRepos: string[];
    }>;
}

/**
 * Algo 2: Skills Cross-Validator
 * Matches claimed resume skills against extracted GitHub languages and repositories.
 */
export class SkillsCrossValidatorService {
    public validateSkills(
        claims: ResumeClaim[],
        githubData: GitHubAnalysisResult | null
    ): SkillsVerificationResult {
        const verifiedSkills: SkillsVerificationResult["verifiedSkills"] = [];
        let totalScore = 0;

        // Extract all unique skills claimed by the student
        const allClaimedSkills = Array.from(
            new Set(claims.flatMap((c) => c.skills.map((s: string) => s.toLowerCase())))
        );

        if (allClaimedSkills.length === 0) {
            return { score: 1.0, verifiedSkills: [] }; // Nothing to verify
        }

        if (!githubData || githubData.repositories.length === 0) {
            // If no GitHub data but skills claimed -> unverifiable via GitHub
            for (const skill of allClaimedSkills) {
                verifiedSkills.push({
                    skillName: skill,
                    status: "UNVERIFIED",
                    confidenceScore: 0,
                    evidenceRepos: [],
                });
            }
            return { score: 0.2, verifiedSkills }; // Low score, needs company/manual verification
        }

        // Map GitHub languages to standard lowercase strings
        const githubLanguages = Object.keys(githubData.languages).map((l) => l.toLowerCase());

        for (const claimedSkill of allClaimedSkills) {
            const matchPos = githubLanguages.findIndex((lang) =>
                claimedSkill.includes(lang) || lang.includes(claimedSkill)
            );

            if (matchPos !== -1) {
                // Find which repos contributed to this language match
                const sourceResourceLang = Object.keys(githubData.languages)[matchPos];
                const evidenceRepos = githubData.repositories
                    .filter((repo) => repo.language && repo.language.toLowerCase() === sourceResourceLang.toLowerCase() && !repo.isFork)
                    .map((repo) => repo.name);

                verifiedSkills.push({
                    skillName: claimedSkill,
                    status: evidenceRepos.length > 1 ? "VERIFIED" : "PARTIAL",
                    confidenceScore: evidenceRepos.length > 2 ? 0.9 : 0.6,
                    evidenceRepos,
                });

                totalScore += evidenceRepos.length > 1 ? 1.0 : 0.6;
            } else {
                verifiedSkills.push({
                    skillName: claimedSkill,
                    status: "UNVERIFIED",
                    confidenceScore: 0,
                    evidenceRepos: [],
                });
            }
        }

        // Calculate final ratio
        const normalizedScore = totalScore / allClaimedSkills.length;

        return {
            score: Math.max(0, Math.min(1.0, normalizedScore)),
            verifiedSkills,
        };
    }
}

export const skillsCrossValidator = new SkillsCrossValidatorService();
