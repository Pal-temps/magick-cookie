import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

// ─── Types (mirror Rust mcp_client.rs) ───

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  auto_connect: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpServerStatus {
  id: string;
  name: string;
  connected: boolean;
  tools: McpTool[];
  enabled: boolean;
  auto_connect: boolean;
}

// ─── State ───

const [servers, setServers] = createSignal<McpServerStatus[]>([]);
const [loading, setLoading] = createSignal(false);

// ─── Store ───

export function useMcpStore() {
  async function fetchServers() {
    setLoading(true);
    try {
      const list = await invoke<McpServerStatus[]>("mcp_get_status");
      setServers(list);
    } catch {
      setServers([]);
    }
    setLoading(false);
  }

  async function addServer(config: McpServerConfig) {
    await invoke("mcp_add_server", { config });
    await fetchServers();
  }

  async function removeServer(serverId: string) {
    await invoke("mcp_remove_server", { serverId });
    await fetchServers();
  }

  async function connectServer(serverId: string): Promise<McpTool[]> {
    const tools = await invoke<McpTool[]>("mcp_connect_server", { serverId });
    await fetchServers();
    return tools;
  }

  async function disconnectServer(serverId: string) {
    await invoke("mcp_disconnect_server", { serverId });
    await fetchServers();
  }

  async function callTool(toolName: string, args: unknown): Promise<string> {
    return invoke<string>("mcp_call_tool", { toolName, arguments: args });
  }

  async function setAutoConnect(serverId: string, autoConnect: boolean) {
    await invoke("mcp_set_auto_connect", { serverId, autoConnect });
    await fetchServers();
  }

  async function autoConnectAll() {
    await invoke<string[]>("mcp_auto_connect_all");
    await fetchServers();
  }

  return {
    servers,
    loading,
    fetchServers,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    callTool,
    setAutoConnect,
    autoConnectAll,
  };
}
