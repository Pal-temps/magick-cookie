import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ConnectorConfigService } from "../../application/connector-config/connector-config.service";
import type { ConnectorConfig } from "../../domain/connector-config/connector-config.entity";

// --- Helpers ---

function makeConfig(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: "cfg-1",
    type: "github",
    token: "ghp_abc123",
    settings: {},
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// --- Mock factories ---

function createMocks() {
  const mockRepo = {
    findAll: mock(() => Promise.resolve([] as ConnectorConfig[])),
    findByType: mock(() => Promise.resolve(null as ConnectorConfig | null)),
    upsert: mock((input: any) => Promise.resolve(makeConfig(input))),
    delete: mock(() => Promise.resolve()),
  };

  const service = new ConnectorConfigService(mockRepo as any);

  return { service, mockRepo };
}

// --- Tests ---

describe("ConnectorConfigService", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("getAll returns all configs", async () => {
    const { service, mockRepo } = mocks;
    const configs = [
      makeConfig({ id: "c1", type: "github" }),
      makeConfig({ id: "c2", type: "clickup" }),
    ];
    mockRepo.findAll.mockResolvedValue(configs);

    const result = await service.getAll();

    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual(configs);
  });

  it("getByType returns config for given type", async () => {
    const { service, mockRepo } = mocks;
    const config = makeConfig({ type: "clickup" });
    mockRepo.findByType.mockResolvedValue(config);

    const result = await service.getByType("clickup");

    expect(mockRepo.findByType).toHaveBeenCalledTimes(1);
    expect(mockRepo.findByType.mock.calls[0][0]).toBe("clickup");
    expect(result).toEqual(config);
  });

  it("getByType returns null for unconfigured type", async () => {
    const { service, mockRepo } = mocks;
    mockRepo.findByType.mockResolvedValue(null);

    const result = await service.getByType("gitlab");

    expect(mockRepo.findByType).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("save calls upsert with correct params", async () => {
    const { service, mockRepo } = mocks;
    const settings = { username: "octocat", repos: ["repo1"] };

    await service.save("github", "ghp_token123", settings);

    expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
    const arg = mockRepo.upsert.mock.calls[0][0];
    expect(arg.type).toBe("github");
    expect(arg.token).toBe("ghp_token123");
    expect(arg.settings).toEqual(settings);
  });

  it("delete calls repo delete", async () => {
    const { service, mockRepo } = mocks;

    await service.delete("clickup");

    expect(mockRepo.delete).toHaveBeenCalledTimes(1);
    expect(mockRepo.delete.mock.calls[0][0]).toBe("clickup");
  });
});
