#!/usr/bin/env bun
/**
 * Magick MCP Server (stdio)
 *
 * Spawned by Claude CLI via --mcp-config.
 * Exposes two categories of tools to Cookia:
 *
 * 1. `ask` — Permission handler (--permission-prompt-tool mcp__magick__ask)
 *    Intercepts Write, Bash, etc. and shows a dialog in the app UI.
 *    Certain writes to the app source code are auto-denied.
 *
 * 2. All ToolRegistry tools — Fetched from the API at startup.
 *    Notes, tasks, calendar, email, snippets, etc.
 *    This is the "hooks" layer: Claude uses these instead of writing files.
 *
 * Env vars:
 *   MAGICK_API_URL      e.g. http://localhost:47300
 *   MAGICK_SESSION_ID   Tauri session id
 *   MAGICK_APP_ROOT     Absolute path to the Magick Cookie project root
 *                       Used to auto-deny writes to the app's source files.
 */

import { createInterface } from "readline";
import { isProtectedSourcePath } from "./source-protection";

const API_URL = process.env.MAGICK_API_URL ?? "http://localhost:47300";
const SESSION_ID = process.env.MAGICK_SESSION_ID ?? "unknown";
const APP_ROOT = process.env.MAGICK_APP_ROOT ?? "";

// ─── Types ───────────────────────────────────────────────────────────────────

interface McpTool {
  name: string;
  description: string;
  permissionLevel?: string;
  inputSchema: unknown;
}

// ─── Fetch tools from API ─────────────────────────────────────────────────────

async function fetchApiTools(): Promise<McpTool[]> {
  try {
    const res = await fetch(`${API_URL}/api/ai/tools`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: McpTool[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

// ─── Permission logic ─────────────────────────────────────────────────────────

async function handlePermissionAsk(args: {
  tool_name?: string;
  tool_input?: unknown;
  tool_use_id?: string;
}): Promise<{ behavior: "allow" | "deny"; message?: string }> {
  const toolName = args.tool_name ?? "unknown";
  const toolInput = (args.tool_input ?? {}) as Record<string, unknown>;

  // ── Auto-deny writes to app source files ──────────────────────────────────
  if (toolName === "Write" || toolName === "Edit") {
    const filePath = (toolInput.file_path ?? toolInput.path ?? "") as string;
    if (filePath && isProtectedSourcePath(filePath, APP_ROOT)) {
      return {
        behavior: "deny",
        message:
          "Écriture dans le code source de l'application refusée automatiquement. " +
          "Utilisez les outils MCP (notes, tasks, etc.) pour les opérations de données.",
      };
    }
  }

  // ── Surface to user via API long-poll ─────────────────────────────────────
  try {
    const createRes = await fetch(`${API_URL}/api/ai/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: SESSION_ID,
        tool_name: toolName,
        tool_input: toolInput,
      }),
      signal: AbortSignal.timeout(3_000),
    });

    if (!createRes.ok) throw new Error(`API ${createRes.status}`);
    const { id: requestId } = (await createRes.json()) as { id: string };

    // Long-poll for user decision (28s — API times out at 29s)
    const decisionRes = await fetch(
      `${API_URL}/api/ai/permissions/${requestId}`,
      { signal: AbortSignal.timeout(28_000) },
    );

    if (!decisionRes.ok) return { behavior: "deny" };
    const data = (await decisionRes.json()) as { behavior: "allow" | "deny" };
    return { behavior: data.behavior };
  } catch {
    return { behavior: "deny" };
  }
}

// ─── MCP stdio server ─────────────────────────────────────────────────────────

let apiTools: McpTool[] = [];

// Fetch tools eagerly (non-blocking — we proceed even if this fails)
fetchApiTools().then((tools) => {
  apiTools = tools;
});

const rl = createInterface({ input: process.stdin, terminal: false });

function send(obj: unknown) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

rl.on("line", async (raw) => {
  const line = raw.trim();
  if (!line) return;

  let req: Record<string, unknown>;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = req as {
    id?: unknown;
    method: string;
    params?: Record<string, unknown>;
  };

  switch (method) {
    // ── Handshake ─────────────────────────────────────────────────────────────
    case "initialize":
      // Refresh tool list when Claude CLI connects
      fetchApiTools().then((tools) => { apiTools = tools; });
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "magick", version: "2.0.0" },
        },
      });
      break;

    case "notifications/initialized":
      break;

    // ── Tool list ──────────────────────────────────────────────────────────────
    case "tools/list": {
      // Permission tool (always present)
      const permTool = {
        name: "ask",
        description:
          "Ask the user for permission before performing a sensitive action " +
          "(writing files outside the project, running shell commands, network access). " +
          "Returns { behavior: 'allow' } or { behavior: 'deny' }.",
        inputSchema: {
          type: "object",
          properties: {
            tool_name: { type: "string" },
            tool_input: {},
            tool_use_id: { type: "string" },
          },
          required: ["tool_name", "tool_input", "tool_use_id"],
        },
      };

      // ToolRegistry tools — notes, tasks, calendar, etc.
      const registryTools = apiTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      send({
        jsonrpc: "2.0",
        id,
        result: { tools: [permTool, ...registryTools] },
      });
      break;
    }

    // ── Tool call ──────────────────────────────────────────────────────────────
    case "tools/call": {
      const toolName = (params?.name as string) ?? "";
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

      // Permission tool
      if (toolName === "ask") {
        const result = await handlePermissionAsk({
          tool_name: toolArgs.tool_name as string | undefined,
          tool_input: toolArgs.tool_input,
          tool_use_id: toolArgs.tool_use_id as string | undefined,
        });

        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result) }],
          },
        });
        break;
      }

      // ToolRegistry tools
      try {
        const res = await fetch(`${API_URL}/api/ai/tools/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: toolName,
            arguments: toolArgs,
            session_id: SESSION_ID,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          send({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: `API error: ${res.status}` },
          });
          break;
        }

        const dispatchResult = await res.json();

        // Map ToolDispatchResult to MCP response
        const isError = dispatchResult.status !== "ok";
        const content = isError
          ? dispatchResult.error ?? dispatchResult.status
          : dispatchResult.result;

        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              { type: "text", text: JSON.stringify(content) },
            ],
            isError,
          },
        });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32603,
            message: `Tool call failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        });
      }
      break;
    }

    // ── Unknown method ─────────────────────────────────────────────────────────
    default:
      if (id !== undefined) {
        send({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
  }
});

rl.on("close", () => process.exit(0));
