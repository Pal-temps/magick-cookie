// Read-only shape used by the GitHub routes to expose the connector config.
// The actual config is stored in `connector_configs` (see domain/connector-config),
// this type just documents the projection the legacy /github/config endpoint serves.
export interface GitHubConfig {
  id: string;
  token: string;
  username: string;
  repos: string[];
  pollIntervalSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

// Synced PR cache entry (source=github today, future providers can reuse the table).
export interface GitHubPR {
  id: string;
  source: string;
  externalId: string;
  prNumber: number;
  repo: string;
  title: string;
  state: string; // "open", "closed", "merged", "draft"
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
