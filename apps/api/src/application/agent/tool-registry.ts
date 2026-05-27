import { z } from "zod";
import type { PermissionLevel, ToolCallStatus } from "../../domain/ai-tool-call/ai-tool-call.entity";
import type { AiToolCallService } from "../ai-tool-call/ai-tool-call.service";

export type { PermissionLevel, ToolCallStatus };

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
}

export interface ToolRateLimit {
  limit: number;
  windowMs: number;
}

export interface ToolContext {
  conversationId?: string | null;
  sessionId?: string | null;
}

/**
 * Result of dispatching a tool through the registry.
 * Always a structured outcome — never throws for predictable conditions
 * (invalid input, rate limit, permission denied).
 */
export interface ToolDispatchResult {
  status: ToolCallStatus;
  toolName: string;
  result?: unknown;
  error?: string;
  details?: unknown;
}

export interface AgentTool {
  name: string;
  description: string;
  /** Human-readable parameter summary rendered into the LLM system prompt. Derived from {@link paramsSchema} when using {@link defineTool}. */
  parameters: Record<string, ToolParameter>;
  /** Zod schema validated before each call. Optional for legacy tools. */
  paramsSchema?: z.ZodTypeAny;
  /** `auto` executes without interaction, `user-confirm` and `admin` require permission wiring (enforced by the dispatcher). Defaults to `auto` when omitted. */
  permissionLevel?: PermissionLevel;
  /** Per-tool in-memory sliding window. */
  rateLimit?: ToolRateLimit;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

interface DefineToolConfig<T extends z.ZodTypeAny> {
  name: string;
  description: string;
  params: T;
  permissionLevel?: PermissionLevel;
  rateLimit?: ToolRateLimit;
  execute: (params: z.infer<T>) => Promise<unknown>;
}

/**
 * Describe a tool with a zod schema for params and a typed execute.
 * The registry uses the schema to validate before dispatch and to render
 * the parameter list for the LLM system prompt.
 *
 * The returned {@link AgentTool.execute} also validates via zod when called
 * directly (outside dispatch), so callers that bypass the registry still get
 * a structured `{ error, details }` on invalid input instead of a crash.
 */
export function defineTool<T extends z.ZodTypeAny>(cfg: DefineToolConfig<T>): AgentTool {
  return {
    name: cfg.name,
    description: cfg.description,
    parameters: deriveLlmParameters(cfg.params),
    paramsSchema: cfg.params,
    permissionLevel: cfg.permissionLevel ?? "auto",
    rateLimit: cfg.rateLimit,
    execute: async (rawParams) => {
      const parsed = cfg.params.safeParse(rawParams);
      if (!parsed.success) {
        return { error: "Parametres invalides", details: parsed.error.issues };
      }
      return cfg.execute(parsed.data);
    },
  };
}

// ─── LLM parameter rendering (derived from zod) ───

function deriveLlmParameters(schema: z.ZodTypeAny): Record<string, ToolParameter> {
  // Only ZodObject is meaningful for tool params — everything else renders empty.
  const objSchema = unwrap(schema);
  if (!(objSchema instanceof z.ZodObject)) return {};
  const shape = objSchema.shape as Record<string, z.ZodTypeAny>;
  const out: Record<string, ToolParameter> = {};
  for (const [key, value] of Object.entries(shape)) {
    const unwrapped = unwrap(value);
    out[key] = {
      type: zodTypeName(unwrapped),
      description: (value as { description?: string }).description ?? "",
      required: !value.isOptional(),
    };
  }
  return out;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = (current as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType;
  }
  return current;
}

function zodTypeName(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodEnum) return "enum";
  if (schema instanceof z.ZodArray) return "array";
  if (schema instanceof z.ZodObject) return "object";
  return "unknown";
}

// ─── Rate limiter (in-memory sliding window) ───

class RateLimiter {
  // key -> sorted ascending array of epoch-ms timestamps
  private hits = new Map<string, number[]>();

  /** Returns true when the call is allowed and records the hit; false otherwise. */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const prev = this.hits.get(key) ?? [];
    const active = prev.filter((t) => t > cutoff);
    if (active.length >= limit) {
      this.hits.set(key, active);
      return false;
    }
    active.push(now);
    this.hits.set(key, active);
    return true;
  }

  reset() {
    this.hits.clear();
  }
}

// ─── Registry ───

/**
 * Render an arbitrary list of tools to the markdown block consumed by the LLM
 * system prompt. Extracted from {@link ToolRegistry.describeForLlm} so callers
 * (e.g. session-mode-filtered prompts) can format a sub-set of tools without
 * round-tripping through the registry.
 */
export function formatToolsForLlm(tools: AgentTool[]): string {
  if (tools.length === 0) return "";
  const lines = tools.map((t) => {
    const params = Object.entries(t.parameters);
    const paramStr = params.length > 0
      ? params.map(([k, v]) => `    - ${k} (${v.type}${v.required === false ? ", optionnel" : ""}): ${v.description}`).join("\n")
      : "    (aucun parametre)";
    const permissionNote = t.permissionLevel === "auto" ? "" : ` [permission: ${t.permissionLevel}]`;
    return `- **${t.name}**${permissionNote}: ${t.description}\n  Parametres:\n${paramStr}`;
  });
  return lines.join("\n\n");
}

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();
  private limiter = new RateLimiter();
  private _disabledTools = new Set<string>();

  constructor(private auditService?: AiToolCallService) {}

  register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: AgentTool[]) {
    for (const tool of tools) this.register(tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  all(): AgentTool[] {
    return [...this.tools.values()];
  }

  isDisabled(name: string): boolean {
    return this._disabledTools.has(name);
  }

  /** Replace the set of user-disabled tools (called on preferences save). */
  setDisabledTools(tools: string[]): void {
    this._disabledTools = new Set(tools);
  }

  /** Build a description of all (non-disabled) tools for the LLM system prompt */
  describeForLlm(): string {
    const tools = this.all().filter((t) => !this._disabledTools.has(t.name));
    if (tools.length === 0) return "";

    const lines = tools.map((t) => {
      const params = Object.entries(t.parameters);
      const paramStr = params.length > 0
        ? params.map(([k, v]) => `    - ${k} (${v.type}${v.required === false ? ", optionnel" : ""}): ${v.description}`).join("\n")
        : "    (aucun parametre)";
      const permissionNote = t.permissionLevel === "auto" ? "" : ` [permission: ${t.permissionLevel}]`;
      return `- **${t.name}**${permissionNote}: ${t.description}\n  Parametres:\n${paramStr}`;
    });

    return lines.join("\n\n");
  }

  /**
   * Dispatch a tool by name. Never throws for predictable conditions — returns a
   * {@link ToolDispatchResult} the caller can render back to the LLM.
   *
   * Pipeline: tool lookup → zod validation → rate limit check → permission check
   * → execute → audit record.
   */
  async dispatch(
    name: string,
    rawParams: Record<string, unknown>,
    context: ToolContext = {},
  ): Promise<ToolDispatchResult> {
    const tool = this.get(name);
    if (!tool) {
      await this.recordAudit({
        toolName: name,
        permissionLevel: "auto",
        args: rawParams,
        status: "error",
        errorMessage: `Unknown tool: ${name}`,
        context,
      });
      return { status: "error", toolName: name, error: `Outil inconnu: ${name}` };
    }

    const permissionLevel: PermissionLevel = tool.permissionLevel ?? "auto";

    // 1) Validate params via zod (if schema provided).
    let params: Record<string, unknown> = rawParams;
    if (tool.paramsSchema) {
      const parsed = tool.paramsSchema.safeParse(rawParams);
      if (!parsed.success) {
        await this.recordAudit({
          toolName: tool.name,
          permissionLevel,
          args: rawParams,
          status: "invalid_input",
          errorMessage: "Invalid input",
          context,
        });
        return {
          status: "invalid_input",
          toolName: tool.name,
          error: "Parametres invalides",
          details: parsed.error.issues,
        };
      }
      params = parsed.data as Record<string, unknown>;
    }

    // 2) Rate limit (scoped per conversation+tool when available, otherwise global per tool).
    if (tool.rateLimit) {
      const key = `${tool.name}:${context.conversationId ?? context.sessionId ?? "global"}`;
      if (!this.limiter.check(key, tool.rateLimit.limit, tool.rateLimit.windowMs)) {
        await this.recordAudit({
          toolName: tool.name,
          permissionLevel,
          args: params,
          status: "rate_limited",
          errorMessage: `Rate limit exceeded (${tool.rateLimit.limit}/${tool.rateLimit.windowMs}ms)`,
          context,
        });
        return {
          status: "rate_limited",
          toolName: tool.name,
          error: `Limite d'appels atteinte pour ${tool.name}`,
        };
      }
    }

    // 3) User-disabled check.
    if (this._disabledTools.has(tool.name)) {
      await this.recordAudit({
        toolName: tool.name,
        permissionLevel,
        args: params,
        status: "disabled",
        errorMessage: "Tool disabled by user",
        context,
      });
      return {
        status: "disabled",
        toolName: tool.name,
        error: `L'outil ${tool.name} est désactivé dans les paramètres.`,
      };
    }

    // 4) Permission check. `user-confirm`/`admin` require an external approval
    //    channel that callers wire up (agent.service / IDE session). When that
    //    channel is not wired, we deny conservatively and record the attempt.
    if (permissionLevel !== "auto") {
      // TODO(P4/P6): integrate with session-level permission_request event.
      // Until then, flag the attempt and let the caller surface the error to the user.
      await this.recordAudit({
        toolName: tool.name,
        permissionLevel,
        args: params,
        status: "denied",
        errorMessage: `Permission ${permissionLevel} required`,
        context,
      });
      return {
        status: "denied",
        toolName: tool.name,
        error: `Cet outil requiert une confirmation (${permissionLevel}) qui n'est pas encore branchee.`,
      };
    }

    // 4) Execute + audit.
    const startedAt = Date.now();
    try {
      const rawResult = await tool.execute(params);
      const durationMs = Date.now() - startedAt;
      // Strip _undoToken from the result the LLM sees — it's audit-only.
      let undoToken: string | null = null;
      let result: unknown = rawResult;
      if (rawResult !== null && typeof rawResult === "object" && "_undoToken" in rawResult) {
        const { _undoToken, ...rest } = rawResult as Record<string, unknown>;
        undoToken = typeof _undoToken === "string" ? _undoToken : null;
        result = rest;
      }
      await this.recordAudit({
        toolName: tool.name,
        permissionLevel,
        args: params,
        result,
        status: "ok",
        durationMs,
        undoToken,
        context,
      });
      return { status: "ok", toolName: tool.name, result };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      await this.recordAudit({
        toolName: tool.name,
        permissionLevel,
        args: params,
        status: "error",
        errorMessage: message,
        durationMs,
        context,
      });
      return { status: "error", toolName: tool.name, error: message };
    }
  }

  private async recordAudit(input: {
    toolName: string;
    permissionLevel: PermissionLevel;
    args: Record<string, unknown>;
    result?: unknown;
    errorMessage?: string;
    status: ToolCallStatus;
    durationMs?: number;
    undoToken?: string | null;
    context: ToolContext;
  }): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.record({
        conversationId: input.context.conversationId ?? null,
        sessionId: input.context.sessionId ?? null,
        toolName: input.toolName,
        permissionLevel: input.permissionLevel,
        args: input.args,
        result: input.result,
        errorMessage: input.errorMessage,
        status: input.status,
        durationMs: input.durationMs,
        undoToken: input.undoToken,
      });
    } catch (err) {
      // Audit failure must never break the dispatch path.
      console.error("[ai-tool-call] audit record failed:", err);
    }
  }
}
