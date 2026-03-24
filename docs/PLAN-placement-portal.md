# Placement Portal — 5-Phase Implementation Plan

**Project:** ARBC → Full Placement Portal
**Plan File:** `docs/PLAN-placement-portal.md`
**Deployment:** Local development (VPS deployment plan TBD separately)

---

## Actors & System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     PLACEMENT PORTAL                    │
│                                                         │
│  [Institution/TPO]  ←─ approve/reject ─→  [Company]    │
│         │                                     │         │
│   curated job board                      posts jobs     │
│         │                                     │         │
│      [Student]  ──── applies (selective) ────►│         │
│         │                                     │         │
│    ARBC pipeline         (lazy: fires on recruiter view) │
└─────────────────────────────────────────────────────────┘
```

### Dual Job Visibility Model

| Job Type | Institution can pull? | Company can push? | Approval needed? |
|---|---|---|---|
| `PUBLIC` | ✅ Auto-approved | ✅ Requires institution approval | Pull: No / Push: Yes |
| `INSTITUTION_SPECIFIC` | ❌ Not visible unless pushed | ✅ Requires institution approval | Always Yes |

---

## Phase 1 — Infrastructure Foundation
> **Goal:** Everything downstream depends on this. DB, queue, notifications, env.
> **Atomic exit:** Server starts cleanly; migration applies; queue worker boots; test notification inserts to DB.

### TASK-1 · Prisma Schema Migration

All new models in one migration named `placement_portal_foundation`.

**New Enums:**
```prisma
enum Role            { STUDENT RECRUITER INSTITUTION }
enum JobVisibility   { PUBLIC INSTITUTION_SPECIFIC }
enum JobStatus       { DRAFT OPEN CLOSED }
enum BoardEntryStatus{ PENDING_INSTITUTION APPROVED REJECTED WITHDRAWN }
enum BoardEntryInitiator { COMPANY INSTITUTION }
enum ApplicationStatus { APPLIED UNDER_REVIEW SHORTLISTED REJECTED OFFERED WITHDRAWN }
```

**New Models:**
```prisma
model Institution {
  id          String   @id @default(cuid())
  name        String
  domain      String?
  logoUrl     String?
  createdAt   DateTime @default(now())
  members     InstitutionMember[]
  students    Student[]
  inviteCodes InviteCode[]
  jobBoard    JobBoardEntry[]
}

model InstitutionMember {
  id            String      @id @default(cuid())
  userId        String      @unique
  institutionId String
  user          User        @relation(fields:[userId], references:[id])
  institution   Institution @relation(fields:[institutionId], references:[id])
}

model InviteCode {
  id            String      @id @default(cuid())
  code          String      @unique @default(cuid())
  institutionId String
  expiresAt     DateTime?
  usedById      String?     @unique
  createdAt     DateTime    @default(now())
  institution   Institution @relation(fields:[institutionId], references:[id])
  usedBy        Student?    @relation(fields:[usedById], references:[id])
}

model Company {
  id        String   @id @default(cuid())
  name      String
  logoUrl   String?
  website   String?
  createdAt DateTime @default(now())
  members   CompanyMember[]
  jobs      Job[]
}

model CompanyMember {
  id        String  @id @default(cuid())
  userId    String  @unique
  companyId String
  user      User    @relation(fields:[userId], references:[id])
  company   Company @relation(fields:[companyId], references:[id])
}

model Job {
  id            String        @id @default(cuid())
  companyId     String
  title         String
  description   String
  skills        String[]
  location      String?
  isRemote      Boolean       @default(false)
  type          String        // INTERNSHIP | FULL_TIME | PART_TIME | CONTRACT
  visibility    JobVisibility @default(PUBLIC)
  status        JobStatus     @default(DRAFT)
  deadline      DateTime?
  openPositions Int           @default(1)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  company       Company         @relation(fields:[companyId], references:[id])
  boardEntries  JobBoardEntry[]
  applications  Application[]
}

model JobBoardEntry {
  id            String              @id @default(cuid())
  jobId         String
  institutionId String
  status        BoardEntryStatus    @default(APPROVED)
  initiator     BoardEntryInitiator
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  job           Job         @relation(fields:[jobId], references:[id])
  institution   Institution @relation(fields:[institutionId], references:[id])
  @@unique([jobId, institutionId])
}

model Application {
  id            String            @id @default(cuid())
  studentId     String
  jobId         String
  status        ApplicationStatus @default(APPLIED)
  coverNote     String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  student         Student              @relation(fields:[studentId], references:[id])
  job             Job                  @relation(fields:[jobId], references:[id])
  disclosedClaims ApplicationClaim[]
  verificationRequests VerificationRequest[]
  @@unique([studentId, jobId])
}

model ApplicationClaim {
  applicationId String
  claimId       String
  application   Application @relation(fields:[applicationId], references:[id])
  claim         ResumeClaim @relation(fields:[claimId], references:[id])
  @@id([applicationId, claimId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String
  read      Boolean  @default(false)
  metadata  Json?
  createdAt DateTime @default(now())
  user      User     @relation(fields:[userId], references:[id])
}
```

**Modified Models:**
```diff
model Student {
+  institutionId String?
+  inviteCodeId  String? @unique
}

model VerificationRequest {
+  applicationId String?
}
```

- **Verify:** `prisma migrate dev --name placement_portal_foundation` → no drift; all tables present in `prisma studio`

---

### TASK-2 · Environment Config

**File:** `src/config/environment.ts`

```diff
+ SMTP_HOST: z.string().optional(),
+ SMTP_PORT: z.coerce.number().default(587),
+ SMTP_USER: z.string().optional(),
+ SMTP_PASS: z.string().optional(),
+ SMTP_FROM: z.string().default('noreply@arbc.io'),
+ APP_URL:   z.string().default('http://localhost:3000'),
```

---

### TASK-3 · pg-boss Job Queue Service

**File:** `src/services/job-queue.service.ts` *(new)*

```typescript
// Initializes pg-boss with the existing DATABASE_URL.
// Exports scheduleVerification(applicationId: string): Promise<void>
// Registers one worker: 'verify-application' → calls verificationOrchestrator.runForApplication()
// Singleton: boot once in app.ts, before routes.
```

- **Verify:** Start server → pg-boss tables appear in DB; enqueue a test job → worker picks it up within 5s

---

### TASK-4 · Notification Service

**File:** `src/services/notification.service.ts` *(new)*

```typescript
// notify(userId, type, title, body, metadata?) → inserts Notification row
// notifyEmail(userId, subject, html) → Nodemailer (SMTP) for critical types:
//   APPLICATION_RECEIVED, STATUS_CHANGED(SHORTLISTED|OFFERED)
// Email silently skipped if SMTP_HOST not configured (dev mode)
```

- **Verify:** `notify()` call → row in `notifications` table; with SMTP configured → email delivered to Mailtrap/Ethereal

---

## Phase 2 — Actor Registration & Auth
> **Goal:** Institution and Company can register, create their profiles, and have role-gated JWTs. Students can bind to an institution via invite code.
> **Atomic exit:** Three distinct login flows work; invite code binding sets `student.institutionId`.

### TASK-5 · Institution Controller + Routes

**File:** `src/controllers/institution.controller.ts` + `src/routes/institution.routes.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/institutions` | Public (first setup) | Register institution |
| `GET`  | `/api/institutions/me` | INSTITUTION | Get own profile |
| `PUT`  | `/api/institutions/me` | INSTITUTION | Update profile |
| `POST` | `/api/institutions/me/invite-codes` | INSTITUTION | Generate N invite codes |
| `GET`  | `/api/institutions/me/invite-codes` | INSTITUTION | List codes + usage status |
| `GET`  | `/api/institutions/me/students` | INSTITUTION | View student cohort |

**Student invite-code binding** (in `student.controller.ts`):
- `POST /api/student/me/join` `{ code }` → validate code, set `student.institutionId`, mark code `usedById`
- Atomic transaction: mark code + update student in one DB call (prevents race condition)

- **Verify:** Generate code → student uses it → `student.institutionId` populated; reuse same code → 409

---

### TASK-6 · Company Controller + Routes

**File:** `src/controllers/company.controller.ts` + `src/routes/company.routes.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/companies` | RECRUITER | Create company + self as member |
| `GET`  | `/api/companies/me` | RECRUITER | Get own company |
| `PUT`  | `/api/companies/me` | RECRUITER | Update company |

- `POST /api/companies` creates `Company` + `CompanyMember` in one transaction
- Middleware: `requireCompany` — rejects RECRUITER requests if no `CompanyMember` row exists

- **Verify:** Recruiter registers → creates company → `companyId` attached; hitting protected job route without company → 403

---

## Phase 3 — Jobs & Job Board
> **Goal:** Companies can post/publish jobs. Institutions can curate a board via pull or push/approval. The dual-visibility model is fully enforced.
> **Atomic exit:** Public job visible to all; institution-specific job only visible after company push + institution approval.

### TASK-7 · Job Controller + Routes

**File:** `src/controllers/job.controller.ts` + `src/routes/job.routes.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST`   | `/api/jobs`                    | RECRUITER | Create job (DRAFT) |
| `PUT`    | `/api/jobs/:id`                | RECRUITER (owner) | Update job |
| `PUT`    | `/api/jobs/:id/publish`        | RECRUITER (owner) | Set status → OPEN |
| `PUT`    | `/api/jobs/:id/close`          | RECRUITER (owner) | Set status → CLOSED |
| `DELETE` | `/api/jobs/:id`                | RECRUITER (owner) | Delete (only DRAFT + 0 applications) |
| `GET`    | `/api/jobs/mine`               | RECRUITER | List own jobs |
| `GET`    | `/api/jobs/public`             | Any authenticated | All OPEN PUBLIC jobs |
| `GET`    | `/api/jobs/:id`                | Any authenticated | Single job detail |
| `POST`   | `/api/jobs/:id/distribute`     | RECRUITER (owner) | Push to institution(s) |

**Business rules:**
- `DELETE` blocked if `applications.length > 0`
- `distribute` creates a `JobBoardEntry(COMPANY, PENDING_INSTITUTION)` per target institution
- Fires `notify(institutionAdminId, 'BOARD_REQUEST', ...)` for each push
- Closing a CLOSED job auto-notifies applicants with status `APPLIED`

---

### TASK-8 · Job Board Controller + Routes

**File:** `src/controllers/jobboard.controller.ts` + `src/routes/jobboard.routes.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET`    | `/api/jobboard`                    | INSTITUTION | Own curated board (APPROVED entries) |
| `POST`   | `/api/jobboard/pull/:jobId`         | INSTITUTION | Pull PUBLIC job → auto-approved |
| `GET`    | `/api/jobboard/requests`            | INSTITUTION | Incoming PENDING_INSTITUTION requests |
| `PUT`    | `/api/jobboard/requests/:entryId/approve` | INSTITUTION | Approve push |
| `PUT`    | `/api/jobboard/requests/:entryId/reject`  | INSTITUTION | Reject push |
| `DELETE` | `/api/jobboard/:entryId`            | INSTITUTION | Remove from board |

**Business rules:**
- `pull` → `JobBoardEntry { initiator: INSTITUTION, status: APPROVED }` — `@@unique` prevents double-add
- `pull` of INSTITUTION_SPECIFIC job → 403 (not visible)
- `approve` → fires `notify(companyAdminId, 'BOARD_APPROVED', ...)`
- `reject` → fires `notify(companyAdminId, 'BOARD_REJECTED', ...)`

---

## Phase 4 — Applications & Lazy ARBC
> **Goal:** Students can apply with selective claim disclosure. Recruiter opening an application triggers scoped ARBC (only disclosed claims analyzed). Status updates notify the student.
> **Atomic exit:** End-to-end apply → recruiter views → ARBC runs → result visible.

### TASK-9 · VerificationOrchestrator — Application-Scoped Mode

**File:** `src/services/verification-orchestrator.ts` *(modify)*

```typescript
// NEW: runForApplication(applicationId: string): Promise<void>
//   1. Fetch Application + disclosedClaims (claimIds only)
//   2. Fetch student + decrypt githubAccessToken
//   3. Filter claimedRepoUrls to only disclosed claim repos
//   4. Run githubAnalyzer.analyzeProfile(username, filteredRepoUrls, decryptedToken)
//   5. Run only the skills from disclosed claims through skillsCrossValidator
//   6. Create VerificationRequest with { applicationId, studentId }
//   7. Persist VerificationResult as before
// RESULT CACHE: if VerificationRequest exists for same applicationId and is < 72h old → skip, return cached
```

---

### TASK-10 · Application Controller + Routes

**File:** `src/controllers/application.controller.ts` + `src/routes/application.routes.ts`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET`    | `/api/jobs/board`                 | STUDENT | Institution-approved jobs for student's institution |
| `POST`   | `/api/applications`               | STUDENT | Apply `{ jobId, claimIds[], coverNote? }` |
| `GET`    | `/api/applications/mine`          | STUDENT | My applications + status timeline |
| `DELETE` | `/api/applications/:id`           | STUDENT | Withdraw (only if APPLIED) |
| `GET`    | `/api/applications/job/:jobId`    | RECRUITER | All applicants for a job |
| `GET`    | `/api/applications/:id`           | RECRUITER | Single applicant (triggers lazy ARBC) |
| `PUT`    | `/api/applications/:id/status`    | RECRUITER | Update status (SHORTLISTED/REJECTED/OFFERED) |

**Business rules:**
- `POST /api/applications`: guard checks `job.status === OPEN` + `job.deadline` not passed + student has `institutionId` + job is on their institution's board
- `@@unique([studentId, jobId])` → 409 on duplicate
- `GET /api/applications/:id` (recruiter): check if `VerificationRequest` exists for this `applicationId` and is fresh; if not → `jobQueue.scheduleVerification(applicationId)`
- `PUT /status` → fires `notify(studentId, 'STATUS_CHANGED', ...)` + email on SHORTLISTED/OFFERED

---

## Phase 5 — All Three Frontends
> **Goal:** All three portals are functional with full user flows. Build from shared component patterns.
> **Atomic exit:** Each portal: `npx tsc --noEmit` → 0 errors; all manual flows pass.

### TASK-11 · Institution Portal (new Next.js app)

**Path:** `source_code/institution-portal/`

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email + password auth, `INSTITUTION` role |
| Dashboard | `/` | Board summary card, pending requests badge, student count |
| Browse Jobs | `/jobs` | All PUBLIC + OPEN jobs with search/filter; "Add to Board" button |
| My Board | `/board` | Current approved jobs; remove from board |
| Requests | `/requests` | Incoming PENDING pushes from companies; approve/reject |
| Students | `/students` | Cohort list; generate invite codes; copy shareable link |

**Shared UI:** Reuse ShadCN components from existing portals (copy `components/ui/` folder).

---

### TASK-12 · Student Portal Enhancements

**Path:** `source_code/student-portal/` *(existing — add pages)*

| Page | Route | Description |
|------|-------|-------------|
| Job Board | `/jobs` | List institution-approved jobs; search by skill/type/location |
| Job Detail | `/jobs/[id]` | Full job info + apply button |
| Apply | `/jobs/[id]/apply` | Selective disclosure form: checkboxes per claim (project/experience), cover note, submit |
| My Applications | `/applications` | Track status with timeline chip (APPLIED → UNDER_REVIEW → SHORTLISTED/REJECTED/OFFERED) |

**Selective disclosure UX:**
- Each claim shown as card with checkbox
- Preview panel: "Recruiter will see: [2 projects, 1 experience]"
- Disabled submit if 0 claims selected

**Onboarding gate:** If `student.institutionId` is null → redirect `/` to `/join` page with invite code input.

---

### TASK-13 · Recruiter Dashboard Enhancements

**Path:** `source_code/recruiter-dashboard/` *(existing — add pages)*

| Page | Route | Description |
|------|-------|-------------|
| My Jobs | `/jobs` | Job listings with status badges (DRAFT/OPEN/CLOSED); publish/close/delete actions |
| Create Job | `/jobs/create` | Full form: title, description, skills (tag input), type, visibility, deadline, positions |
| Job Detail | `/jobs/[id]` | Job info + applicant list table with status filter |
| Distribute | `/jobs/[id]/distribute` | Search institutions by name; select + push; shows pending/approved per institution |
| Applicant | `/applications/[id]` | Disclosed claims list + ARBC result panel (skeleton while loading, auto-refreshes until result ready) |
| Notifications | `/notifications` | In-app notification feed (mark all read) |

**ARBC panel behavior:**
- On load: `GET /api/applications/:id` → if no VerificationResult yet → show "Analysis in progress…" with spinner
- Poll every 5s until result arrives → render existing verification report component

---


## Phase Dependency Map

```
Phase 1 (Foundation)
    │
    ├──► Phase 2 (Actors)
    │        │
    │        ├──► Phase 3 (Jobs & Board)
    │        │        │
    │        │        └──► Phase 4 (Applications & ARBC)
    │        │                  │
    │        └──────────────────┴──► Phase 5 (Frontends)
```

---

## Phase Exit Checklist

| Phase | Exit Condition |
|-------|---------------|
| **1** | `prisma migrate dev` clean; server boots; queue worker running; `notify()` inserts row |
| **2** | Institution + Company register; invite code binds student; role-gated routes enforce correctly |
| **3** | Public job visible to all; institution-specific hidden until approved; board pull/push/approve flows work |
| **4** | Student applies with 2/5 claims; recruiter views → job enqueued; result populated in < 30s; status notify fires |
| **5** | All 3 portals: `tsc --noEmit` clean; full manual user flow passes for each actor |

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| GitHub rate limit (lazy trigger) | 72h result cache per applicationId + queue serialization |
| Invite code race condition (two students) | Atomic transaction: `@@unique(usedById)` + DB-level constraint |
| Wrong institution sees institution-specific job | Server-side: filter by `JobBoardEntry` inner join; never expose raw job ID to un-enrolled institution |
| pg-boss tables grow unbounded | Set `archiveCompletedAfterSeconds: 86400` (1 day retention) |
| Student applies to expired job | Guard: `job.status === OPEN && (!job.deadline \|\| job.deadline > now())` |
