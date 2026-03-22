import { onMount, onCleanup, Show, createSignal } from "solid-js";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { MonacoEditor } from "./MonacoEditor";
import { EditorTabs } from "./EditorTabs";
import { FileExplorer } from "./FileExplorer";
import { Terminal } from "./Terminal";
import { GitPanel } from "./GitPanel";
import { AiAssistant } from "./AiAssistant";
import type { MonacoEditorApi } from "./MonacoEditor";
import "../../styles/ide.css";

export function IdeView() {
  const ide = useIdeStore();
  const { snippets, fetchSnippets } = useSnippetStore();
  let editorApi: MonacoEditorApi | undefined;

  const [newFileDialog, setNewFileDialog] = createSignal<{ folder: string; type: "file" | "folder" } | null>(null);
  const [newFileInput, setNewFileInput] = createSignal("");

  onMount(async () => {
    await fetchSnippets();
    document.addEventListener("keydown", ide.handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", ide.handleKeyDown);
  });

  function handleCreateFile(folder: string) {
    setNewFileDialog({ folder, type: "file" });
    setNewFileInput("");
  }

  function handleCreateFolder(folder: string) {
    setNewFileDialog({ folder, type: "folder" });
    setNewFileInput("");
  }

  async function confirmCreate() {
    const info = newFileDialog();
    const name = newFileInput().trim();
    if (!info || !name) return;

    if (info.type === "file") {
      await ide.createFile(info.folder, name);
    } else {
      await ide.createFolder(info.folder, name);
    }
    setNewFileDialog(null);
  }

  async function pickProject() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Ouvrir un projet",
    });
    if (selected && typeof selected === "string") {
      await ide.openProject(selected);
    }
  }

  const hasProject = () => ide.projectPath() !== null;

  return (
    <div class="ide-layout">
      {/* Sidebar */}
      <Show when={ide.showSidePanel()}>
        <div class="ide-sidebar">
          {/* Sidebar header: project name + open + tabs */}
          <div style={{
            display: "flex", "align-items": "center", gap: "6px",
            padding: "8px 10px", "border-bottom": "1px solid var(--border-color)", "flex-shrink": "0",
          }}>
            <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)", flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
              {ide.projectName()}
            </span>
            <button
              onClick={() => pickProject()}
              style={{
                padding: "3px 8px", "font-size": "11px", background: "var(--bg-elevated)",
                border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)",
                color: "var(--text-secondary)", cursor: "pointer", "flex-shrink": "0",
              }}
              title="Ouvrir un projet"
            >Ouvrir</button>
          </div>

          {/* Sidebar tabs: Files / Git */}
          <div class="ide-sidebar-tabs">
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "files" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("files")}
            >Fichiers</button>
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "git" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("git")}
            >Git</button>
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "ai" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("ai")}
            >IA</button>
          </div>

          {/* Files panel */}
          <Show when={ide.sidePanel() === "files"}>
            <Show when={hasProject()} fallback={
              <div style={{ padding: "20px", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
                <p>Aucun projet ouvert</p>
                <button
                  onClick={() => pickProject()}
                  style={{
                    "margin-top": "12px", padding: "8px 16px", background: "var(--accent-primary)",
                    border: "none", "border-radius": "var(--radius-sm)", color: "#fff",
                    cursor: "pointer", "font-size": "12px",
                  }}
                >Ouvrir un projet</button>
              </div>
            }>
              <FileExplorer
                tree={ide.fileTree()}
                snippets={snippets()}
                expandedFolders={ide.expandedFolders()}
                onToggleFolder={(p) => ide.toggleFolder(p)}
                onOpenFile={(entry) => ide.openFile(entry)}
                onOpenSnippet={(snippet) => ide.openSnippet(snippet)}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onDeleteFile={(path) => ide.deleteFile(path)}
                onDeleteFolder={(path) => ide.deleteFolder(path)}
                onRenameFile={(path, name) => {
                  const newName = prompt("Renommer", name);
                  if (newName && newName !== name) ide.renameFile(path, newName);
                }}
                onCopyPath={(path) => ide.copyPath(path)}
                activeFilePath={ide.activeTab()?.source === "project" ? ide.activeTab()?.path ?? null : null}
              />
            </Show>
          </Show>

          {/* Git panel */}
          <Show when={ide.sidePanel() === "git"}>
            <GitPanel projectPath={ide.projectPath()} />
          </Show>

          {/* AI panel */}
          <Show when={ide.sidePanel() === "ai"}>
            <AiAssistant
              getContext={() => {
                const tab = ide.activeTab();
                if (!tab) return null;
                const code = editorApi?.getSelection() || tab.content;
                return { code, language: tab.language, fileName: tab.name };
              }}
              onApplyCode={(code) => {
                if (editorApi) editorApi.insertAtCursor(code);
              }}
            />
          </Show>
        </div>
      </Show>

      {/* Main editor area */}
      <div class="ide-main">
        <EditorTabs
          tabs={ide.tabs()}
          activeTabId={ide.activeTabId()}
          onSwitch={(id) => ide.switchTab(id)}
          onClose={(id) => ide.closeTab(id)}
          onCloseOthers={(id) => ide.closeOtherTabs(id)}
          onCloseAll={() => ide.closeAllTabs()}
          onCopyPath={(path) => ide.copyPath(path)}
        />

        <div class="ide-editor-area">
          <Show when={ide.activeTab()} fallback={
            <div class="ide-empty">
              <Show when={hasProject()} fallback={
                <>
                  <span>Ouvrir un projet pour commencer</span>
                  <button
                    onClick={() => pickProject()}
                    style={{
                      "margin-top": "8px", padding: "8px 20px", background: "var(--accent-primary)",
                      border: "none", "border-radius": "var(--radius-sm)", color: "#fff",
                      cursor: "pointer", "font-size": "13px",
                    }}
                  >Ouvrir un projet</button>
                </>
              }>
                <span>Cliquer sur un fichier pour l'ouvrir</span>
                <span><kbd>Ctrl+S</kbd> sauvegarder &middot; <kbd>Ctrl+W</kbd> fermer &middot; <kbd>Ctrl+B</kbd> sidebar</span>
              </Show>
            </div>
          }>
            <MonacoEditor
              value={ide.activeTab()!.content}
              language={ide.activeTab()!.language}
              path={ide.activeTab()!.path}
              onChange={(val) => ide.updateTabContent(ide.activeTab()!.id, val)}
              style={{ flex: "1", "min-height": "0" }}
              ref={(api) => { editorApi = api; }}
              onAiAction={() => {
                ide.setSidePanel("ai");
              }}
            />
          </Show>
        </div>

        {/* Bottom panel — Terminal */}
        <Show when={ide.showBottomPanel()}>
          <div class="ide-bottom-panel">
            <div class="ide-bottom-panel__header">
              Terminal
              <span style={{ "margin-left": "auto", cursor: "pointer" }} onClick={() => ide.setShowBottomPanel(false)}>&times;</span>
            </div>
            <div class="ide-bottom-panel__content ide-bottom-panel__terminal">
              <Terminal cwd={ide.projectPath() ?? undefined} />
            </div>
          </div>
        </Show>
      </div>

      {/* New file/folder dialog */}
      <Show when={newFileDialog()}>
        <div style={{
          position: "fixed", inset: "0", "z-index": "1000",
          display: "flex", "align-items": "center", "justify-content": "center",
          background: "rgba(0,0,0,0.5)",
        }} onClick={() => setNewFileDialog(null)}>
          <div style={{
            background: "var(--bg-surface)", padding: "20px", "border-radius": "var(--radius-md)",
            border: "1px solid var(--border-color)", "min-width": "300px",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ "font-size": "14px", "font-weight": "600", "margin-bottom": "12px", color: "var(--text-primary)" }}>
              {newFileDialog()!.type === "file" ? "Nouveau fichier" : "Nouveau dossier"}
            </div>
            <input
              autofocus
              value={newFileInput()}
              onInput={(e) => setNewFileInput(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmCreate(); if (e.key === "Escape") setNewFileDialog(null); }}
              placeholder={newFileDialog()!.type === "file" ? "nom-du-fichier.ts" : "nom-du-dossier"}
              style={{
                width: "100%", padding: "8px", background: "var(--bg-base)", border: "1px solid var(--border-color)",
                "border-radius": "var(--radius-sm)", color: "var(--text-primary)", "font-size": "13px", outline: "none",
                "box-sizing": "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "8px", "margin-top": "12px", "justify-content": "flex-end" }}>
              <button
                onClick={() => setNewFileDialog(null)}
                style={{ padding: "6px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer", "font-size": "12px" }}
              >Annuler</button>
              <button
                onClick={confirmCreate}
                style={{ padding: "6px 14px", background: "var(--accent-primary)", border: "none", "border-radius": "var(--radius-sm)", color: "#fff", cursor: "pointer", "font-size": "12px" }}
              >Creer</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
