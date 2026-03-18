import type { GitScanPort, GitCommit, GitActivity } from "../../domain/git/git-scan.port";

export type { GitCommit, GitActivity };

export class GitScanService {
  constructor(private repoPaths: string[], private gitScanner: GitScanPort) {}

  async scanSince(since: Date): Promise<GitActivity> {
    const sinceStr = since.toISOString().split("T")[0];
    const allCommits: GitCommit[] = [];

    for (const repoPath of this.repoPaths) {
      const repoName = repoPath.split(/[/\\]/).pop() || repoPath;
      const commits = await this.gitScanner.getCommitsSince(repoPath, sinceStr);
      for (const c of commits) {
        allCommits.push({ ...c, repo: repoName });
      }
    }

    const repos = new Set(allCommits.map((c) => c.repo));
    return { commits: allCommits, repoCount: repos.size, totalCommits: allCommits.length };
  }
}
