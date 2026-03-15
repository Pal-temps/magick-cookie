import { onMount, onCleanup, Show, For, createSignal, createEffect, createMemo, untrack } from "solid-js";
import { useNotesStore, type NoteEntry, type TreeNode } from "../../../application/stores/notesStore";
import { useThemeStore } from "../../../application/stores/themeStore";
import { mountExcalidraw, type ExcalidrawHandle } from "../drawings/excalidrawMount";
import { Button } from "../common/Button";
import { ConfirmDialog, requestConfirm } from "../common/ConfirmDialog";
import "../../styles/notes.css";

interface ContextMenuState {
  x: number;
  y: number;
  folder: string;
  item?: { type: "file" | "folder"; path: string; name: string };
}

export function NotesView() {
  const store = useNotesStore();
  const { theme } = useThemeStore();
  const [showSettings, setShowSettings] = createSignal(false);
  const [settingsPath, setSettingsPath] = createSignal("");
  const [settingsRemote, setSettingsRemote] = createSignal("");
  const [generatedPubkey, setGeneratedPubkey] = createSignal<string | null>(null);
  const [sshError, setSshError] = createSignal<string | null>(null);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [isLoadingExcalidraw, setIsLoadingExcalidraw] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  const [ctxMenu, setCtxMenu] = createSignal<ContextMenuState | null>(null);

  const [inlineAction, setInlineAction] = createSignal<{
    mode: "create-note" | "create-schema" | "create-folder" | "rename";
    folder: string;
    oldPath?: string;
    oldName?: string;
    itemType?: "file" | "folder";
  } | null>(null);
  const [inlineName, setInlineName] = createSignal("");

  const tree = createMemo((): TreeNode => store.buildTree());

  const [editorContainer, setEditorContainer] = createSignal<HTMLDivElement | null>(null);
  let excalidrawHandle: ExcalidrawHandle | null = null;

  onMount(async () => {
    const cfg = await store.loadConfig();
    await store.checkSshKey();
    if (cfg) {
      await store.fetchAll();
      await store.refreshGitStatus();
    } else {
      setShowSettings(true);
    }
  });

  onCleanup(() => {
    if (excalidrawHandle) {
      excalidrawHandle.destroy();
      excalidrawHandle = null;
    }
  });

  function handleGlobalClick() {
    setCtxMenu(null);
  }

  createEffect(() => {
    const file = store.activeFile();
    const type = store.activeFileType();
    const container = editorContainer();

    if (type !== "excalidraw" || !file) {
      if (excalidrawHandle) { excalidrawHandle.destroy(); excalidrawHandle = null; }
      return;
    }
    if (!container) return;
    if (excalidrawHandle) { excalidrawHandle.destroy(); excalidrawHandle = null; }

    const content = untrack(() => store.noteContent());
    const excalidrawTheme = theme() === "light" ? "light" as const : "dark" as const;
    setIsLoadingExcalidraw(true);
    mountExcalidraw(container, content, (c) => store.updateContent(c), excalidrawTheme)
      .then((h) => { excalidrawHandle = h; setIsLoadingExcalidraw(false); })
      .catch(() => setIsLoadingExcalidraw(false));
  });

  // ─── Settings ───
  async function handleSaveSettings() {
    const path = settingsPath().trim();
    if (!path) return;
    await store.saveConfig(path, settingsRemote().trim());
    setShowSettings(false);
    await store.fetchAll();
    await store.refreshGitStatus();
  }

  async function handleGenerateSshKey() {
    setIsGenerating(true);
    setSshError(null);
    try { setGeneratedPubkey(await store.generateSshKey()); }
    catch (e: any) { setSshError(e?.message || String(e)); }
    finally { setIsGenerating(false); }
  }

  async function handleCopyPubkey() {
    const key = generatedPubkey();
    if (!key) return;
    try { await navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch {}
  }

  function openSettings() {
    const cfg = store.config();
    if (cfg) { setSettingsPath(cfg.path); setSettingsRemote(cfg.remote); }
    setGeneratedPubkey(null); setSshError(null); store.checkSshKey(); setShowSettings(true);
  }

  // ─── Context menu ───
  function showContextMenu(e: MouseEvent, data: Omit<ContextMenuState, "x" | "y">) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, ...data });
  }

  function startCreate(mode: "create-note" | "create-schema" | "create-folder", folder: string) {
    setCtxMenu(null);
    store.expandFolder(folder);
    setInlineAction({ mode, folder });
    setInlineName("");
  }

  function startRename(path: string, name: string, folder: string, itemType: "file" | "folder") {
    setCtxMenu(null);
    setInlineAction({ mode: "rename", folder, oldPath: path, oldName: name, itemType });
    setInlineName(name);
  }

  async function confirmInline() {
    const action = inlineAction();
    const name = inlineName().trim();
    if (!action || !name) return;

    if (action.mode === "create-folder") {
      await store.createFolder(name, action.folder);
    } else if (action.mode === "create-schema") {
      await store.createDrawing(name, action.folder);
    } else if (action.mode === "create-note") {
      await store.createNote(name, action.folder);
    } else if (action.mode === "rename" && action.oldPath) {
      const dir = action.oldPath.includes("/") ? action.oldPath.slice(0, action.oldPath.lastIndexOf("/") + 1) : "";
      let newName = name;
      if (action.itemType === "file") {
        // Preserve file extension if not provided
        const dotIdx = action.oldPath.lastIndexOf(".");
        if (dotIdx > action.oldPath.lastIndexOf("/") && !name.includes(".")) {
          newName = name + action.oldPath.slice(dotIdx);
        }
      }
      const newPath = dir + newName;
      if (newPath !== action.oldPath) await store.renameFile(action.oldPath, newPath);
    }

    setInlineAction(null);
    setInlineName("");
  }

  function cancelInline() {
    setInlineAction(null);
    setInlineName("");
  }

  async function handleDeleteFromMenu(path: string) {
    setCtxMenu(null);
    if (await requestConfirm(`Supprimer "${path}" ?`)) await store.deleteFile(path);
  }

  async function handleDeleteFolderFromMenu(path: string) {
    setCtxMenu(null);
    if (await requestConfirm(`Supprimer le dossier "${path}" et tout son contenu ?`)) await store.deleteFolder(path);
  }

  // ─── Editor ───
  function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      if (store.activeFileType() === "excalidraw" && excalidrawHandle) store.updateContent(excalidrawHandle.getContent());
      store.saveCurrentFile();
    }
  }

  async function handleSaveFile() {
    if (store.activeFileType() === "excalidraw" && excalidrawHandle) store.updateContent(excalidrawHandle.getContent());
    await store.saveCurrentFile();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    return `${(bytes / 1024).toFixed(1)} Ko`;
  }

  function fileIcon(type: "md" | "excalidraw"): string {
    return type === "excalidraw" ? "\u270F" : "\u2630";
  }

  function handleEditorDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes("application/x-magick-cookie")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
  }

  function handleEditorDrop(e: DragEvent) {
    const raw = e.dataTransfer?.getData("application/x-magick-cookie");
    if (!raw) return;
    e.preventDefault();
    try {
      const data = JSON.parse(raw) as { type: string; markdown: string };
      const textarea = e.currentTarget as HTMLTextAreaElement;
      const pos = textarea.selectionStart ?? store.noteContent().length;
      const content = store.noteContent();
      const before = content.slice(0, pos);
      const after = content.slice(pos);
      const insert = (before.length > 0 && !before.endsWith("\n") ? "\n" : "") + data.markdown + "\n";
      store.updateContent(before + insert + after);
      requestAnimationFrame(() => { textarea.selectionStart = textarea.selectionEnd = before.length + insert.length; textarea.focus(); });
    } catch {}
  }

  // Close sidebar when selecting a file in compact mode
  function handleFileSelect(path: string) {
    store.openFile(path);
    setSidebarOpen(false);
  }

  // ─── Settings Panel ───
  function SettingsPanel() {
    return (
      <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100%", padding: "40px", "overflow-y": "auto" }}>
        <div style={{ "max-width": "560px", width: "100%", display: "flex", "flex-direction": "column", gap: "20px" }}>
          <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>Configuration des notes</h2>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <label style={{ "font-size": "12px", color: "var(--text-secondary)", "font-weight": "500" }}>Chemin du dossier</label>
            <input type="text" value={settingsPath()} onInput={(e) => setSettingsPath(e.currentTarget.value)} placeholder="C:\Users\...\Notes" style={inputStyle()} />
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>Dossier partage pour les notes (.md) et les schemas (.excalidraw). Compatible Obsidian.</span>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <label style={{ "font-size": "12px", color: "var(--text-secondary)", "font-weight": "500" }}>Remote Git (optionnel)</label>
            <input type="text" value={settingsRemote()} onInput={(e) => setSettingsRemote(e.currentTarget.value)} placeholder="git@gitlab.com:user/notes.git" style={inputStyle()} />
          </div>
          {/* SSH */}
          <div style={{ display: "flex", "flex-direction": "column", gap: "10px", padding: "14px", background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
              <div>
                <div style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>Cle SSH dediee</div>
                <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>Genere une cle SSH utilisee uniquement par Magick Cookie.</div>
              </div>
              <Show when={store.sshKeyExists()}>
                <span style={{ "font-size": "10px", padding: "2px 8px", "border-radius": "var(--radius-sm)", background: "var(--cal-green)", color: "#fff" }}>Cle configuree</span>
              </Show>
            </div>
            <Show when={!store.sshKeyExists() && !generatedPubkey()}>
              <Button size="sm" variant="primary" onClick={handleGenerateSshKey} disabled={isGenerating()}>{isGenerating() ? "Generation..." : "Generer une cle SSH"}</Button>
            </Show>
            <Show when={sshError()}><div style={{ "font-size": "12px", color: "var(--cal-red)", padding: "6px 10px", background: "rgba(239,68,68,0.1)", "border-radius": "var(--radius-sm)" }}>{sshError()}</div></Show>
            <Show when={generatedPubkey()}>
              <div style={{ display: "flex", "flex-direction": "column", gap: "8px", padding: "12px", background: "var(--bg-base)", "border-radius": "var(--radius-sm)", border: "1px solid var(--cal-orange)" }}>
                <div style={{ "font-size": "12px", "font-weight": "600", color: "var(--cal-orange)" }}>IMPORTANT : Copiez cette cle publique maintenant</div>
                <textarea readOnly value={generatedPubkey()!} onClick={(e) => e.currentTarget.select()} style={{ width: "100%", padding: "8px", "font-family": "monospace", "font-size": "11px", background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)", resize: "none", height: "60px", outline: "none" }} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button size="sm" variant="primary" onClick={handleCopyPubkey}>{copied() ? "Copie !" : "Copier"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setGeneratedPubkey(null)}>J'ai copie, fermer</Button>
                </div>
              </div>
            </Show>
            <Show when={store.sshKeyExists() && !generatedPubkey()}>
              <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>Cle deja configuree. Les operations Git l'utiliseront automatiquement.</div>
            </Show>
          </div>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button variant="primary" onClick={handleSaveSettings}>Enregistrer</Button>
            <Show when={store.config()}><Button variant="ghost" onClick={() => setShowSettings(false)}>Annuler</Button></Show>
            <Show when={import.meta.env.DEV}>
              <Button variant="ghost" size="sm" onClick={async () => {
                const tmpPath = `${await import("@tauri-apps/api/path").then((m) => m.tempDir())}magick-cookie-dev-notes`;
                await store.saveConfig(tmpPath, ""); setShowSettings(false); await store.fetchAll();
              }} style={{ "margin-left": "auto", "font-size": "11px", color: "var(--cal-orange)" }}>Skip (dev)</Button>
            </Show>
          </div>
        </div>
      </div>
    );
  }

  // ─── Context Menu ───
  function ContextMenu() {
    const itemStyle = { display: "block", width: "100%", padding: "6px 14px", "text-align": "left" as const, "font-size": "12px", cursor: "pointer", color: "var(--text-primary)", "white-space": "nowrap" as const };
    const dangerStyle = { ...itemStyle, color: "var(--cal-red)" };

    return (
      <Show when={ctxMenu()}>
        {(menu) => (
          <div
            style={{ position: "fixed", left: `${menu().x}px`, top: `${menu().y}px`, background: "var(--bg-surface)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-md)", "box-shadow": "0 4px 16px rgba(0,0,0,0.3)", "z-index": "1000", padding: "4px 0", "min-width": "170px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startCreate("create-note", menu().folder)}>Nouvelle note</button>
            <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startCreate("create-schema", menu().folder)}>Nouveau schema</button>
            <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startCreate("create-folder", menu().folder)}>Nouveau dossier</button>
            <Show when={menu().item}>
              {(item) => (<>
                <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
                <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startRename(item().path, item().name, menu().folder, item().type)}>Renommer</button>
                <Show when={item().type === "file"}>
                  <button style={dangerStyle} onMouseEnter={hoverInDanger} onMouseLeave={hoverOut} onClick={() => handleDeleteFromMenu(item().path)}>Supprimer</button>
                </Show>
                <Show when={item().type === "folder"}>
                  <button style={dangerStyle} onMouseEnter={hoverInDanger} onMouseLeave={hoverOut} onClick={() => handleDeleteFolderFromMenu(item().path)}>Supprimer le dossier</button>
                </Show>
              </>)}
            </Show>
          </div>
        )}
      </Show>
    );
  }

  // ─── Inline Input ───
  function InlineInputRow(props: { folder: string }) {
    const action = inlineAction();
    if (!action || action.folder !== props.folder) return null;
    const isRename = action.mode === "rename";
    const label = action.mode === "create-folder" ? "Dossier" : action.mode === "create-schema" ? "Schema" : action.mode === "create-note" ? "Note" : "";
    return (
      <div
        style={{ padding: "3px 0 3px 4px", display: "flex", "align-items": "center", gap: "4px", overflow: "hidden", "min-width": "0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Show when={!isRename}>
          <span style={{ "font-size": "10px", color: "var(--text-muted)", "font-weight": "600", "flex-shrink": "0" }}>{label}</span>
        </Show>
        <input
          type="text"
          value={inlineName()}
          onInput={(e) => setInlineName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmInline(); if (e.key === "Escape") cancelInline(); }}
          placeholder={isRename ? "Nouveau nom" : ""}
          style={{ ...inputStyle(), flex: "1", "font-size": "11px", padding: "3px 6px", "min-width": "0" }}
          ref={(el) => setTimeout(() => el.focus(), 0)}
        />
        <button
          onClick={confirmInline}
          style={{ "font-size": "11px", padding: "2px 8px", "border-radius": "var(--radius-sm)", background: "var(--accent-primary)", color: "#fff", cursor: "pointer", "font-weight": "600", "white-space": "nowrap", "flex-shrink": "0" }}
        >OK</button>
        <button onClick={cancelInline} style={{ "font-size": "14px", color: "var(--text-muted)", cursor: "pointer", padding: "0 4px", "line-height": "1", "flex-shrink": "0" }}>&times;</button>
      </div>
    );
  }

  // ─── Inline rename input (replaces name in-place) ───
  function InlineRenameInput() {
    return (
      <div style={{ display: "flex", "align-items": "center", gap: "2px", flex: "1", "min-width": "0", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={inlineName()}
          onInput={(e) => setInlineName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmInline(); if (e.key === "Escape") cancelInline(); }}
          style={{ ...inputStyle(), flex: "1", "font-size": "11px", padding: "2px 6px", "min-width": "0" }}
          ref={(el) => setTimeout(() => { el.focus(); el.select(); }, 0)}
        />
        <button
          onClick={confirmInline}
          style={{ "font-size": "10px", padding: "2px 6px", "border-radius": "var(--radius-sm)", background: "var(--accent-primary)", color: "#fff", cursor: "pointer", "font-weight": "600", "flex-shrink": "0" }}
        >OK</button>
        <button onClick={cancelInline} style={{ "font-size": "13px", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", "line-height": "1", "flex-shrink": "0" }}>&times;</button>
      </div>
    );
  }

  function isRenamingItem(path: string) {
    const a = inlineAction();
    return a && a.mode === "rename" && a.oldPath === path;
  }

  // ─── Tree Folder Node ───
  function FolderNode(props: { node: TreeNode; depth: number }) {
    const expanded = () => store.isFolderExpanded(props.node.path);
    const indent = () => props.depth * 16;
    const hasCreateInline = () => {
      const a = inlineAction();
      return a && a.mode !== "rename" && a.folder === props.node.path;
    };
    const renaming = () => isRenamingItem(props.node.path);

    return (
      <div>
        <div
          data-ctx-item
          onClick={() => { if (!renaming()) store.toggleFolder(props.node.path); }}
          onContextMenu={(e) => showContextMenu(e, { folder: props.node.path, item: { type: "folder", path: props.node.path, name: props.node.name } })}
          style={{
            display: "flex", "align-items": "center", gap: "4px", width: "100%",
            padding: `4px 6px 4px ${6 + indent()}px`, "text-align": "left", cursor: "pointer",
            color: "var(--text-primary)", transition: "background 0.1s", overflow: "hidden",
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
        >
          <span style={{
            "font-size": "11px", color: "var(--text-secondary)", width: "14px", "text-align": "center", "flex-shrink": "0",
            display: "inline-flex", "align-items": "center", "justify-content": "center",
            transform: expanded() ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}>
            {"\u25B6"}
          </span>
          <span style={{ "font-size": "12px", "flex-shrink": "0" }}>{"\uD83D\uDCC1"}</span>
          <Show when={renaming()} fallback={
            <>
              <span style={{ "font-size": "12px", "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {props.node.name}
              </span>
              <span style={{ "font-size": "10px", color: "var(--text-muted)", "margin-left": "auto", "flex-shrink": "0" }}>
                {props.node.files.length + props.node.folders.length}
              </span>
            </>
          }>
            <InlineRenameInput />
          </Show>
        </div>

        <Show when={expanded()}>
          <Show when={hasCreateInline()}>
            <div style={{ "padding-left": `${6 + indent() + 16}px` }}>
              <InlineInputRow folder={props.node.path} />
            </div>
          </Show>

          <For each={props.node.folders}>
            {(child) => <FolderNode node={child} depth={props.depth + 1} />}
          </For>

          <For each={props.node.files}>
            {(file) => <FileNode file={file} depth={props.depth + 1} />}
          </For>
        </Show>
      </div>
    );
  }

  // ─── Tree File Node ───
  function FileNode(props: { file: NoteEntry; depth: number; showPath?: boolean }) {
    const indent = () => props.depth * 16;
    const isActive = () => store.activeFile() === props.file.path;
    const renaming = () => isRenamingItem(props.file.path);
    const parentFolder = () => {
      const idx = props.file.path.lastIndexOf("/");
      return idx > 0 ? props.file.path.slice(0, idx) : "";
    };

    return (
      <div
        data-ctx-item
        onClick={() => { if (!renaming()) handleFileSelect(props.file.path); }}
        onContextMenu={(e) => showContextMenu(e, { folder: parentFolder(), item: { type: "file", path: props.file.path, name: props.file.name } })}
        style={{
          display: "flex", "align-items": "center", gap: "4px", width: "100%",
          padding: `4px 6px 4px ${6 + indent() + 16}px`, "text-align": "left", cursor: "pointer",
          background: isActive() && !renaming() ? "var(--accent-primary)" : "transparent",
          color: "var(--text-primary)", transition: "background 0.1s", overflow: "hidden",
        }}
        onMouseEnter={(e) => { if (!isActive() || renaming()) (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
        onMouseLeave={(e) => { if (!isActive() || renaming()) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <span style={{ "font-size": "11px", color: props.file.type === "excalidraw" ? "var(--cal-purple)" : "var(--text-muted)", "flex-shrink": "0" }}>
          {fileIcon(props.file.type)}
        </span>
        <Show when={renaming()} fallback={
          <>
            <span style={{ "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", flex: "1" }}>
              {props.file.name}
            </span>
            <span style={{ "font-size": "10px", color: "var(--text-muted)", "flex-shrink": "0" }}>
              {props.showPath ? props.file.path : formatSize(props.file.size)}
            </span>
          </>
        }>
          <InlineRenameInput />
        </Show>
      </div>
    );
  }

  // ─── Main View ───
  return (
    <Show when={!showSettings()} fallback={<SettingsPanel />}>
    <div class="notes-container" onKeyDown={handleKeyDown} onClick={handleGlobalClick}>
      {/* Sidebar */}
      <div class={`notes-sidebar ${sidebarOpen() ? "notes-sidebar--open" : ""}`}>
        <div class="notes-sidebar-search">
          <input
            type="text" placeholder="Rechercher..."
            value={store.searchQuery()} onInput={(e) => store.setSearchQuery(e.currentTarget.value)}
            style={{ ...inputStyle(), flex: "1" }}
          />
          <Button size="sm" variant="ghost" onClick={openSettings} style={{ "font-size": "18px", "min-width": "32px", "min-height": "32px", display: "inline-flex", "align-items": "center", "justify-content": "center", padding: "0" }}>&#9881;</Button>
        </div>

        <div
          class="notes-sidebar-tree"
          onContextMenu={(e) => {
            if (!(e.target as HTMLElement).closest("[data-ctx-item]")) {
              showContextMenu(e, { folder: "" });
            }
          }}
        >
          <Show when={store.searchQuery()}>
            <For each={store.filteredFiles()}>
              {(file) => <FileNode file={file} depth={0} showPath />}
            </For>
            <Show when={store.filteredFiles().length === 0}>
              <div style={{ padding: "20px", "text-align": "center", "font-size": "12px", color: "var(--text-muted)" }}>Aucun resultat</div>
            </Show>
          </Show>

          <Show when={!store.searchQuery()}>
            <Show when={inlineAction()?.folder === ""}>
              <div style={{ "padding-left": "6px" }}>
                <InlineInputRow folder="" />
              </div>
            </Show>

            <For each={tree().folders}>
              {(folder) => <FolderNode node={folder} depth={0} />}
            </For>

            <For each={tree().files}>
              {(file) => <FileNode file={file} depth={0} />}
            </For>

            <Show when={tree().folders.length === 0 && tree().files.length === 0 && !inlineAction()}>
              <div style={{ padding: "20px", "text-align": "center", "font-size": "12px", color: "var(--text-muted)" }}>
                Clic droit pour creer
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Editor */}
      <div class="notes-editor">
        {/* Toolbar */}
        <div class="notes-toolbar">
          <div class="notes-toolbar-left">
            <button
              class="notes-toggle-sidebar"
              onClick={() => setSidebarOpen(!sidebarOpen())}
              title="Fichiers"
            >
              {sidebarOpen() ? "\u2715" : "\u2630"}
            </button>
            <Show when={store.activeFile()}>
              <span class="notes-toolbar-filename" style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-primary)" }}>{store.activeFile()}</span>
              <Show when={store.isDirty()}><span style={{ "font-size": "11px", color: "var(--cal-orange)", "font-weight": "600" }}>*</span></Show>
            </Show>
          </div>
          <div class="notes-toolbar-right">
            <Show when={store.gitStatus()}>
              <span style={{ "font-size": "10px", padding: "2px 8px", "border-radius": "var(--radius-sm)", background: store.gitStatus()!.has_changes ? "var(--cal-orange)" : "var(--cal-green)", color: "#fff" }}>
                {store.gitStatus()!.summary}
              </span>
            </Show>
            <Show when={store.activeFile() && store.activeFileType() === "md"}>
              <Button size="sm" variant={store.isPreview() ? "primary" : "secondary"} onClick={() => store.setIsPreview(!store.isPreview())}>
                {store.isPreview() ? "Editer" : "Apercu"}
              </Button>
            </Show>
            <Show when={store.activeFile()}>
              <Button size="sm" variant="secondary" onClick={handleSaveFile} disabled={!store.isDirty()}>Sauver</Button>
            </Show>
            <Button size="sm" variant="primary" onClick={() => store.gitSync()} disabled={store.isSyncing()}>{store.isSyncing() ? "Sync..." : "Sync"}</Button>
            <Show when={store.activeFile()}>
              <Button size="sm" variant="danger" onClick={async () => { if (await requestConfirm(`Supprimer "${store.activeFile()}" ?`)) store.deleteFile(store.activeFile()!); }}>Suppr.</Button>
            </Show>
          </div>
        </div>

        {/* Editor area */}
        <div class="notes-editor-content">
          <Show when={store.activeFile()} fallback={
            <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--text-muted)", "font-size": "14px" }}>Selectionnez ou creez un fichier</div>
          }>
            <Show when={store.activeFileType() === "md"}>
              <Show when={store.isPreview()} fallback={
                <textarea
                  class="notes-textarea"
                  value={store.noteContent()} onInput={(e) => store.updateContent(e.currentTarget.value)}
                  onDragOver={handleEditorDragOver} onDrop={handleEditorDrop}
                  spellcheck={false}
                />
              }>
                <div class="notes-preview" innerHTML={renderMarkdown(store.noteContent())} />
              </Show>
            </Show>
            <Show when={store.activeFileType() === "excalidraw"}>
              <div style={{ flex: "1", position: "relative", overflow: "hidden" }}>
                <Show when={isLoadingExcalidraw()}>
                  <div style={{ position: "absolute", inset: "0", display: "flex", "align-items": "center", "justify-content": "center", background: "var(--bg-base)", "z-index": "10", color: "var(--text-muted)", "font-size": "14px" }}>Chargement d'Excalidraw...</div>
                </Show>
                <div ref={setEditorContainer} style={{ width: "100%", height: "100%" }} />
              </div>
            </Show>
          </Show>
        </div>
      </div>

      <ContextMenu />
      <ConfirmDialog />
    </div>
    </Show>
  );
}

// ─── Helpers ───

function hoverIn(e: MouseEvent) { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }
function hoverInDanger(e: MouseEvent) { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; }
function hoverOut(e: MouseEvent) { (e.currentTarget as HTMLElement).style.background = "transparent"; }

function inputStyle(): Record<string, string> {
  return { padding: "6px 10px", "border-radius": "var(--radius-md)", border: "1px solid var(--border-color)", background: "var(--bg-base)", color: "var(--text-primary)", "font-size": "13px", outline: "none" };
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg-elevated);padding:12px;border-radius:var(--radius-md);overflow-x:auto;font-size:12px"><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-elevated);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:600;margin:16px 0 8px">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:700;margin:16px 0 8px">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent-primary)">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:20px">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:20px;list-style-type:decimal">$2</li>');
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-color);margin:16px 0">');
  html = html.replace(/\[x\]/g, '<input type="checkbox" checked disabled style="margin-right:6px">');
  html = html.replace(/\[ \]/g, '<input type="checkbox" disabled style="margin-right:6px">');
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  html = html.replace(/\n/g, "<br>");
  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
