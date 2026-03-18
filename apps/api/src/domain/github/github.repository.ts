import type { GitHubConfig, GitHubPR } from "./github.entity";

export interface GitHubConfigRepository {
  get(): Promise<GitHubConfig | null>;
  save(input: { token: string; username: string; repos: string[] }): Promise<GitHubConfig>;
  delete(): Promise<void>;
}

export interface GitHubPRRepository {
  findAll(): Promise<GitHubPR[]>;
  findByRepo(repo: string): Promise<GitHubPR[]>;
  upsert(pr: Omit<GitHubPR, "id" | "createdAt" | "updatedAt">): Promise<GitHubPR>;
  deleteById(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
