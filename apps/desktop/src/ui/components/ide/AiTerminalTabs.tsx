import { createSignal, Show, For } from "solid-js";
import { windowService } from "../../../application/services/windowService";
import { useAiSessionStore, type ProviderInfo } from "../../../application/stores/aiSessionStore";
import { useIdeStore, GRID_TEMPLATES } from "../../../application/stores/ideStore";
import { useSecretsStore } from "../../../application/stores/secretsStore";
import { useCliTabStore } from "../../../application/stores/cliTabStore";
import { useT } from "../../../i18n/context";
import { AiChatContent } from "./AiChatContent";
import { PastSessionViewer } from "./PastSessionViewer";
import { Terminal } from "./Terminal";
import { TokenStatusBar } from "./TokenStatusBar";
import type { MonacoEditorApi } from "./MonacoEditor";

interface AiTerminalTabsProps {
  editorApi?: MonacoEditorApi;
}

const SLOT_LABELS = ["a", "b", "c", "d"];

// Default models per provider
const DEFAULT_MODELS: Record<string, string[]> = {
  "claude-cli": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  "anthropic-api": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
  "openai-api": ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  "ollama": ["llama3.2", "mistral", "codellama", "deepseek-coder"],
  "lmstudio": ["default"],
};

interface ConfigDialogState {
  provider: ProviderInfo;
  model: string;
  apiKey: string;
  baseUrl: string;
}

// Mini SVG icons for grid templates (14x14)
function GridIcon(props: { id: string }) {
  const s = 14; const c = "currentColor";
  switch (props.id) {
    case "single":  return <svg width={s} height={s}><rect x="0" y="0" width={s} height={s} rx="2" fill={c} /></svg>;
    case "side":    return <svg width={s} height={s}><rect x="0" y="0" width="6" height={s} rx="1" fill={c} /><rect x="8" y="0" width="6" height={s} rx="1" fill={c} /></svg>;
    case "stack":   return <svg width={s} height={s}><rect x="0" y="0" width={s} height="6" rx="1" fill={c} /><rect x="0" y="8" width={s} height="6" rx="1" fill={c} /></svg>;
    case "grid":    return <svg width={s} height={s}><rect x="0" y="0" width="6" height="6" rx="1" fill={c} /><rect x="8" y="0" width="6" height="6" rx="1" fill={c} /><rect x="0" y="8" width="6" height="6" rx="1" fill={c} /><rect x="8" y="8" width="6" height="6" rx="1" fill={c} /></svg>;
    case "left-2r": return <svg width={s} height={s}><rect x="0" y="0" width="6" height={s} rx="1" fill={c} /><rect x="8" y="0" width="6" height="6" rx="1" fill={c} /><rect x="8" y="8" width="6" height="6" rx="1" fill={c} /></svg>;
    case "top-2b":  return <svg width={s} height={s}><rect x="0" y="0" width={s} height="6" rx="1" fill={c} /><rect x="0" y="8" width="6" height="6" rx="1" fill={c} /><rect x="8" y="8" width="6" height="6" rx="1" fill={c} /></svg>;
    default:        return <svg width={s} height={s}><rect x="0" y="0" width={s} height={s} rx="2" fill={c} /></svg>;
  }
}

export function AiTerminalTabs(props: AiTerminalTabsProps) {
  const { t } = useT();
  const ai = useAiSessionStore();
  const ide = useIdeStore();
  const secretsVault = useSecretsStore();
  const [showNewMenu, setShowNewMenu] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; sessionId: string } | null>(null);
  const [configDialog, setConfigDialog] = createSignal<ConfigDialogState | null>(null);
  const [pendingAssignSlot, setPendingAssignSlot] = createSignal<number | null>(null);

  // CLI PTY terminals (shared store so sidebar can also create them)
  const cli = useCliTabStore();
  const [activeTabId, setActiveTabId] = createSignal<string | null>(null);

  // ─── Unified tab list ───

  type UnifiedTab = { id: string; type: "cli" | "ai"; label: string; badge: string; isActive: boolean; isStreaming: boolean; phase: string };

  const allTabs = (): UnifiedTab[] => {
    const tabs: UnifiedTab[] = [];
    // CLI terminals
    for (const tab of cli.cliTabs()) {
      tabs.push({ id: tab.id, type: "cli", label: tab.label, badge: tab.mode === "shell" ? "$" : "CC", isActive: false, isStreaming: false, phase: "ready" });
    }
    // AI sessions
    for (const session of ai.sessions().values()) {
      tabs.push({
        id: session.id, type: "ai", label: session.label || session.model || session.provider,
        badge: providerBadge(session.provider), isActive: false,
        isStreaming: session.isStreaming, phase: session.phase,
      });
    }
    // Mark active
    const active = activeTabId() ?? ai.activeSessionId();
    for (const tab of tabs) {
      tab.isActive = tab.id === active;
    }
    return tabs;
  };

  function switchToTab(id: string) {
    setActiveTabId(id);
    // Also sync AI session if it's an AI tab
    if (ai.sessions().has(id)) {
      ai.switchSession(id);
    }
  }

  function currentTabId(): string | null {
    return activeTabId() ?? cli.activeCliTabId() ?? ai.activeSessionId() ?? null;
  }

  // ─── Tab context menu ───

  function handleTabContextMenu(e: MouseEvent, tabId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId: tabId });
    requestAnimationFrame(() => {
      const close = () => { setContextMenu(null); document.removeEventListener("mousedown", close); };
      document.addEventListener("mousedown", close);
    });
  }

  async function detachSession(sessionId: string) {
    setContextMenu(null);
    const session = ai.sessions().get(sessionId);
    const title = session ? (session.model || session.provider) : t("ide.newAiTerminal");
    await windowService.openDetached({
      label: `ai-session-${sessionId.slice(0, 8)}`,
      title: `${title} — Magick Cookie`,
      route: `/detached-session/${sessionId}`,
    });
  }

  function closeTab(tabId: string) {
    // CLI terminal?
    const isCliTab = cli.cliTabs().find((t) => t.id === tabId);
    if (isCliTab) {
      cli.closeCliTab(tabId);
    } else {
      // AI session
      ai.stopSession(tabId);
    }
    // Switch to another tab if closing the active one
    if (activeTabId() === tabId || cli.activeCliTabId() === tabId) {
      const remaining = allTabs().filter((t) => t.id !== tabId);
      setActiveTabId(remaining[0]?.id ?? null);
    }
  }

  // ─── Provider selection + config ───

  async function selectProvider(provider: ProviderInfo) {
    setShowNewMenu(false);
    // Claude CLI → launch directly (no config dialog needed)
    if (provider.id === "claude-cli") {
      try {
        await launchSession(provider.id, "");
      } catch (e) {
        console.error("Failed to start Claude CLI session:", e);
      }
      return;
    }
    const models = DEFAULT_MODELS[provider.id] ?? ["default"];
    const savedKey = await secretsVault.getAppSecret(`ai_apikey_${provider.id}`) ?? "";
    const savedUrl = localStorage.getItem(`ide-baseurl-${provider.id}`) ?? "";
    setConfigDialog({ provider, model: models[0], apiKey: savedKey, baseUrl: savedUrl });
  }

  async function launchSession(providerId: string, model: string, apiKey?: string, baseUrl?: string): Promise<string> {
    const cwd = ide.projectPath() ?? ".";
    const sessionId = await ai.startSession({
      provider: providerId, model, cwd,
      api_key: apiKey || null, base_url: baseUrl || null,
    });
    setActiveTabId(sessionId);
    return sessionId;
  }

  async function confirmConfig() {
    const cfg = configDialog();
    if (!cfg) return;
    if (cfg.apiKey) secretsVault.setAppSecret(`ai_apikey_${cfg.provider.id}`, cfg.apiKey);
    if (cfg.baseUrl) localStorage.setItem(`ide-baseurl-${cfg.provider.id}`, cfg.baseUrl);
    const sessionId = await launchSession(cfg.provider.id, cfg.model, cfg.apiKey, cfg.baseUrl);
    const slot = pendingAssignSlot();
    if (slot !== null && sessionId) {
      ide.assignSlot(slot, sessionId);
      setPendingAssignSlot(null);
    }
    setConfigDialog(null);
  }

  const needsApiKey = () => {
    const cfg = configDialog();
    return cfg && (cfg.provider.id === "anthropic-api" || cfg.provider.id === "openai-api");
  };

  // ─── New session menu ───

  async function openNewMenu() {
    if (showNewMenu()) { setShowNewMenu(false); return; }
    await ai.fetchProviders();
    setShowNewMenu(true);
    requestAnimationFrame(() => {
      const close = () => { setShowNewMenu(false); document.removeEventListener("mousedown", close); };
      document.addEventListener("mousedown", close);
    });
  }

  // ─── Helpers ───

  const providerBadge = (provider: string): string => {
    const p = provider.toLowerCase();
    if (p.includes("claude")) return "CC";
    if (p.includes("openai") || p.includes("gpt")) return "GPT";
    if (p.includes("ollama")) return "OL";
    return p.slice(0, 2).toUpperCase();
  };

  function slotContent(slotIndex: number): { type: "cli"; id: string } | { type: "ai"; id: string } | null {
    // Check explicit grid slot assignments
    const slots = ide.gridSlots();
    const assigned = slots[slotIndex];
    if (assigned) {
      if (cli.cliTabs().find((t) => t.id === assigned)) return { type: "cli", id: assigned };
      if (ai.sessions().has(assigned)) return { type: "ai", id: assigned };
    }
    // Slot 0 fallback: show active tab
    if (slotIndex === 0) {
      const active = currentTabId();
      if (!active) return null;
      if (cli.cliTabs().find((t) => t.id === active)) return { type: "cli", id: active };
      if (ai.sessions().has(active)) return { type: "ai", id: active };
    }
    return null;
  }

  // ─── Render ───

  return (
    <div class="cc-terminal-tabs-root">
      {/* Tab bar */}
      <div class="cc-terminal-tabbar">
        <div class="cc-terminal-tabbar__tabs">
          <For each={allTabs()}>
            {(tab) => (
              <div
                class={`cc-terminal-tab ${tab.isActive ? "cc-terminal-tab--active" : ""}`}
                onClick={() => switchToTab(tab.id)}
                onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
              >
                <span class={`cc-status-dot ${tab.isStreaming ? "cc-status-dot--active" : tab.phase === "ready" ? "cc-status-dot--ready" : ""}`} />
                <span class="cc-terminal-tab__name">{tab.label}</span>
                <span class="cc-terminal-tab__badge">{tab.badge}</span>
                <button
                  class="cc-terminal-tab__close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  title={t("common.close")}
                >&times;</button>
              </div>
            )}
          </For>

          {/* New terminal [+] */}
          <div style={{ position: "relative" }}>
            <button class="cc-terminal-tab cc-terminal-tab--add" onClick={openNewMenu} title={t("ide.newAiTerminal")}>+</button>
            <Show when={showNewMenu()}>
              <div class="cc-new-session-menu" onMouseDown={(e) => e.stopPropagation()}>
                <div class="cc-new-session-menu__title">{t("ide.newAiTerminal")}</div>
                <For each={ai.providers()}>
                  {(provider) => (
                    <button
                      class={`cc-new-session-menu__item ${!provider.available ? "cc-new-session-menu__item--disabled" : ""}`}
                      onClick={() => provider.available && selectProvider(provider)}
                      disabled={!provider.available}
                    >
                      <span>{provider.name}</span>
                      <Show when={provider.capabilities.supports_tools}>
                        <span class="cc-new-session-menu__badge">tools</span>
                      </Show>
                      <Show when={!provider.available}>
                        <span class="cc-new-session-menu__badge">{t("ide.unavailable")}</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Token status (fills the gap) */}
        <TokenStatusBar />

        {/* Right actions */}
        <div class="cc-terminal-tabbar__actions">
          <div class="cc-grid-picker">
            <For each={GRID_TEMPLATES}>
              {(tpl) => (
                <button
                  class={`cc-grid-picker__btn ${ide.gridLayout() === tpl.id ? "cc-grid-picker__btn--active" : ""}`}
                  onClick={() => ide.switchGridLayout(tpl.id)}
                  title={tpl.name}
                ><GridIcon id={tpl.id} /></button>
              )}
            </For>
          </div>
          <div class="cc-terminal-tabbar__sep" />
          <button
            class={`cc-topbar-btn ${ide.codeDrawerOpen() ? "cc-topbar-btn--active" : ""}`}
            onClick={() => ide.toggleCodeDrawer()}
            title="Code (Ctrl+E)"
          >{t("ide.code")}</button>
          <button
            class={`cc-topbar-btn ${ide.contextPanelOpen() ? "cc-topbar-btn--active" : ""}`}
            onClick={() => ide.toggleContextPanel()}
            title="Context (Ctrl+\)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="9" height="14" rx="1" stroke="currentColor" stroke-width="1.5" />
              <rect x="12" y="1" width="3" height="14" rx="1" fill="currentColor" opacity="0.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid content */}
      <div
        class="cc-terminal-grid"
        style={{
          "grid-template-areas": ide.currentGrid().areas,
          "grid-template-columns": ide.currentGrid().columns,
          "grid-template-rows": ide.currentGrid().rows,
        }}
      >
        {Array.from({ length: ide.currentGrid().slotCount }, (_, i) => {
          const content = () => slotContent(i);
          return (
            <div class="cc-terminal-grid__slot" style={{ "grid-area": SLOT_LABELS[i] }}>
              {(() => {
                const c = content();
                if (c?.type === "cli") {
                  const tab = cli.cliTabs().find((t) => t.id === c.id);
                  const autoCmd = tab?.mode === "shell" ? undefined : "claude";
                  return <Terminal cwd={ide.projectPath() ?? "."} autoCommand={autoCmd} />;
                }
                if (c?.type === "ai") {
                  return <AiChatContent sessionId={c.id} editorApi={props.editorApi} />;
                }
                return (
                  <div class="cc-slot-empty">
                    <div class="cc-slot-empty__icon">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <path d="M8 20l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                        <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5" />
                      </svg>
                    </div>
                    <button class="cc-slot-empty__assign" onClick={async () => {
                      try {
                        const sessionId = await launchSession("claude-cli", "");
                        ide.assignSlot(i, sessionId);
                      } catch (e) {
                        console.error("Failed to start Claude CLI:", e);
                      }
                    }}>
                      Claude Code
                    </button>
                    <button class="cc-slot-empty__assign cc-slot-empty__assign--secondary" onClick={() => {
                      const id = cli.launchCliTerminal();
                      setActiveTabId(id);
                      ide.assignSlot(i, id);
                    }}>
                      Terminal
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* ─── Past Session Viewer (overlay) ─── */}
      <Show when={ai.loadedPastSession()}>
        <PastSessionViewer />
      </Show>

      {/* ─── Config Dialog (modal) ─── */}
      <Show when={configDialog()}>
        <div class="cc-config-overlay" onClick={() => setConfigDialog(null)}>
          <div class="cc-config-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="cc-config-dialog__header">
              <span>{t("ide.configure")} {configDialog()!.provider.name}</span>
              <button class="cc-config-dialog__close" onClick={() => setConfigDialog(null)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="cc-config-dialog__body">
              {/* Model selector */}
              <label class="cc-config-field">
                <span class="cc-config-field__label">{t("ide.model")}</span>
                <select
                  class="cc-config-field__select"
                  value={configDialog()!.model}
                  onChange={(e) => setConfigDialog((prev) => prev ? { ...prev, model: e.currentTarget.value } : null)}
                >
                  <For each={DEFAULT_MODELS[configDialog()!.provider.id] ?? []}>
                    {(m) => <option value={m}>{m}</option>}
                  </For>
                </select>
                <input
                  class="cc-config-field__input"
                  type="text"
                  placeholder={t("ide.customModel")}
                  value={configDialog()!.model}
                  onInput={(e) => setConfigDialog((prev) => prev ? { ...prev, model: e.currentTarget.value } : null)}
                />
              </label>

              {/* API Key (only for cloud providers) */}
              <Show when={needsApiKey()}>
                <label class="cc-config-field">
                  <span class="cc-config-field__label">{t("ide.apiKey")}</span>
                  <input
                    class="cc-config-field__input"
                    type="password"
                    placeholder={configDialog()!.provider.id === "anthropic-api" ? "sk-ant-api03-..." : "sk-..."}
                    value={configDialog()!.apiKey}
                    onInput={(e) => setConfigDialog((prev) => prev ? { ...prev, apiKey: e.currentTarget.value } : null)}
                  />
                  <span class="cc-config-field__hint">{t("ide.storedLocally")}</span>
                </label>
              </Show>

              {/* Base URL (optional) */}
              <label class="cc-config-field">
                <span class="cc-config-field__label">{t("ide.baseUrl")} <span style={{ "font-weight": "normal", color: "var(--text-muted)" }}>({t("ide.optional")})</span></span>
                <input
                  class="cc-config-field__input"
                  type="text"
                  placeholder={configDialog()!.provider.id === "ollama" ? "http://localhost:11434" : configDialog()!.provider.id === "lmstudio" ? "http://localhost:1234" : ""}
                  value={configDialog()!.baseUrl}
                  onInput={(e) => setConfigDialog((prev) => prev ? { ...prev, baseUrl: e.currentTarget.value } : null)}
                />
              </label>
            </div>

            <div class="cc-config-dialog__footer">
              <button class="cc-config-dialog__btn cc-config-dialog__btn--cancel" onClick={() => setConfigDialog(null)}>
                {t("common.cancel")}
              </button>
              <button
                class="cc-config-dialog__btn cc-config-dialog__btn--confirm"
                onClick={confirmConfig}
                disabled={!!(needsApiKey() && !configDialog()!.apiKey)}
              >
                {t("ide.start")}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ─── Context menus ─── */}
      <Show when={contextMenu()}>
        <div class="ide-context-menu" style={{ left: `${contextMenu()!.x}px`, top: `${contextMenu()!.y}px` }} onMouseDown={(e) => e.stopPropagation()}>
          <Show when={ai.sessions().has(contextMenu()!.sessionId)}>
            <div class="ide-context-item" onClick={() => detachSession(contextMenu()!.sessionId)}>{t("ide.detachWindow")}</div>
            <div class="ide-context-sep" />
          </Show>
          <div class="ide-context-item ide-context-item--danger" onClick={() => { closeTab(contextMenu()!.sessionId); setContextMenu(null); }}>{t("common.close")}</div>
        </div>
      </Show>

    </div>
  );
}

// Export for sidebar
export async function openSystemTerminalWindow(cwd: string) {
  await windowService.openDetached({
    label: `terminal-${Date.now()}`,
    title: "Terminal — Magick Cookie",
    route: `/detached-terminal?cwd=${encodeURIComponent(cwd)}`,
  });
}
