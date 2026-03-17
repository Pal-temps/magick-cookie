import { describe, it, expect, beforeEach, mock } from "bun:test";
import { LlmService } from "../application/llm/llm.service";
import type { LlmConfigRepository } from "../domain/llm/llm-config.repository";
import type { LlmConfig } from "../domain/llm/llm-config.entity";

const makeConfig = (overrides: Partial<LlmConfig> = {}): LlmConfig => ({
  id: "cfg-1",
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
  apiKey: null,
  maxTokens: 2048,
  temperature: 0.7,
  enabled: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("LlmService", () => {
  let service: LlmService;
  let mockConfigRepo: Record<keyof LlmConfigRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockConfigRepo = {
      getActive: mock(() => Promise.resolve(makeConfig())),
      upsert: mock((input: any) => Promise.resolve(makeConfig(input))),
    };
    service = new LlmService(mockConfigRepo as unknown as LlmConfigRepository);
  });

  describe("getConfig", () => {
    it("should return active config", async () => {
      const result = await service.getConfig();
      expect(result).toBeDefined();
      expect(result!.provider).toBe("ollama");
      expect(mockConfigRepo.getActive).toHaveBeenCalledTimes(1);
    });

    it("should return null when no config", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      const result = await service.getConfig();
      expect(result).toBeNull();
    });
  });

  describe("updateConfig", () => {
    it("should upsert config", async () => {
      const input = {
        provider: "lmstudio",
        baseUrl: "http://localhost:1234",
        model: "mistral",
      };
      const result = await service.updateConfig(input);
      expect(result.provider).toBe("lmstudio");
      expect(mockConfigRepo.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("chat", () => {
    it("should throw when no config", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      await expect(service.chat([{ role: "user", content: "test" }])).rejects.toThrow("No LLM configured");
    });
  });

  describe("testConnection", () => {
    it("should return false when no config", async () => {
      mockConfigRepo.getActive.mockReturnValue(Promise.resolve(null));
      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });
});
