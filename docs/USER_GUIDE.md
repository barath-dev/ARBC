# ARBC User Guide

Welcome to the Algorithmic Resume Background Checker (ARBC). This system is composed of two independent web applications: the **Student Portal** and the **Recruiter Dashboard**.

This guide explains how to operate both applications to perform end-to-end credential verification.

---

## 🏃‍♂️ Prerequisites & Starting the Systems

Before using the UI, ensure your backend and both frontend servers are running:

1. **Start the Backend API:**
   ```bash
   cd source_code/server
   npm run dev
   ```
   *(Runs on `http://localhost:3000`)*

2. **Start the Student Portal:**
   ```bash
   cd source_code/student-portal
   pnpm run dev
   ```
   *(Runs on `http://localhost:3001` — adjust port if needed)*

3. **Start the Recruiter Dashboard:**
   ```bash
   cd source_code/recruiter-dashboard
   pnpm run dev
   ```
   *(Runs on `http://localhost:3002` — adjust port if needed)*

---

## 🎓 1. Student Portal Guide
**Purpose:** Data entry for students to declare their skills, link repositories, and monitor background check statuses.

### Flow 1: Onboarding
1. Navigate to the Student Portal URL (e.g., `http://localhost:3001`).
2. If it's your first time, click **Register here** to create an account. The system automatically assigns you the `STUDENT` role.
3. If returning, log in with your credentials.

### Flow 2: Building Your Verifiable Profile
Once logged in, you will be on the **Profile Editor**.
1. **Link GitHub:** Under the *Developer Portfolio* card, enter your GitHub Username (e.g., `torvalds`) and click **Save**. This allows the ARBC engine to fetch your public repositories and languages to cross-validate your claimed skills.
2. **Add Experiences:** Click the **+ Add Experience** button.
3. Select either **Internship** or **Project**.
4. Fill in the organization, dates, and—most importantly—the **Summary of Skills Used** (e.g., "Built a backend using Node.js and TypeScript"). The engine uses natural language processing to extract the skills from this description.
5. Save the claim.

### Flow 3: Tracking Verifications
1. Click **Verification Status** in the sidebar.
2. This is a read-only list. When a recruiter runs a background check on you, it will appear here.
3. The status will update from `PENDING` to `COMPLETED` once the algorithmic processing finishes.

---

## 🏢 2. Recruiter Dashboard Guide
**Purpose:** Administrative tools for HR/Recruiters to view candidate pools, trigger algorithmic verification, and read deep-dive fraud analysis reports.

### Flow 1: Recruiter Login
1. Navigate to the Recruiter Dashboard URL (e.g., `http://localhost:3002`).
2. Log in using an account with the `RECRUITER` role. *(Note: If you need to scaffold a test Recruiter, you must currently seed this directly in the database as the UI only allows Student registration).*

### Flow 2: Dashboard Overview
1. The default view is the **Overview Dashboard**.
2. Here you can see top-level metrics: Total Students, Total Verifications Run, High-Risk Profiles, etc.
3. The **Recent Verifications** table shows the latest candidates processed and their Overall Risk Score.

### Flow 3: Running a Verification
1. Click **Students & Reports** in the sidebar.
2. Use the search bar to find candidates by Name or Email.
3. Click the **Run Verification** button next to a student.
4. The system will dispatch the algorithmic pipeline:
   - It fetches the student's claimed skills from the database.
   - It scrapes the student's linked GitHub account.
   - It runs the `Temporal Consistency`, `Skills Cross-Validator`, and `Fraud Scoring` algorithms.
5. Upon completion, you will be automatically redirected to the detailed **Verification Report**.

### Flow 4: Analyzing the Report
The Verification Report is the core of ARBC:
1. **Top Bar:** Displays the **Overall Risk Score** percentage and a color-coded visual indicator (Green for Low Risk, Red for High Risk).
2. **Algorithm Breakdown:** Shows individual confidence scores for Temporal Consistency (timeline logic), Skills Validation, and Document Authenticity.
3. **Deep Dive Tabs:**
   - **Flags & Inconsistencies:** Lists any red flags the algorithms found (e.g., "Claimed TypeScript but 0 repos contain it").
   - **Verified Skills:** A granular breakdown of every claimed skill mapped to the specific GitHub repositories where code evidence was found.
   - **Raw Evidence:** Raw JSON outputs from the data collection services for maximum transparency.

---

## 🔁 Typical E2E Scenario
1. **Student** registers and adds "React" and "TypeScript" to their claims.
2. **Student** links their GitHub username.
3. **Recruiter** logs in, searches for the Student, and clicks "Run Verification".
4. ARBC Engine executes.
5. **Recruiter** reviews the report and sees a `15% Overall Risk Score` (Low Risk) because the algorithms successfully found React/TS code in the student's repositories.
6. **Student** checks their status page and sees a "Evaluated" badge next to their background check.
