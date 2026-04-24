import { describe, it, expect, mock, beforeEach } from "bun:test";
import { GitHubService } from "../../application/github/github.service";
import type { ConnectorConfig } from "../../domain/connector-config/connector-config.entity";
import type { GitHubPR } from "../../domain/github/github.entity";

const NOW = new Date("2026-04-25T10:00:00Z");

function makeConnector(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: "conn-1",
    type: "github",
    token: "ghp_secret",
    settings: { username: "alice", repos: ["owner/repo"], syncIssues: true, syncPRs: true },
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePR(overrides: Partial<GitHubPR> = {}): GitHubPR {
  return {
    id: "pr-1",
    source: "github",
    externalId: "owner/repo#42",
    prNumber: 42,
    repo: "owner/repo",
    title: "Fix bug",
    state: "open",
    draft: false,
    author: "bob",
    url: "https://github.com/owner/repo/pull/42",
    reviewRequested: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createMocks() {
  return {
    connectorRepo: {
      findByType: mock(() => Promise.resolve(null as ConnectorConfig | null)),
      findAll: mock(() => Promise.resolve([])),
      upsert: mock((input: { type: "github"; token: string; settings: Record<string, unknown> }) =>
        Promise.resolve(makeConnector({ token: input.token, settings: input.settings })),
      ),
      delete: mock(() => Promise.resolve()),
    },
    prRepo: {
      findAll: mock(() => Promise.resolve([] as GitHubPR[])),
      findByRepo: mock(() => Promise.resolve([] as GitHubPR[])),
      upsert: mock((pr: Omit<GitHubPR, "id" | "source" | "createdAt" | "updatedAt">) =>
        Promise.resolve(makePR({ ...pr, id: "pr-new", externalId: `${pr.repo}#${pr.prNumber}` })),
      ),
      deleteById: mock(() => Promise.resolve()),
      deleteAll: mock(() => Promise.resolve()),
    },
  };
}

describe("GitHubService — reads from connector_configs (unified provider)", () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: GitHubService;

  beforeEach(() => {
    mocks = createMocks();
    service = new GitHubService(mocks.connectorRepo as any, mocks.prRepo as any);
  });

  describe("getConfig", () => {
    it("returns null when no github connector is configured", async () => {
      mocks.connectorRepo.findByType.mockReturnValue(Promise.resolve(null));
      const result = await service.getConfig();
      expect(result).toBeNull();
      expect(mocks.connectorRepo.findByType).toHaveBeenCalledWith("github");
    });

    it("projects the connector into the GitHubConfig shape", async () => {
      mocks.connectorRepo.findByType.mockReturnValue(Promise.resolve(makeConnector()));
      const cfg = await service.getConfig();
      expect(cfg).not.toBeNull();
      expect(cfg!.token).toBe("ghp_secret");
      expect(cfg!.username).toBe("alice");
      expect(cfg!.repos).toEqual(["owner/repo"]);
      expect(cfg!.pollIntervalSeconds).toBe(300); // default
    });

    it("defaults username and repos when settings are partial", async () => {
      mocks.connectorRepo.findByType.mockReturnValue(Promise.resolve(makeConnector({ settings: {} })));
      const cfg = await service.getConfig();
      expect(cfg!.username).toBe("");
      expect(cfg!.repos).toEqual([]);
    });
  });

  describe("saveConfig", () => {
    it("upserts connector_configs with merged settings (preserves syncIssues/syncPRs)", async () => {
      mocks.connectorRepo.findByType.mockReturnValue(
        Promise.resolve(makeConnector({ settings: { syncIssues: true, syncPRs: true, pollIntervalSeconds: 120 } })),
      );
      await service.saveConfig({ token: "ghp_new", username: "alice", repos: ["a/b"] });
      expect(mocks.connectorRepo.upsert).toHaveBeenCalledTimes(1);
      const call = mocks.connectorRepo.upsert.mock.calls[0]![0] as {
        type: string;
        token: string;
        settings: Record<string, unknown>;
      };
      expect(call.type).toBe("github");
      expect(call.token).toBe("ghp_new");
      expect(call.settings.username).toBe("alice");
      expect(call.settings.repos).toEqual(["a/b"]);
      // Existing syncIssues/syncPRs/pollInterval preserved.
      expect(call.settings.syncIssues).toBe(true);
      expect(call.settings.syncPRs).toBe(true);
      expect(call.settings.pollIntervalSeconds).toBe(120);
    });

    it("uses the default poll interval when no previous config exists", async () => {
      mocks.connectorRepo.findByType.mockReturnValue(Promise.resolve(null));
      await service.saveConfig({ token: "ghp_new", username: "alice", repos: [] });
      const call = mocks.connectorRepo.upsert.mock.calls[0]![0] as { settings: Record<string, unknown> };
      expect(call.settings.pollIntervalSeconds).toBe(300);
    });
  });

  describe("deleteConfig", () => {
    it("deletes both the connector row and all synced PRs", async () => {
      await service.deleteConfig();
      expect(mocks.connectorRepo.delete).toHaveBeenCalledWith("github");
      expect(mocks.prRepo.deleteAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPRs", () => {
    it("returns the PRs from the (source=github) cache", async () => {
      const prs = [makePR({ id: "a" }), makePR({ id: "b", prNumber: 43, externalId: "owner/repo#43" })];
      mocks.prRepo.findAll.mockReturnValue(Promise.resolve(prs));
      const result = await service.getPRs();
      expect(result).toHaveLength(2);
      expect(mocks.prRepo.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
