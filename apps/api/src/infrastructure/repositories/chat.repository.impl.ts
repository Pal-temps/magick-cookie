import { eq, asc, desc } from "drizzle-orm";
import type { Database } from "../database/client";
import { chatConversations, chatMessages } from "../database/schema";
import type { ChatRepository } from "../../domain/chat/chat.repository";
import type { ChatConversation, ChatMessage } from "../../domain/chat/chat.entity";

export class DrizzleChatRepository implements ChatRepository {
  constructor(private db: Database) {}

  async listConversations(): Promise<ChatConversation[]> {
    const rows = await this.db.select().from(chatConversations).orderBy(desc(chatConversations.updatedAt));
    return rows.map(this.toConversation);
  }

  async getConversation(id: string): Promise<ChatConversation | null> {
    const rows = await this.db.select().from(chatConversations).where(eq(chatConversations.id, id));
    return rows[0] ? this.toConversation(rows[0]) : null;
  }

  async createConversation(title?: string): Promise<ChatConversation> {
    const values: Record<string, unknown> = {};
    if (title) values.title = title;
    const rows = await this.db.insert(chatConversations).values(values).returning();
    return this.toConversation(rows[0]);
  }

  async updateConversationTitle(id: string, title: string): Promise<ChatConversation | null> {
    const rows = await this.db
      .update(chatConversations)
      .set({ title })
      .where(eq(chatConversations.id, id))
      .returning();
    return rows[0] ? this.toConversation(rows[0]) : null;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(chatConversations)
      .where(eq(chatConversations.id, id))
      .returning({ id: chatConversations.id });
    return rows.length > 0;
  }

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(asc(chatMessages.createdAt));
    return rows.map(this.toMessage);
  }

  async addMessage(conversationId: string, role: string, content: string): Promise<ChatMessage> {
    const rows = await this.db
      .insert(chatMessages)
      .values({ conversationId, role, content })
      .returning();
    return this.toMessage(rows[0]);
  }

  private toConversation(row: typeof chatConversations.$inferSelect): ChatConversation {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
    return {
      id: row.id,
      conversationId: row.conversationId,
      role: row.role as ChatMessage["role"],
      content: row.content,
      createdAt: row.createdAt,
    };
  }
}
