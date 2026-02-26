/**
 * Algorithm weights and thresholds from the ARBC research paper.
 *
 * Fraud risk score: ρ = wG·rG + wC·rC + wD·rD + wT·rT
 */

export const FRAUD_WEIGHTS = {
  github: 0.35,
  company: 0.30,
  document: 0.15,
  temporal: 0.20,
} as const;

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
