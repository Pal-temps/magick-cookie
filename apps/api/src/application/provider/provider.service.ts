// ProviderService — Phase 5 of the AI integration plan.
// Single point of access to credentials + typed clients for github / gitlab / clickup.
// Tools call this instead of touching ConnectorConfigRepository directly, so we have
// one place to enforce "is the provider configured?" and to construct clients.

import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { ConnectorType } from "../../domain/connector-config/connector-config.entity";
import { GitHubApiClient } from "../../infrastructure/connectors/github-api.client";
import { GitLabApiClient } from "../../infrastructure/connectors/gitlab-api.client";
import { ClickUpApiClient } from "../../infrastructure/connectors/clickup-api.client";

interface GitHubSettings {
  username?: string;
  repos?: string[];
}

interface GitLabSettings {
  baseUrl?: string;
}

export interface ProviderStatus {
  type: ConnectorType;
  configured: boolean;
  username: string | null;
}

export class ProviderService {
  constructor(private connectorConfigRepo: ConnectorConfigRepository) {}

  async isConfigured(type: ConnectorType): Promise<boolean> {
    const cfg = await this.connectorConfigRepo.findByType(type);
    return cfg !== null && cfg.enabled;
  }

  async getStatus(type: ConnectorType): Promise<ProviderStatus> {
    const cfg = await this.connectorConfigRepo.findByType(type);
    if (!cfg || !cfg.enabled) {
      return { type, configured: false, username: null };
    }
    const username = type === "github"
      ? (cfg.settings as GitHubSettings).username ?? null
      : null;
    return { type, configured: true, username };
  }

  async getGitHubToken(): Promise<string | null> {
    const cfg = await this.connectorConfigRepo.findByType("github");
    return cfg?.enabled ? cfg.token : null;
  }

  /** Returns null when the provider is not configured. Callers must check + return a structured error. */
  async getGitHubClient(): Promise<GitHubApiClient | null> {
    const cfg = await this.connectorConfigRepo.findByType("github");
    if (!cfg || !cfg.enabled) return null;
    const username = (cfg.settings as GitHubSettings).username ?? "";
    return new GitHubApiClient(cfg.token, username);
  }

  async getGitLabClient(): Promise<GitLabApiClient | null> {
    const cfg = await this.connectorConfigRepo.findByType("gitlab");
    if (!cfg || !cfg.enabled) return null;
    const baseUrl = (cfg.settings as GitLabSettings).baseUrl;
    return new GitLabApiClient(cfg.token, baseUrl);
  }

  async getClickUpClient(): Promise<ClickUpApiClient | null> {
    const cfg = await this.connectorConfigRepo.findByType("clickup");
    if (!cfg || !cfg.enabled) return null;
    return new ClickUpApiClient(cfg.token);
  }
}

/**
 * Standard "provider not configured" error returned by tools — uniform shape so the
 * frontend / LLM can render a single CTA pointing to settings/connectors.
 */
export const PROVIDER_NOT_CONFIGURED = (type: ConnectorType) => ({
  error: "Provider not configured",
  provider: type,
  configureUrl: "settings/connectors",
});
