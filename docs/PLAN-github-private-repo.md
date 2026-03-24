# GitHub Private Repo Access & Analysis — Implementation Plan

**Project Type:** BACKEND (TypeScript / Express / Prisma)  
**Plan File:** `docs/PLAN-github-private-repo.md`

---

## Overview

The ARBC verification pipeline currently analyses a student's GitHub profile using a **GitHub App** (app-level Octokit). The student's OAuth `githubAccessToken` is already persisted in the `students` table, but it is never passed to the `GitHubAnalyzerService`. This means **private repositories are invisible** to the analyzer — silently failing or returning 404s.

This plan upgrades the pipeline to use the student's own OAuth token for private-repo access, encrypts tokens at rest, persists risk scores in the database, and expands OAuth scopes.

---

## Success Criteria

- [ ] Private repositories owned by the student are included in `analyzeProfile()` results.
- [ ] GitHub OAuth flow requests `repo` scope so private repos are readable.
- [ ] `githubAccessToken` is AES-256-GCM encrypted in the database.
- [ ] The token is never returned in any API response payload.
- [ ] `GitHubAnalysis.githubRisk` and `Repository.repoRisk` are persisted after each verification run.
- [ ] Build passes with zero TypeScript errors after all changes.
- [ ] Prisma migration applies cleanly.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Analyzer | `octokit` – user token auth | GitHub user token grants private repo access; App token does not |
| Encryption | Node.js `crypto` (AES-256-GCM) | Built-in, no extra dependency; GCM provides authenticated encryption |
| DB | Prisma + PostgreSQL migration | Already in use; only adding nullable Float fields |

---

## File Structure (Affected Files)

```
source_code/server/
├── prisma/
│   └── schema.prisma                      [MODIFY] — add githubRisk, repoRisk fields
├── src/
│   ├── config/
│   │   └── environment.ts                 [MODIFY] — add GITHUB_TOKEN_ENCRYPTION_KEY
│   ├── controllers/
│   │   ├── auth.controller.ts             [MODIFY] — scope upgrade + encrypt on store
│   │   └── student.controller.ts          [MODIFY] — decrypt on use, exclude token from response
│   ├── services/
│   │   ├── github-analyzer.ts             [MODIFY] — user OAuth token support, private repo listing
│   │   └── verification-orchestrator.ts  [MODIFY] — token pass-through + persist risk scores
│   └── utils/
│       └── github-token-crypto.ts         [NEW]    — encryptToken / decryptToken helpers
```

---

## Task Breakdown

### Phase 1 — FOUNDATION (P0)

---

#### TASK-1: DB Schema Migration
- **Agent:** `backend-specialist`
- **Skill:** `database-design`
- **Priority:** P0 (must land before any code tries to save risk scores)
- **INPUT:** `schema.prisma` current state
- **OUTPUT:** New Prisma migration adding:
  - `GitHubAnalysis.githubRisk Float @default(0)`
  - `GitHubAnalysis.rFork Float @default(0)`
  - `GitHubAnalysis.rPattern Float @default(0)`
  - `GitHubAnalysis.rComplexity Float @default(0)`
  - `Repository.repoRisk Float @default(0)`
- **VERIFY:** `prisma migrate dev` applies without error; `prisma studio` shows new columns.
- **ROLLBACK:** `prisma migrate reset` (dev only) or write a `DOWN` migration.

---

#### TASK-2: Token Encryption Utility
- **Agent:** `security-auditor`
- **Skill:** `vulnerability-scanner`
- **Priority:** P0 (blocks all token handling tasks)
- **INPUT:** None (new file)
- **OUTPUT:** `utils/github-token-crypto.ts` with `encryptToken(plaintext: string): string` and `decryptToken(ciphertext: string): string` using AES-256-GCM. IV prepended to output.
- **ENV:** Reads `GITHUB_TOKEN_ENCRYPTION_KEY` (32-byte hex string, 64 hex chars).
- **VERIFY:** Unit test round-trip: `decryptToken(encryptToken("gh_abc123")) === "gh_abc123"`.
- **ROLLBACK:** Remove file; revert callers.

---

#### TASK-3: Environment Config Update
- **Agent:** `backend-specialist`
- **Skill:** `clean-code`
- **Priority:** P0
- **INPUT:** `config/environment.ts`
- **OUTPUT:** `GITHUB_TOKEN_ENCRYPTION_KEY: z.string().length(64).optional()` added to env schema. Update `.env.example` with placeholder.
- **VERIFY:** Server starts without error; `env.GITHUB_TOKEN_ENCRYPTION_KEY` accessible.
- **ROLLBACK:** Revert env schema; existing code unaffected (field was not previously read).

---

### Phase 2 — CORE (P1)

---

#### TASK-4: OAuth Scope Upgrade
- **Agent:** `backend-specialist`
- **Skill:** `api-patterns`
- **Priority:** P1
- **Dependencies:** TASK-3
- **INPUT:** `auth.controller.ts` line 159 — existing OAuth URL construction
- **OUTPUT:** Add `scope=repo%2Cread%3Auser` to the authorization URL. Add `prompt=consent` (already present).
- **VERIFY:** Clicking "Connect GitHub" redirects to GitHub with `scope=repo` visible in URL.
- **ROLLBACK:** Remove scope param. Students reconnect with old scope (only degrades private-repo access, not auth).

---

#### TASK-5: Encrypt Token on Store
- **Agent:** `security-auditor`
- **Skill:** `vulnerability-scanner`
- **Priority:** P1
- **Dependencies:** TASK-2, TASK-3
- **INPUT:** `auth.controller.ts` line 253 — `data: { githubUsername, githubAccessToken: accessToken }`
- **OUTPUT:** `data: { githubUsername, githubAccessToken: encryptToken(accessToken) }`
- **VERIFY:** After connecting GitHub, querying the DB directly shows an encrypted blob (not a plain `ghp_*` token).
- **ROLLBACK:** Remove `encryptToken` call. Existing encrypted rows in DB will break — need migration script to clear tokens if rolling back.

---

#### TASK-6: GitHubAnalyzerService — Private Repo Support
- **Agent:** `backend-specialist`
- **Skill:** `api-patterns`
- **Priority:** P1
- **Dependencies:** TASK-1 (new types), TASK-2 (decrypt)
- **INPUT:** `services/github-analyzer.ts`
- **OUTPUT:**
  - New `getOctokitForUser(username, oauthToken?)` helper.
  - `analyzeProfile(username, claimedRepoUrls, userOAuthToken?)` uses user Octokit when token provided.
  - When user token provided, switch from `repos.listForUser` to `repos.listForAuthenticatedUser` to include private repos.
  - Existing App-token fallback preserved when `oauthToken` is undefined.
- **VERIFY:** Integration test: with a user token having `repo` scope, `analyzeProfile` includes at least one private repo in `repositories[]`.
- **ROLLBACK:** Revert method signatures; orchestrator stops passing token.

---

#### TASK-7: Persist Risk Scores in Orchestrator
- **Agent:** `backend-specialist`
- **Skill:** `clean-code`
- **Priority:** P1
- **Dependencies:** TASK-1 (schema fields), TASK-6 (new result shape)
- **INPUT:** `services/verification-orchestrator.ts` — the `prisma.gitHubAnalysis.create()` call
- **OUTPUT:**
  - Decrypt `student.githubAccessToken` before passing to `analyzeProfile`.
  - Add `githubRisk`, `rFork`, `rPattern`, `rComplexity` to `gitHubAnalysis.create()`.
  - Add `repoRisk` to each entry in `repositories.create`.
- **VERIFY:** After triggering verification, `GET /api/verification/{id}` returns `githubAnalysis.githubRisk` as a number (not null/0 by default).
- **ROLLBACK:** Revert to not passing token; remove new fields from create call.

---

### Phase 3 — POLISH (P2)

---

#### TASK-8: Exclude Token from API Responses
- **Agent:** `security-auditor`
- **Skill:** `vulnerability-scanner`
- **Priority:** P2
- **INPUT:** `controllers/student.controller.ts` — `getMyProfile()` (line 268), `listStudents()`, `getStudentById()`
- **OUTPUT:** Add `select: { githubAccessToken: false }` or use explicit `select` to omit the token field from all student queries returned to clients.
- **VERIFY:** `GET /api/students/me` response JSON has no `githubAccessToken` key.
- **ROLLBACK:** Revert select statements (minor risk — token re-exposed, but app still works).

---

#### TASK-9: Decrypt Token in verifyRepo
- **Agent:** `backend-specialist`
- **Skill:** `clean-code`
- **Priority:** P2
- **Dependencies:** TASK-2, TASK-5
- **INPUT:** `controllers/student.controller.ts` `verifyRepo()` line 89-90
- **OUTPUT:** Wrap `student.githubAccessToken` with `decryptToken()` before placing in `authHeaders`.
- **VERIFY:** `GET /api/students/me/verify-repo?url=https://github.com/user/private-repo` returns `verified: true` when student has valid token.
- **ROLLBACK:** Remove `decryptToken` call; unencrypted tokens still work (requires TASK-5 rollback too).

---

### Phase X — Verification

- [ ] `cd source_code/server && npm run build` → 0 TypeScript errors
- [ ] `npx prisma migrate dev` → migration applies cleanly
- [ ] Unit tests: `encryptToken`/`decryptToken` round-trip ✅
- [ ] Manual: OAuth flow with private repo scope ✅
- [ ] Manual: `verifyRepo` returns `true` for a private repo ✅
- [ ] Manual: `GET /api/verification/{id}` shows `githubRisk` populated ✅
- [ ] Manual: `GET /api/students/me` response has no `githubAccessToken` ✅
- [ ] `python .agent/skills/vulnerability-scanner/scripts/security_scan.py source_code/server` → no critical issues

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Students must re-authorize GitHub | HIGH | MEDIUM | Show clear prompt in UI; one-click reconnect flow already exists |
| Encryption key management | MEDIUM | HIGH | Store key in environment/secrets manager; rotate carefully |
| GitHub token expiry | LOW | MEDIUM | Handle 401 in analyzer with graceful fallback; consider token refresh |
| Rate limits with user token | LOW | LOW | Existing `GITHUB_LIMITS` constants already throttle requests |
