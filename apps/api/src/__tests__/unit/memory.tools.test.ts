import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createMemoryTools } from "../../application/agent/tools/memory.tools";
import type { AgentMemoryRepository } from "../../domain/agent-memory/agent-memory.repository";
import type { AgentTool } from "../../application/agent/tool-registry";
import type { AgentMemory } from "../../domain/agent-memory/agent-memory.entity";

const makeMemory = (overrides: Partial<AgentMemory> = {}): AgentMemory => ({
  id: "mem-1",
  type: "fact",
  content: "dev backend senior",
  createdAt: new Date("2026-03-01"),
  expiresAt: null,
  ...overrides,
});

describe("memory.tools", () => {
  let mockRepo: Record<keyof AgentMemoryRepository, ReturnType<typeof mock>>;
  let tools: AgentTool[];
  let saveTool: AgentTool;
  let getTool: AgentTool;
  let deleteTool: AgentTool;

  beforeEach(() => {
    mockRepo = {
      findAll: mock(() => Promise.resolve([])),
      findActive: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeMemory())),
      delete: mock(() => Promise.resolve(true)),
      deleteExpired: mock(() => Promise.resolve(0)),
    };
    tools = createMemoryTools(mockRepo as unknown as AgentMemoryRepository);
    saveTool = tools.find((t) => t.name === "save_memory")!;
    getTool = tools.find((t) => t.name === "get_memories")!;
    deleteTool = tools.find((t) => t.name === "delete_memory")!;
  });

  it("should create exactly 3 tools", () => {
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(["save_memory", "get_memories", "delete_memory"]);
  });

  describe("save_memory", () => {
    it("should have correct name and description", () => {
      expect(saveTool.name).toBe("save_memory");
      expect(saveTool.description).toContain("Sauvegarde");
      expect(saveTool.parameters.type).toBeDefined();
      expect(saveTool.parameters.content).toBeDefined();
      expect(saveTool.parameters.type.required).toBe(true);
      expect(saveTool.parameters.content.required).toBe(true);
    });

    it("should save a fact memory", async () => {
      const mem = makeMemory({ type: "fact", content: "uses TypeScript" });
      mockRepo.create.mockReturnValue(Promise.resolve(mem));

      const result = await saveTool.execute({ type: "fact", content: "uses TypeScript" });

      expect(mockRepo.create).toHaveBeenCalledWith({ type: "fact", content: "uses TypeScript" });
      expect(result).toEqual({ saved: true, id: mem.id, type: "fact", expiresAt: null });
    });

    it("should save a context memory", async () => {
      const expiresAt = new Date("2026-03-19T12:00:00Z");
      const mem = makeMemory({ type: "context", content: "working on auth", expiresAt });
      mockRepo.create.mockReturnValue(Promise.resolve(mem));

      const result = await saveTool.execute({ type: "context", content: "working on auth" });

      expect(mockRepo.create).toHaveBeenCalledWith({ type: "context", content: "working on auth" });
      expect(result).toEqual({ saved: true, id: mem.id, type: "context", expiresAt });
    });

    it("should save a preference memory", async () => {
      const mem = makeMemory({ type: "preference", content: "prefere briefs courts" });
      mockRepo.create.mockReturnValue(Promise.resolve(mem));

      const result = await saveTool.execute({ type: "preference", content: "prefere briefs courts" });

      expect(mockRepo.create).toHaveBeenCalledWith({ type: "preference", content: "prefere briefs courts" });
      expect(result).toEqual({ saved: true, id: mem.id, type: "preference", expiresAt: null });
    });

    it("should reject invalid type", async () => {
      const result = await saveTool.execute({ type: "invalid_type", content: "something" });

      expect(result).toEqual({ error: "Type invalide. Utilise : fact, context, preference" });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("should reject empty string type", async () => {
      const result = await saveTool.execute({ type: "", content: "something" });

      expect(result).toEqual({ error: "Type invalide. Utilise : fact, context, preference" });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("get_memories", () => {
    it("should have correct name and description", () => {
      expect(getTool.name).toBe("get_memories");
      expect(getTool.description).toContain("memoires actives");
      expect(getTool.parameters.type).toBeDefined();
      expect(getTool.parameters.type.required).toBe(false);
    });

    it("should return all active memories when no type filter", async () => {
      const memories = [
        makeMemory({ id: "m1", type: "fact", content: "dev backend" }),
        makeMemory({ id: "m2", type: "preference", content: "briefs courts" }),
      ];
      mockRepo.findActive.mockReturnValue(Promise.resolve(memories));

      const result = (await getTool.execute({})) as { count: number; memories: unknown[] };

      expect(mockRepo.findActive).toHaveBeenCalledWith(undefined);
      expect(result.count).toBe(2);
      expect(result.memories).toHaveLength(2);
      expect(result.memories[0]).toEqual({
        id: "m1",
        type: "fact",
        content: "dev backend",
        expiresAt: null,
      });
    });

    it("should filter memories by type", async () => {
      const memories = [makeMemory({ id: "m1", type: "fact", content: "dev backend" })];
      mockRepo.findActive.mockReturnValue(Promise.resolve(memories));

      const result = (await getTool.execute({ type: "fact" })) as { count: number; memories: unknown[] };

      expect(mockRepo.findActive).toHaveBeenCalledWith("fact");
      expect(result.count).toBe(1);
    });

    it("should return empty list when no memories exist", async () => {
      mockRepo.findActive.mockReturnValue(Promise.resolve([]));

      const result = (await getTool.execute({})) as { count: number; memories: unknown[] };

      expect(result.count).toBe(0);
      expect(result.memories).toEqual([]);
    });

    it("should reject invalid type filter", async () => {
      const result = await getTool.execute({ type: "bad_type" });

      expect(result).toEqual({ error: "Type invalide. Utilise : fact, context, preference" });
      expect(mockRepo.findActive).not.toHaveBeenCalled();
    });

    it("should pass undefined when type is not provided", async () => {
      mockRepo.findActive.mockReturnValue(Promise.resolve([]));

      await getTool.execute({});

      expect(mockRepo.findActive).toHaveBeenCalledWith(undefined);
    });
  });

  describe("delete_memory", () => {
    it("should have correct name and description", () => {
      expect(deleteTool.name).toBe("delete_memory");
      expect(deleteTool.description).toContain("Supprime");
      expect(deleteTool.parameters.id).toBeDefined();
      expect(deleteTool.parameters.id.required).toBe(true);
    });

    it("should delete a memory by id and return true", async () => {
      mockRepo.delete.mockReturnValue(Promise.resolve(true));

      const result = await deleteTool.execute({ id: "mem-1" });

      expect(mockRepo.delete).toHaveBeenCalledWith("mem-1");
      expect(result).toEqual({ deleted: true });
    });

    it("should return false when memory does not exist", async () => {
      mockRepo.delete.mockReturnValue(Promise.resolve(false));

      const result = await deleteTool.execute({ id: "nonexistent" });

      expect(mockRepo.delete).toHaveBeenCalledWith("nonexistent");
      expect(result).toEqual({ deleted: false });
    });
  });
});
