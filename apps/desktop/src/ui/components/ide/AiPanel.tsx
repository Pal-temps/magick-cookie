import { Show, onMount } from "solid-js";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";
import { useIdeStore } from "../../../application/stores/ideStore";
import { AiMessageFeed } from "./AiMessageFeed";
import { AiComposer } from "./AiComposer";
import { ProviderPicker } from "./ProviderPicker";
import { ResizeHandle } from "./ResizeHandle";
import type { MonacoEditorApi } from "./MonacoEditor";

interface AiPanelProps {
  editorApi?: MonacoEditorApi;
}

export function AiPanel(props: AiPanelProps) {
  const ide = useIdeStore();
  const ai = useAiSessionStore();

  onMount(() => {
    ai.fetchProviders();
  });

  function handleResize(delta: number) {
    const current = ide.aiPanelWidth();
    const newWidth = Math.max(300, Math.min(600, current + delta));
    ide.persistAiPanelWidth(newWidth);
  }

  async function handleSelectProvider(providerId: string) {
    const cwd = ide.projectPath() ?? ".";
    await ai.startSession({
      provider: providerId,
      model: "", // Will use provider default
      cwd,
    });
  }

  async function handleSend(content: string) {
    if (!ai.activeSession()) {
      // Auto-start with first available provider
      const providerList = ai.providers();
      const available = providerList.find((p) => p.available);
      if (!available) return;
      const cwd = ide.projectPath() ?? ".";
      await ai.startSession({ provider: available.id, model: "", cwd });
    }
    await ai.sendMessage(content);
  }

  function getActiveFileName(): string | null {
    return ide.activeTab()?.name ?? null;
  }

  function getActiveSelection(): string | null {
    return props.editorApi?.getSelection() || null;
  }

  return (
    <>
      <ResizeHandle onResize={handleResize} />
      <div
        class="ide-ai-panel"
        style={{ "--ai-panel-width": `${ide.aiPanelWidth()}px` }}
      >
        {/* Header */}
        <div class="ide-ai-panel__header">
          <ProviderPicker
            providers={ai.providers()}
            activeProvider={ai.activeSession()?.provider ?? null}
            onSelect={handleSelectProvider}
          />
          <span class="ide-ai-panel__header-title">
            <Show when={ai.activeSession()}>
              {ai.activeSession()!.model || ai.activeSession()!.provider}
            </Show>
          </span>
          <button class="ide-ai-panel__close" onClick={() => ide.setAiPanelOpen(false)} title="Fermer (Ctrl+I)">
            &times;
          </button>
        </div>

        {/* Message feed */}
        <Show when={ai.activeSession()} fallback={
          <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--text-muted)", "font-size": "12px", padding: "20px", "text-align": "center" }}>
            Selectionnez un provider pour commencer
          </div>
        }>
          <AiMessageFeed
            session={ai.activeSession()!}
            onAllowPermission={(id) => ai.respondPermission(id, true)}
            onDenyPermission={(id) => ai.respondPermission(id, false)}
          />
        </Show>

        {/* Composer */}
        <AiComposer
          onSend={handleSend}
          disabled={ai.activeSession()?.isStreaming}
          activeFileName={getActiveFileName()}
          activeSelection={getActiveSelection()}
          capabilities={ai.activeSession()?.capabilities ?? null}
        />
      </div>
    </>
  );
}
