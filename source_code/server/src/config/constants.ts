/**
 * Algorithm weights and thresholds from the ARBC research paper.
 *
 * Fraud risk score: ρ = wG·rG + wC·rC + wD·rD + wT·rT
 */

/**
 * Top-level fraud score weights (ρ = wG·rG + wC·rC + wD·rD + wT·rT)
 * Source: RP.pdf Section 4.1 – Table 1
 */
export const FRAUD_WEIGHTS = {
  github: 0.30,
  company: 0.40,
  document: 0.20,
  temporal: 0.10,
} as const;

/**
 * GitHub legitimacy risk sub-weights (rG = wFork·rFork + wPattern·rPattern + wComplexity·rComplexity)
 * Source: RP.pdf Section 4.2 – Algorithm 2
 */
export const GITHUB_RISK_WEIGHTS = {
  fork: 0.4,
  pattern: 0.3,
  complexity: 0.3,
} as const;

/** A commit burst is considered suspicious when all commits to a repo land within this window (days). */
export const BURST_WINDOW_DAYS = 3;

export const THRESHOLDS = {
  temporalConsistency: 0.6,
  skillsMatch: 0.5,
  riskLow: 0.4,
  riskHigh: 0.7,
} as const;

export const GITHUB_LIMITS = {
  requestsPerHour: 5000,
  requestsPerStudent: 50,
  maxReposToAnalyze: 30,
} as const;

export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
} as const;
