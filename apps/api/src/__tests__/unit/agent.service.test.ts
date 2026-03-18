import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentService } from "../../application/agent/agent.service";
import type { ChatRepository } from "../../domain/chat/chat.repository";
import type { ChatMessage, ChatConversation } from "../../domain/chat/chat.entity";
import type { LlmService } from "../../application/llm/llm.service";
import type { AgentMemoryRepository } from "../../domain/agent-memory/agent-memory.repository";
import { ToolRegistry } from "../../application/agent/tool-registry";
import type { AgentMemory } from "../../domain/agent-memory/agent-memory.entity";

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "msg-1",
  conversationId: "conv-1",
  role: "user",
  content: "Bonjour",
  createdAt: new Date("2026-03-18T10:00:00Z"),
  ...overrides,
});

const makeConversation = (overrides: Partial<ChatConversation> = {}): ChatConversation => ({
  id: "conv-1",
  title: "Nouvelle conversation",
  createdAt: new Date("2026-03-18T10:00:00Z"),
  updatedAt: new Date("2026-03-18T10:00:00Z"),
  ...overrides,
});

const makeMemory = (overrides: Partial<AgentMemory> = {}): AgentMemory => ({
  id: "mem-1",
  type: "fact",
  content: "dev backend senior",
  createdAt: new Date("2026-03-01"),
  expiresAt: null,
  ...overrides,
});

describe("AgentService", () => {
  let service: AgentService;
  let mockChatRepo: Record<keyof ChatRepository, ReturnType<typeof mock>>;
  let mockLlmService: { chat: ReturnType<typeof mock>; getConfig: ReturnType<typeof mock>; updateConfig: ReturnType<typeof mock>; summarize: ReturnType<typeof mock> };
  let toolRegistry: ToolRegistry;
  let mockMemoryRepo: Record<keyof AgentMemoryRepository, ReturnType<typeof mock>>;

  beforeEach(() => {
    mockChatRepo = {
      listConversations: mock(() => Promise.resolve([])),
      getConversation: mock(() => Promise.resolve(makeConversation())),
      createConversation: mock(() => Promise.resolve(makeConversation())),
      updateConversationTitle: mock(() => Promise.resolve(makeConversation())),
      deleteConversation: mock(() => Promise.resolve(true)),
      getMessages: mock(() => Promise.resolve([])),
      addMessage: mock(() => Promise.resolve(makeMessage({ role: "assistant", content: "Salut!" }))),
    };

    mockLlmService = {
      chat: mock(() => Promise.resolve("Bonjour, comment puis-je t'aider ?")),
      getConfig: mock(() => Promise.resolve(null)),
      updateConfig: mock(() => Promise.resolve(null)),
      summarize: mock(() => Promise.resolve("")),
    };

    toolRegistry = new ToolRegistry();

    mockMemoryRepo = {
      findAll: mock(() => Promise.resolve([])),
      findActive: mock(() => Promise.resolve([])),
      create: mock(() => Promise.resolve(makeMemory())),
      delete: mock(() => Promise.resolve(true)),
      deleteExpired: mock(() => Promise.resolve(0)),
    };

    service = new AgentService(
      mockChatRepo as unknown as ChatRepository,
      mockLlmService as unknown as LlmService,
      toolRegistry,
      mockMemoryRepo as unknown as AgentMemoryRepository,
    );
  });

  describe("listConversations", () => {
    it("should delegate to chatRepo", async () => {
      const convs = [makeConversation()];
      mockChatRepo.listConversations.mockReturnValue(Promise.resolve(convs));

      const result = await service.listConversations();

      expect(result).toEqual(convs);
      expect(mockChatRepo.listConversations).toHaveBeenCalledTimes(1);
    });
  });

  describe("createConversation", () => {
    it("should delegate to chatRepo", async () => {
      const conv = makeConversation({ title: "Custom title" });
      mockChatRepo.createConversation.mockReturnValue(Promise.resolve(conv));

      const result = await service.createConversation("Custom title");

      expect(result).toEqual(conv);
      expect(mockChatRepo.createConversation).toHaveBeenCalledWith("Custom title");
    });
  });

  describe("getMessages", () => {
    it("should delegate to chatRepo", async () => {
      const msgs = [makeMessage()];
      mockChatRepo.getMessages.mockReturnValue(Promise.resolve(msgs));

      const result = await service.getMessages("conv-1");

      expect(result).toEqual(msgs);
      expect(mockChatRepo.getMessages).toHaveBeenCalledWith("conv-1");
    });
  });

  describe("deleteConversation", () => {
    it("should delegate to chatRepo", async () => {
      const result = await service.deleteConversation("conv-1");

      expect(result).toBe(true);
      expect(mockChatRepo.deleteConversation).toHaveBeenCalledWith("conv-1");
    });
  });

  describe("sendMessage", () => {
    it("should throw if no LLM configured", async () => {
      const noLlmService = new AgentService(
        mockChatRepo as unknown as ChatRepository,
        null,
        toolRegistry,
        mockMemoryRepo as unknown as AgentMemoryRepository,
      );

      expect(noLlmService.sendMessage("conv-1", "hello")).rejects.toThrow("No LLM configured");
    });

    it("should save user message, call LLM, and return assistant response", async () => {
      const userMsg = makeMessage({ id: "u1", role: "user", content: "Bonjour" });
      const assistantMsg = makeMessage({ id: "a1", role: "assistant", content: "Salut!" });

      mockChatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      mockChatRepo.addMessage.mockReturnValue(Promise.resolve(assistantMsg));
      mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

      const result = await service.sendMessage("conv-1", "Bonjour");

      expect(mockChatRepo.addMessage).toHaveBeenCalledWith("conv-1", "user", "Bonjour");
      expect(result.message).toEqual(assistantMsg);
      expect(result.toolCalls).toEqual([]);
    });

    it("should build system prompt with memories injected", async () => {
      const memories = [
        makeMemory({ type: "fact", content: "dev backend" }),
        makeMemory({ id: "m2", type: "preference", content: "briefs courts" }),
        makeMemory({ id: "m3", type: "context", content: "travaille sur auth" }),
      ];
      mockMemoryRepo.findActive.mockReturnValue(Promise.resolve(memories));
      mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

      await service.sendMessage("conv-1", "Bonjour");

      // The first call to llmService.chat should have a system prompt containing memories
      const firstCallMessages = mockLlmService.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      const systemPrompt = firstCallMessages[0].content;

      expect(systemPrompt).toContain("Ce que tu sais de l'utilisateur");
      expect(systemPrompt).toContain("dev backend");
      expect(systemPrompt).toContain("briefs courts");
      expect(systemPrompt).toContain("travaille sur auth");
      expect(systemPrompt).toContain("**Faits :**");
      expect(systemPrompt).toContain("**Preferences :**");
      expect(systemPrompt).toContain("**Contexte actuel :**");
    });

    it("should build system prompt without memory section when no memories exist", async () => {
      mockMemoryRepo.findActive.mockReturnValue(Promise.resolve([]));
      mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

      await service.sendMessage("conv-1", "Bonjour");

      const firstCallMessages = mockLlmService.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      const systemPrompt = firstCallMessages[0].content;

      expect(systemPrompt).not.toContain("Ce que tu sais de l'utilisateur");
    });

    it("should continue without memories when memoryRepo throws", async () => {
      mockMemoryRepo.findActive.mockReturnValue(Promise.reject(new Error("DB error")));
      mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

      const result = await service.sendMessage("conv-1", "Bonjour");

      expect(result.message).toBeDefined();
      // Should not throw, gracefully degrades
    });

    it("should build system prompt without memory section when no memoryRepo", async () => {
      const serviceNoMem = new AgentService(
        mockChatRepo as unknown as ChatRepository,
        mockLlmService as unknown as LlmService,
        toolRegistry,
      );
      mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

      await serviceNoMem.sendMessage("conv-1", "Bonjour");

      const firstCallMessages = mockLlmService.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
      const systemPrompt = firstCallMessages[0].content;

      expect(systemPrompt).not.toContain("Ce que tu sais de l'utilisateur");
    });

    describe("tool-calling loop", () => {
      it("should parse TOOL_CALL, execute tool, and return final answer", async () => {
        const executeMock = mock(() => Promise.resolve({ streak: 5 }));
        toolRegistry.register({
          name: "get_streak",
          description: "Get streak",
          parameters: {},
          execute: executeMock,
        });

        // First call: LLM returns a TOOL_CALL
        // Second call: LLM returns a final answer
        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "get_streak", "params": {}}\n```');
          }
          if (callCount === 2) {
            return Promise.resolve("Tu as un streak de 5 jours !");
          }
          // For auto-title
          return Promise.resolve("Streak");
        });

        const assistantMsg = makeMessage({ role: "assistant", content: "Tu as un streak de 5 jours !" });
        mockChatRepo.addMessage.mockReturnValue(Promise.resolve(assistantMsg));

        const result = await service.sendMessage("conv-1", "Mon streak ?");

        expect(executeMock).toHaveBeenCalledWith({});
        expect(result.message.content).toBe("Tu as un streak de 5 jours !");
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0]).toEqual({ tool: "get_streak", result: { streak: 5 } });
      });

      it("should handle multiple TOOL_CALL blocks in one response", async () => {
        const streakMock = mock(() => Promise.resolve({ streak: 3 }));
        const statsMock = mock(() => Promise.resolve({ total: 42 }));
        toolRegistry.register({ name: "get_streak", description: "Streak", parameters: {}, execute: streakMock });
        toolRegistry.register({ name: "get_today_stats", description: "Stats", parameters: {}, execute: statsMock });

        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(
              '```TOOL_CALL\n{"tool": "get_streak", "params": {}}\n```\n\n```TOOL_CALL\n{"tool": "get_today_stats", "params": {}}\n```',
            );
          }
          if (callCount === 2) {
            return Promise.resolve("Streak 3, stats 42");
          }
          return Promise.resolve("Recap");
        });

        const result = await service.sendMessage("conv-1", "Resume");

        expect(streakMock).toHaveBeenCalled();
        expect(statsMock).toHaveBeenCalled();
        expect(result.toolCalls).toHaveLength(2);
      });

      it("should handle unknown tool gracefully", async () => {
        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "nonexistent_tool", "params": {}}\n```');
          }
          if (callCount === 2) {
            return Promise.resolve("Desole, outil inconnu");
          }
          return Promise.resolve("Title");
        });

        const result = await service.sendMessage("conv-1", "Test");

        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].error).toContain("Outil inconnu");
        expect(result.toolCalls[0].result).toBeNull();
      });

      it("should handle tool execution error gracefully", async () => {
        toolRegistry.register({
          name: "failing_tool",
          description: "Fails",
          parameters: {},
          execute: mock(() => Promise.reject(new Error("Boom"))),
        });

        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "failing_tool", "params": {}}\n```');
          }
          if (callCount === 2) {
            return Promise.resolve("Tool failed");
          }
          return Promise.resolve("Title");
        });

        const result = await service.sendMessage("conv-1", "Test");

        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].error).toContain("Boom");
      });

      it("should respect max rounds limit and force a final answer", async () => {
        toolRegistry.register({
          name: "loop_tool",
          description: "Loops",
          parameters: {},
          execute: mock(() => Promise.resolve({ ok: true })),
        });

        // Every call returns a TOOL_CALL (simulating infinite loop)
        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          // First 5 calls are tool calls (the loop), 6th is the forced final answer
          if (callCount <= 5) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "loop_tool", "params": {}}\n```');
          }
          // After max rounds, the service appends a "stop" message and asks for final answer
          return Promise.resolve("Voici ce que j'ai trouve");
        });

        const result = await service.sendMessage("conv-1", "Loop test");

        // 5 rounds of tool calls + 1 final forced answer
        expect(mockLlmService.chat).toHaveBeenCalledTimes(
          5 + 1 + 1, // 5 tool rounds + 1 max-round final + 1 auto-title
        );
        expect(result.toolCalls).toHaveLength(5);
        expect(result.message.content).toBeDefined();
      });

      it("should strip TOOL_CALL blocks from forced final response", async () => {
        toolRegistry.register({
          name: "loop_tool",
          description: "Loops",
          parameters: {},
          execute: mock(() => Promise.resolve({ ok: true })),
        });

        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount <= 5) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "loop_tool", "params": {}}\n```');
          }
          // Final response still has tool calls that should be stripped
          return Promise.resolve('Some text ```TOOL_CALL\n{"tool": "loop_tool", "params": {}}\n``` more text');
        });

        // Capture what gets saved
        mockChatRepo.addMessage.mockImplementation((_id: string, _role: string, content: string) => {
          return Promise.resolve(makeMessage({ role: "assistant", content }));
        });

        const result = await service.sendMessage("conv-1", "Loop test");

        expect(result.message.content).toBe("Some text  more text");
        expect(result.message.content).not.toContain("TOOL_CALL");
      });

      it("should skip malformed TOOL_CALL JSON", async () => {
        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('```TOOL_CALL\n{invalid json}\n```');
          }
          // Malformed JSON means 0 tool calls parsed, so this IS the final answer
          // Actually, it should be callCount === 1 that returns 0 tool calls (malformed)
          // So callCount === 1 response becomes the final answer
          return Promise.resolve("Title");
        });

        const result = await service.sendMessage("conv-1", "Test");

        // Malformed JSON means no tool calls parsed, so response is saved as final
        expect(result.toolCalls).toEqual([]);
      });

      it("should pass tool results back to LLM for next round", async () => {
        toolRegistry.register({
          name: "my_tool",
          description: "Test",
          parameters: {},
          execute: mock(() => Promise.resolve({ data: "hello" })),
        });

        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "my_tool", "params": {}}\n```');
          }
          return Promise.resolve("Final answer");
        });

        await service.sendMessage("conv-1", "Test");

        // Second LLM call should include tool results
        const secondCallMessages = mockLlmService.chat.mock.calls[1][0] as Array<{ role: string; content: string }>;
        const toolResultMsg = secondCallMessages.find((m) => m.content.includes("RESULTAT my_tool"));
        expect(toolResultMsg).toBeDefined();
        expect(toolResultMsg!.content).toContain(JSON.stringify({ data: "hello" }));
      });

      it("should include error message in tool results for unknown tools", async () => {
        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve('```TOOL_CALL\n{"tool": "unknown", "params": {}}\n```');
          }
          return Promise.resolve("OK");
        });

        await service.sendMessage("conv-1", "Test");

        const secondCallMessages = mockLlmService.chat.mock.calls[1][0] as Array<{ role: string; content: string }>;
        const errorMsg = secondCallMessages.find((m) => m.content.includes("ERREUR unknown"));
        expect(errorMsg).toBeDefined();
      });
    });

    describe("auto-title", () => {
      it("should generate title for new conversation with <= 2 previous messages", async () => {
        mockChatRepo.getMessages.mockReturnValue(Promise.resolve([]));
        mockChatRepo.getConversation.mockReturnValue(
          Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
        );

        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve("Salut!");
          return Promise.resolve("Mon premier chat");
        });

        await service.sendMessage("conv-1", "Bonjour");

        expect(mockChatRepo.updateConversationTitle).toHaveBeenCalledWith("conv-1", "Mon premier chat");
      });

      it("should NOT generate title when previous messages > 2", async () => {
        const msgs = [makeMessage(), makeMessage({ id: "m2" }), makeMessage({ id: "m3" })];
        mockChatRepo.getMessages.mockReturnValue(Promise.resolve(msgs));
        mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

        await service.sendMessage("conv-1", "Bonjour");

        expect(mockChatRepo.updateConversationTitle).not.toHaveBeenCalled();
      });

      it("should NOT generate title when conversation already has a custom title", async () => {
        mockChatRepo.getMessages.mockReturnValue(Promise.resolve([]));
        mockChatRepo.getConversation.mockReturnValue(
          Promise.resolve(makeConversation({ title: "Custom Title" })),
        );
        mockLlmService.chat.mockReturnValue(Promise.resolve("Salut!"));

        await service.sendMessage("conv-1", "Bonjour");

        expect(mockChatRepo.updateConversationTitle).not.toHaveBeenCalled();
      });

      it("should truncate title to 100 characters", async () => {
        mockChatRepo.getMessages.mockReturnValue(Promise.resolve([]));
        mockChatRepo.getConversation.mockReturnValue(
          Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
        );

        const longTitle = "A".repeat(150);
        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve("Salut!");
          return Promise.resolve(longTitle);
        });

        await service.sendMessage("conv-1", "Bonjour");

        expect(mockChatRepo.updateConversationTitle).toHaveBeenCalledWith("conv-1", "A".repeat(100));
      });

      it("should silently ignore title generation errors", async () => {
        mockChatRepo.getMessages.mockReturnValue(Promise.resolve([]));
        mockChatRepo.getConversation.mockReturnValue(
          Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
        );

        let callCount = 0;
        mockLlmService.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve("Salut!");
          return Promise.reject(new Error("LLM error"));
        });

        // Should NOT throw
        const result = await service.sendMessage("conv-1", "Bonjour");
        expect(result.message).toBeDefined();
      });
    });
  });
});
