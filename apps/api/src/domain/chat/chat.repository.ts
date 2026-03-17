import type { ChatConversation, ChatMessage } from "./chat.entity";

export interface ChatRepository {
  listConversations(): Promise<ChatConversation[]>;
  getConversation(id: string): Promise<ChatConversation | null>;
  createConversation(title?: string): Promise<ChatConversation>;
  updateConversationTitle(id: string, title: string): Promise<ChatConversation | null>;
  deleteConversation(id: string): Promise<boolean>;
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  addMessage(conversationId: string, role: string, content: string): Promise<ChatMessage>;
}
