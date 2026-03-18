export interface GitHubConfig {
  id: string;
  token: string;
  username: string;
  repos: string[];
  pollIntervalSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubPR {
  id: string;
  prNumber: number;
  repo: string;
  title: string;
  state: string; // "open", "closed", "merged"
  draft: boolean;
  author: string;
  url: string;
  reviewRequested: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRun {
  id: number;
  repo: string;
  name: string;
  branch: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}
