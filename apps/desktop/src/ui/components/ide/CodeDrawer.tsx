import { Show } from "solid-js";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useWorkflowStore } from "../../../application/stores/workflowStore";
import { useT } from "../../../i18n/context";
import { MonacoEditor } from "./MonacoEditor";
import { EditorTabs } from "./EditorTabs";
import { ResizeHandle } from "./ResizeHandle";
import { WorkflowEditor } from "./WorkflowEditor";
import type { MonacoEditorApi } from "./MonacoEditor";

interface CodeDrawerProps {
  onEditorReady?: (api: MonacoEditorApi) => void;
  width: number;
  onResize: (width: number) => void;
}

export function CodeDrawer(props: CodeDrawerProps) {
  const { t } = useT();
  const ide = useIdeStore();
  const wfStore = useWorkflowStore();

  const hasProject = () => ide.projectPath() !== null;
  const editingWf = () => wfStore.editingWorkflowId();

  // Compute display names
  const tabDisplayNames = () => {
    const allTabs = ide.tabs();
    const nameCounts = new Map<string, number>();
    for (const t of allTabs) {
      if (t.source === "project") {
        nameCounts.set(t.name, (nameCounts.get(t.name) ?? 0) + 1);
      }
    }
    return new Map(allTabs.map((t) => {
      if (t.source === "project" && (nameCounts.get(t.name) ?? 0) > 1) {
        const parts = t.path.replace(/\\/g, "/").split("/");
        const seg = parts.length >= 3 ? parts[parts.length - 3] : "";
        return [t.id, seg ? `${seg}/${t.name}` : t.name] as const;
      }
      return [t.id, t.name] as const;
    }));
  };

  function handleResize(delta: number) {
    const newWidth = Math.max(400, Math.min(window.innerWidth * 0.7, props.width - delta));
    props.onResize(newWidth);
  }

  return (
    <>
      <ResizeHandle onResize={handleResize} />
      <div
        class="cc-code-drawer"
        style={{ width: `${props.width}px` }}
      >
        {/* Header */}
        <div class="cc-code-drawer__header">
          <Show when={editingWf()} fallback={
            <span class="cc-code-drawer__title">{t("ide.code")}</span>
          }>
            <button
              class="cc-code-drawer__back"
              onClick={() => wfStore.setEditingWorkflowId(null)}
              title={t("ide.backToCode")}
            >&larr;</button>
            <span class="cc-code-drawer__title">{t("ide.workflow")}</span>
          </Show>
          <button
            class="cc-code-drawer__close"
            onClick={() => { wfStore.setEditingWorkflowId(null); ide.toggleCodeDrawer(); }}
            title={`${t("common.close")} (Ctrl+E)`}
          >&times;</button>
        </div>

        {/* Tabs */}
        <EditorTabs
          tabs={ide.tabs()}
          activeTabId={ide.activeTabId()}
          onSwitch={(id) => ide.switchTab(id)}
          onClose={(id) => ide.closeTab(id)}
          onCloseOthers={(id) => ide.closeOtherTabs(id)}
          onCloseAll={() => ide.closeAllTabs()}
          onCopyPath={(path) => ide.copyPath(path)}
          displayNames={tabDisplayNames()}
        />

        {/* Editor */}
        <div class="cc-code-drawer__editor">
          <Show when={editingWf()} fallback={
            <Show when={ide.activeTab()} fallback={
              <div class="ide-empty">
                <Show when={hasProject()} fallback={
                  <span>{t("ide.selectProjectSidebar")}</span>
                }>
                  <span>{t("ide.clickFileToOpen")}</span>
                  <span><kbd>Ctrl+S</kbd> sauvegarder &middot; <kbd>Ctrl+W</kbd> fermer</span>
                </Show>
              </div>
            }>
              <MonacoEditor
                value={ide.activeTab()!.content}
                language={ide.activeTab()!.language}
                path={ide.activeTab()!.path}
                onChange={(val) => ide.updateTabContent(ide.activeTab()!.id, val)}
                style={{ flex: "1", "min-height": "0" }}
                ref={(api) => props.onEditorReady?.(api)}
                onAiAction={() => {}}
              />
            </Show>
          }>
            <WorkflowEditor workflowId={editingWf()!} />
          </Show>
        </div>
      </div>
    </>
  );
}
