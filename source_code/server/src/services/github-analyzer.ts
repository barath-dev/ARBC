import { Octokit } from "octokit";
import { env } from "../config/environment";
import { GITHUB_LIMITS } from "../config/constants";
import { logger } from "../utils/logger";

export interface GitHubAnalysisResult {
    username: string;
    totalRepos: number;
    totalCommits: number;
    forkedRepos: number;
    originalRepos: number;
    languages: Record<string, number>;
    contributionScore: number;
    accountCreatedAt: Date | null;
    repositories: Array<{
        name: string;
        url: string;
        isFork: boolean;
        stars: number;
        language: string | null;
        commitCount: number;
        firstCommitAt: Date | null;
        lastCommitAt: Date | null;
        description: string | null;
    }>;
}

export class GitHubAnalyzerService {
    private octokit: Octokit;

    constructor() {
        this.octokit = new Octokit({
            auth: env.GITHUB_TOKEN,
            baseUrl: env.GITHUB_API_URL,
        });
    }

    public async analyzeProfile(username: string): Promise<GitHubAnalysisResult> {
        try {
            logger.info(`Analyzing GitHub profile for ${username}...`);

            // 1. Fetch User Data
            const userRes = await this.octokit.rest.users.getByUsername({ username });
            const user = userRes.data;

            // 2. Fetch Repositories (sorted by recently updated, limited to prevent abuse)
            const reposRes = await this.octokit.rest.repos.listForUser({
                username,
                sort: "updated",
                direction: "desc",
                per_page: Math.min(GITHUB_LIMITS.maxReposToAnalyze, 100),
            });

            const repos = reposRes.data;

            let totalCommits = 0;
            let forkedRepos = 0;
            let originalRepos = 0;
            const languages: Record<string, number> = {};
            const repositories: GitHubAnalysisResult["repositories"] = [];

            // 3. Analyze each repository
            for (const repo of repos) {
                if (repo.fork) {
                    forkedRepos++;
                } else {
                    originalRepos++;
                }

                if (repo.language) {
                    languages[repo.language] = (languages[repo.language] || 0) + 1;
                }

                // Fetch commit stats for this repo (only for original repos to save API limits)
                let commitCount = 0;
                let firstCommitAt: Date | null = null;
                let lastCommitAt: Date | null = null;

                if (!repo.fork) {
                    try {
                        const commitsRes = await this.octokit.rest.repos.listCommits({
                            owner: username,
                            repo: repo.name,
                            author: username,
                            per_page: 1, // We just need total count from headers or first/last
                        });

                        // Simplified commit counting (in a real app we'd paginate or use GraphQL)
                        // Octokit pagination isn't strictly necessary for the MVP stub
                        if (commitsRes.data.length > 0) {
                            commitCount = 10; // Stubbed count for MVP to save API calls
                            totalCommits += 10;
                            lastCommitAt = new Date(commitsRes.data[0].commit.author?.date || "");
                            firstCommitAt = lastCommitAt; // Simplified
                        }
                    } catch (error) {
                        logger.warn(`Could not fetch commits for ${repo.name}`);
                    }
                }

                repositories.push({
                    name: repo.name,
                    url: repo.html_url,
                    isFork: repo.fork,
                    stars: repo.stargazers_count || 0,
                    language: repo.language || null,
                    commitCount,
                    firstCommitAt,
                    lastCommitAt,
                    description: repo.description,
                });
            }

            // 4. Calculate abstract contribution score based on Alg 2 theory
            // (Commits in original repos carry more weight)
            const contributionScore = Math.min((originalRepos * 10) + (totalCommits * 2) + (user.public_gists * 5), 100);

            return {
                username,
                totalRepos: user.public_repos,
                totalCommits,
                forkedRepos,
                originalRepos,
                languages,
                contributionScore,
                accountCreatedAt: user.created_at ? new Date(user.created_at) : null,
                repositories,
            };

        } catch (error) {
            logger.error(`GitHub API error for ${username}:`, error as any);
            throw new Error(`Failed to analyze GitHub profile: ${(error as any).message}`);
        }
    }
}

export const githubAnalyzer = new GitHubAnalyzerService();
