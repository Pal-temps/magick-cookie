import type { GitHubPR } from "./github.entity";

// The GitHub config is stored in connector_configs (see domain/connector-config)
// — no dedicated repo interface anymore. See GitHubService for the adapter.

export interface GitHubPRRepository {
  findAll(): Promise<GitHubPR[]>;
  findByRepo(repo: string): Promise<GitHubPR[]>;
  upsert(pr: Omit<GitHubPR, "id" | "source" | "createdAt" | "updatedAt">): Promise<GitHubPR>;
  deleteById(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
