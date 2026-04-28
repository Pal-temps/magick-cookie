import { Show, For, createSignal, createEffect, Switch, Match, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useAiSessionStore, type AiSession } from "../../../application/stores/aiSessionStore";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useWorkflowStore } from "../../../application/stores/workflowStore";
import { useHookStore } from "../../../application/stores/hookStore";
import { useT } from "../../../i18n/context";
import { AiMessageFeed } from "./AiMessageFeed";
import { AiComposer } from "./AiComposer";
import type { MonacoEditorApi } from "./MonacoEditor";
import { ALL_MODES, type SessionModeId } from "./sessionModes";
import { buildContextParts } from "./contextInjection";
import { getCookiaContext, clearCookiaContext } from "../../../application/stores/cookiaContextStore";
import { SLASH_COMMANDS, parseSlashCommand } from "./slashCommands";
import { buildCompactPrompt, buildHelpMessage, isClaudeCliProvider } from "./slashHandlers";

type AiTab = "session" | "diffs" | "processes" | "files" | "validation";

interface AiChatContentProps {
  sessionId: string;
  editorApi?: MonacoEditorApi;
}

export function AiChatContent(props: AiChatContentProps) {
  const { t } = useT();
  const ide = useIdeStore();
  const ai = useAiSessionStore();
  const wf = useWorkflowStore();
  const snippetStore = useSnippetStore();
  const hooks = useHookStore();
  const [activeTab, setActiveTab] = createSignal<AiTab>("session");
  const [sessionMode, setSessionMode] = createSignal<SessionModeId>("general");
  const [composerInitialText, setComposerInitialText] = createSignal<string | undefined>(undefined);

  // Consume "Ask Cookia" context from other views and pre-fill the composer
  createEffect(() => {
    const ctx = getCookiaContext();
    if (ctx) {
      setComposerInitialText(ctx.prompt);
      clearCookiaContext();
      setActiveTab("session"); // ensure the session tab is visible
    }
  });

  const session = (): AiSession | undefined => {
    return ai.sessions().get(props.sessionId);
  };

  // Listen for Escape to interrupt
  function handleEscape() {
    if (session()?.isStreaming) ai.interruptSession();
  }
  onMount(() => document.addEventListener("ide-escape", handleEscape));
  onCleanup(() => document.removeEventListener("ide-escape", handleEscape));

  // Auto-validation: watch for turn completion and run hooks
  let lastMsgCount = 0;
  const checkAutoValidation = () => {
    const s = session();
    if (!s || s.messages.length <= lastMsgCount) return;
    const newMsgs = s.messages.slice(lastMsgCount);
    lastMsgCount = s.messages.length;

    // Check if a system message indicates turn complete (streaming just stopped)
    const wasTurnComplete = !s.isStreaming && newMsgs.some((m) =>
      m.type === "assistant" || (m.type === "system" && m.content.includes("terminee"))
    );
    if (!wasTurnComplete) return;

    const workflow = wf.getWorkflowForSession(props.sessionId);
    if (!workflow || workflow.preCommit.length === 0) return;

    const cwd = ide.projectPath();
    if (!cwd) return;

    hooks.onTurnComplete(props.sessionId, cwd, workflow.preCommit).then((failureMsg) => {
      if (failureMsg) {
        // Auto-inject failure into AI for self-fix
        ai.switchSession(props.sessionId);
        ai.sendMessage(failureMsg);
      }
    });
  };

  // Use a simple interval to poll for changes (reactive would be cleaner but this is simpler)
  const validationInterval = setInterval(checkAutoValidation, 1000);
  onCleanup(() => clearInterval(validationInterval));

  // Track whether project context has been injected for this session
  const [contextInjected, setContextInjected] = createSignal(false);

  async function handleSend(content: string, images?: { media_type: string; data: string }[]) {
    // Ensure this session is active
    if (ai.activeSessionId() !== props.sessionId) {
      ai.switchSession(props.sessionId);
    }

    // ─── Slash command interceptor ───
    const sessionProvider = session()?.provider ?? "";
    const parsed = content.trim().startsWith("/") ? parseSlashCommand(content) : null;
    if (parsed && !isClaudeCliProvider(sessionProvider)) {
      const cmd = SLASH_COMMANDS.find((c) => c.name === parsed.command);
      if (!cmd) {
        ai.injectSystemMessage(`Commande inconnue : /${parsed.command}. Tapez /help pour voir les commandes disponibles.`, props.sessionId);
        return;
      }
      if (cmd.level === "local") {
        if (parsed.command === "help") {
          ai.injectSystemMessage(buildHelpMessage(SLASH_COMMANDS), props.sessionId);
        } else if (parsed.command === "clear") {
          ai.clearMessages(props.sessionId);
          setContextInjected(false);
        } else {
          ai.injectSystemMessage(`/${parsed.command} : fonctionnalité à venir.`, props.sessionId);
        }
        return;
      }
      // LLM-assisted: build the appropriate prompt
      if (parsed.command === "compact") {
        const msgs = session()?.messages ?? [];
        const prompt = buildCompactPrompt(msgs);
        if (!prompt) {
          ai.injectSystemMessage("Rien à compacter (aucun message assistant dans la session).", props.sessionId);
          return;
        }
        content = prompt;
      }
      // Other LLM-assisted commands: pass through with command hint
    }

    // Inject context on first message of the session
    if (!contextInjected()) {
      setContextInjected(true);

      // Project CLAUDE.md
      let claudeMd: string | null = null;
      try {
        claudeMd = await ide.readProjectContext() || null;
      } catch { /* no context */ }

      // Active workflow instructions + resolve file references
      let workflowPart: string | null = null;
      const workflow = wf.getWorkflowForSession(props.sessionId);
      if (workflow) {
        const resolvedParts: string[] = [];

        async function resolveRef(ref: string): Promise<string> {
          try {
            if (ref.startsWith("file:")) {
              const path = ref.slice(5);
              if (path.startsWith("snippet::")) {
                const sid = path.slice(9);
                await snippetStore.fetchSnippets();
                const s = snippetStore.snippets().find((sn) => sn.id === sid);
                return s ? `[Snippet: ${s.title}]\n\`\`\`${s.language}\n${s.content}\n\`\`\`` : `[Snippet introuvable: ${sid}]`;
              }
              if (path.startsWith("bookmark::")) {
                const url = path.slice(10);
                return `[Signet: ${url}]\nURL a consulter/scanner: ${url}`;
              }
              if (path.startsWith("rss::")) {
                const url = path.slice(5);
                return `[Article RSS favori]\nURL a lire/analyser: ${url}`;
              }
              if (path.startsWith("notes::")) {
                const noteContent = await invoke<string>("notes_read", { path: path.slice(7) });
                return `[Note: ${path.split("/").pop()}]\n${noteContent}`;
              }
              const fileContent = await invoke<string>("vault_read_json", { relPath: path });
              return `[${path.split("/").pop()}]\n${fileContent}`;
            }
            return `Commande: \`${ref}\``;
          } catch {
            return `[Fichier introuvable: ${ref}]`;
          }
        }

        if (workflow.instructions) {
          resolvedParts.push(`[Workflow: ${workflow.name}]\n${workflow.instructions}`);
        }
        if (workflow.preCommit.length > 0) {
          const items: string[] = [];
          for (const cmd of workflow.preCommit) {
            items.push(await resolveRef(cmd));
          }
          resolvedParts.push(`## Pre-commit\n${items.join("\n\n")}`);
        }
        if (workflow.postCommit.length > 0) {
          const items: string[] = [];
          for (const cmd of workflow.postCommit) {
            items.push(await resolveRef(cmd));
          }
          resolvedParts.push(`## Post-commit\n${items.join("\n\n")}`);
        }

        if (resolvedParts.length > 0) {
          workflowPart = resolvedParts.join("\n\n");
        }
      }

      const contextParts = buildContextParts({ mode: sessionMode(), claudeMd, workflowPart });
      if (contextParts.length > 0) {
        content = contextParts.join("\n\n---\n\n") + "\n\n---\n\n" + content;
      }
    }

    await ai.sendMessage(content, images);
  }

  function getActiveFileName(): string | null {
    return ide.activeTab()?.name ?? null;
  }

  function getActiveSelection(): string | null {
    return props.editorApi?.getSelection() || null;
  }

  const tabs = (): { id: AiTab; label: string }[] => [
    { id: "session", label: t("ide.session") },
    { id: "diffs", label: "Diffs" },
    { id: "processes", label: "Processes" },
    { id: "files", label: t("ide.files") },
    { id: "validation", label: t("ide.validation") },
  ];

  const isStreaming = () => session()?.isStreaming ?? false;

  // Count tools for badge
  const toolCount = () => session()?.messages.filter((m) => m.type === "tool_use").length ?? 0;
  const fileCount = () => {
    const s = session();
    if (!s) return 0;
    const files = new Set<string>();
    for (const m of s.messages) {
      if (m.type === "tool_use" && m.toolInput) {
        const input = m.toolInput as Record<string, unknown>;
        const path = (input.file_path ?? input.path ?? "") as string;
        if (path) files.add(path);
      }
    }
    return files.size;
  };

  return (
    <div class="cc-ai-root">
      {/* Sub-tabs */}
      <div class="cc-subtabs">
        {tabs().map((tab) => (
          <button
            class={`cc-subtab ${activeTab() === tab.id ? "cc-subtab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Show when={tab.id === "session"}>
              <span class={`cc-status-dot ${isStreaming() ? "cc-status-dot--active" : ""}`} />
            </Show>
            {tab.label}
            <Show when={tab.id === "processes" && toolCount() > 0}>
              <span class="cc-subtab__badge">{toolCount()}</span>
            </Show>
            <Show when={tab.id === "files" && fileCount() > 0}>
              <span class="cc-subtab__badge">{fileCount()}</span>
            </Show>
          </button>
        ))}
      </div>

      {/* Session mode selector — only shown on the session tab */}
      <Show when={activeTab() === "session"}>
        <div class="cc-mode-bar">
          <For each={ALL_MODES}>
            {(mode) => (
              <button
                class={`cc-mode-pill ${sessionMode() === mode.id ? "cc-mode-pill--active" : ""}`}
                title={mode.description}
                onClick={() => {
                  setSessionMode(mode.id);
                  setContextInjected(false);
                }}
              >
                {mode.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Content area */}
      <div class="cc-content-area">
        <div class="cc-main-content">
          <Switch>
            {/* Session / Chat tab */}
            <Match when={activeTab() === "session"}>
              <div class="cc-chat-area">
                <Show when={session()}>
                  <AiMessageFeed
                    session={session()!}
                    onAllowPermission={(id) => ai.respondPermission(id, true)}
                    onDenyPermission={(id) => ai.respondPermission(id, false)}
                  />
                </Show>

                <AiComposer
                  onSend={handleSend}
                  disabled={session()?.isStreaming}
                  activeFileName={getActiveFileName()}
                  activeSelection={getActiveSelection()}
                  capabilities={session()?.capabilities ?? null}
                  initialText={composerInitialText()}
                />
              </div>
            </Match>

            {/* Diffs tab */}
            <Match when={activeTab() === "diffs"}>
              <div class="cc-tab-placeholder">
                <span>{t("ide.diffsPlaceholder")}</span>
              </div>
            </Match>

            {/* Processes tab */}
            <Match when={activeTab() === "processes"}>
              <div class="cc-processes-tab">
                <Show when={toolCount() > 0} fallback={
                  <div class="cc-tab-placeholder">
                    <span>{t("ide.processesPlaceholder")}</span>
                  </div>
                }>
                  <div class="cc-processes-list">
                    {session()!.messages.filter((m) => m.type === "tool_use").map((msg) => {
                      const result = session()!.messages.find(
                        (m) => m.type === "tool_result" && m.seq > msg.seq
                      );
                      return (
                        <div class={`cc-process-item ${result?.toolIsError ? "cc-process-item--error" : ""}`}>
                          <span class="cc-process-item__icon">
                            {msg.toolName?.toLowerCase().includes("read") ? "R" :
                             msg.toolName?.toLowerCase().includes("write") ? "W" :
                             msg.toolName?.toLowerCase() === "bash" ? "$" :
                             msg.toolName?.toLowerCase().includes("edit") ? "E" : "T"}
                          </span>
                          <span class="cc-process-item__name">{msg.toolName}</span>
                          <span class="cc-process-item__status">
                            {result ? (result.toolIsError ? t("ide.error") : t("ide.ok")) : "..."}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Show>
              </div>
            </Match>

            {/* Validation tab */}
            <Match when={activeTab() === "validation"}>
              <div class="cc-processes-tab" style={{ padding: "12px" }}>
                <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "12px" }}>
                  <label style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={hooks.autoValidationEnabled()}
                      onChange={(e) => hooks.setAutoValidationEnabled(e.currentTarget.checked)}
                    />
                    {t("ide.autoValidation")}
                  </label>
                  <Show when={hooks.isRunningHooks()}>
                    <span style={{ "font-size": "11px", color: "var(--accent-primary)" }}>
                      {t("ide.runningHooks")}
                    </span>
                  </Show>
                </div>

                <Show when={hooks.getResultsForSession(props.sessionId).length > 0} fallback={
                  <div class="cc-tab-placeholder">
                    <span>{t("ide.noHooks")}</span>
                  </div>
                }>
                  <div class="cc-processes-list">
                    <For each={hooks.getResultsForSession(props.sessionId)}>
                      {(turn) => (
                        <div style={{ "margin-bottom": "10px" }}>
                          <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-bottom": "4px" }}>
                            Turn {turn.turnSeq} — {turn.allPassed ? t("ide.hookPassed") : t("ide.hookFailed")}
                          </div>
                          <For each={turn.results}>
                            {(r) => (
                              <details class={`cc-process-item ${r.success ? "" : "cc-process-item--error"}`}
                                style={{ cursor: "pointer", "margin-bottom": "2px" }}>
                                <summary style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px" }}>
                                  <span style={{ color: r.success ? "var(--accent-primary)" : "var(--color-danger)" }}>
                                    {r.success ? "OK" : "FAIL"}
                                  </span>
                                  <code style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                                    {r.command}
                                  </code>
                                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                                    {r.duration_ms}ms
                                  </span>
                                </summary>
                                <pre style={{
                                  "font-size": "11px", padding: "6px", margin: "4px 0 0",
                                  background: "var(--bg-base)", "border-radius": "var(--radius-sm)",
                                  "max-height": "150px", overflow: "auto", "white-space": "pre-wrap",
                                }}>
                                  {[r.stdout, r.stderr].filter(Boolean).join("\n") || "(no output)"}
                                </pre>
                              </details>
                            )}
                          </For>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Match>

            {/* Files tab */}
            <Match when={activeTab() === "files"}>
              <div class="cc-files-tab">
                <Show when={fileCount() > 0} fallback={
                  <div class="cc-tab-placeholder">
                    <span>{t("ide.filesPlaceholder")}</span>
                  </div>
                }>
                  <div class="cc-files-list">
                    {(() => {
                      const files = new Map<string, { reads: number; writes: number }>();
                      for (const m of session()!.messages) {
                        if (m.type === "tool_use" && m.toolInput) {
                          const input = m.toolInput as Record<string, unknown>;
                          const path = (input.file_path ?? input.path ?? "") as string;
                          if (!path) continue;
                          const entry = files.get(path) ?? { reads: 0, writes: 0 };
                          const name = (m.toolName ?? "").toLowerCase();
                          if (name.includes("write") || name.includes("edit")) entry.writes++;
                          else entry.reads++;
                          files.set(path, entry);
                        }
                      }
                      return Array.from(files.entries()).map(([path, info]) => (
                        <button
                          class="cc-file-item"
                          onClick={() => {
                            // Open file in editor
                            const rel = path.replace(/\\/g, "/");
                            const name = rel.split("/").pop() ?? rel;
                            ide.openFile({ name, path: rel, is_dir: false, size: 0, modified: 0 });
                            ide.toggleCodeDrawer();
                          }}
                        >
                          <span class={`cc-file-item__icon ${info.writes > 0 ? "cc-file-item__icon--write" : ""}`}>
                            {info.writes > 0 ? "M" : "R"}
                          </span>
                          <span class="cc-file-item__path">{path.split(/[/\\]/).slice(-2).join("/")}</span>
                          <span class="cc-file-item__stats">
                            {info.reads > 0 ? `${info.reads}R` : ""}
                            {info.writes > 0 ? ` ${info.writes}W` : ""}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                </Show>
              </div>
            </Match>
          </Switch>
        </div>

        {/* Context panel is rendered at IdeView level */}
      </div>
    </div>
  );
}
