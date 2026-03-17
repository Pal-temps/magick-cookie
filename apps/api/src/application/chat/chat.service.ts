import type { ChatRepository } from "../../domain/chat/chat.repository";
import type { ChatMessage } from "../../domain/chat/chat.entity";
import type { LlmService } from "../llm/llm.service";

export class ChatService {
  constructor(
    private chatRepo: ChatRepository,
    private llmService: LlmService | null,
  ) {}

  async listConversations() {
    return this.chatRepo.listConversations();
  }

  async createConversation(title?: string) {
    return this.chatRepo.createConversation(title);
  }

  async getMessages(conversationId: string) {
    return this.chatRepo.getMessages(conversationId);
  }

  async sendMessage(conversationId: string, content: string): Promise<ChatMessage> {
    if (!this.llmService) throw new Error("No LLM configured");

    // Save user message
    await this.chatRepo.addMessage(conversationId, "user", content);

    // Get conversation history
    const messages = await this.chatRepo.getMessages(conversationId);

    // Build LLM messages
    const llmMessages = [
      { role: "system" as const, content: "Tu es un assistant utile. Reponds en francais sauf si on te parle dans une autre langue." },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call LLM
    const response = await this.llmService.chat(llmMessages);

    // Save assistant message
    const assistantMsg = await this.chatRepo.addMessage(conversationId, "assistant", response);

    // Auto-title: if this is the first exchange, generate a title
    const conv = await this.chatRepo.getConversation(conversationId);
    if (conv && conv.title === "Nouvelle conversation" && messages.length <= 2) {
      try {
        const titleResponse = await this.llmService.chat([
          { role: "system", content: "Genere un titre court (max 5 mots) pour cette conversation. Reponds uniquement avec le titre, sans guillemets." },
          { role: "user", content },
        ]);
        await this.chatRepo.updateConversationTitle(conversationId, titleResponse.trim().substring(0, 100));
      } catch {
        // Ignore title generation errors
      }
    }

    return assistantMsg;
  }

  async deleteConversation(id: string) {
    return this.chatRepo.deleteConversation(id);
  }
}
