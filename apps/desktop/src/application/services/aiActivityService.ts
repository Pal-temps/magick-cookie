// Thin facade over /api/ai/tool-calls — same DDD pattern as gitService / vaultService.
// Used by the AI Activity dashboard (Settings → AI Activity).

import { api } from "../../infrastructure/api/apiClient";

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
  createdAt: string;
}

export interface AiActivityStats {
  totalCalls: number;
  byTool: { toolName: string; count: number }[];
  byStatus: Record<ToolCallStatus, number>;
  avgDurationMs: number | null;
  recentFailures: AiToolCall[];
}

export interface AiToolCallListParams {
  conversationId?: string;
  toolName?: string;
  status?: ToolCallStatus;
  limit?: number;
  offset?: number;
}

function buildQuery(params: AiToolCallListParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export const aiActivityService = {
  list: (params: AiToolCallListParams = {}) =>
    api.get<AiToolCall[]>(`/api/ai/tool-calls${buildQuery(params)}`),

  getStats: () => api.get<AiActivityStats>("/api/ai/tool-calls/stats"),
};
