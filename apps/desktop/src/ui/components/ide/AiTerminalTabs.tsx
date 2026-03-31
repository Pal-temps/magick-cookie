import { createSignal, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useAiSessionStore, type ProviderInfo } from "../../../application/stores/aiSessionStore";
import { useIdeStore, GRID_TEMPLATES } from "../../../application/stores/ideStore";
import { useSecretsStore } from "../../../application/stores/secretsStore";
import { AiChatContent } from "./AiChatContent";
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
  const ai = useAiSessionStore();
  const ide = useIdeStore();
  const secretsVault = useSecretsStore();
  const [showNewMenu, setShowNewMenu] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; sessionId: string } | null>(null);
  const [assignMenu, setAssignMenu] = createSignal<{ x: number; y: number; slotIndex: number } | null>(null);
  const [configDialog, setConfigDialog] = createSignal<ConfigDialogState | null>(null);

  // ─── Tab context menu ───

  function handleTabContextMenu(e: MouseEvent, sessionId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId });
    requestAnimationFrame(() => {
      const close = () => { setContextMenu(null); document.removeEventListener("mousedown", close); };
      document.addEventListener("mousedown", close);
    });
  }

  async function detachSession(sessionId: string) {
    setContextMenu(null);
    const session = ai.sessions().get(sessionId);
    const title = session ? (session.model || session.provider) : "Terminal IA";
    await invoke("open_detached_window", {
      label: `ai-session-${sessionId.slice(0, 8)}`,
      title: `${title} — Magick Cookie`,
      route: `/detached-session/${sessionId}`,
    });
  }

  // ─── Provider selection + config ───

  async function selectProvider(provider: ProviderInfo) {
    setShowNewMenu(false);
    // CLI providers start immediately
    if (provider.id === "claude-cli") {
      launchSession(provider.id, "");
      return;
    }
    // Local providers (ollama/lmstudio) — show config but no API key needed
    // API providers — show full config
    const models = DEFAULT_MODELS[provider.id] ?? ["default"];
    const savedKey = await secretsVault.getAppSecret(`ai_apikey_${provider.id}`) ?? "";
    const savedUrl = localStorage.getItem(`ide-baseurl-${provider.id}`) ?? ""; // URLs are not secrets
    setConfigDialog({
      provider,
      model: models[0],
      apiKey: savedKey,
      baseUrl: savedUrl,
    });
  }

  async function launchSession(providerId: string, model: string, apiKey?: string, baseUrl?: string) {
    const cwd = ide.projectPath() ?? ".";
    await ai.startSession({
      provider: providerId,
      model,
      cwd,
      api_key: apiKey || null,
      base_url: baseUrl || null,
    });
  }

  function confirmConfig() {
    const cfg = configDialog();
    if (!cfg) return;
    // Save API key to KDBX vault, base URL to localStorage (not a secret)
    if (cfg.apiKey) secretsVault.setAppSecret(`ai_apikey_${cfg.provider.id}`, cfg.apiKey);
    if (cfg.baseUrl) localStorage.setItem(`ide-baseurl-${cfg.provider.id}`, cfg.baseUrl);
    launchSession(cfg.provider.id, cfg.model, cfg.apiKey, cfg.baseUrl);
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

  // ─── Assign slot menu ───

  function openAssignMenu(e: MouseEvent, slotIndex: number) {
    e.stopPropagation();
    setAssignMenu({ x: e.clientX, y: e.clientY, slotIndex });
    requestAnimationFrame(() => {
      const close = () => { setAssignMenu(null); document.removeEventListener("mousedown", close); };
      document.addEventListener("mousedown", close);
    });
  }

  // ─── Helpers ───

  const sessionList = () => Array.from(ai.sessions().values());

  const providerBadge = (provider: string): string => {
    const p = provider.toLowerCase();
    if (p.includes("claude")) return "CC";
    if (p.includes("openai") || p.includes("gpt")) return "GPT";
    if (p.includes("ollama")) return "OL";
    return p.slice(0, 2).toUpperCase();
  };

  function slotSessionId(slotIndex: number): string | null {
    const slots = ide.gridSlots();
    const assigned = slots[slotIndex];
    if (assigned && ai.sessions().has(assigned)) return assigned;
    if (slotIndex === 0) return ai.activeSessionId();
    return null;
  }

  // ─── Render ───

  return (
    <div class="cc-terminal-tabs-root">
      {/* Tab bar */}
      <div class="cc-terminal-tabbar">
        <div class="cc-terminal-tabbar__tabs">
          <For each={sessionList()}>
            {(session) => (
              <button
                class={`cc-terminal-tab ${ai.activeSessionId() === session.id ? "cc-terminal-tab--active" : ""}`}
                onClick={() => ai.switchSession(session.id)}
                onContextMenu={(e) => handleTabContextMenu(e, session.id)}
              >
                <span class={`cc-status-dot ${session.isStreaming ? "cc-status-dot--active" : session.phase === "ready" ? "cc-status-dot--ready" : ""}`} />
                <span class="cc-terminal-tab__name">{session.model || session.provider}</span>
                <span class="cc-terminal-tab__badge">{providerBadge(session.provider)}</span>
                <button
                  class="cc-terminal-tab__close"
                  onClick={(e) => { e.stopPropagation(); ai.stopSession(session.id); }}
                  title="Fermer"
                >&times;</button>
              </button>
            )}
          </For>

          {/* New terminal [+] */}
          <div style={{ position: "relative" }}>
            <button class="cc-terminal-tab cc-terminal-tab--add" onClick={openNewMenu} title="Nouveau terminal IA">+</button>
            <Show when={showNewMenu()}>
              <div class="cc-new-session-menu" onMouseDown={(e) => e.stopPropagation()}>
                <div class="cc-new-session-menu__title">Nouveau terminal IA</div>
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
                        <span class="cc-new-session-menu__badge">indisponible</span>
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
          >Code</button>
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
          const sessionId = slotSessionId(i);
          return (
            <div class="cc-terminal-grid__slot" style={{ "grid-area": SLOT_LABELS[i] }}>
              <Show when={sessionId} fallback={
                <div class="cc-slot-empty">
                  <div class="cc-slot-empty__icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <rect x="4" y="12" width="24" height="16" rx="3" stroke="currentColor" stroke-width="1.5" />
                      <path d="M10 12V8C10 5.24 12.24 3 15 3H17C19.76 3 22 5.24 22 8V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </div>
                  <button class="cc-slot-empty__assign" onClick={(e) => openAssignMenu(e, i)}>
                    Assigner une session
                  </button>
                  <span class="cc-slot-empty__hint">Cliquez [+] pour creer un terminal IA</span>
                  <Show when={ai.providers().length === 0}>
                    <span class="cc-slot-empty__hint" style={{ color: "var(--accent-primary)" }}>
                      Aucun provider IA detecte — configurez Claude CLI ou une cle API dans Settings
                    </span>
                  </Show>
                </div>
              }>
                <AiChatContent sessionId={sessionId!} editorApi={props.editorApi} />
              </Show>
            </div>
          );
        })}
      </div>

      {/* ─── Config Dialog (modal) ─── */}
      <Show when={configDialog()}>
        <div class="cc-config-overlay" onClick={() => setConfigDialog(null)}>
          <div class="cc-config-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="cc-config-dialog__header">
              <span>Configurer {configDialog()!.provider.name}</span>
              <button class="cc-config-dialog__close" onClick={() => setConfigDialog(null)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="cc-config-dialog__body">
              {/* Model selector */}
              <label class="cc-config-field">
                <span class="cc-config-field__label">Modele</span>
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
                  placeholder="ou saisir un modele custom..."
                  value={configDialog()!.model}
                  onInput={(e) => setConfigDialog((prev) => prev ? { ...prev, model: e.currentTarget.value } : null)}
                />
              </label>

              {/* API Key (only for cloud providers) */}
              <Show when={needsApiKey()}>
                <label class="cc-config-field">
                  <span class="cc-config-field__label">Cle API</span>
                  <input
                    class="cc-config-field__input"
                    type="password"
                    placeholder={configDialog()!.provider.id === "anthropic-api" ? "sk-ant-api03-..." : "sk-..."}
                    value={configDialog()!.apiKey}
                    onInput={(e) => setConfigDialog((prev) => prev ? { ...prev, apiKey: e.currentTarget.value } : null)}
                  />
                  <span class="cc-config-field__hint">Stockee localement dans le navigateur</span>
                </label>
              </Show>

              {/* Base URL (optional) */}
              <label class="cc-config-field">
                <span class="cc-config-field__label">URL de base <span style={{ "font-weight": "normal", color: "var(--text-muted)" }}>(optionnel)</span></span>
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
                Annuler
              </button>
              <button
                class="cc-config-dialog__btn cc-config-dialog__btn--confirm"
                onClick={confirmConfig}
                disabled={!!(needsApiKey() && !configDialog()!.apiKey)}
              >
                Demarrer
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ─── Context menus ─── */}
      <Show when={contextMenu()}>
        <div class="ide-context-menu" style={{ left: `${contextMenu()!.x}px`, top: `${contextMenu()!.y}px` }} onMouseDown={(e) => e.stopPropagation()}>
          <div class="ide-context-item" onClick={() => detachSession(contextMenu()!.sessionId)}>Detacher dans une fenetre</div>
          <div class="ide-context-sep" />
          <div class="ide-context-item ide-context-item--danger" onClick={() => { ai.stopSession(contextMenu()!.sessionId); setContextMenu(null); }}>Fermer la session</div>
        </div>
      </Show>

      <Show when={assignMenu()}>
        <div class="ide-context-menu" style={{ left: `${assignMenu()!.x}px`, top: `${assignMenu()!.y}px` }} onMouseDown={(e) => e.stopPropagation()}>
          <For each={sessionList()}>
            {(session) => (
              <div class="ide-context-item" onClick={() => { ide.assignSlot(assignMenu()!.slotIndex, session.id); setAssignMenu(null); }}>
                {session.model || session.provider}
                <span style={{ "margin-left": "auto", "font-size": "9px", color: "var(--text-muted)" }}>{providerBadge(session.provider)}</span>
              </div>
            )}
          </For>
          <Show when={sessionList().length === 0}>
            <div class="ide-context-item" style={{ color: "var(--text-muted)", cursor: "default" }}>Aucune session active</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// Export for sidebar
export async function openSystemTerminalWindow(cwd: string) {
  await invoke("open_detached_window", {
    label: `terminal-${Date.now()}`,
    title: "Terminal — Magick Cookie",
    route: `/detached-terminal?cwd=${encodeURIComponent(cwd)}`,
  });
}
