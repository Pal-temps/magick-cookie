import { describe, test, expect, beforeEach, mock } from "bun:test";
import { ChatService } from "../../application/chat/chat.service";
import type { ChatRepository } from "../../domain/chat/chat.repository";
import type { LlmService } from "../../application/llm/llm.service";
import type { ChatConversation, ChatMessage } from "../../domain/chat/chat.entity";

function makeConversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
  return {
    id: "conv-1",
    title: "Nouvelle conversation",
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-01"),
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    role: "user",
    content: "Hello",
    createdAt: new Date("2026-03-01"),
    ...overrides,
  };
}

function createMockChatRepo(): Record<keyof ChatRepository, ReturnType<typeof mock>> {
  return {
    listConversations: mock(() => Promise.resolve([])),
    getConversation: mock(() => Promise.resolve(null)),
    createConversation: mock(() => Promise.resolve(makeConversation())),
    updateConversationTitle: mock(() => Promise.resolve(null)),
    deleteConversation: mock(() => Promise.resolve(false)),
    getMessages: mock(() => Promise.resolve([])),
    addMessage: mock(() => Promise.resolve(makeMessage())),
  };
}

function createMockLlmService(): { chat: ReturnType<typeof mock> } {
  return {
    chat: mock(() => Promise.resolve("LLM response")),
  };
}

describe("ChatService", () => {
  let service: ChatService;
  let chatRepo: ReturnType<typeof createMockChatRepo>;
  let llmService: ReturnType<typeof createMockLlmService>;

  beforeEach(() => {
    chatRepo = createMockChatRepo();
    llmService = createMockLlmService();
    service = new ChatService(
      chatRepo as unknown as ChatRepository,
      llmService as unknown as LlmService,
    );
  });

  describe("listConversations", () => {
    test("returns all conversations from repo", async () => {
      const convs = [makeConversation(), makeConversation({ id: "conv-2", title: "Second" })];
      chatRepo.listConversations.mockReturnValue(Promise.resolve(convs));

      const result = await service.listConversations();
      expect(result).toEqual(convs);
      expect(chatRepo.listConversations).toHaveBeenCalledTimes(1);
    });

    test("returns empty array when no conversations", async () => {
      const result = await service.listConversations();
      expect(result).toEqual([]);
    });
  });

  describe("createConversation", () => {
    test("creates conversation with title", async () => {
      const conv = makeConversation({ title: "My Chat" });
      chatRepo.createConversation.mockReturnValue(Promise.resolve(conv));

      const result = await service.createConversation("My Chat");
      expect(result).toEqual(conv);
      expect(chatRepo.createConversation).toHaveBeenCalledWith("My Chat");
    });

    test("creates conversation without title", async () => {
      const result = await service.createConversation();
      expect(result).toBeDefined();
      expect(chatRepo.createConversation).toHaveBeenCalledWith(undefined);
    });
  });

  describe("getMessages", () => {
    test("returns messages for a conversation", async () => {
      const msgs = [
        makeMessage({ id: "msg-1", content: "Hello" }),
        makeMessage({ id: "msg-2", role: "assistant", content: "Hi" }),
      ];
      chatRepo.getMessages.mockReturnValue(Promise.resolve(msgs));

      const result = await service.getMessages("conv-1");
      expect(result).toEqual(msgs);
      expect(chatRepo.getMessages).toHaveBeenCalledWith("conv-1");
    });

    test("returns empty array for conversation with no messages", async () => {
      const result = await service.getMessages("conv-1");
      expect(result).toEqual([]);
    });
  });

  describe("sendMessage", () => {
    test("throws when no LLM configured", async () => {
      const serviceNoLlm = new ChatService(
        chatRepo as unknown as ChatRepository,
        null,
      );

      await expect(serviceNoLlm.sendMessage("conv-1", "Hello")).rejects.toThrow("No LLM configured");
    });

    test("saves user message, calls LLM, and saves assistant message", async () => {
      const userMsg = makeMessage({ role: "user", content: "Hello" });
      const assistantMsg = makeMessage({ id: "msg-2", role: "assistant", content: "LLM response" });
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(userMsg))
        .mockReturnValueOnce(Promise.resolve(assistantMsg));
      chatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      chatRepo.getConversation.mockReturnValue(Promise.resolve(makeConversation({ title: "Already titled" })));

      const result = await service.sendMessage("conv-1", "Hello");

      expect(result).toEqual(assistantMsg);
      expect(chatRepo.addMessage).toHaveBeenCalledTimes(2);
      expect(chatRepo.addMessage).toHaveBeenNthCalledWith(1, "conv-1", "user", "Hello");
      expect(chatRepo.addMessage).toHaveBeenNthCalledWith(2, "conv-1", "assistant", "LLM response");
      expect(llmService.chat).toHaveBeenCalledTimes(1);
    });

    test("auto-titles when first exchange and default title", async () => {
      const userMsg = makeMessage({ role: "user", content: "What is Bun?" });
      const assistantMsg = makeMessage({ id: "msg-2", role: "assistant", content: "Bun is a JS runtime" });
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(userMsg))
        .mockReturnValueOnce(Promise.resolve(assistantMsg));
      chatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      chatRepo.getConversation.mockReturnValue(
        Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
      );
      llmService.chat
        .mockReturnValueOnce(Promise.resolve("Bun is a JS runtime"))
        .mockReturnValueOnce(Promise.resolve("  Bun Runtime  "));

      const result = await service.sendMessage("conv-1", "What is Bun?");

      expect(result).toEqual(assistantMsg);
      expect(llmService.chat).toHaveBeenCalledTimes(2);
      expect(chatRepo.updateConversationTitle).toHaveBeenCalledWith("conv-1", "Bun Runtime");
    });

    test("does not auto-title when conversation already has custom title", async () => {
      const userMsg = makeMessage({ role: "user", content: "Hello" });
      const assistantMsg = makeMessage({ id: "msg-2", role: "assistant", content: "Hi" });
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(userMsg))
        .mockReturnValueOnce(Promise.resolve(assistantMsg));
      chatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      chatRepo.getConversation.mockReturnValue(
        Promise.resolve(makeConversation({ title: "Custom Title" })),
      );
      llmService.chat.mockReturnValue(Promise.resolve("Hi"));

      await service.sendMessage("conv-1", "Hello");

      expect(llmService.chat).toHaveBeenCalledTimes(1); // Only the main chat call
      expect(chatRepo.updateConversationTitle).not.toHaveBeenCalled();
    });

    test("does not auto-title when messages > 2", async () => {
      const msgs = [
        makeMessage({ id: "msg-1", role: "user", content: "A" }),
        makeMessage({ id: "msg-2", role: "assistant", content: "B" }),
        makeMessage({ id: "msg-3", role: "user", content: "C" }),
      ];
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(msgs[2]))
        .mockReturnValueOnce(Promise.resolve(makeMessage({ id: "msg-4", role: "assistant", content: "D" })));
      chatRepo.getMessages.mockReturnValue(Promise.resolve(msgs));
      chatRepo.getConversation.mockReturnValue(
        Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
      );
      llmService.chat.mockReturnValue(Promise.resolve("D"));

      await service.sendMessage("conv-1", "C");

      expect(llmService.chat).toHaveBeenCalledTimes(1);
      expect(chatRepo.updateConversationTitle).not.toHaveBeenCalled();
    });

    test("ignores title generation error gracefully", async () => {
      const userMsg = makeMessage({ role: "user", content: "Hello" });
      const assistantMsg = makeMessage({ id: "msg-2", role: "assistant", content: "Hi" });
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(userMsg))
        .mockReturnValueOnce(Promise.resolve(assistantMsg));
      chatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      chatRepo.getConversation.mockReturnValue(
        Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
      );
      llmService.chat
        .mockReturnValueOnce(Promise.resolve("Hi"))
        .mockReturnValueOnce(Promise.reject(new Error("LLM error")));

      const result = await service.sendMessage("conv-1", "Hello");

      expect(result).toEqual(assistantMsg);
    });

    test("does not auto-title when conversation is null", async () => {
      const userMsg = makeMessage({ role: "user", content: "Hello" });
      const assistantMsg = makeMessage({ id: "msg-2", role: "assistant", content: "Hi" });
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(userMsg))
        .mockReturnValueOnce(Promise.resolve(assistantMsg));
      chatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      chatRepo.getConversation.mockReturnValue(Promise.resolve(null));
      llmService.chat.mockReturnValue(Promise.resolve("Hi"));

      await service.sendMessage("conv-1", "Hello");

      expect(chatRepo.updateConversationTitle).not.toHaveBeenCalled();
    });

    test("truncates long title to 100 characters", async () => {
      const userMsg = makeMessage({ role: "user", content: "Tell me everything" });
      const assistantMsg = makeMessage({ id: "msg-2", role: "assistant", content: "OK" });
      chatRepo.addMessage
        .mockReturnValueOnce(Promise.resolve(userMsg))
        .mockReturnValueOnce(Promise.resolve(assistantMsg));
      chatRepo.getMessages.mockReturnValue(Promise.resolve([userMsg]));
      chatRepo.getConversation.mockReturnValue(
        Promise.resolve(makeConversation({ title: "Nouvelle conversation" })),
      );
      const longTitle = "A".repeat(200);
      llmService.chat
        .mockReturnValueOnce(Promise.resolve("OK"))
        .mockReturnValueOnce(Promise.resolve(longTitle));

      await service.sendMessage("conv-1", "Tell me everything");

      expect(chatRepo.updateConversationTitle).toHaveBeenCalledWith("conv-1", "A".repeat(100));
    });
  });

  describe("deleteConversation", () => {
    test("returns true when deleted", async () => {
      chatRepo.deleteConversation.mockReturnValue(Promise.resolve(true));

      const result = await service.deleteConversation("conv-1");
      expect(result).toBe(true);
      expect(chatRepo.deleteConversation).toHaveBeenCalledWith("conv-1");
    });

    test("returns false when not found", async () => {
      chatRepo.deleteConversation.mockReturnValue(Promise.resolve(false));

      const result = await service.deleteConversation("ghost");
      expect(result).toBe(false);
    });
  });
});
