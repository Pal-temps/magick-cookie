import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";
import { FileExplorer } from "../ide/FileExplorer";
import { GitPanel } from "../ide/GitPanel";
import { openSystemTerminalWindow } from "../ide/AiTerminalTabs";

export function IdeSidebarContent() {
  const ide = useIdeStore();
  const { snippets } = useSnippetStore();

  const [newFileDialog, setNewFileDialog] = createSignal<{ folder: string; type: "file" | "folder" } | null>(null);
  const [newFileInput, setNewFileInput] = createSignal("");
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = createSignal(false);

  let dropdownRef: HTMLDivElement | undefined;
  let searchRef: HTMLInputElement | undefined;

  const settings = useSettingsStore();

  // Load workspace on mount + restore last active project
  onMount(async () => {
    await ide.refreshWorkspace();
    if (!ide.projectPath()) {
      const lastProject = settings.getWorkspace().activeProjectPath;
      if (lastProject) {
        await ide.openProject(lastProject);
      }
    }
  });

  // Close dropdown on outside click
  function handleGlobalClick(e: MouseEvent) {
    if (dropdownOpen() && dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setDropdownOpen(false);
    }
  }
  onMount(() => document.addEventListener("mousedown", handleGlobalClick));
  onCleanup(() => document.removeEventListener("mousedown", handleGlobalClick));

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

  async function pickAndAddProject() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Ajouter un projet",
    });
    if (selected && typeof selected === "string") {
      await ide.addManualProject(selected);
      ide.switchProject(selected);
      setDropdownOpen(false);
    }
  }

  async function pickRootDir() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Ajouter un dossier racine",
    });
    if (selected && typeof selected === "string") {
      await ide.addRootDir(selected);
    }
  }

  function openDropdown() {
    setDropdownOpen(true);
    ide.setWorkspaceSearchQuery("");
    // Focus search after render
    requestAnimationFrame(() => searchRef?.focus());
  }

  function selectProject(path: string) {
    ide.switchProject(path);
    setDropdownOpen(false);
  }

  const ai = useAiSessionStore();
  const hasProject = () => ide.projectPath() !== null;

  // Short path for display (last 2 segments)
  function shortPath(fullPath: string): string {
    const parts = fullPath.replace(/\\/g, "/").split("/");
    return parts.length > 2 ? parts.slice(-2).join("/") : fullPath;
  }

  // ─── Sidebar Section (collapsible) ───
  function SidebarSection(props: { id: string; title: string; defaultOpen?: boolean; children: any }) {
    const key = `ide-sidebar-section-${props.id}`;
    const [open, setOpen] = createSignal(
      localStorage.getItem(key) !== null ? localStorage.getItem(key) === "true" : (props.defaultOpen ?? true)
    );
    function toggle() {
      const next = !open();
      setOpen(next);
      localStorage.setItem(key, String(next));
    }
    return (
      <div class="ide-sidebar-section">
        <button class="ide-sidebar-section__header" onClick={toggle}>
          <span class={`ide-sidebar-section__chevron ${open() ? "ide-sidebar-section__chevron--open" : ""}`}>&#x25B8;</span>
          {props.title}
        </button>
        <Show when={open()}>
          <div class="ide-sidebar-section__body">
            {props.children}
          </div>
        </Show>
      </div>
    );
  }

  // ─── Sessions List ───
  function SessionsList() {
    const sessionList = () => Array.from(ai.sessions().values());

    async function newSession() {
      await ai.fetchProviders();
      const available = ai.providers().find((p) => p.available);
      if (!available) return;
      const cwd = ide.projectPath() ?? ".";
      await ai.startSession({ provider: available.id, model: "", cwd });
    }

    return (
      <div class="ide-sessions-list">
        <For each={sessionList()} fallback={
          <div style={{ padding: "8px 0", "font-size": "11px", color: "var(--text-muted)" }}>
            Aucune session active
          </div>
        }>
          {(session) => (
            <button
              class={`ide-session-item ${ai.activeSessionId() === session.id ? "ide-session-item--active" : ""}`}
              onClick={() => ai.switchSession(session.id)}
            >
              <span class={`cc-status-dot ${session.phase === "ready" ? "cc-status-dot--ready" : session.isStreaming ? "cc-status-dot--active" : ""}`} />
              <span class="ide-session-item__name">{session.model || session.provider}</span>
              <span class="ide-session-item__badge">
                {session.provider.toLowerCase().includes("claude") ? "CC" :
                 session.provider.toLowerCase().includes("openai") ? "GPT" :
                 session.provider.toLowerCase().includes("ollama") ? "OL" :
                 session.provider.slice(0, 2).toUpperCase()}
              </span>
            </button>
          )}
        </For>
        <button class="ide-sidebar-link ide-sidebar-link--accent" onClick={newSession}>
          <span class="ide-sidebar-link__icon">+</span> Nouvelle session
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Project switcher */}
      <div ref={dropdownRef} style={{ position: "relative", "flex-shrink": "0" }}>
        {/* Trigger */}
        <button
          onClick={() => dropdownOpen() ? setDropdownOpen(false) : openDropdown()}
          class="ws-dropdown-trigger"
        >
          <span class="ws-dropdown-trigger__name">{ide.projectName()}</span>
          <span class="ws-dropdown-trigger__chevron">{dropdownOpen() ? "\u25B4" : "\u25BE"}</span>
        </button>

        {/* Dropdown panel */}
        <Show when={dropdownOpen()}>
          <div class="ws-dropdown-panel">
            {/* Search */}
            <div style={{ padding: "6px 8px", "border-bottom": "1px solid var(--border-color)" }}>
              <input
                ref={searchRef}
                type="text"
                placeholder="Rechercher un projet..."
                value={ide.workspaceSearchQuery()}
                onInput={(e) => ide.setWorkspaceSearchQuery(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDropdownOpen(false);
                }}
                class="ws-dropdown-search"
              />
            </div>

            <div class="ws-dropdown-list">
              {/* Favorites section */}
              <Show when={ide.favoriteProjects().length > 0}>
                <div class="ws-dropdown-section-label">Favoris</div>
                <For each={ide.favoriteProjects()}>
                  {(project) => (
                    <div
                      class="ws-dropdown-item"
                      classList={{ "ws-dropdown-item--active": project.path === ide.projectPath() }}
                      onClick={() => selectProject(project.path)}
                    >
                      <button
                        class="ws-star ws-star--active"
                        onClick={(e) => { e.stopPropagation(); ide.toggleFavorite(project.path); }}
                        title="Retirer des favoris"
                      >&#9733;</button>
                      <span class="ws-dropdown-item__name">{project.name}</span>
                    </div>
                  )}
                </For>
                <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
              </Show>

              {/* All projects */}
              <Show when={ide.filteredProjects().length > 0} fallback={
                <div style={{ padding: "12px", "text-align": "center", color: "var(--text-muted)", "font-size": "12px" }}>
                  {ide.discoveredProjects().length === 0
                    ? "Aucun projet. Ajoutez un dossier racine ou un projet."
                    : "Aucun resultat"
                  }
                </div>
              }>
                <div class="ws-dropdown-section-label">Projets</div>
                <For each={ide.filteredProjects()}>
                  {(project) => (
                    <div
                      class="ws-dropdown-item"
                      classList={{ "ws-dropdown-item--active": project.path === ide.projectPath() }}
                      onClick={() => selectProject(project.path)}
                    >
                      <button
                        class={`ws-star ${ide.isFavorite(project.path) ? "ws-star--active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); ide.toggleFavorite(project.path); }}
                        title={ide.isFavorite(project.path) ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >{ide.isFavorite(project.path) ? "\u2733" : "\u2606"}</button>
                      <span class="ws-dropdown-item__name">{project.name}</span>
                      <span class="ws-dropdown-item__path">{shortPath(project.path)}</span>
                    </div>
                  )}
                </For>
              </Show>
            </div>

            {/* Actions */}
            <div class="ws-dropdown-actions">
              <button class="ws-dropdown-action" onClick={pickAndAddProject}>
                + Ajouter un projet
              </button>
              <button class="ws-dropdown-action" onClick={() => { setShowWorkspaceSettings(true); setDropdownOpen(false); }}>
                Parametres workspace
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Sections */}
      <div class="ide-sidebar-sections">
        {/* ─── SESSIONS ─── */}
        <SidebarSection id="sessions" title="SESSIONS">
          <SessionsList />
        </SidebarSection>

        {/* ─── WORKBENCH ─── */}
        <SidebarSection id="workbench" title="WORKBENCH">
          <Show when={ide.projectPath()}>
            <button class="ide-sidebar-link ide-sidebar-link--highlight" onClick={() => {
              const name = ide.projectName();
              if (name && name !== "Aucun projet") {
                const entry = { name: "CLAUDE.md", path: `_projects/${name}/CLAUDE.md`, is_dir: false, size: 0, modified: 0 };
                ide.openFile(entry as any);
                if (!ide.codeDrawerOpen()) ide.toggleCodeDrawer();
              }
            }}>
              <span class="ide-sidebar-link__icon" style={{ background: "var(--accent-primary)", color: "#fff" }}>AI</span> CLAUDE.md
            </button>
          </Show>
          <button class="ide-sidebar-link" onClick={() => {/* TODO: open vault _ide/skills/ */}}>
            <span class="ide-sidebar-link__icon">S</span> Skills
          </button>
          <button class="ide-sidebar-link" onClick={() => {/* TODO: open vault _ide/hooks/ */}}>
            <span class="ide-sidebar-link__icon">H</span> Hooks
          </button>
          <button class="ide-sidebar-link" onClick={() => {/* TODO: open prompts manager */}}>
            <span class="ide-sidebar-link__icon">P</span> Prompts
          </button>
          <button class="ide-sidebar-link" onClick={() => openSystemTerminalWindow(ide.projectPath() ?? ".")}>
            <span class="ide-sidebar-link__icon">$</span> Terminal
          </button>
        </SidebarSection>

        {/* ─── WORKSPACE ─── */}
        <SidebarSection id="workspace" title="WORKSPACE" defaultOpen={true}>
          {/* Sub-tabs for Files/Git */}
          <div class="ide-sidebar-tabs">
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "files" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("files")}
            >Fichiers</button>
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "git" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("git")}
            >Git</button>
          </div>

          {/* Files panel */}
          <Show when={ide.sidePanel() === "files"}>
            <Show when={hasProject()} fallback={
              <div style={{ padding: "12px", "text-align": "center", color: "var(--text-muted)", "font-size": "12px" }}>
                Aucun projet ouvert
              </div>
            }>
              <FileExplorer
                tree={ide.fileTree()}
                snippets={snippets()}
                expandedFolders={ide.expandedFolders()}
                onToggleFolder={(p) => ide.toggleFolder(p)}
                onOpenFile={(entry) => { ide.openFile(entry); if (!ide.codeDrawerOpen()) ide.toggleCodeDrawer(); }}
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
        </SidebarSection>
      </div>

      {/* Workspace settings modal */}
      <Show when={showWorkspaceSettings()}>
        <div style={{
          position: "fixed", inset: "0", "z-index": "1000",
          display: "flex", "align-items": "center", "justify-content": "center",
          background: "rgba(0,0,0,0.5)",
        }} onClick={() => setShowWorkspaceSettings(false)}>
          <div style={{
            background: "var(--bg-surface)", padding: "20px", "border-radius": "var(--radius-md)",
            border: "1px solid var(--border-color)", "min-width": "400px", "max-width": "500px",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ "font-size": "14px", "font-weight": "600", "margin-bottom": "16px", color: "var(--text-primary)" }}>
              Parametres Workspace
            </div>

            <div style={{ "margin-bottom": "12px" }}>
              <div style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-secondary)", "margin-bottom": "8px" }}>
                Dossiers racines
              </div>
              <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
                <For each={ide.getRootDirs()} fallback={
                  <div style={{ "font-size": "12px", color: "var(--text-muted)", padding: "8px 0" }}>
                    Aucun dossier racine configure.
                  </div>
                }>
                  {(dir) => (
                    <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "4px 0" }}>
                      <span style={{ flex: "1", "font-size": "12px", color: "var(--text-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                        {dir}
                      </span>
                      <button
                        onClick={() => ide.removeRootDir(dir)}
                        style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", "font-size": "14px", padding: "0 4px" }}
                        title="Supprimer"
                      >&#10005;</button>
                    </div>
                  )}
                </For>
              </div>
              <button
                onClick={pickRootDir}
                style={{
                  "margin-top": "8px", padding: "6px 12px", "font-size": "12px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border-color)",
                  "border-radius": "var(--radius-sm)", color: "var(--text-secondary)", cursor: "pointer",
                }}
              >+ Ajouter un dossier racine</button>
            </div>

            <div style={{ display: "flex", "justify-content": "flex-end", "margin-top": "16px" }}>
              <button
                onClick={() => setShowWorkspaceSettings(false)}
                style={{ padding: "6px 14px", background: "var(--accent-primary)", border: "none", "border-radius": "var(--radius-sm)", color: "#fff", cursor: "pointer", "font-size": "12px" }}
              >Fermer</button>
            </div>
          </div>
        </div>
      </Show>

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
    </>
  );
}
