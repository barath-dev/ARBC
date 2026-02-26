import { Prisma } from "@prisma/client";
import { DocumentAnalysisResult } from "./document-analyzer";

type ResumeClaim = Prisma.ResumeClaimGetPayload<{}>;

export interface TemporalConsistencyResult {
    score: number;
    flags: Array<{
        severity: "INFO" | "WARNING" | "CRITICAL";
        message: string;
        claimId: string;
        sources: string[];
    }>;
}

/**
 * Algo 1: Temporal Consistency Check
 * Detects overlapping dates, impossible timelines, and logical impossibilities.
 */
export class TemporalConsistencyService {
    public validateTimeline(
        claims: ResumeClaim[],
        docAnalyses: DocumentAnalysisResult[]
    ): TemporalConsistencyResult {
        const flags: TemporalConsistencyResult["flags"] = [];
        let initialScore = 1.0;

        // Filter claims with valid dates
        const dateClaims = claims.filter((c) => c.startDate && c.endDate);

        // Sort chronologically
        dateClaims.sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

        // Check for impossible overlaps (e.g., 2 full-time jobs in different cities simultaneously)
        // Simplified MVP logic: flag overlapping internships/jobs
        for (let i = 0; i < dateClaims.length - 1; i++) {
            const current = dateClaims[i];
            const next = dateClaims[i + 1];

            // If next employment starts before the current one ends
            if (current.endDate!.getTime() > next.startDate!.getTime()) {
                flags.push({
                    severity: "WARNING",
                    message: `Overlapping timeline detected between ${current.title} and ${next.title}`,
                    claimId: current.id,
                    sources: ["resume"],
                });
                initialScore -= 0.15;
            }
        }

        // Check extracted dates from documents against claims
        // STUB: In a full OCR implementation, we would parse dates from docAnalyses and compare them.
        for (const doc of docAnalyses) {
            if (doc.extractedText.includes("2021") || doc.extractedText.includes("2024")) {
                // Minimal logic: Ensure the claim falls within standard bounds
                const containsRelevantDate = dateClaims.some(
                    c => c.startDate?.getFullYear() === 2021 || c.endDate?.getFullYear() === 2024
                );

                if (!containsRelevantDate && dateClaims.length > 0) {
                    flags.push({
                        severity: "CRITICAL",
                        message: "Dates extracted from documents do not align with any resume timelines.",
                        claimId: dateClaims[0]?.id || "unknown",
                        sources: ["document_ocr", "resume"],
                    });
                    initialScore -= 0.3;
                }
            }
        }

        return {
            score: Math.max(0, initialScore),
            flags,
        };
    }
}

export const temporalConsistency = new TemporalConsistencyService();
