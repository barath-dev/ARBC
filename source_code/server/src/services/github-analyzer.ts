import { App, Octokit } from "octokit";
import { env } from "../config/environment";
import { GITHUB_LIMITS, GITHUB_RISK_WEIGHTS, BURST_WINDOW_DAYS } from "../config/constants";
import { logger } from "../utils/logger";

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface RepoContributionStats {
    name: string;
    url: string;
    isFork: boolean;
    stars: number;
    language: string | null;
    languages: Record<string, number>;   // bytes per language
    commitCount: number;
    firstCommitAt: Date | null;
    lastCommitAt: Date | null;
    description: string | null;
    isPrivate: boolean;
    /** 0.0 (no suspicion) → 1.0 (very suspicious) for this individual repo */
    repoRisk: number;
}

export interface GitHubAnalysisResult {
    username: string;
    totalRepos: number;
    totalCommits: number;
    forkedRepos: number;
    originalRepos: number;
    languages: Record<string, number>;
    contributionScore: number;
    accountCreatedAt: Date | null;
    repositories: RepoContributionStats[];
    /**
     * Computed rG value from RP.pdf Algorithm 2:
     * rG = 0.4·r_fork + 0.3·r_pattern + 0.3·r_complexity
     * Range: 0.0 (legitimate) → 1.0 (high fraud risk)
     */
    githubRisk: number;
    /** Individual sub-scores exposed for transparency / audit logs. */
    riskBreakdown: {
        rFork: number;
        rPattern: number;
        rComplexity: number;
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parses `https://github.com/owner/repo` → `{ owner, repo }`. Returns null if invalid. */
function parseRepoUrl(url: string): { owner: string; repo: string } | null {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes("github.com")) return null;
        const parts = parsed.pathname.replace(/^\//, "").split("/");
        if (parts.length < 2 || !parts[0] || !parts[1]) return null;
        return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
    } catch {
        return null;
    }
}

/** Milliseconds → days */
const msToDays = (ms: number) => ms / (1000 * 60 * 60 * 24);

// ─── Service ─────────────────────────────────────────────────────────────────

export class GitHubAnalyzerService {
    private app: App;

    constructor() {
        this.app = new App({
            appId: env.GITHUB_APP_ID || "",
            privateKey: env.GITHUB_APP_PRIVATE_KEY || "",
        });
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /**
     * Returns an authenticated Octokit instance for the given user.
     *
     * Priority:
     * 1. User's own OAuth token (full private-repo access) — used when `oauthToken` is provided.
     * 2. GitHub App installation token (public-repo access only) — fallback.
     */
    private async getOctokitForUser(username: string, oauthToken?: string): Promise<Octokit> {
        if (oauthToken) {
            return new Octokit({ auth: oauthToken });
        }

        // Fallback: GitHub App flow (public repos only)
        try {
            const { data: installation } = await this.app.octokit.rest.apps.getUserInstallation({ username });
            return await this.app.getInstallationOctokit(installation.id) as unknown as Octokit;
        } catch {
            logger.warn(`No GitHub App installation for ${username} and no OAuth token. Using unauthenticated app API.`);
            return this.app.octokit as unknown as Octokit;
        }
    }

    /**
     * Fetches all commits authored by `authorUsername` in `owner/repo`, up to
     * GITHUB_LIMITS.requestsPerStudent pages (100 commits/page).
     * Returns commit dates for burst-pattern detection.
     */
    private async fetchCommitDates(
        octokit: Octokit,
        owner: string,
        repo: string,
        authorUsername: string
    ): Promise<Date[]> {
        const dates: Date[] = [];
        let page = 1;
        const maxPages = Math.ceil(GITHUB_LIMITS.requestsPerStudent / 100);

        while (page <= maxPages) {
            try {
                const res = await octokit.rest.repos.listCommits({
                    owner,
                    repo,
                    author: authorUsername,
                    per_page: 100,
                    page,
                });

                if (res.data.length === 0) break;

                for (const commit of res.data) {
                    const dateStr = commit.commit.author?.date;
                    if (dateStr) dates.push(new Date(dateStr));
                }

                if (res.data.length < 100) break; // last page
                page++;
            } catch (err) {
                logger.warn(`Could not fetch commits page ${page} for ${owner}/${repo}: ${(err as any).message}`);
                break;
            }
        }

        return dates;
    }

    /**
     * Detects a "burst" pattern — all commits land within BURST_WINDOW_DAYS.
     * Returns true (suspicious) when the entire commit history spans ≤ BURST_WINDOW_DAYS.
     */
    private isBurstPattern(dates: Date[]): boolean {
        if (dates.length < 2) return false;
        const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
        const spanDays = msToDays(sorted[sorted.length - 1].getTime() - sorted[0].getTime());
        return spanDays <= BURST_WINDOW_DAYS;
    }

    /**
     * Fetches language bytes for `owner/repo` and returns a normalised diversity
     * score: 0.0 = single-language (more suspicious), 1.0 = many languages.
     */
    private async fetchLanguageDiversity(
        octokit: Octokit,
        owner: string,
        repo: string
    ): Promise<{ languages: Record<string, number>; diversityScore: number }> {
        try {
            const res = await octokit.rest.repos.listLanguages({ owner, repo });
            const languages = res.data as Record<string, number>;
            const count = Object.keys(languages).length;
            // Log-scale normalisation — 1 lang → 0.0, 5+ langs → ~0.8, 10+ → ~1.0
            const diversityScore = count <= 1 ? 0 : Math.min(1.0, Math.log2(count) / Math.log2(10));
            return { languages, diversityScore };
        } catch {
            return { languages: {}, diversityScore: 0.5 }; // neutral if API fails
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Analyses a **specific repository** to produce contribution stats for the
     * given student (identified by `studentUsername`).
     *
     * When `userOAuthToken` is provided, private repositories are accessible.
     * Called per PROJECT/INTERNSHIP claim that includes a `repoUrl`.
     */
    public async analyzeRepoContributions(
        repoUrl: string,
        studentUsername: string,
        userOAuthToken?: string
    ): Promise<RepoContributionStats> {
        const parsed = parseRepoUrl(repoUrl);
        if (!parsed) throw new Error(`Invalid GitHub repo URL: ${repoUrl}`);

        const { owner, repo } = parsed;
        logger.info(`Analyzing repo contributions: ${owner}/${repo} for ${studentUsername}`);

        const octokit = await this.getOctokitForUser(studentUsername, userOAuthToken);

        // Fetch repo metadata
        const repoRes = await octokit.rest.repos.get({ owner, repo });
        const repoData = repoRes.data;

        // Fetch student's commit history for this repo
        const commitDates = await this.fetchCommitDates(octokit, owner, repo, studentUsername);
        const commitCount = commitDates.length;
        const sortedDates = [...commitDates].sort((a, b) => a.getTime() - b.getTime());
        const firstCommitAt = sortedDates.length > 0 ? sortedDates[0] : null;
        const lastCommitAt = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

        // Burst pattern detection
        const burst = this.isBurstPattern(commitDates);

        // Language diversity
        const { languages, diversityScore } = await this.fetchLanguageDiversity(octokit, owner, repo);

        // Per-repo risk: average the burst and complexity signals
        const rPattern = burst ? 1.0 : 0.0;
        const rComplexity = 1.0 - diversityScore;
        const repoRisk = parseFloat(
            (GITHUB_RISK_WEIGHTS.pattern * rPattern + GITHUB_RISK_WEIGHTS.complexity * rComplexity).toFixed(3)
        );

        return {
            name: repoData.name,
            url: repoData.html_url,
            isFork: repoData.fork,
            stars: repoData.stargazers_count ?? 0,
            language: repoData.language ?? null,
            languages,
            commitCount,
            firstCommitAt,
            lastCommitAt,
            description: repoData.description ?? null,
            isPrivate: repoData.private,
            repoRisk,
        };
    }

    /**
     * Algo 2 — Profile-level GitHub legitimacy risk (rG).
     *
     * Analyses the student's profile AND any claimed project repos.
     * Returns a full GitHubAnalysisResult including the computed `githubRisk`
     * that maps directly to `rG` in the paper's fraud formula.
     *
     * rG = 0.4·r_fork + 0.3·r_pattern + 0.3·r_complexity
     *
     * @param userOAuthToken — When provided, private repositories are included
     *   in the analysis using the student's own OAuth token.
     */
    public async analyzeProfile(
        username: string,
        claimedRepoUrls: string[] = [],
        userOAuthToken?: string
    ): Promise<GitHubAnalysisResult> {
        logger.info(`Analyzing GitHub profile for ${username}${userOAuthToken ? " (with OAuth token — private repos included)" : " (public repos only)"}...`);

        const octokit = await this.getOctokitForUser(username, userOAuthToken);

        // ── 1. User profile ──────────────────────────────────────────────────
        const userRes = await octokit.rest.users.getByUsername({ username });
        const user = userRes.data;

        // ── 2. Repo listing ──────────────────────────────────────────────────
        // When using the user's own OAuth token, listForAuthenticatedUser returns
        // private repos too. listForUser only returns public repos.
        let repos: any[];
        if (userOAuthToken) {
            const reposRes = await octokit.rest.repos.listForAuthenticatedUser({
                sort: "updated",
                direction: "desc",
                per_page: Math.min(GITHUB_LIMITS.maxReposToAnalyze, 100),
                affiliation: "owner",
            });
            repos = reposRes.data;
        } else {
            const reposRes = await octokit.rest.repos.listForUser({
                username,
                sort: "updated",
                direction: "desc",
                per_page: Math.min(GITHUB_LIMITS.maxReposToAnalyze, 100),
            });
            repos = reposRes.data;
        }

        let totalCommits = 0;
        let forkedRepos = 0;
        let originalRepos = 0;
        const aggregatedLanguages: Record<string, number> = {};
        const repositories: RepoContributionStats[] = [];

        let burstCount = 0; // repos showing burst commit patterns

        // ── 3. Per-repo analysis ─────────────────────────────────────────────
        for (const repo of repos) {
            if (repo.fork) {
                forkedRepos++;
            } else {
                originalRepos++;
            }

            const { languages, diversityScore } = await this.fetchLanguageDiversity(octokit, repo.owner.login, repo.name);
            for (const [lang, bytes] of Object.entries(languages)) {
                aggregatedLanguages[lang] = (aggregatedLanguages[lang] ?? 0) + (bytes as number);
            }

            let commitCount = 0;
            let firstCommitAt: Date | null = null;
            let lastCommitAt: Date | null = null;
            let repoRisk = 0;

            if (!repo.fork) {
                try {
                    const commitDates = await this.fetchCommitDates(octokit, repo.owner.login, repo.name, username);
                    commitCount = commitDates.length;
                    totalCommits += commitCount;

                    const sorted = [...commitDates].sort((a, b) => a.getTime() - b.getTime());
                    firstCommitAt = sorted[0] ?? null;
                    lastCommitAt = sorted[sorted.length - 1] ?? null;

                    const burst = this.isBurstPattern(commitDates);
                    if (burst) burstCount++;

                    const rPattern = burst ? 1.0 : 0.0;
                    const rComplexity = 1.0 - diversityScore;
                    repoRisk = parseFloat(
                        (GITHUB_RISK_WEIGHTS.pattern * rPattern + GITHUB_RISK_WEIGHTS.complexity * rComplexity).toFixed(3)
                    );
                } catch (err) {
                    logger.warn(`Skipped commit analysis for ${repo.name}: ${(err as any).message}`);
                }
            }

            repositories.push({
                name: repo.name,
                url: repo.html_url,
                isFork: repo.fork,
                stars: repo.stargazers_count ?? 0,
                language: repo.language ?? null,
                languages,
                commitCount,
                firstCommitAt,
                lastCommitAt,
                description: repo.description ?? null,
                isPrivate: repo.private ?? false,
                repoRisk,
            });
        }

        // ── 4. Analyse specific claimed repo URLs (PROJECT claims) ───────────
        for (const repoUrl of claimedRepoUrls) {
            const parsed = parseRepoUrl(repoUrl);
            if (!parsed) continue;

            // Skip if already covered by the profile listing
            const alreadyAnalysed = repositories.some(
                (r) => r.url.toLowerCase() === repoUrl.toLowerCase()
            );
            if (alreadyAnalysed) continue;

            try {
                const stats = await this.analyzeRepoContributions(repoUrl, username, userOAuthToken);
                repositories.push(stats);
                totalCommits += stats.commitCount;
                if (stats.isFork) forkedRepos++;
                else originalRepos++;
                for (const [lang, bytes] of Object.entries(stats.languages)) {
                    aggregatedLanguages[lang] = (aggregatedLanguages[lang] ?? 0) + bytes;
                }
                if (this.isBurstPattern(
                    stats.firstCommitAt && stats.lastCommitAt ? [stats.firstCommitAt, stats.lastCommitAt] : []
                )) {
                    burstCount++;
                }
            } catch (err) {
                logger.warn(`Could not analyse claimed repo ${repoUrl}: ${(err as any).message}`);
            }
        }

        // ── 5. Compute rG sub-scores (RP.pdf Algorithm 2) ───────────────────
        const analysedOriginal = repositories.filter((r) => !r.isFork);
        const totalAnalysed = repositories.length;

        // r_fork: ratio of forked to total repos (higher fork ratio = riskier)
        const rFork = totalAnalysed > 0 ? forkedRepos / totalAnalysed : 0;

        // r_pattern: proportion of original repos showing bursty commits
        const rPattern = analysedOriginal.length > 0 ? burstCount / analysedOriginal.length : 0;

        // r_complexity: average per-repo risk (which encodes complexity contribution)
        const avgRepoComplexity = analysedOriginal.length > 0
            ? analysedOriginal.reduce((sum, r) => sum + r.repoRisk, 0) / analysedOriginal.length
            : 0;

        const githubRisk = parseFloat((
            GITHUB_RISK_WEIGHTS.fork * rFork +
            GITHUB_RISK_WEIGHTS.pattern * rPattern +
            GITHUB_RISK_WEIGHTS.complexity * avgRepoComplexity
        ).toFixed(3));

        // Legacy contributionScore kept for backward-compat display (0–100)
        const contributionScore = Math.min(
            (originalRepos * 10) + (totalCommits * 2) + (user.public_gists * 5),
            100
        );

        return {
            username,
            totalRepos: user.public_repos,
            totalCommits,
            forkedRepos,
            originalRepos,
            languages: aggregatedLanguages,
            contributionScore,
            accountCreatedAt: user.created_at ? new Date(user.created_at) : null,
            repositories,
            githubRisk,
            riskBreakdown: {
                rFork: parseFloat(rFork.toFixed(3)),
                rPattern: parseFloat(rPattern.toFixed(3)),
                rComplexity: parseFloat(avgRepoComplexity.toFixed(3)),
            },
        };
    }
}

export const githubAnalyzer = new GitHubAnalyzerService();
