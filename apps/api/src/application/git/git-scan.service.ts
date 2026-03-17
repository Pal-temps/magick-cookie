import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitCommit {
  hash: string;
  message: string;
  repo: string;
}

export interface GitActivity {
  commits: GitCommit[];
  repoCount: number;
  totalCommits: number;
}

export class GitScanService {
  constructor(private repoPaths: string[]) {}

  async scanSince(since: Date): Promise<GitActivity> {
    const sinceStr = since.toISOString().split("T")[0];
    const allCommits: GitCommit[] = [];

    for (const repoPath of this.repoPaths) {
      try {
        const { stdout } = await execAsync(
          `git -C "${repoPath}" log --since="${sinceStr}" --oneline --no-merges --format="%h %s"`,
          { timeout: 5000 },
        );
        const lines = stdout.trim().split("\n").filter(Boolean);
        const repoName = repoPath.split(/[/\\]/).pop() || repoPath;
        for (const line of lines) {
          const spaceIdx = line.indexOf(" ");
          allCommits.push({
            hash: line.substring(0, spaceIdx),
            message: line.substring(spaceIdx + 1),
            repo: repoName,
          });
        }
      } catch {
        // Skip repos that fail (not found, not a git repo, etc.)
      }
    }

    const repos = new Set(allCommits.map((c) => c.repo));
    return { commits: allCommits, repoCount: repos.size, totalCommits: allCommits.length };
  }
}
