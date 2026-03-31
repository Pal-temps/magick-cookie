import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSnippetStore, type Snippet } from "./snippetStore";
import { useViewStore } from "./viewStore";
import { useSettingsStore } from "./settingsStore";

// ─── Types ───

export interface FsEntry {
  name: string;
  path: string;    // relative to project root
  is_dir: boolean;
  size: number;
  modified: number;
}

export interface TreeNode {
  name: string;
  path: string;
  folders: TreeNode[];
  files: FsEntry[];
}

export interface EditorTab {
  id: string;
  path: string;       // absolute path for project files, "snippet::{id}" for snippets
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  source: "project" | "snippet";
  snippetId?: string;
}

export type SidePanel = "files" | "git";

// ─── Grid layout for AI terminals ───

export interface GridTemplate {
  id: string;
  name: string;
  icon: string;
  columns: string;
  rows: string;
  areas: string;
  slotCount: number;
}

export const GRID_TEMPLATES: GridTemplate[] = [
  { id: "single",  name: "1 terminal",    icon: "1",  columns: "1fr",     rows: "1fr",     areas: '"a"',               slotCount: 1 },
  { id: "side",    name: "2 cote a cote", icon: "2h", columns: "1fr 1fr", rows: "1fr",     areas: '"a b"',             slotCount: 2 },
  { id: "stack",   name: "2 empiles",     icon: "2v", columns: "1fr",     rows: "1fr 1fr", areas: '"a" "b"',           slotCount: 2 },
  { id: "grid",    name: "Grille 2x2",    icon: "4",  columns: "1fr 1fr", rows: "1fr 1fr", areas: '"a b" "c d"',       slotCount: 4 },
  { id: "left-2r", name: "1 + 2 droite",  icon: "L",  columns: "1fr 1fr", rows: "1fr 1fr", areas: '"a b" "a c"',       slotCount: 3 },
  { id: "top-2b",  name: "1 + 2 bas",     icon: "T",  columns: "1fr 1fr", rows: "1fr 1fr", areas: '"a a" "b c"',       slotCount: 3 },
];

export interface WorkspaceProject {
  path: string;
  name: string;
  markers: string[];
}

// ─── State ───

const [projectPath, setProjectPath] = createSignal<string | null>(null);
const [projectName, setProjectName] = createSignal<string>("Aucun projet");
const [projectFiles, setProjectFiles] = createSignal<FsEntry[]>([]);
const [tabs, setTabs] = createSignal<EditorTab[]>([]);
const [activeTabId, setActiveTabId] = createSignal<string | null>(null);
const [sidePanel, setSidePanel] = createSignal<SidePanel>("files");
// showBottomPanel and showSidePanel removed — panels are now managed by grid layout + drawers
const [gridLayout, setGridLayout] = createSignal<string>(
  localStorage.getItem("ide-grid-layout") ?? "single"
);
const [gridSlots, setGridSlots] = createSignal<(string | null)[]>(
  JSON.parse(localStorage.getItem("ide-grid-slots") ?? "[null, null, null, null]")
);
const [codeDrawerOpen, setCodeDrawerOpen] = createSignal(
  localStorage.getItem("ide-code-drawer") === "true"
);
const [codeDrawerWidth, setCodeDrawerWidth] = createSignal(
  parseInt(localStorage.getItem("ide-code-drawer-width") ?? "550", 10)
);
const [contextPanelOpen, setContextPanelOpen] = createSignal(
  localStorage.getItem("ide-context-open") !== "false"
);
const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set([""]));

// ─── File watcher state ───

let fsChangeUnlisten: UnlistenFn | null = null;
let refreshDebounce: ReturnType<typeof setTimeout> | null = null;

// ─── Persistence helpers ───

const STORAGE_KEYS = {
  tabs: "ide-tabs",
  activeTab: "ide-active-tab",
  expandedFolders: "ide-expanded-folders",
  sidePanel: "ide-side-panel",
  projectPath: "ide-project-path",
} as const;

interface PersistedTab {
  id: string;
  path: string;
  name: string;
  language: string;
  source: "project" | "snippet";
  snippetId?: string;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistState, 300);
}

function persistState() {
  // Save tabs (without content — we reload from disk)
  const tabData: PersistedTab[] = tabs().map((t) => ({
    id: t.id, path: t.path, name: t.name,
    language: t.language, source: t.source, snippetId: t.snippetId,
  }));
  localStorage.setItem(STORAGE_KEYS.tabs, JSON.stringify(tabData));
  localStorage.setItem(STORAGE_KEYS.activeTab, activeTabId() ?? "");
  localStorage.setItem(STORAGE_KEYS.expandedFolders, JSON.stringify([...expandedFolders()]));
  localStorage.setItem(STORAGE_KEYS.sidePanel, sidePanel());
  localStorage.setItem(STORAGE_KEYS.projectPath, projectPath() ?? "");
}

// ─── Workspace state ───

const [discoveredProjects, setDiscoveredProjects] = createSignal<WorkspaceProject[]>([]);
const [workspaceSearchQuery, setWorkspaceSearchQuery] = createSignal("");
const workspaceSettings = useSettingsStore();

function switchGridLayout(templateId: string) {
  setGridLayout(templateId);
  localStorage.setItem("ide-grid-layout", templateId);
}

function assignSlot(slotIndex: number, sessionId: string | null) {
  setGridSlots((prev) => {
    const next = [...prev];
    while (next.length <= slotIndex) next.push(null);
    next[slotIndex] = sessionId;
    localStorage.setItem("ide-grid-slots", JSON.stringify(next));
    return next;
  });
}

function currentGrid(): GridTemplate {
  return GRID_TEMPLATES.find((t) => t.id === gridLayout()) ?? GRID_TEMPLATES[0];
}

function toggleCodeDrawer() {
  const next = !codeDrawerOpen();
  setCodeDrawerOpen(next);
  localStorage.setItem("ide-code-drawer", String(next));
}

function persistCodeDrawerWidth(w: number) {
  setCodeDrawerWidth(w);
  localStorage.setItem("ide-code-drawer-width", String(w));
}

function toggleContextPanel() {
  const next = !contextPanelOpen();
  setContextPanelOpen(next);
  localStorage.setItem("ide-context-open", String(next));
}

// ─── Helpers ───

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", scss: "scss", html: "html",
    rs: "rust", py: "python", go: "go", sh: "shell", bash: "shell",
    yml: "yaml", yaml: "yaml", toml: "ini", sql: "sql", xml: "xml",
    java: "java", kt: "kotlin", rb: "ruby", php: "php", c: "c",
    cpp: "cpp", h: "cpp", cs: "csharp", swift: "swift", dart: "dart",
    lua: "lua", r: "r", excalidraw: "json",
  };
  return map[ext] ?? "plaintext";
}

function fileNameFromPath(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  return path.split(sep).pop() ?? path;
}

// ─── Tree builder ───

function buildTree(files: FsEntry[], rootName: string): TreeNode {
  const root: TreeNode = { name: rootName, path: "", folders: [], files: [] };

  function ensureFolder(node: TreeNode, folderPath: string): TreeNode {
    const parts = folderPath.split("/");
    let current = node;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      let child = current.folders.find((f) => f.name === name);
      if (!child) {
        child = { name, path, folders: [], files: [] };
        current.folders.push(child);
      }
      current = child;
    }
    return current;
  }

  for (const file of files) {
    const parts = file.path.split("/");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join("/");
      const folder = ensureFolder(root, parentPath);
      if (file.is_dir) {
        ensureFolder(root, file.path);
      } else {
        folder.files.push(file);
      }
    } else {
      if (file.is_dir) {
        ensureFolder(root, file.path);
      } else {
        root.files.push(file);
      }
    }
  }

  return root;
}

// ─── Store ───

export function useIdeStore() {
  const snippetStore = useSnippetStore();

  // ─── Restore persisted state ───

  async function restoreState() {
    // Restore project path first
    const savedProject = localStorage.getItem(STORAGE_KEYS.projectPath);
    if (savedProject) {
      setProjectPath(savedProject);
      setProjectName(fileNameFromPath(savedProject));
      await refreshFiles();
      await startWatcher(savedProject);
    }

    // Restore side panel
    const savedPanel = localStorage.getItem(STORAGE_KEYS.sidePanel);
    if (savedPanel === "files" || savedPanel === "git") setSidePanel(savedPanel);

    // Restore expanded folders
    const savedFolders = localStorage.getItem(STORAGE_KEYS.expandedFolders);
    if (savedFolders) {
      try {
        const arr = JSON.parse(savedFolders) as string[];
        setExpandedFolders(new Set(arr));
      } catch { /* ignore */ }
    }

    // Restore tabs — reload content from disk
    const savedTabs = localStorage.getItem(STORAGE_KEYS.tabs);
    if (savedTabs && projectPath()) {
      try {
        const persisted = JSON.parse(savedTabs) as PersistedTab[];
        const restored: EditorTab[] = [];

        for (const pt of persisted) {
          if (pt.source === "project") {
            try {
              const content = await invoke<string>("fs_read_file", { path: pt.path });
              restored.push({ ...pt, content, isDirty: false });
            } catch {
              // File was deleted/moved — skip it
            }
          } else if (pt.source === "snippet" && pt.snippetId) {
            // Snippets are loaded separately; add placeholder that gets filled
            restored.push({ ...pt, content: "", isDirty: false });
          }
        }

        if (restored.length > 0) {
          setTabs(restored);
          const savedActive = localStorage.getItem(STORAGE_KEYS.activeTab);
          if (savedActive && restored.some((t) => t.id === savedActive)) {
            setActiveTabId(savedActive);
          } else {
            setActiveTabId(restored[0].id);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // ─── File watcher ───

  async function startWatcher(watchPath: string) {
    // Listen for fs-change events (only once)
    if (!fsChangeUnlisten) {
      fsChangeUnlisten = await listen<{ path: string; kind: string }>("fs-change", (event) => {
        const { path: changedPath, kind } = event.payload;

        // Debounce file tree refresh
        if (refreshDebounce) clearTimeout(refreshDebounce);
        refreshDebounce = setTimeout(() => refreshFiles(), 200);

        // Reload content for open tabs if modified externally
        if (kind === "modify") {
          const tab = tabs().find((t) => t.source === "project" && t.path.replace(/\\/g, "/") === changedPath);
          if (tab && !tab.isDirty) {
            invoke<string>("fs_read_file", { path: tab.path }).then((content) => {
              if (content !== tab.content) {
                setTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, content } : t));
              }
            }).catch(() => {});
          }
        }

        // Close tabs for removed files
        if (kind === "remove") {
          const tab = tabs().find((t) => t.source === "project" && t.path.replace(/\\/g, "/") === changedPath);
          if (tab) closeTab(tab.id);
        }
      });
    }

    // Start Rust watcher
    try {
      await invoke("fs_watch_start", { path: watchPath });
    } catch (e) {
      console.error("fs_watch_start error:", e);
    }
  }

  async function stopWatcher() {
    try {
      await invoke("fs_watch_stop");
    } catch { /* ignore */ }
  }

  // ─── Project management ───

  async function ensureProjectVault(name: string) {
    try {
      // Don't overwrite existing CLAUDE.md
      try {
        await invoke<string>("vault_read_json", { relPath: `_projects/${name}/CLAUDE.md` });
        return; // Already exists
      } catch { /* File doesn't exist — create it */ }

      const claudeMd = `# ${name}

## Stack technique
- Langage : (TypeScript, Rust, Python, etc.)
- Framework : (Next.js, SolidJS, etc.)
- Runtime : (Bun, Node, Deno)
- Base de donnees : (PostgreSQL, SQLite, etc.)
- Reverse proxy : Caddy (auto-HTTPS)

## Conventions
- Style de code : (camelCase, snake_case)
- Tests : (bun test, vitest, etc.)
- Linter : (ESLint, Biome)
- Formatter : (Prettier, Biome)

## Deploiement
- Provider : vps-bare (bare git + post-receive hook)
- Serveur : (ID du serveur dans Settings > Infrastructure)
- Domaine : (ex: ${name}.paltemps.fr)
- Port : 3000
- Process manager : pm2
- Build : npm install && npm run build
- Start : pm2 start npm --name ${name} -- start

## Regles pour l'IA
- Toujours utiliser Caddy comme reverse proxy (pas nginx)
- Toujours deployer via git push (pas de SCP/rsync direct)
- Ne jamais stocker de secrets dans le code (utiliser le coffre-fort KDBX)
- Ecrire des tests pour chaque nouvelle feature
- Commenter uniquement le code non-evident

## Structure du projet
(Decrivez l'arborescence cle du projet ici)

## Notes
(Notes libres pour donner du contexte a l'IA)
`;
      await invoke("vault_write_json", { relPath: `_projects/${name}/CLAUDE.md`, content: claudeMd });
    } catch { /* vault might not be configured */ }
  }

  async function readProjectContext(): Promise<string | null> {
    const name = projectName();
    if (!name || name === "Aucun projet") return null;
    try {
      return await invoke<string>("vault_read_json", { relPath: `_projects/${name}/CLAUDE.md` });
    } catch {
      return null;
    }
  }

  async function openProject(path: string) {
    setProjectPath(path);
    setProjectName(fileNameFromPath(path));
    setExpandedFolders(new Set([""]));
    setTabs([]);
    setActiveTabId(null);
    await refreshFiles();
    await startWatcher(path);
    workspaceSettings.patchWorkspace({ activeProjectPath: path });
    debouncedSave();
    // Ensure vault folder for this project
    ensureProjectVault(fileNameFromPath(path)).catch(() => {});
  }

  async function refreshFiles() {
    const base = projectPath();
    if (!base) {
      setProjectFiles([]);
      return;
    }
    try {
      const files = await invoke<FsEntry[]>("fs_list_dir", { basePath: base });
      setProjectFiles(files);
    } catch (e) {
      console.error("fs_list_dir error:", e);
      setProjectFiles([]);
    }
  }

  function fileTree(): TreeNode {
    return buildTree(projectFiles(), projectName());
  }

  // ─── Folder expand/collapse ───

  function toggleFolder(path: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    debouncedSave();
  }

  // ─── Tab management ───

  function activeTab() {
    const id = activeTabId();
    return id ? tabs().find((t) => t.id === id) ?? null : null;
  }

  async function openFile(entry: FsEntry) {
    const base = projectPath();
    if (!base) return;

    const absPath = `${base}/${entry.path}`;
    const id = `project::${absPath}`;
    const existing = tabs().find((t) => t.id === id);
    if (existing) {
      setActiveTabId(id);
      return;
    }

    try {
      const content = await invoke<string>("fs_read_file", { path: absPath });
      const tab: EditorTab = {
        id,
        path: absPath,
        name: entry.name,
        content,
        language: detectLanguage(entry.name),
        isDirty: false,
        source: "project",
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
      debouncedSave();
    } catch (e) {
      console.error("fs_read_file error:", e);
    }
  }

  function openSnippet(snippet: Snippet) {
    const id = `snippet::${snippet.id}`;
    const existing = tabs().find((t) => t.id === id);
    if (existing) {
      setActiveTabId(id);
      return;
    }

    const ext = snippet.language === "text" ? "txt" : snippet.language;
    const tab: EditorTab = {
      id,
      path: `snippet::${snippet.id}`,
      name: `${snippet.title}.${ext}`,
      content: snippet.content,
      language: snippet.language,
      isDirty: false,
      source: "snippet",
      snippetId: snippet.id,
    };

    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
    debouncedSave();
  }

  function closeTab(id: string) {
    const idx = tabs().findIndex((t) => t.id === id);
    if (idx === -1) return;

    const newTabs = tabs().filter((t) => t.id !== id);
    setTabs(newTabs);

    if (activeTabId() === id) {
      if (newTabs.length === 0) {
        setActiveTabId(null);
      } else {
        const nextIdx = Math.min(idx, newTabs.length - 1);
        setActiveTabId(newTabs[nextIdx].id);
      }
    }
    debouncedSave();
  }

  function switchTab(id: string) {
    setActiveTabId(id);
    debouncedSave();
  }

  function updateTabContent(id: string, content: string) {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, content, isDirty: true } : t))
    );
  }

  async function saveTab(id: string) {
    const tab = tabs().find((t) => t.id === id);
    if (!tab || !tab.isDirty) return;

    if (tab.source === "project") {
      await invoke("fs_write_file", { path: tab.path, content: tab.content });
    } else if (tab.source === "snippet" && tab.snippetId) {
      await snippetStore.updateSnippet(tab.snippetId, { content: tab.content });
    }

    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t))
    );
  }

  async function saveActiveTab() {
    const id = activeTabId();
    if (id) await saveTab(id);
  }

  // ─── File operations ───

  async function createFile(folder: string, name: string) {
    const base = projectPath();
    if (!base) return;
    const relPath = folder ? `${folder}/${name}` : name;
    const absPath = `${base}/${relPath}`;
    await invoke("fs_write_file", { path: absPath, content: "" });
    await refreshFiles();
    // Open the new file
    await openFile({ name, path: relPath, is_dir: false, size: 0, modified: 0 });
  }

  async function createFolder(folder: string, name: string) {
    const base = projectPath();
    if (!base) return;
    const relPath = folder ? `${folder}/${name}` : name;
    const absPath = `${base}/${relPath}`;
    await invoke("fs_create_dir", { path: absPath });
    await refreshFiles();
    // Auto-expand
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.add(relPath);
      if (folder) next.add(folder);
      return next;
    });
  }

  async function deleteFile(relPath: string) {
    const base = projectPath();
    if (!base) return;
    const absPath = `${base}/${relPath}`;
    await invoke("fs_delete", { path: absPath });
    const tid = `project::${absPath}`;
    if (tabs().find((t) => t.id === tid)) closeTab(tid);
    await refreshFiles();
  }

  async function deleteFolder(relPath: string) {
    const base = projectPath();
    if (!base) return;
    const absPath = `${base}/${relPath}`;
    await invoke("fs_delete", { path: absPath });
    // Close tabs inside this folder
    const prefix = `project::${absPath}/`;
    const toClose = tabs().filter((t) => t.id.startsWith(prefix) || t.id === `project::${absPath}`);
    for (const t of toClose) closeTab(t.id);
    await refreshFiles();
  }

  async function renameFile(relPath: string, newName: string) {
    const base = projectPath();
    if (!base) return;
    const oldAbs = `${base}/${relPath}`;
    const parts = relPath.split("/");
    parts[parts.length - 1] = newName;
    const newRel = parts.join("/");
    const newAbs = `${base}/${newRel}`;
    await invoke("fs_rename", { oldPath: oldAbs, newPath: newAbs });
    // Update tab if open
    const oldId = `project::${oldAbs}`;
    const tab = tabs().find((t) => t.id === oldId);
    if (tab) {
      setTabs((prev) => prev.map((t) => t.id === oldId
        ? { ...t, id: `project::${newAbs}`, path: newAbs, name: newName }
        : t
      ));
      if (activeTabId() === oldId) setActiveTabId(`project::${newAbs}`);
    }
    await refreshFiles();
  }

  function closeOtherTabs(keepId: string) {
    const toClose = tabs().filter((t) => t.id !== keepId);
    for (const t of toClose) closeTab(t.id);
  }

  function closeAllTabs() {
    setTabs([]);
    setActiveTabId(null);
    debouncedSave();
  }

  function copyPath(relOrAbsPath: string) {
    const base = projectPath();
    const absPath = relOrAbsPath.startsWith("project::") || relOrAbsPath.includes(":")
      ? relOrAbsPath
      : base ? `${base}/${relOrAbsPath}` : relOrAbsPath;
    navigator.clipboard.writeText(absPath).catch(() => {});
  }

  // ─── Keyboard shortcuts ───

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveActiveTab();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "w") {
      e.preventDefault();
      const id = activeTabId();
      if (id) closeTab(id);
    }
    // Ctrl+` reserved for future use
    if (e.key === "b" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const { toggleSidebar } = useViewStore();
      toggleSidebar();
    }
    if (e.key === "e" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleCodeDrawer();
    }
    if (e.key === "\\" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleContextPanel();
    }
    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.querySelector<HTMLTextAreaElement>(".cc-composer__textarea")?.focus();
    }
    if (e.key === "Escape") {
      // Dispatch custom event for AI interrupt (handled by AiChatContent)
      document.dispatchEvent(new CustomEvent("ide-escape"));
    }
  }

  // ─── Workspace management ───

  async function refreshWorkspace() {
    const ws = workspaceSettings.getWorkspace();
    const rootDirs = ws.rootDirs ?? [];
    const manualPaths = ws.manualProjects ?? [];

    let scanned: WorkspaceProject[] = [];
    if (rootDirs.length > 0) {
      try {
        scanned = await invoke<WorkspaceProject[]>("fs_scan_projects", { rootDirs });
      } catch (e) {
        console.error("fs_scan_projects error:", e);
      }
    }

    // Merge manual projects (add them if not already discovered)
    const scannedPaths = new Set(scanned.map((p) => p.path));
    for (const mp of manualPaths) {
      if (!scannedPaths.has(mp)) {
        scanned.push({ path: mp, name: fileNameFromPath(mp), markers: ["manual"] });
      }
    }

    scanned.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    setDiscoveredProjects(scanned);
  }

  function switchProject(path: string) {
    openProject(path);
  }

  function toggleFavorite(path: string) {
    const ws = workspaceSettings.getWorkspace();
    const favs = ws.favorites ?? [];
    const idx = favs.indexOf(path);
    if (idx >= 0) {
      workspaceSettings.patchWorkspace({ favorites: favs.filter((f) => f !== path) });
    } else {
      workspaceSettings.patchWorkspace({ favorites: [...favs, path] });
    }
  }

  function isFavorite(path: string): boolean {
    const ws = workspaceSettings.getWorkspace();
    return (ws.favorites ?? []).includes(path);
  }

  async function addManualProject(path: string) {
    const ws = workspaceSettings.getWorkspace();
    const manuals = ws.manualProjects ?? [];
    if (!manuals.includes(path)) {
      workspaceSettings.patchWorkspace({ manualProjects: [...manuals, path] });
    }
    await refreshWorkspace();
  }

  async function removeProject(path: string) {
    const ws = workspaceSettings.getWorkspace();
    workspaceSettings.patchWorkspace({
      manualProjects: (ws.manualProjects ?? []).filter((p) => p !== path),
      favorites: (ws.favorites ?? []).filter((p) => p !== path),
    });
    await refreshWorkspace();
  }

  function filteredProjects(): WorkspaceProject[] {
    const q = workspaceSearchQuery().toLowerCase().trim();
    if (!q) return discoveredProjects();
    return discoveredProjects().filter((p) =>
      p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)
    );
  }

  function favoriteProjects(): WorkspaceProject[] {
    const ws = workspaceSettings.getWorkspace();
    const favSet = new Set(ws.favorites ?? []);
    return discoveredProjects().filter((p) => favSet.has(p.path));
  }

  async function addRootDir(path: string) {
    const ws = workspaceSettings.getWorkspace();
    const dirs = ws.rootDirs ?? [];
    if (!dirs.includes(path)) {
      workspaceSettings.patchWorkspace({ rootDirs: [...dirs, path] });
    }
    await refreshWorkspace();
  }

  async function removeRootDir(path: string) {
    const ws = workspaceSettings.getWorkspace();
    workspaceSettings.patchWorkspace({
      rootDirs: (ws.rootDirs ?? []).filter((d) => d !== path),
    });
    await refreshWorkspace();
  }

  function getRootDirs(): string[] {
    return workspaceSettings.getWorkspace().rootDirs ?? [];
  }

  return {
    // Project
    projectPath,
    projectName,
    openProject,
    refreshFiles,

    // Tabs
    tabs,
    activeTabId,
    activeTab,
    openFile,
    openSnippet,
    closeTab,
    switchTab,
    updateTabContent,
    saveTab,
    saveActiveTab,

    // File tree
    fileTree,
    expandedFolders,
    toggleFolder,

    // File operations
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameFile,
    closeOtherTabs,
    closeAllTabs,
    copyPath,

    // State restore + watcher + vault
    restoreState,
    stopWatcher,
    readProjectContext,

    // Panels
    sidePanel,
    setSidePanel: (val: SidePanel | ((prev: SidePanel) => SidePanel)) => {
      if (typeof val === "function") setSidePanel(val);
      else setSidePanel(val);
      debouncedSave();
    },
    // Grid layout
    gridLayout,
    gridSlots,
    switchGridLayout,
    assignSlot,
    currentGrid,

    codeDrawerOpen,
    toggleCodeDrawer,
    codeDrawerWidth,
    persistCodeDrawerWidth,
    contextPanelOpen,
    toggleContextPanel,

    // Keyboard
    handleKeyDown,

    // Workspace
    discoveredProjects,
    workspaceSearchQuery: workspaceSearchQuery,
    setWorkspaceSearchQuery: setWorkspaceSearchQuery,
    refreshWorkspace,
    switchProject,
    toggleFavorite,
    isFavorite,
    addManualProject,
    removeProject,
    filteredProjects,
    favoriteProjects,
    addRootDir,
    removeRootDir,
    getRootDirs,
  };
}
