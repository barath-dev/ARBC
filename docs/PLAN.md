# ARBC Frontend Plan

## 🎼 Orchestration: Phase 1 (Planning)

**Task:** Build two individual web applications (Student Portal and Recruiter Dashboard) for the ARBC system.
**Aesthetics:** Light-Themed, Premium Professional.
**Tech Stack:** Next.js (App Router), Tailwind CSS v4, `shadcn/ui`, React Query.

### 1. Architecture Decision

We will create a monorepo-style structure inside the existing `Capstone` directory but keep them as completely independent applications (not sharing a `package.json` to prevent deployment cross-contamination unless using Turborepo).

```text
/Capstone
  /source_code
    /server                (✅ DONE)
    /student-portal        (🚧 TO DO)
    /recruiter-dashboard   (🚧 TO DO)
```

### 2. Recruiter Dashboard (`recruiter-dashboard`)

**Purpose:** Admin interface for recruiters to trigger verifications and view fraud analysis reports.

**Core Pages:**
- `/login` - Recruiter Authentication
- `/` (Dashboard) - High-level metrics (Total checks, flagged profiles)
- `/students` - Search and list all student profiles
- `/verification/[id]` - Detailed report view (Risk Score, Algorithmic visual breakdown, Timeline flags)

**shadcn/ui Components Needed:**
- `DataTable` (for student lists)
- `Card`, `Badge` (for risk scores)
- `Progress` (for algorithm confidence meters)
- `Tabs` (to segregate GitHub, OCR, and Company Evidence)

### 3. Student Portal (`student-portal`)

**Purpose:** Lightweight data entry portal for students to build their verified profile.

**Core Pages:**
- `/login` & `/register` - Student Onboarding
- `/` (Profile Editor) - Sections for Resume Upload, GitHub Link, and Employment Claims adding.
- `/status` - Read-only view of their current verification status.

**shadcn/ui Components Needed:**
- `Form`, `Input`, `Select` (for data entry)
- `Dialog` (for adding new employment claims)
- `Toast` (for success/error feedback)

### 4. Design System (Light Theme)

Following the `@frontend-design` principles:
- **Background:** `bg-slate-50` (soft, anti-glare white).
- **Cards/Surfaces:** `bg-white` with `shadow-sm` and `border-slate-200`.
- **Primary Accent:** Deep Blue/Slate (`slate-900`) instead of generic tech blue.
- **Risk Colors:** 
  - Low Risk: `emerald-600`
  - Medium Risk: `amber-500`
  - High Risk: `rose-600`
- **Typography:** `Inter` or `Geist Sans`. Readability prioritized.

### 5. Implementation Phases (Orchestration Phase 2)

Once this plan is approved, we will invoke multiple agents in parallel:

1. **`frontend-specialist`**: Scaffolds both Next.js applications and installs `shadcn/ui`.
2. **`frontend-specialist`**: Implements the Light-Themed Design System and global CSS.
3. **`test-engineer` / `web-design-guidelines`**: Audits the accessibility, contrast ratios, and structural layout of the scaffolds.
4. **`frontend-specialist`**: Builds out the Recruiter Dashboard Pages.
5. **`frontend-specialist`**: Builds out the Student Portal Pages.
6. **`security-auditor`**: Runs `ux_audit.py` and `security_scan.py`.
