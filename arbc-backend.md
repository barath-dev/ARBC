# ARBC Backend

## Goal
Build the backend for **ARBC** (Automated Resume-Based Credential verification) — a multi-source student credential fraud detection system using Express 5 + Prisma 7 + PostgreSQL + TypeScript.

## Project Type
**BACKEND** — API only. Agent: `backend-specialist`

## Decisions Made
| Decision | Answer |
|----------|--------|
| OCR | **Stubbed** — adapter pattern with `Tesseract.js` as default (free/open-source). Can swap to Google Cloud Vision, Mindee, or Klippa later |
| Company Verification | **Stubbed** — interface + mock implementation, no SMTP/SendGrid yet |
| Auth Roles | **Both** — Recruiter (creates verifications, views dashboard) + Student (submits profile, views own reports) |
| Framework | Express 5 (already in scaffold) |
| Database | PostgreSQL via Prisma 7 (already in scaffold) |
| Validation | Zod |
| Auth | JWT (bcrypt for password hashing) |

## OCR Alternatives Research

| Option | Type | Cost | Best For | Node.js Support |
|--------|------|------|----------|----------------|
| **Tesseract.js** ✅ | Open-source | Free | MVP/prototype, basic text extraction | Native JS, runs in Node |
| **Google Cloud Vision** | Cloud API | ~$1.50/1000 pages | High accuracy, multi-language | Official SDK |
| **Mindee** | Cloud API | Freemium | Pre-trained models for IDs, invoices | SDK available |
| **Klippa DocHorizon** | Cloud API | Paid | Identity docs + built-in fraud detection | SDK available |
| **Microsoft Azure AI Vision** | Cloud API | ~$1/1000 pages | Enterprise, mixed languages | REST API / SDK |

> **Strategy:** Build an `OcrProvider` interface so any provider can be swapped in. Start with `Tesseract.js` for the prototype.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js + TypeScript | Existing scaffold |
| Framework | Express 5 | Already configured |
| ORM | Prisma 7 | Already configured |
| Database | PostgreSQL | Already configured |
| Validation | Zod | Type-safe, lightweight |
| Auth | JWT + bcrypt | Simple, stateless |
| OCR (stubbed) | Tesseract.js | Free, no external deps |
| Queue (future) | BullMQ + Redis | For async verification jobs |

## File Structure

```
source_code/server/
├── prisma/
│   └── schema.prisma          # Full data model
├── src/
│   ├── app.ts                 # Express bootstrap + server start
│   ├── config/
│   │   ├── environment.ts     # Env var validation + export
│   │   ├── database.ts        # Prisma client singleton
│   │   └── constants.ts       # Algorithm weights, thresholds
│   ├── middlewares/
│   │   ├── auth.ts            # JWT verification + role check
│   │   ├── errorHandler.ts    # Global error handler
│   │   └── validate.ts        # Zod schema validation middleware
│   ├── routes/
│   │   ├── index.ts           # Mount all sub-routers
│   │   ├── auth.routes.ts     # /api/auth/*
│   │   ├── student.routes.ts  # /api/students/*
│   │   ├── verification.routes.ts # /api/verifications/*
│   │   └── dashboard.routes.ts    # /api/dashboard/*
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── student.controller.ts
│   │   ├── verification.controller.ts
│   │   └── dashboard.controller.ts
│   ├── services/
│   │   ├── github-analyzer.ts         # GitHub REST/GraphQL API
│   │   ├── company-verification.ts    # STUBBED — mock responses
│   │   ├── document-analyzer.ts       # STUBBED — Tesseract.js adapter
│   │   ├── temporal-consistency.ts    # Algorithm 1: cross-source timeline check
│   │   ├── skills-cross-validator.ts  # Algorithm 2: claimed vs demonstrated
│   │   ├── fraud-scoring.ts           # Weighted risk score + classification
│   │   └── verification-orchestrator.ts # Pipeline coordinator
│   ├── utils/
│   │   ├── api-response.ts    # Standardized success/error responses
│   │   └── logger.ts          # Structured logging
│   └── types/
│       └── index.ts           # Shared TypeScript types + Zod schemas
├── package.json
└── tsconfig.json
```

## Tasks

- [ ] **T1: Prisma Schema** — Define all models (User, Student, VerificationRequest, ResumeClaim, GitHubAnalysis, Repository, CompanyVerification, DocumentAnalysis, VerificationResult, InconsistencyFlag, SkillVerification, AuditLog) with relations and enums → Verify: `npx prisma validate`

- [ ] **T2: Config + Utils** — Create `environment.ts` (Zod-validated env), `database.ts` (Prisma singleton), `constants.ts` (algorithm weights/thresholds), `api-response.ts`, `logger.ts` → Verify: `npx tsc --noEmit`

- [ ] **T3: Types + Validation** — Create Zod schemas for all request/response DTOs in `types/index.ts`, validation middleware in `validate.ts` → Verify: `npx tsc --noEmit`

- [ ] **T4: Auth Middleware** — JWT sign/verify + role guard (`RECRUITER` / `STUDENT`), bcrypt password hashing → Verify: `npx tsc --noEmit`

- [ ] **T5: Auth Controller + Routes** — `POST /api/auth/register` (role-aware), `POST /api/auth/login`, `GET /api/auth/me` → Verify: `curl POST /api/auth/register`

- [ ] **T6: Student Controller + Routes** — `POST /api/students` (student creates profile with GitHub username, skills, internships), `GET /api/students/:id`, `GET /api/students` (recruiter list) → Verify: `curl GET /api/students`

- [ ] **T7: Services — Data Collection** — `github-analyzer.ts` (fetch repos, commits, languages, detect forks via GitHub API), `company-verification.ts` (stubbed mock), `document-analyzer.ts` (stubbed with Tesseract.js adapter interface) → Verify: `npx tsc --noEmit`

- [ ] **T8: Services — Verification Engine** — `temporal-consistency.ts` (Algorithm 1), `skills-cross-validator.ts` (Algorithm 2), `fraud-scoring.ts` (weighted scoring model) → Verify: `npx tsc --noEmit`

- [ ] **T9: Verification Orchestrator + Controller + Routes** — `POST /api/verifications` (kick off verification), `GET /api/verifications/:id` (result), `GET /api/verifications` (list) — orchestrator calls all services sequentially → Verify: `curl POST /api/verifications`

- [ ] **T10: Dashboard Controller + Routes** — `GET /api/dashboard/stats` (counts by risk level), `GET /api/dashboard/recent` (latest verifications) — recruiter-only → Verify: `curl GET /api/dashboard/stats`

## Done When
- [ ] All 10 tasks marked `[x]`
- [ ] `npx prisma validate` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Server starts on `npm run dev` / `npx ts-node src/app.ts`
- [ ] `GET /api/health` returns `200`
- [ ] Auth flow works (register → login → access protected route)

## Phase X: Verification
```bash
# P0: Type Check
npx tsc --noEmit

# P0: Prisma Validate
npx prisma validate

# P0: Security
python .agent/skills/vulnerability-scanner/scripts/security_scan.py .

# P1: Server Start
npx ts-node src/app.ts

# P2: API Test
curl http://localhost:3000/api/health
```
