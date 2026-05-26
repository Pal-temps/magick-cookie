/**
 * changelogService — Centralized service for LLM-based changelog generation.
 *
 * Moves the `POST /changelog/generate` call out of ChangelogGenerator.tsx
 * so the AI call is auditable via aiRegistry and testable independently.
 */

import { api } from "../../infrastructure/api/apiClient";

export interface ChangelogResult {
  commits: { hash: string; message: string; repo: string }[];
  changelog: string;
}

export interface ChangelogConfig {
  /** ISO date string — include commits since this date */
  since: string;
  /** Optional repository name filter */
  repo?: string;
}

export async function generateChangelog(config: ChangelogConfig): Promise<ChangelogResult> {
  const { trackAiActivity } = await import("../stores/aiActivityStore");
  const body: { since: string; repo?: string } = { since: config.since };
  if (config.repo?.trim()) body.repo = config.repo.trim();

  return trackAiActivity("Changelog IA", () =>
    api.post<ChangelogResult>("/changelog/generate", body)
  );
}
