import { FRAUD_WEIGHTS, THRESHOLDS } from "../config/constants";

export interface FraudScores {
    githubScore: number;
    companyScore: number;
    documentScore: number;
    temporalScore: number;
}

export interface FraudResult {
    overallRiskScore: number;   // 0.0 (Safe) to 1.0 (High Risk)
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    summary: string;
}

/**
 * Algo 3: Fraud Risk Scoring
 * Applies the weighted formula from the research paper to generate a final risk classification.
 * ρ = wG·rG + wC·rC + wD·rD + wT·rT
 * (Where r is RISK, which is 1.0 - TRUST SCORE)
 */
export class FraudScoringService {
    public calculateRisk(scores: FraudScores): FraudResult {
        // Note: The intermediate services output "Trust" scores (1.0 = perfect match).
        // The Fraud formula calculates "Risk" (1.0 = certain fraud).

        const rG = 1.0 - scores.githubScore;
        const rC = 1.0 - scores.companyScore;
        const rD = 1.0 - scores.documentScore;
        const rT = 1.0 - scores.temporalScore;

        const overallRiskScore =
            (FRAUD_WEIGHTS.github * rG) +
            (FRAUD_WEIGHTS.company * rC) +
            (FRAUD_WEIGHTS.document * rD) +
            (FRAUD_WEIGHTS.temporal * rT);

        let riskLevel: "LOW" | "MEDIUM" | "HIGH";
        let summary: string;

        if (overallRiskScore < THRESHOLDS.riskLow) {
            riskLevel = "LOW";
            summary = "Candidate profile appears legitimate. Skills and timelines correlate well across multiple data sources.";
        } else if (overallRiskScore < THRESHOLDS.riskHigh) {
            riskLevel = "MEDIUM";
            summary = "Some inconsistencies detected. Consider manual review of overlapping dates or unverified skills.";
        } else {
            riskLevel = "HIGH";
            summary = "CRITICAL: Multiple high-risk fraud indicators detected. Strong possibility of profile fabrication.";
        }

        return {
            overallRiskScore: Number(overallRiskScore.toFixed(3)),
            riskLevel,
            summary,
        };
    }
}

export const fraudScorer = new FraudScoringService();
