import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useSnippetStore, type Snippet } from "./snippetStore";

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

// ─── State ───

const [projectPath, setProjectPath] = createSignal<string | null>(null);
const [projectName, setProjectName] = createSignal<string>("Aucun projet");
const [projectFiles, setProjectFiles] = createSignal<FsEntry[]>([]);
const [tabs, setTabs] = createSignal<EditorTab[]>([]);
const [activeTabId, setActiveTabId] = createSignal<string | null>(null);
const [sidePanel, setSidePanel] = createSignal<SidePanel>("files");
const [showBottomPanel, setShowBottomPanel] = createSignal(false);
const [showSidePanel, setShowSidePanel] = createSignal(true);
const [aiPanelOpen, setAiPanelOpen] = createSignal(false);
const [aiPanelWidth, setAiPanelWidth] = createSignal(
  parseInt(localStorage.getItem("ide-ai-panel-width") ?? "380", 10)
);
const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set([""]));

function persistAiPanelWidth(w: number) {
  setAiPanelWidth(w);
  localStorage.setItem("ide-ai-panel-width", String(w));
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

  // ─── Project management ───

  async function openProject(path: string) {
    setProjectPath(path);
    setProjectName(fileNameFromPath(path));
    setExpandedFolders(new Set([""]));
    await refreshFiles();
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
  }

  function switchTab(id: string) {
    setActiveTabId(id);
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
    if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowBottomPanel((v) => !v);
    }
    if (e.key === "b" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowSidePanel((v) => !v);
    }
    if (e.key === "i" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setAiPanelOpen((v) => !v);
    }
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

    // Panels
    sidePanel,
    setSidePanel,
    showBottomPanel,
    setShowBottomPanel,
    showSidePanel,
    setShowSidePanel,
    aiPanelOpen,
    setAiPanelOpen,
    aiPanelWidth,
    persistAiPanelWidth,

    // Keyboard
    handleKeyDown,
  };
}
