import { eq, and, or, isNull, gt, sql } from "drizzle-orm";
import type { Database } from "../database/client";
import { agentMemory } from "../database/schema";
import type { AgentMemoryRepository } from "../../domain/agent-memory/agent-memory.repository";
import type { AgentMemory, AgentMemoryType, CreateAgentMemoryInput } from "../../domain/agent-memory/agent-memory.entity";

export class DrizzleAgentMemoryRepository implements AgentMemoryRepository {
  constructor(private db: Database) {}

  async findAll(type?: AgentMemoryType): Promise<AgentMemory[]> {
    const conditions = type ? [eq(agentMemory.type, type)] : [];
    const query = this.db.select().from(agentMemory);
    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(agentMemory.createdAt);
    return rows.map(this.toDomain);
  }

  async findActive(type?: AgentMemoryType): Promise<AgentMemory[]> {
    const now = new Date();
    const conditions: ReturnType<typeof eq>[] = [];
    if (type) conditions.push(eq(agentMemory.type, type));

    const query = this.db.select().from(agentMemory);
    const activeCondition = or(isNull(agentMemory.expiresAt), gt(agentMemory.expiresAt, now));
    const finalCondition = conditions.length > 0
      ? and(...conditions, activeCondition)
      : activeCondition;

    const rows = await query.where(finalCondition!).orderBy(agentMemory.createdAt);
    return rows.map(this.toDomain);
  }

  async create(input: CreateAgentMemoryInput): Promise<AgentMemory> {
    const expiresAt = input.expiresAt ?? (input.type === "context"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null);

    const rows = await this.db.insert(agentMemory).values({
      type: input.type,
      content: input.content,
      expiresAt,
    }).returning();

    return this.toDomain(rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(agentMemory).where(eq(agentMemory.id, id)).returning();
    return rows.length > 0;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const rows = await this.db.delete(agentMemory)
      .where(and(
        sql`${agentMemory.expiresAt} IS NOT NULL`,
        sql`${agentMemory.expiresAt} < ${now}`,
      ))
      .returning();
    return rows.length;
  }

  private toDomain(row: typeof agentMemory.$inferSelect): AgentMemory {
    return {
      id: row.id,
      type: row.type as AgentMemoryType,
      content: row.content,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }
}
