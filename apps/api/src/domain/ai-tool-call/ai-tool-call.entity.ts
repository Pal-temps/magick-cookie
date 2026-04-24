export type ToolCallStatus = "ok" | "error" | "denied" | "invalid_input" | "rate_limited";

export type PermissionLevel = "auto" | "user-confirm" | "admin";

export interface AiToolCall {
  id: string;
  conversationId: string | null;
  sessionId: string | null;
  toolName: string;
  permissionLevel: PermissionLevel;
  args: Record<string, unknown>;
  result: unknown | null;
  errorMessage: string | null;
  status: ToolCallStatus;
  durationMs: number | null;
  createdAt: Date;
}

export interface RecordToolCallInput {
  conversationId?: string | null;
  sessionId?: string | null;
  toolName: string;
  permissionLevel: PermissionLevel;
  args: Record<string, unknown>;
  result?: unknown;
  errorMessage?: string;
  status: ToolCallStatus;
  durationMs?: number;
}

export interface FindToolCallsOptions {
  conversationId?: string;
  toolName?: string;
  limit?: number;
  offset?: number;
}
