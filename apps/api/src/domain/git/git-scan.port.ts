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

export interface GitScanPort {
  getCommitsSince(repoPath: string, since: string): Promise<{ hash: string; message: string }[]>;
}
