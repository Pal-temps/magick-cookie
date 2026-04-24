import { createSignal, Show, For, onMount } from "solid-js";
import { useMcpStore, type McpServerConfig } from "../../../application/stores/mcpStore";
import { useT } from "../../../i18n/context";

export function McpPanel() {
  const { t } = useT();
  const mcp = useMcpStore();
  const [adding, setAdding] = createSignal(false);
  const [form, setForm] = createSignal({ name: "", command: "", args: "", env: "" });

  onMount(() => {
    mcp.autoConnectAll();
  });

  function parseEnvVars(raw: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    }
    return env;
  }

  async function handleAdd() {
    const f = form();
    if (!f.name.trim() || !f.command.trim()) return;

    const config: McpServerConfig = {
      id: f.name.trim().toLowerCase().replace(/\s+/g, "-"),
      name: f.name.trim(),
      command: f.command.trim(),
      args: f.args.trim() ? f.args.trim().split(/\s+/) : [],
      env: parseEnvVars(f.env),
      enabled: true,
      auto_connect: false,
    };

    await mcp.addServer(config);
    setForm({ name: "", command: "", args: "", env: "" });
    setAdding(false);
  }

  async function toggleConnection(serverId: string, connected: boolean) {
    if (connected) {
      await mcp.disconnectServer(serverId);
    } else {
      try {
        await mcp.connectServer(serverId);
      } catch (e) {
        console.error("MCP connect failed:", e);
      }
    }
  }

  return (
    <div class="mcp-panel">
      <For each={mcp.servers()} fallback={
        <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
          {t("ide.mcpNoServers")}
        </div>
      }>
        {(server) => (
          <div class="mcp-server-item">
            <div class="mcp-server-item__header">
              <span class={`cc-status-dot ${server.connected ? "cc-status-dot--ready" : ""}`} />
              <span class="mcp-server-item__name">{server.name}</span>
              <Show when={server.connected && server.tools.length > 0}>
                <span class="mcp-server-item__tools">
                  {server.tools.length} {t("ide.mcpTools")}
                </span>
              </Show>
              <label
                class="mcp-server-item__auto-connect"
                title={t("ide.mcpAutoConnect")}
              >
                <input
                  type="checkbox"
                  checked={server.auto_connect}
                  onChange={() => mcp.setAutoConnect(server.id, !server.auto_connect)}
                />
                <span style={{ "font-size": "10px" }}>auto</span>
              </label>
              <button
                class={`mcp-server-item__toggle ${server.connected ? "mcp-server-item__toggle--disconnect" : ""}`}
                onClick={() => toggleConnection(server.id, server.connected)}
                title={server.connected ? t("ide.mcpDisconnect") : t("ide.mcpConnect")}
              >
                {server.connected ? "■" : "▶"}
              </button>
              <button
                class="mcp-server-item__delete"
                onClick={() => mcp.removeServer(server.id)}
                title={t("common.delete")}
              >
                &times;
              </button>
            </div>
            <Show when={server.connected && server.tools.length > 0}>
              <div class="mcp-server-item__tool-list">
                <For each={server.tools}>
                  {(tool) => (
                    <div class="mcp-server-item__tool" title={tool.description}>
                      <span class="mcp-server-item__tool-icon">T</span>
                      {tool.name}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>

      <Show when={adding()}>
        <div class="mcp-add-form">
          <input
            class="mcp-add-form__input"
            type="text"
            placeholder={t("ide.mcpServerName")}
            value={form().name}
            onInput={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            ref={(el) => requestAnimationFrame(() => el.focus())}
          />
          <input
            class="mcp-add-form__input"
            type="text"
            placeholder={`${t("ide.mcpCommand")} (e.g. npx -y @modelcontextprotocol/server-fs)`}
            value={form().command}
            onInput={(e) => setForm((f) => ({ ...f, command: e.currentTarget.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
          />
          <input
            class="mcp-add-form__input"
            type="text"
            placeholder={`${t("ide.mcpArgs")} (${t("ide.optional")})`}
            value={form().args}
            onInput={(e) => setForm((f) => ({ ...f, args: e.currentTarget.value }))}
            onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}
          />
          <textarea
            class="mcp-add-form__input"
            rows={2}
            placeholder={`${t("ide.mcpEnvVars")} — ${t("ide.mcpEnvVarsPlaceholder")}`}
            value={form().env}
            onInput={(e) => setForm((f) => ({ ...f, env: e.currentTarget.value }))}
            onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}
            style={{ resize: "vertical", "font-family": "monospace", "font-size": "11px" }}
          />
          <div style={{ display: "flex", gap: "4px" }}>
            <button class="mcp-add-form__btn mcp-add-form__btn--confirm" onClick={handleAdd}>
              {t("common.add")}
            </button>
            <button class="mcp-add-form__btn" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </Show>

      <button
        class="ide-sidebar-link ide-sidebar-link--accent"
        style={{ "font-size": "11px" }}
        onClick={() => setAdding(true)}
      >
        <span class="ide-sidebar-link__icon">+</span> {t("ide.mcpAddServer")}
      </button>
    </div>
  );
}
