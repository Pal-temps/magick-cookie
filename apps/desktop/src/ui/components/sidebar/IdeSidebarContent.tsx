import { Show, For, createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { vaultService } from "../../../application/services/vaultService";
import { useIdeStore } from "../../../application/stores/ideStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useSettingsStore } from "../../../application/stores/settingsStore";
import { useAiSessionStore } from "../../../application/stores/aiSessionStore";
import { useCliTabStore } from "../../../application/stores/cliTabStore";
import { useWorkflowStore } from "../../../application/stores/workflowStore";
import { useCiCdStore } from "../../../application/stores/cicdStore";
import { useT } from "../../../i18n/context";
import { FileExplorer } from "../ide/FileExplorer";
import { GitPanel } from "../ide/GitPanel";
import { McpPanel } from "../ide/McpPanel";

export function IdeSidebarContent() {
  const { t } = useT();
  const ide = useIdeStore();
  const { snippets } = useSnippetStore();

  const [newFileDialog, setNewFileDialog] = createSignal<{ folder: string; type: "file" | "folder" } | null>(null);
  const [newFileInput, setNewFileInput] = createSignal("");


  const settings = useSettingsStore();

  // Load workspace on mount + restore last active project
  onMount(async () => {
    await ide.refreshWorkspace();
    if (!ide.projectPath()) {
      const lastProject = settings.getWorkspace().activeProjectPath;
      if (lastProject) {
        // Only restore if the project is still in the workspace
        const projects = ide.discoveredProjects();
        const exists = projects.some((p) => p.path === lastProject);
        if (exists) {
          await ide.openProject(lastProject);
        } else {
          // Clean up stale reference
          settings.patchWorkspace({ activeProjectPath: null });
        }
      }
    }
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

  function selectProject(path: string) {
    ide.switchProject(path);
  }

  const ai = useAiSessionStore();
  const hasProject = () => ide.projectPath() !== null;

  // ─── Context menu (shared for vault files & workflows) ───
  const [ctxMenu, setCtxMenu] = createSignal<{ x: number; y: number; action: () => Promise<void> | void } | null>(null);

  function showCtxMenu(e: MouseEvent, onDelete: () => Promise<void> | void) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, action: onDelete });
  }

  // ─── Vault section (skills / hooks / prompts) ───
  function VaultSectionLink(props: { icon: string; label: string; section: string }) {
    const [expanded, setExpanded] = createSignal(false);
    const [files, setFiles] = createSignal<{ name: string; path: string }[]>([]);
    const [creating, setCreating] = createSignal(false);
    const [newName, setNewName] = createSignal("");

    async function toggle() {
      if (!expanded()) {
        const entries = await ide.listVaultSection(props.section);
        setFiles(entries);
      }
      setExpanded(!expanded());
    }

    async function handleCreate() {
      const name = newName().trim();
      if (!name) return;
      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      await ide.createVaultFile(props.section, fileName);
      setCreating(false);
      setNewName("");
      const entries = await ide.listVaultSection(props.section);
      setFiles(entries);
    }

    async function handleDelete(relPath: string) {
      try {
        await vaultService.deleteFile(`${props.section}/${relPath}`);
      } catch (e) {
        console.error("Failed to delete vault file:", e);
      }
      const entries = await ide.listVaultSection(props.section);
      setFiles(entries);
    }

    return (
      <div>
        <button class="ide-sidebar-link" onClick={toggle}>
          <span class="ide-sidebar-link__icon">{props.icon}</span>
          {props.label}
          <span style={{ "margin-left": "auto", "font-size": "10px", opacity: "0.5" }}>
            {expanded() ? "\u25B4" : "\u25BE"}
          </span>
        </button>
        <Show when={expanded()}>
          <div style={{ "padding-left": "20px" }}>
            <For each={files()} fallback={
              <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
                {t("ide.noFile")}
              </div>
            }>
              {(entry) => (
                <button
                  class="ide-sidebar-link"
                  style={{ "font-size": "11px" }}
                  onClick={() => ide.openVaultFile(`${props.section}/${entry.path}`)}
                  onContextMenu={(e) => showCtxMenu(e, () => handleDelete(entry.path))}
                >
                  {entry.name.replace(/\.md$/, "")}
                </button>
              )}
            </For>
            <Show when={creating()}>
              <div style={{ display: "flex", gap: "4px", padding: "4px 0" }}>
                <input
                  autofocus
                  value={newName()}
                  onInput={(e) => setNewName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="nom.md"
                  style={{
                    flex: "1", padding: "3px 6px", "font-size": "11px",
                    background: "var(--bg-base)", border: "1px solid var(--border-color)",
                    "border-radius": "var(--radius-sm)", color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
            </Show>
            <button
              class="ide-sidebar-link ide-sidebar-link--accent"
              style={{ "font-size": "11px" }}
              onClick={() => setCreating(true)}
            >
              <span class="ide-sidebar-link__icon">+</span> {t("common.new")}
            </button>
          </div>
        </Show>
      </div>
    );
  }

  // Short path for display (last 2 segments)


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

  // ─── Session Workflow Picker ───
  function SessionWorkflowPicker(props: { sessionId: string }) {
    const wfStore = useWorkflowStore();
    const [open, setOpen] = createSignal(false);

    const assigned  = () => wfStore.getWorkflowForSession(props.sessionId);
    const inherited = () => wfStore.activeWorkflow();
    const effective = () => assigned() ?? inherited();

    const label = () => {
      if (assigned()) return assigned()!.name;
      if (inherited()) return inherited()!.name;
      return "Aucun workflow";
    };

    function openEditor(e: MouseEvent) {
      e.stopPropagation();
      const wf = effective();
      if (wf) {
        wfStore.setEditingWorkflowId(wf.id);
        if (!ide.codeDrawerOpen()) ide.toggleCodeDrawer();
      }
    }

    function toggle(e: MouseEvent) {
      e.stopPropagation();
      setOpen((v) => !v);
    }

    function pick(id: string | null, e: MouseEvent) {
      e.stopPropagation();
      wfStore.assignWorkflowToSession(props.sessionId, id);
      setOpen(false);
    }

    return (
      <div class="ide-swf" onClick={(e) => e.stopPropagation()}>
        {/* Trigger row — full width, flat, part of the card */}
        <button
          class="ide-swf__trigger"
          onClick={toggle}
          title={assigned()
            ? `Workflow : ${assigned()!.name}`
            : inherited()
              ? `Hérité du défaut : ${inherited()!.name}`
              : "Aucun workflow assigné"}
        >
          {/* ⚡ icon */}
          <svg class={`ide-swf__bolt ${assigned() ? "ide-swf__bolt--set" : ""}`} width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6 1.5L3 5.5h2.5L4 9l4-5H5.5L6 1.5Z" fill="currentColor"/>
          </svg>

          <span class={`ide-swf__label ${!assigned() && !inherited() ? "ide-swf__label--empty" : assigned() ? "" : "ide-swf__label--inherited"}`}>
            {label()}
          </span>

          <Show when={!assigned() && inherited()}>
            <span class="ide-swf__badge-tag">défaut</span>
          </Show>

          <svg class={`ide-swf__chevron ${open() ? "ide-swf__chevron--open" : ""}`} width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 2.5L4 5.5L6.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        {/* Edit button — shows only when a workflow is effective */}
        <Show when={effective()}>
          <button class="ide-swf__edit" onClick={openEditor} title="Ouvrir l'éditeur de workflow">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" stroke-width="1.2"/>
            </svg>
          </button>
        </Show>

        {/* Dropdown */}
        <Show when={open()}>
          <div
            style={{ position: "fixed", inset: "0", "z-index": "200" }}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div class="ide-swf__dropdown">
            <div class="ide-swf__dropdown-header">Workflow de la session</div>

            <button
              class={`ide-swf__opt ${!assigned() ? "ide-swf__opt--active" : ""}`}
              onClick={(e) => pick(null, e)}
            >
              <span class="ide-swf__opt-name ide-swf__opt-name--dim">
                {inherited() ? `Hérité — ${inherited()!.name}` : "Aucun"}
              </span>
            </button>

            <Show when={wfStore.workflows().length > 0}>
              <div class="ide-swf__sep" />
            </Show>

            <For each={wfStore.workflows()}>
              {(wf) => (
                <button
                  class={`ide-swf__opt ${assigned()?.id === wf.id ? "ide-swf__opt--active" : ""}`}
                  onClick={(e) => pick(wf.id, e)}
                >
                  <div class="ide-swf__opt-row">
                    <span class="ide-swf__opt-name">{wf.name}</span>
                    <Show when={assigned()?.id === wf.id}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5.5L4 8l4.5-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </Show>
                  </div>
                  <Show when={wf.description}>
                    <span class="ide-swf__opt-desc">{wf.description}</span>
                  </Show>
                </button>
              )}
            </For>

            <Show when={wfStore.workflows().length === 0}>
              <div class="ide-swf__empty">Aucun workflow — créez-en un dans la section Workflows</div>
            </Show>
          </div>
        </Show>
      </div>
    );
  }

  // ─── Sessions List ───
  function SessionsList() {
    const cliStore = useCliTabStore();
    const sessionList = () => Array.from(ai.sessions().values());
    const [editingId, setEditingId] = createSignal<string | null>(null);
    const [editValue, setEditValue] = createSignal("");

    async function newSession() {
      await ai.fetchProviders();
      const cwd = ide.projectPath();
      if (!cwd) {
        // No project open — fall back to terminal so the user can set one
        cliStore.launchCliTerminal();
        return;
      }
      try {
        await ai.startSession({ provider: "claude-cli", model: "", cwd });
      } catch (e) {
        cliStore.launchCliTerminal();
      }
    }

    function startRename(id: string, currentLabel: string) {
      setEditingId(id);
      setEditValue(currentLabel);
    }

    function commitRename(id: string) {
      const val = editValue().trim();
      if (val) ai.renameSession(id, val).catch(() => { /* already logged + reverted in store */ });
      setEditingId(null);
    }

    function sessionDisplayName(session: { label: string; model: string; provider: string }): string {
      return session.label || session.model || session.provider;
    }

    return (
      <div class="ide-sessions-list">
        {/* CLI terminals */}
        <For each={cliStore.cliTabs()}>
          {(tab) => (
            <button
              class={`ide-session-item ${cliStore.activeCliTabId() === tab.id ? "ide-session-item--active" : ""}`}
              onClick={() => cliStore.setActiveCliTabId(tab.id)}
            >
              <span class="cc-status-dot cc-status-dot--ready" />
              <span class="ide-session-item__name">{tab.label}</span>
              <span class="ide-session-item__badge">PTY</span>
            </button>
          )}
        </For>
        {/* AI sessions */}
        <For each={sessionList()}>
          {(session) => (
            <div class="ide-session-wrap">
              <div
                class={`ide-session-item ${ai.activeSessionId() === session.id ? "ide-session-item--active" : ""}`}
                onClick={() => ai.switchSession(session.id)}
                onDblClick={(e) => { e.stopPropagation(); startRename(session.id, sessionDisplayName(session)); }}
              >
                <span class={`cc-status-dot ${
                  session.isStreaming ? "cc-status-dot--active" :
                  session.phase === "terminated" ? "cc-status-dot--terminated" :
                  session.phase === "ready" ? "cc-status-dot--ready" : ""
                }`} />
                <Show when={editingId() === session.id} fallback={
                  <span class="ide-session-item__name" title={t("ide.dblClickRename")}>{sessionDisplayName(session)}</span>
                }>
                  <input
                    class="ide-session-item__rename"
                    type="text"
                    value={editValue()}
                    onInput={(e) => setEditValue(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(session.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => commitRename(session.id)}
                    onClick={(e) => e.stopPropagation()}
                    ref={(el) => requestAnimationFrame(() => el.focus())}
                  />
                </Show>
                <span class="ide-session-item__badge">
                  {session.provider.toLowerCase().includes("claude") ? "CC" :
                   session.provider.toLowerCase().includes("openai") ? "GPT" :
                   session.provider.toLowerCase().includes("ollama") ? "OL" :
                   session.provider.slice(0, 2).toUpperCase()}
                </span>
              </div>
              {/* Modern workflow picker */}
              <SessionWorkflowPicker sessionId={session.id} />
            </div>
          )}
        </For>
        <Show when={cliStore.cliTabs().length === 0 && sessionList().length === 0}>
          <div style={{ padding: "8px 0", "font-size": "11px", color: "var(--text-muted)" }}>
            {t("ide.noSession")}
          </div>
        </Show>
        <button class="ide-sidebar-link ide-sidebar-link--accent" onClick={newSession}>
          <span class="ide-sidebar-link__icon">+</span> {t("ide.newSession")}
        </button>
      </div>
    );
  }

  // ─── Workflows List ───
  function WorkflowsList() {
    const wf = useWorkflowStore();
    const [showPresets, setShowPresets] = createSignal(false);
    const [creating, setCreating] = createSignal(false);
    const [newName, setNewName] = createSignal("");

    onMount(() => { wf.fetchWorkflows(); });

    async function handleCreatePreset(presetId: string) {
      await wf.createFromPreset(presetId);
      setShowPresets(false);
    }

    async function handleCreate() {
      const name = newName().trim();
      if (!name) return;
      await wf.createWorkflow(name);
      setCreating(false);
      setNewName("");
    }

    function openInEditor(templateId: string) {
      wf.setEditingWorkflowId(templateId);
      if (!ide.codeDrawerOpen()) ide.toggleCodeDrawer();
    }

    return (
      <div class="ide-workflows-list">
        <For each={wf.workflows()}>
          {(template) => {
            const isDefault = () => wf.activeWorkflowId() === template.id;
            return (
              <div
                class={`ide-workflow-item ${isDefault() ? "ide-workflow-item--active" : ""}`}
                onClick={() => wf.selectWorkflow(isDefault() ? null : template.id)}
                onContextMenu={(e) => showCtxMenu(e, () => wf.deleteWorkflow(template.id))}
                title={template.description || template.name}
              >
                <div class="ide-workflow-item__info">
                  <span class="ide-workflow-item__name">{template.name}</span>
                  <Show when={template.description}>
                    <span class="ide-workflow-item__desc">{template.description}</span>
                  </Show>
                </div>
                <Show when={isDefault()}>
                  <span class="ide-workflow-item__active-badge">{t("ide.default")}</span>
                </Show>
                <button
                  class="ide-workflow-item__edit"
                  onClick={(e) => { e.stopPropagation(); openInEditor(template.id); }}
                  title="Editer"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" stroke-width="1.2" /></svg>
                </button>
              </div>
            );
          }}
        </For>

        <Show when={wf.workflows().length === 0}>
          <div style={{ padding: "6px 0", "font-size": "11px", color: "var(--text-muted)" }}>
            {t("ide.noWorkflow")} — {t("ide.noWorkflowHint")}
          </div>
        </Show>

        {/* Create actions */}
        <Show when={creating()}>
          <div style={{ display: "flex", gap: "4px", padding: "4px 0" }}>
            <input
              class="ide-session-item__rename"
              type="text"
              placeholder="Nom du workflow..."
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              ref={(el) => requestAnimationFrame(() => el.focus())}
              style={{ flex: "1" }}
            />
          </div>
        </Show>

        <div style={{ display: "flex", gap: "4px" }}>
          <button class="ide-sidebar-link ide-sidebar-link--accent" style={{ flex: "1" }} onClick={() => setCreating(true)}>
            <span class="ide-sidebar-link__icon">+</span> {t("common.new")}
          </button>
          <div style={{ position: "relative" }}>
            <button class="ide-sidebar-link" onClick={() => setShowPresets(!showPresets())}>
              <span class="ide-sidebar-link__icon">T</span> {t("ide.presets")}
            </button>
            <Show when={showPresets()}>
              <div class="ide-context-menu" style={{ position: "absolute", bottom: "100%", right: "0", "min-width": "180px" }} onMouseDown={(e) => e.stopPropagation()}>
                <div class="ide-context-label">{t("ide.predefinedTemplates")}</div>
                <For each={wf.presetIds}>
                  {(presetId) => {
                    const preset = wf.presets[presetId]();
                    return (
                      <div class="ide-context-item" onClick={() => handleCreatePreset(presetId)}>
                        <span>{preset.name}</span>
                        <span style={{ "margin-left": "auto", "font-size": "9px", color: "var(--text-muted)" }}>
                          {preset.preCommit.length > 0 ? `${preset.preCommit.length} hooks` : ""}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    );
  }

  // ─── Monorepo scanner ───
  const cicd = useCiCdStore();
  const MONOREPO_ROOT = "C:/Users/bumbl/Documents/Perso/magick-cookie";
  const [linkDialog, setLinkDialog] = createSignal<{ projectName: string } | null>(null);
  const [linkProvider, setLinkProvider] = createSignal<"github" | "gitlab">("github");
  const [linkRepo, setLinkRepo] = createSignal("");
  const [linkBranch, setLinkBranch] = createSignal("main");
  const [monorepoProjects, setMonorepoProjects] = createSignal<{ name: string; path: string; markers: string[] }[]>([]);
  const [projectSearch, setProjectSearch] = createSignal("");
  // Internal app projects — hidden from the explorer
  const INTERNAL_PROJECTS = new Set(["api", "desktop", "llm", "screenshot-cli"]);

  async function scanMonorepo() {
    try {
      const scanned = await invoke<{ name: string; path: string; markers: string[] }[]>(
        "fs_scan_projects", { rootDirs: [MONOREPO_ROOT + "/apps", MONOREPO_ROOT + "/tools"] }
      );
      // Add the root itself
      scanned.unshift({ name: "magick-cookie", path: MONOREPO_ROOT, markers: ["monorepo"] });
      setMonorepoProjects(scanned);
    } catch (e) {
      console.error("Scan monorepo failed:", e);
      // Fallback
      setMonorepoProjects([{ name: "magick-cookie", path: MONOREPO_ROOT, markers: ["monorepo"] }]);
    }
  }

  onMount(() => { scanMonorepo(); });

  const filteredMonorepoProjects = () => {
    const q = projectSearch().toLowerCase();
    const visible = monorepoProjects().filter((p) => !INTERNAL_PROJECTS.has(p.name));
    if (!q) return visible;
    return visible.filter((p) => p.name.toLowerCase().includes(q));
  };

  function markerBadge(markers: string[]): { label: string; color: string } {
    if (markers.includes("monorepo")) return { label: "MONO", color: "var(--accent-primary)" };
    const m = markers[0] || "";
    if (m === "package.json") return { label: "JS", color: "#f0db4f" };
    if (m === "Cargo.toml") return { label: "RS", color: "#ce422b" };
    if (m === "go.mod") return { label: "GO", color: "#00add8" };
    if (m === "pyproject.toml" || m === "setup.py") return { label: "PY", color: "#3776ab" };
    return { label: "DIR", color: "var(--text-muted)" };
  }

  return (
    <>
      {/* Project explorer */}
      <div class="proj-explorer" style={{ "flex-shrink": "0" }}>
        {/* Active project header */}
        <div class="proj-explorer__active">
          <div class="proj-explorer__active-name">
            {ide.projectPath() ? ide.projectName() : "Magick Cookie"}
          </div>
          <Show when={ide.projectPath() && ide.projectPath() !== MONOREPO_ROOT}>
            <button class="proj-explorer__root-btn" onClick={() => selectProject(MONOREPO_ROOT)} title={t("ide.openMonorepo")}>
              ↑ Monorepo
            </button>
          </Show>
        </div>

        {/* Search */}
        <div class="proj-explorer__search">
          <input
            type="text"
            placeholder={t("ide.filterProjects")}
            value={projectSearch()}
            onInput={(e) => setProjectSearch(e.currentTarget.value)}
            class="proj-explorer__search-input"
          />
        </div>

        {/* Project list */}
        <div class="proj-explorer__list">
          <For each={filteredMonorepoProjects()}>
            {(project) => {
              const badge = () => markerBadge(project.markers);
              const isActive = () => project.path.replace(/\\/g, "/") === ide.projectPath()?.replace(/\\/g, "/");
              const gitLink = () => cicd.getProjectLink(project.name);
              return (
                <button
                  class={`proj-explorer__item ${isActive() ? "proj-explorer__item--active" : ""}`}
                  onClick={() => selectProject(project.path)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const existing = gitLink();
                    setLinkProvider(existing?.provider ?? "github");
                    setLinkRepo(existing?.repo ?? "");
                    setLinkBranch(existing?.branch ?? "main");
                    setLinkDialog({ projectName: project.name });
                  }}
                >
                  <span class="proj-explorer__badge" style={{ background: badge().color }}>{badge().label}</span>
                  <span class="proj-explorer__name">{project.name}</span>
                  <Show when={gitLink()}>
                    <span class={`proj-explorer__git proj-explorer__git--${gitLink()!.provider}`} title={`${gitLink()!.provider}: ${gitLink()!.repo}`}>
                      {gitLink()!.provider === "github" ? "GH" : "GL"}
                    </span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Sections */}
      <div class="ide-sidebar-sections">
        {/* ─── SESSIONS ─── */}
        <SidebarSection id="sessions" title={t("ide.sessions")}>
          <SessionsList />
        </SidebarSection>

        {/* ─── WORKBENCH ─── */}
        <SidebarSection id="workbench" title={t("ide.workbench")}>
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
          <VaultSectionLink icon="S" label="Skills" section="_ide/skills" />
          <VaultSectionLink icon="H" label="Hooks" section="_ide/hooks" />
          <VaultSectionLink icon="P" label="Prompts" section="_ide/prompts" />
          <button class="ide-sidebar-link" onClick={() => { const cliStore = useCliTabStore(); cliStore.launchShellTerminal(); }}>
            <span class="ide-sidebar-link__icon">$</span> Terminal
          </button>
        </SidebarSection>

        {/* ─── WORKFLOWS ─── */}
        <SidebarSection id="workflows" title={t("ide.workflows")}>
          <WorkflowsList />
        </SidebarSection>

        {/* ─── MCP SERVERS ─── */}
        <SidebarSection id="mcp" title={t("ide.mcpServers")} defaultOpen={false}>
          <McpPanel />
        </SidebarSection>

        {/* ─── WORKSPACE ─── */}
        <SidebarSection id="workspace" title={t("ide.workspace")} defaultOpen={true}>
          {/* Sub-tabs for Files/Git */}
          <div class="ide-sidebar-tabs">
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "files" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("files")}
            >{t("ide.files")}</button>
            <button
              class={`ide-sidebar-tab ${ide.sidePanel() === "git" ? "ide-sidebar-tab--active" : ""}`}
              onClick={() => ide.setSidePanel("git")}
            >{t("ide.git")}</button>
          </div>

          {/* Files panel */}
          <Show when={ide.sidePanel() === "files"}>
            <Show when={hasProject()} fallback={
              <div style={{ padding: "12px", "text-align": "center", color: "var(--text-muted)", "font-size": "12px" }}>
                {t("ide.noProjectOpen")}
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
              {newFileDialog()!.type === "file" ? t("ide.newFile") : t("ide.newFolder")}
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
              >{t("common.cancel")}</button>
              <button
                onClick={confirmCreate}
                style={{ padding: "6px 14px", background: "var(--accent-primary)", border: "none", "border-radius": "var(--radius-sm)", color: "#fff", cursor: "pointer", "font-size": "12px" }}
              >{t("common.create")}</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Git link dialog */}
      <Show when={linkDialog()}>
        <div class="cicd-overlay" onClick={() => setLinkDialog(null)}>
          <div class="cicd-dialog" onClick={(e) => e.stopPropagation()} style={{ width: "360px" }}>
            <div class="cicd-dialog__header">
              <span>{t("ide.linkToGitRepo")} — {linkDialog()!.projectName}</span>
              <button class="cicd-dialog__close" onClick={() => setLinkDialog(null)}>&times;</button>
            </div>
            <div class="cicd-dialog__body">
              <label class="cicd-field">
                <span class="cicd-field__label">Provider</span>
                <select class="cicd-field__input" value={linkProvider()} onChange={(e) => setLinkProvider(e.currentTarget.value as "github" | "gitlab")}>
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                </select>
              </label>
              <label class="cicd-field">
                <span class="cicd-field__label">{linkProvider() === "github" ? "Repo (owner/repo)" : "ID du projet"}</span>
                <input class="cicd-field__input" type="text" value={linkRepo()} onInput={(e) => setLinkRepo(e.currentTarget.value)}
                  placeholder={linkProvider() === "github" ? "user/repo" : "12345"} />
              </label>
              <label class="cicd-field">
                <span class="cicd-field__label">{t("ide.defaultBranch")}</span>
                <input class="cicd-field__input" type="text" value={linkBranch()} onInput={(e) => setLinkBranch(e.currentTarget.value)} placeholder="main" />
              </label>
            </div>
            <div class="cicd-dialog__footer">
              <Show when={cicd.getProjectLink(linkDialog()!.projectName)}>
                <button class="cicd-dialog__btn cicd-dialog__btn--danger" onClick={() => { cicd.unlinkProject(linkDialog()!.projectName); setLinkDialog(null); }}>
                  {t("ide.unlink")}
                </button>
              </Show>
              <div style={{ flex: "1" }} />
              <button class="cicd-dialog__btn" onClick={() => setLinkDialog(null)}>{t("common.cancel")}</button>
              <button class="cicd-dialog__btn cicd-dialog__btn--primary" disabled={!linkRepo().trim()} onClick={() => {
                cicd.linkProject(linkDialog()!.projectName, linkProvider(), linkRepo().trim(), linkBranch().trim() || "main");
                setLinkDialog(null);
              }}>{t("ide.link")}</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Shared context menu (delete) */}
      <Show when={ctxMenu()}>
        <div
          class="ide-context-overlay"
          style={{ position: "fixed", inset: "0", "z-index": "9998" }}
          onClick={() => setCtxMenu(null)}
        />
        <div
          class="ide-context-menu"
          style={{ left: `${ctxMenu()!.x}px`, top: `${ctxMenu()!.y}px`, position: "fixed", "z-index": "9999" }}
        >
          <div class="ide-context-item ide-context-item--danger" onClick={async () => {
            const action = ctxMenu()!.action;
            setCtxMenu(null);
            await action();
          }}>
            {t("common.delete")}
          </div>
        </div>
      </Show>
    </>
  );
}
