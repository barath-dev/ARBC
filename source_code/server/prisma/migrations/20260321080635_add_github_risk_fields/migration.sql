-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RECRUITER', 'STUDENT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('INTERNSHIP', 'PROJECT', 'SKILL', 'CERTIFICATE', 'EDUCATION');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('VERIFIED', 'PARTIAL', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OFFER_LETTER', 'CERTIFICATE', 'TRANSCRIPT', 'RECOMMENDATION', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUsername" TEXT,
    "githubAccessToken" TEXT,
    "linkedinUrl" TEXT,
    "resumeUrl" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_claims" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "ClaimType" NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "repoUrl" TEXT,
    "description" TEXT,
    "skills" TEXT[],
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_analyses" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalRepos" INTEGER NOT NULL DEFAULT 0,
    "totalCommits" INTEGER NOT NULL DEFAULT 0,
    "forkedRepos" INTEGER NOT NULL DEFAULT 0,
    "originalRepos" INTEGER NOT NULL DEFAULT 0,
    "languages" JSONB NOT NULL,
    "contributionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accountCreatedAt" TIMESTAMP(3),
    "githubRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rFork" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rPattern" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rComplexity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rawData" JSONB,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "githubAnalysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT,
    "languages" JSONB,
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "firstCommitAt" TIMESTAMP(3),
    "lastCommitAt" TIMESTAMP(3),
    "description" TEXT,
    "repoRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_verifications" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "claimedRole" TEXT,
    "claimedStartDate" TIMESTAMP(3),
    "claimedEndDate" TIMESTAMP(3),
    "verified" BOOLEAN,
    "responseReceived" BOOLEAN NOT NULL DEFAULT false,
    "responseDate" TIMESTAMP(3),
    "responseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_analyses" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "extractedText" TEXT,
    "metadataCreatedAt" TIMESTAMP(3),
    "metadataModifiedAt" TIMESTAMP(3),
    "authenticityScore" DOUBLE PRECISION,
    "flags" TEXT[],
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_results" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "overallRiskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "githubScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "documentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "temporalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inconsistency_flags" (
    "id" TEXT NOT NULL,
    "verificationResultId" TEXT NOT NULL,
    "claimId" TEXT,
    "severity" "FlagSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidenceSources" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inconsistency_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_verifications" (
    "id" TEXT NOT NULL,
    "verificationResultId" TEXT NOT NULL,
    "claimId" TEXT,
    "skillName" TEXT NOT NULL,
    "status" "SkillStatus" NOT NULL,
    "evidenceRepos" TEXT[],
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "skill_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "verificationRequestId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "github_analyses_verificationRequestId_key" ON "github_analyses"("verificationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "company_verifications_verificationRequestId_key" ON "company_verifications"("verificationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_results_verificationRequestId_key" ON "verification_results"("verificationRequestId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_claims" ADD CONSTRAINT "resume_claims_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_analyses" ADD CONSTRAINT "github_analyses_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_githubAnalysisId_fkey" FOREIGN KEY ("githubAnalysisId") REFERENCES "github_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_verifications" ADD CONSTRAINT "company_verifications_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inconsistency_flags" ADD CONSTRAINT "inconsistency_flags_verificationResultId_fkey" FOREIGN KEY ("verificationResultId") REFERENCES "verification_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inconsistency_flags" ADD CONSTRAINT "inconsistency_flags_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "resume_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_verificationResultId_fkey" FOREIGN KEY ("verificationResultId") REFERENCES "verification_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_verifications" ADD CONSTRAINT "skill_verifications_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "resume_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
