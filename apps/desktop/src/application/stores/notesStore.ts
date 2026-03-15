import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";

export interface NoteEntry {
  name: string;
  path: string;
  modified: number;
  size: number;
  type: "md" | "excalidraw";
}

export interface NotesConfig {
  path: string;
  remote: string;
}

export interface GitStatus {
  has_changes: boolean;
  summary: string;
}

export interface SshKeyInfo {
  exists: boolean;
  pubkey: string | null;
}

export interface TreeNode {
  name: string;
  path: string; // relative folder path (e.g. "projets/web")
  folders: TreeNode[];
  files: NoteEntry[];
}

const [notes, setNotes] = createSignal<NoteEntry[]>([]);
const [drawings, setDrawings] = createSignal<NoteEntry[]>([]);
const [folderPaths, setFolderPaths] = createSignal<string[]>([]);
const [config, setConfig] = createSignal<NotesConfig | null>(null);
const [activeFile, setActiveFile] = createSignal<string | null>(null);
const [activeFileType, setActiveFileType] = createSignal<"md" | "excalidraw">("md");
const [noteContent, setNoteContent] = createSignal("");
const [isDirty, setIsDirty] = createSignal(false);
const [gitStatus, setGitStatus] = createSignal<GitStatus | null>(null);
const [isSyncing, setIsSyncing] = createSignal(false);
const [isPreview, setIsPreview] = createSignal(false);
const [searchQuery, setSearchQuery] = createSignal("");
const [sshKeyExists, setSshKeyExists] = createSignal(false);
const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set());

export function useNotesStore() {
  async function loadConfig() {
    const cfg = await invoke<NotesConfig | null>("notes_get_config");
    setConfig(cfg);
    return cfg;
  }

  async function saveConfig(path: string, remote: string) {
    await invoke("notes_set_config", { path, remote });
    await loadConfig();
    await fetchAll();
  }

  async function fetchNotes() {
    try {
      const list = await invoke<NoteEntry[]>("notes_list");
      setNotes(list.map((n) => ({ ...n, type: "md" as const })));
    } catch {
      setNotes([]);
    }
  }

  async function fetchDrawings() {
    try {
      const list = await invoke<NoteEntry[]>("notes_list_drawings");
      setDrawings(list.map((d) => ({ ...d, type: "excalidraw" as const })));
    } catch {
      setDrawings([]);
    }
  }

  async function fetchFolders() {
    try {
      const list = await invoke<string[]>("notes_list_folders");
      setFolderPaths(list);
    } catch {
      setFolderPaths([]);
    }
  }

  async function fetchAll() {
    await Promise.all([fetchNotes(), fetchDrawings(), fetchFolders()]);
  }

  function allFiles() {
    return [...notes(), ...drawings()].sort((a, b) => b.modified - a.modified);
  }

  // ─── Tree builder ───
  function ensureFolder(root: TreeNode, folderPath: string): TreeNode {
    const parts = folderPath.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      let child = node.folders.find((f) => f.name === name);
      if (!child) {
        child = { name, path, folders: [], files: [] };
        node.folders.push(child);
      }
      node = child;
    }
    return node;
  }

  function buildTree(): TreeNode {
    const root: TreeNode = { name: "Vault", path: "", folders: [], files: [] };

    // 1. Create all real folders from backend (including empty ones)
    for (const fp of folderPaths()) {
      ensureFolder(root, fp);
    }

    // 2. Place files into their parent folders
    for (const file of allFiles()) {
      const parts = file.path.split("/");
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join("/");
        const node = ensureFolder(root, parentPath);
        node.files.push(file);
      } else {
        root.files.push(file);
      }
    }

    // Sort folders alphabetically at each level
    function sortNode(n: TreeNode) {
      n.folders.sort((a, b) => a.name.localeCompare(b.name));
      n.folders.forEach(sortNode);
    }
    sortNode(root);

    return root;
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

  function expandFolder(path: string) {
    setExpandedFolders((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }

  function isFolderExpanded(path: string) {
    return expandedFolders().has(path);
  }

  // ─── File operations ───
  async function openFile(path: string) {
    if (isDirty() && activeFile()) {
      await saveCurrentFile();
    }
    const content = await invoke<string>("notes_read", { path });
    const type = path.endsWith(".excalidraw") ? "excalidraw" as const : "md" as const;
    setActiveFile(path);
    setActiveFileType(type);
    setNoteContent(content);
    setIsDirty(false);

    // Auto-expand parent folders
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      expandFolder(parts.slice(0, i).join("/"));
    }
  }

  function updateContent(content: string) {
    setNoteContent(content);
    setIsDirty(true);
  }

  async function saveCurrentFile() {
    const path = activeFile();
    if (!path) return;
    await invoke("notes_save", { path, content: noteContent() });
    setIsDirty(false);
  }

  async function createNote(name: string, folder: string) {
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const path = folder ? `${folder}/${fileName}` : fileName;
    await invoke("notes_save", { path, content: "" });
    if (folder) expandFolder(folder);
    await fetchAll();
    await openFile(path);
  }

  async function createDrawing(name: string, folder: string) {
    const fileName = name.endsWith(".excalidraw") ? name : `${name}.excalidraw`;
    const path = folder ? `${folder}/${fileName}` : fileName;
    const emptyData = JSON.stringify({ type: "excalidraw", version: 2, elements: [], appState: {}, files: {} });
    await invoke("notes_save", { path, content: emptyData });
    if (folder) expandFolder(folder);
    await fetchAll();
    await openFile(path);
  }

  async function createFolder(name: string, parentFolder: string) {
    const folderPath = parentFolder ? `${parentFolder}/${name}` : name;
    await invoke("notes_create_folder", { path: folderPath });
    // Create .gitkeep so git tracks it
    await invoke("notes_save", { path: `${folderPath}/.gitkeep`, content: "" });
    if (parentFolder) expandFolder(parentFolder);
    expandFolder(folderPath);
    await fetchAll();
  }

  async function renameFile(oldPath: string, newPath: string) {
    await invoke("notes_rename", { oldPath, newPath });
    if (activeFile() === oldPath) {
      setActiveFile(newPath);
      const type = newPath.endsWith(".excalidraw") ? "excalidraw" as const : "md" as const;
      setActiveFileType(type);
    }
    await fetchAll();
  }

  async function deleteFile(path: string) {
    await invoke("notes_delete", { path });
    if (activeFile() === path) {
      setActiveFile(null);
      setNoteContent("");
      setIsDirty(false);
    }
    await fetchAll();
  }

  async function deleteFolder(path: string) {
    await invoke("notes_delete_folder", { path });
    // If the active file was inside this folder, clear it
    if (activeFile()?.startsWith(path + "/")) {
      setActiveFile(null);
      setNoteContent("");
      setIsDirty(false);
    }
    // Remove from expanded folders
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const p of next) {
        if (p === path || p.startsWith(path + "/")) next.delete(p);
      }
      return next;
    });
    await fetchAll();
  }

  // ─── Git ───
  async function refreshGitStatus() {
    try {
      const status = await invoke<GitStatus>("notes_git_status");
      setGitStatus(status);
    } catch {
      setGitStatus(null);
    }
  }

  async function gitPull() {
    setIsSyncing(true);
    try {
      await invoke<string>("notes_git_pull");
      await fetchAll();
      if (activeFile()) {
        try {
          const content = await invoke<string>("notes_read", { path: activeFile() });
          setNoteContent(content);
          setIsDirty(false);
        } catch { /* file may have been deleted */ }
      }
      await refreshGitStatus();
    } finally {
      setIsSyncing(false);
    }
  }

  async function gitPush(message?: string) {
    if (isDirty()) await saveCurrentFile();
    setIsSyncing(true);
    try {
      await invoke<string>("notes_git_push", { message: message ?? "" });
      await refreshGitStatus();
    } finally {
      setIsSyncing(false);
    }
  }

  async function gitSync() {
    if (isDirty()) await saveCurrentFile();
    setIsSyncing(true);
    try {
      // Pull remote changes first
      await invoke<string>("notes_git_pull");
      // Reload files after pull (may have new content)
      await fetchAll();
      if (activeFile()) {
        try {
          const content = await invoke<string>("notes_read", { path: activeFile() });
          setNoteContent(content);
          setIsDirty(false);
        } catch { /* file may have been deleted */ }
      }
      // Push local changes (add + commit + push)
      await invoke<string>("notes_git_push", { message: "" });
      await refreshGitStatus();
    } finally {
      setIsSyncing(false);
    }
  }

  // ─── SSH ───
  async function checkSshKey(): Promise<boolean> {
    try {
      const info = await invoke<SshKeyInfo>("notes_ssh_status");
      setSshKeyExists(info.exists);
      return info.exists;
    } catch {
      setSshKeyExists(false);
      return false;
    }
  }

  async function generateSshKey(): Promise<string> {
    const pubkey = await invoke<string>("notes_ssh_generate");
    setSshKeyExists(true);
    return pubkey;
  }

  // ─── Search ───
  function filteredFiles() {
    const q = searchQuery().toLowerCase();
    if (!q) return [];
    const all = allFiles();
    return all.filter((n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q));
  }

  return {
    notes, drawings, config, activeFile, activeFileType, noteContent, isDirty, gitStatus, isSyncing,
    isPreview, setIsPreview, searchQuery, setSearchQuery, sshKeyExists,
    expandedFolders, toggleFolder, expandFolder, isFolderExpanded, buildTree,
    loadConfig, saveConfig, fetchNotes, fetchDrawings, fetchAll, allFiles, openFile, updateContent,
    saveCurrentFile, createNote, createDrawing, createFolder, renameFile, deleteFile, deleteFolder,
    refreshGitStatus, gitPull, gitPush, gitSync, filteredFiles,
    checkSshKey, generateSshKey,
  };
}
