import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ProviderService, PROVIDER_NOT_CONFIGURED } from "../../application/provider/provider.service";
import type { ConnectorConfigRepository } from "../../domain/connector-config/connector-config.repository";
import type { ConnectorConfig } from "../../domain/connector-config/connector-config.entity";

const makeConfig = (overrides: Partial<ConnectorConfig> = {}): ConnectorConfig => ({
  id: "cfg-1",
  type: "github",
  token: "ghp_xxx",
  settings: {},
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ProviderService", () => {
  let repo: { [K in keyof ConnectorConfigRepository]: ReturnType<typeof mock> };
  let svc: ProviderService;

  beforeEach(() => {
    repo = {
      findAll: mock(() => Promise.resolve([])),
      findByType: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve(makeConfig())),
      delete: mock(() => Promise.resolve()),
    } as unknown as { [K in keyof ConnectorConfigRepository]: ReturnType<typeof mock> };
    svc = new ProviderService(repo as unknown as ConnectorConfigRepository);
  });

  describe("isConfigured", () => {
    it("returns false when no config", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(null));
      expect(await svc.isConfigured("github")).toBe(false);
    });

    it("returns false when config exists but disabled", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ enabled: false })));
      expect(await svc.isConfigured("github")).toBe(false);
    });

    it("returns true when configured + enabled", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ enabled: true })));
      expect(await svc.isConfigured("github")).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("reports configured=false when no config", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(null));
      const status = await svc.getStatus("github");
      expect(status).toEqual({ type: "github", configured: false, username: null });
    });

    it("surfaces github username from settings", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ settings: { username: "alice" } })));
      const status = await svc.getStatus("github");
      expect(status.configured).toBe(true);
      expect(status.username).toBe("alice");
    });

    it("returns null username for non-github providers", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ type: "gitlab", settings: {} })));
      const status = await svc.getStatus("gitlab");
      expect(status.username).toBeNull();
    });
  });

  describe("getXClient", () => {
    it("getGitHubClient returns null when not configured", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(null));
      expect(await svc.getGitHubClient()).toBeNull();
    });

    it("getGitHubClient returns a client when configured", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ token: "ghp_x", settings: { username: "alice" } })));
      const client = await svc.getGitHubClient();
      expect(client).not.toBeNull();
    });

    it("getGitLabClient returns null when disabled", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ type: "gitlab", enabled: false })));
      expect(await svc.getGitLabClient()).toBeNull();
    });

    it("getClickUpClient returns a client when configured", async () => {
      repo.findByType.mockReturnValue(Promise.resolve(makeConfig({ type: "clickup", token: "pk_x" })));
      const client = await svc.getClickUpClient();
      expect(client).not.toBeNull();
    });
  });

  it("PROVIDER_NOT_CONFIGURED has the contract shape (error + provider + configureUrl)", () => {
    expect(PROVIDER_NOT_CONFIGURED("github")).toEqual({
      error: "Provider not configured",
      provider: "github",
      configureUrl: "settings/connectors",
    });
  });
});
