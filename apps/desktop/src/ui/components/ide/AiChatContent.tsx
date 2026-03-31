import { Show, createSignal, Switch, Match, onMount, onCleanup } from "solid-js";
import { useAiSessionStore, type AiSession } from "../../../application/stores/aiSessionStore";
import { useIdeStore } from "../../../application/stores/ideStore";
import { AiMessageFeed } from "./AiMessageFeed";
import { AiComposer } from "./AiComposer";
import type { MonacoEditorApi } from "./MonacoEditor";

type AiTab = "session" | "diffs" | "processes" | "files";

interface AiChatContentProps {
  sessionId: string;
  editorApi?: MonacoEditorApi;
}

export function AiChatContent(props: AiChatContentProps) {
  const ide = useIdeStore();
  const ai = useAiSessionStore();
  const [activeTab, setActiveTab] = createSignal<AiTab>("session");

  const session = (): AiSession | undefined => {
    return ai.sessions().get(props.sessionId);
  };

  // Listen for Escape to interrupt
  function handleEscape() {
    if (session()?.isStreaming) ai.interruptSession();
  }
  onMount(() => document.addEventListener("ide-escape", handleEscape));
  onCleanup(() => document.removeEventListener("ide-escape", handleEscape));

  // Track whether project context has been injected for this session
  const [contextInjected, setContextInjected] = createSignal(false);

  async function handleSend(content: string) {
    // Ensure this session is active
    if (ai.activeSessionId() !== props.sessionId) {
      ai.switchSession(props.sessionId);
    }

    // Inject CLAUDE.md context on first message of the session
    if (!contextInjected()) {
      setContextInjected(true);
      try {
        const context = await ide.readProjectContext();
        if (context) {
          content = `[Contexte projet — CLAUDE.md]\n${context}\n---\n\n${content}`;
        }
      } catch { /* no context */ }
    }

    await ai.sendMessage(content);
  }

  function getActiveFileName(): string | null {
    return ide.activeTab()?.name ?? null;
  }

  function getActiveSelection(): string | null {
    return props.editorApi?.getSelection() || null;
  }

  const tabs: { id: AiTab; label: string }[] = [
    { id: "session", label: "Session" },
    { id: "diffs", label: "Diffs" },
    { id: "processes", label: "Processes" },
    { id: "files", label: "Files" },
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
        {tabs.map((tab) => (
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
                />
              </div>
            </Match>

            {/* Diffs tab */}
            <Match when={activeTab() === "diffs"}>
              <div class="cc-tab-placeholder">
                <span>Les diffs apparaitront ici quand l'agent modifie des fichiers</span>
              </div>
            </Match>

            {/* Processes tab */}
            <Match when={activeTab() === "processes"}>
              <div class="cc-processes-tab">
                <Show when={toolCount() > 0} fallback={
                  <div class="cc-tab-placeholder">
                    <span>Les operations apparaitront ici quand l'agent travaille</span>
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
                            {result ? (result.toolIsError ? "erreur" : "ok") : "..."}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Show>
              </div>
            </Match>

            {/* Files tab */}
            <Match when={activeTab() === "files"}>
              <div class="cc-files-tab">
                <Show when={fileCount() > 0} fallback={
                  <div class="cc-tab-placeholder">
                    <span>Les fichiers touches apparaitront ici</span>
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
