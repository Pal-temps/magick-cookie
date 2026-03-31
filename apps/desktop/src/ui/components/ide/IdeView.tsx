import { onMount, onCleanup, Show } from "solid-js";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { AiTerminalTabs } from "./AiTerminalTabs";
import { CodeDrawer } from "./CodeDrawer";
import { ContextPanel } from "./ContextPanel";
import type { MonacoEditorApi } from "./MonacoEditor";
import "../../styles/ide.css";

export function IdeView() {
  const ide = useIdeStore();
  const { fetchSnippets } = useSnippetStore();
  let editorApi: MonacoEditorApi | undefined;

  onMount(async () => {
    await ide.restoreState();
    await fetchSnippets();
    document.addEventListener("keydown", ide.handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", ide.handleKeyDown);
  });

  return (
    <div class="ide-layout">
      {/* Main: AI Terminal Tabs */}
      <AiTerminalTabs editorApi={editorApi} />

      {/* Context Panel (overlay right) */}
      <Show when={ide.contextPanelOpen()}>
        <ContextPanel projectPath={ide.projectPath()} onClose={() => ide.toggleContextPanel()} />
      </Show>

      {/* Code Drawer (slides from right, above context) */}
      <Show when={ide.codeDrawerOpen()}>
        <CodeDrawer
          onEditorReady={(api) => { editorApi = api; }}
          width={ide.codeDrawerWidth()}
          onResize={(w) => ide.persistCodeDrawerWidth(w)}
        />
      </Show>
    </div>
  );
}
