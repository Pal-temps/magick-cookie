import { and, eq, desc } from "drizzle-orm";
import type { Database } from "../database/client";
import { aiToolCalls } from "../database/schema";
import type { AiToolCallRepository } from "../../domain/ai-tool-call/ai-tool-call.repository";
import type { AiToolCall, RecordToolCallInput, FindToolCallsOptions, ToolCallStatus, PermissionLevel } from "../../domain/ai-tool-call/ai-tool-call.entity";

export class DrizzleAiToolCallRepository implements AiToolCallRepository {
  constructor(private db: Database) {}

  async record(input: RecordToolCallInput): Promise<AiToolCall> {
    const [row] = await this.db
      .insert(aiToolCalls)
      .values({
        conversationId: input.conversationId ?? null,
        sessionId: input.sessionId ?? null,
        toolName: input.toolName,
        permissionLevel: input.permissionLevel,
        args: JSON.stringify(input.args ?? {}),
        result: input.result !== undefined ? JSON.stringify(input.result) : null,
        errorMessage: input.errorMessage ?? null,
        status: input.status,
        durationMs: input.durationMs ?? null,
      })
      .returning();
    return this.toDomain(row);
  }

  async findAll(options: FindToolCallsOptions = {}): Promise<AiToolCall[]> {
    const conditions = [];
    if (options.conversationId) conditions.push(eq(aiToolCalls.conversationId, options.conversationId));
    if (options.toolName) conditions.push(eq(aiToolCalls.toolName, options.toolName));

    let query = this.db.select().from(aiToolCalls).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));
    query = query.orderBy(desc(aiToolCalls.createdAt));
    if (options.limit !== undefined) query = query.limit(options.limit);
    if (options.offset !== undefined) query = query.offset(options.offset);

    const rows = await query;
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: typeof aiToolCalls.$inferSelect): AiToolCall {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(row.args) as Record<string, unknown>; } catch {}

    let result: unknown = null;
    if (row.result != null) {
      try { result = JSON.parse(row.result); } catch { result = row.result; }
    }

    return {
      id: row.id,
      conversationId: row.conversationId,
      sessionId: row.sessionId,
      toolName: row.toolName,
      permissionLevel: row.permissionLevel as PermissionLevel,
      args,
      result,
      errorMessage: row.errorMessage,
      status: row.status as ToolCallStatus,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    };
  }
}
