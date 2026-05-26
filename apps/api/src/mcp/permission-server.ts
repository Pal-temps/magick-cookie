#!/usr/bin/env bun
/**
 * MCP Permission Server (stdio)
 *
 * Spawned by Claude CLI via --mcp-config when --permission-prompt-tool is set.
 * Claude CLI calls the "ask" tool for every action that needs a permission.
 * This script:
 *   1. Receives the permission request via JSON-RPC on stdin
 *   2. POSTs it to the Magick Cookie API
 *   3. Long-polls until the user Allow/Deny in the app UI
 *   4. Returns { behavior: "allow" | "deny" } to Claude CLI
 *
 * Env vars (set via mcp-config):
 *   MAGICK_API_URL     — e.g. http://localhost:3000
 *   MAGICK_SESSION_ID  — Tauri session id for UI matching
 */

import { createInterface } from "readline";

const API_URL = process.env.MAGICK_API_URL ?? "http://localhost:3000";
const SESSION_ID = process.env.MAGICK_SESSION_ID ?? "unknown";

const rl = createInterface({ input: process.stdin, terminal: false });

function reply(obj: unknown) {
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
    // ── MCP handshake ──────────────────────────────────────────────────────────
    case "initialize":
      reply({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "magick_perm", version: "1.0.0" },
        },
      });
      break;

    case "notifications/initialized":
      // No response needed for notifications
      break;

    // ── Tool list ──────────────────────────────────────────────────────────────
    case "tools/list":
      reply({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "ask",
              description:
                "Ask the user for permission before performing a sensitive action " +
                "(writing files, running commands, accessing network…). " +
                "Returns { behavior: 'allow' } or { behavior: 'deny' }.",
              inputSchema: {
                type: "object",
                properties: {
                  tool_name: {
                    type: "string",
                    description: "Name of the tool requesting permission",
                  },
                  tool_input: {
                    description: "The exact input that will be passed to the tool",
                  },
                  tool_use_id: {
                    type: "string",
                    description: "The tool_use_id from the assistant message",
                  },
                },
                required: ["tool_name", "tool_input", "tool_use_id"],
              },
            },
          ],
        },
      });
      break;

    // ── Tool call ──────────────────────────────────────────────────────────────
    case "tools/call": {
      const toolName = (params?.name as string) ?? "";
      if (toolName !== "ask") {
        reply({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
        break;
      }

      const args = (params?.arguments ?? {}) as {
        tool_name?: string;
        tool_input?: unknown;
        tool_use_id?: string;
      };

      let behavior: "allow" | "deny" = "deny";

      try {
        // 1. Create pending permission request in API
        const createRes = await fetch(`${API_URL}/api/ai/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: SESSION_ID,
            tool_name: args.tool_name ?? "unknown",
            tool_input: args.tool_input ?? {},
          }),
        });

        if (!createRes.ok) {
          throw new Error(`API returned ${createRes.status}`);
        }

        const { id: requestId } = (await createRes.json()) as { id: string };

        // 2. Long-poll for decision (28s — API will timeout at 29s)
        const decisionRes = await fetch(
          `${API_URL}/api/ai/permissions/${requestId}`,
          { signal: AbortSignal.timeout(28_000) },
        );

        if (decisionRes.ok) {
          const data = (await decisionRes.json()) as { behavior: "allow" | "deny" };
          behavior = data.behavior;
        }
      } catch {
        // Timeout, API unreachable, or JSON parse error → deny for safety
        behavior = "deny";
      }

      reply({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ behavior }),
            },
          ],
        },
      });
      break;
    }

    // ── Unknown method ─────────────────────────────────────────────────────────
    default:
      if (id !== undefined) {
        reply({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
  }
});

// Graceful exit when stdin closes (Claude CLI process exits)
rl.on("close", () => {
  process.exit(0);
});
