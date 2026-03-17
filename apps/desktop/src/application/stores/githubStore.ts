import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";

export interface GitHubPR {
  id: string;
  prNumber: number;
  repo: string;
  title: string;
  state: string;
  draft: boolean;
  author: string;
  url: string;
  reviewRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConfig {
  id: string;
  token: string;
  username: string;
  repos: string[];
  pollIntervalSeconds: number;
  createdAt: string;
  updatedAt: string;
}

const [prs, setPrs] = createSignal<GitHubPR[]>([]);
const [config, setConfig] = createSignal<GitHubConfig | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [isSyncing, setIsSyncing] = createSignal(false);

export function useGitHubStore() {
  async function fetchPRs() {
    setIsLoading(true);
    try {
      const data = await api.get<GitHubPR[]>("/github/prs");
      setPrs(data);
    } catch (err) {
      console.error("Failed to fetch GitHub PRs:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchConfig() {
    try {
      const data = await api.get<GitHubConfig | null>("/github/config");
      setConfig(data);
    } catch (err) {
      console.error("Failed to fetch GitHub config:", err);
    }
  }

  async function saveConfig(input: { token: string; username: string; repos: string[] }) {
    const data = await api.put<GitHubConfig>("/github/config", input);
    setConfig(data);
    return data;
  }

  async function deleteConfig() {
    await api.delete("/github/config");
    setConfig(null);
    setPrs([]);
  }

  async function syncPRs() {
    setIsSyncing(true);
    try {
      const data = await api.post<GitHubPR[]>("/github/sync", {});
      setPrs(data);
      return data;
    } catch (err) {
      console.error("Failed to sync GitHub PRs:", err);
      return [];
    } finally {
      setIsSyncing(false);
    }
  }

  return {
    prs,
    config,
    isLoading,
    isSyncing,
    fetchPRs,
    fetchConfig,
    saveConfig,
    deleteConfig,
    syncPRs,
  };
}
