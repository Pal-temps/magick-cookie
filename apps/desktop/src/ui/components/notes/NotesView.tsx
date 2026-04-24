import { onMount, onCleanup, Show, For, createSignal, createEffect, createMemo, untrack } from "solid-js";
import { useNotesStore, type NoteEntry, type TreeNode } from "../../../application/stores/notesStore";
import { useThemeStore } from "../../../application/stores/themeStore";
import { mountExcalidraw, type ExcalidrawHandle } from "../drawings/excalidrawMount";
import { MonacoEditor } from "../ide/MonacoEditor";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { requestConfirm } from "../common/ConfirmDialog";
import { useT } from "../../../i18n/context";
import { useViewStore } from "../../../application/stores/viewStore";
import { BookmarkView } from "../bookmarks/BookmarkView";
import { SnippetView } from "../snippets/SnippetView";
import "../../styles/notes.css";

export function NotesView() {
  const store = useNotesStore();
  const { theme } = useThemeStore();
  const { t } = useT();
  const viewStore = useViewStore();

  const { notesMainTab } = viewStore;

  const [showSettings, setShowSettings] = createSignal(false);
  const [settingsPath, setSettingsPath] = createSignal("");
  const [settingsRemote, setSettingsRemote] = createSignal("");
  const [isLoadingExcalidraw, setIsLoadingExcalidraw] = createSignal(false);

  // ─── Backlinks state ───
  const [backlinks, setBacklinks] = createSignal<NoteEntry[]>([]);

  const [editorContainer, setEditorContainer] = createSignal<HTMLDivElement | null>(null);
  let excalidrawHandle: ExcalidrawHandle | null = null;

  onMount(async () => {
    const cfg = await store.loadConfig();
    // SSH key check removed — keys are in KDBX vault
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

  // ─── Backlinks: scan all notes when active file changes ───
  createEffect(async () => {
    const currentFile = store.activeFile();
    if (!currentFile || store.activeFileType() !== "md") {
      setBacklinks([]);
      return;
    }
    // Derive the note name (without extension and path) for matching [[name]]
    const currentName = noteNameFromPath(currentFile);
    const allMdFiles = store.allFiles().filter((f) => f.type === "md" && f.path !== currentFile);
    const found: NoteEntry[] = [];
    const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
    for (const file of allMdFiles) {
      try {
        const content = await store.readNoteContent(file.path);
        let match: RegExpExecArray | null;
        wikiLinkPattern.lastIndex = 0;
        while ((match = wikiLinkPattern.exec(content)) !== null) {
          const linkName = match[1].trim().toLowerCase();
          if (linkName === currentName.toLowerCase()) {
            found.push(file);
            break;
          }
        }
      } catch { /* skip unreadable */ }
    }
    setBacklinks(found);
  });


  function handleWikiLinkNavigate(name: string) {
    const allMd = store.allFiles().filter((f) => f.type === "md");
    const target = allMd.find((f) => noteNameFromPath(f.path).toLowerCase() === name.toLowerCase());
    if (target) {
      store.openFile(target.path);
      // sidebar managed by AppLayout
    }
  }

  function handlePreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.hasAttribute("data-wiki-link")) {
      e.preventDefault();
      const name = target.getAttribute("data-wiki-link")!;
      handleWikiLinkNavigate(name);
    }
  }

  // ─── Settings ───
  async function handleSaveSettings() {
    const path = settingsPath().trim();
    if (!path) return;
    await store.saveConfig(path, settingsRemote().trim());
    setShowSettings(false);
    await store.fetchAll();
    await store.refreshGitStatus();
  }

  function openSettings() {
    const cfg = store.config();
    if (cfg) { setSettingsPath(cfg.path); setSettingsRemote(cfg.remote); }
    setShowSettings(true);
  }

  // ─── Editor (sidebar moved to NotesSidebarContent) ───
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

  // ─── Settings Panel ───
  function SettingsPanel() {
    return (
      <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100%", padding: "40px", "overflow-y": "auto" }}>
        <div style={{ "max-width": "560px", width: "100%", display: "flex", "flex-direction": "column", gap: "20px" }}>
          <h2 style={{ "font-size": "20px", "font-weight": "600", color: "var(--text-primary)" }}>{t("notes.config")}</h2>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <label style={{ "font-size": "12px", color: "var(--text-secondary)", "font-weight": "500" }}>{t("notes.folderPath")}</label>
            <input type="text" value={settingsPath()} onInput={(e) => setSettingsPath(e.currentTarget.value)} placeholder="C:\Users\...\Notes" style={inputStyle()} />
            <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>{t("notes.folderHint")}</span>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <label style={{ "font-size": "12px", color: "var(--text-secondary)", "font-weight": "500" }}>{t("notes.gitRemote")}</label>
            <input type="text" value={settingsRemote()} onInput={(e) => setSettingsRemote(e.currentTarget.value)} placeholder="git@gitlab.com:user/notes.git" style={inputStyle()} />
          </div>
          {/* SSH Key selection (from KDBX vault) */}
          <div style={{ display: "flex", "flex-direction": "column", gap: "10px", padding: "14px", background: "var(--bg-elevated)", "border-radius": "var(--radius-md)", border: "1px solid var(--border-color)" }}>
            <div>
              <div style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>{t("notes.sshKey")}</div>
              <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>{t("notes.sshKeyHint")}</div>
            </div>
            <select
              style={{ padding: "7px 10px", "font-size": "13px", background: "var(--bg-base)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-sm)", color: "var(--text-primary)", outline: "none" }}
              value={store.sshKeyName() ?? ""}
              onChange={(e) => store.selectSshKey(e.currentTarget.value || null)}
            >
              <option value="">{t("notes.noSsh")}</option>
              {/* The keys will be populated by the caller after loading from secrets_list_ssh_keys */}
            </select>
            <div style={{ "font-size": "11px", color: "var(--text-muted)" }}>
              {t("notes.sshKeyManage")}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button variant="primary" onClick={handleSaveSettings}>{t("passwords.save")}</Button>
            <Show when={store.config()}><Button variant="ghost" onClick={() => setShowSettings(false)}>{t("common.cancel")}</Button></Show>
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

  // ContextMenu, FolderNode, FileNode, etc. → moved to NotesSidebarContent

  /* eslint-disable @typescript-eslint/no-unused-vars */
  function _DEAD_ContextMenu() {
    const itemStyle = { display: "block", width: "100%", padding: "6px 14px", "text-align": "left" as const, "font-size": "12px", cursor: "pointer", color: "var(--text-primary)", "white-space": "nowrap" as const };
    const dangerStyle = { ...itemStyle, color: "var(--cal-red)" };

    return (
      <Show when={ctxMenu()}>
        {(menu) => (
          <div
            style={{ position: "fixed", left: `${menu().x}px`, top: `${menu().y}px`, background: "var(--bg-surface)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-md)", "box-shadow": "0 4px 16px rgba(0,0,0,0.3)", "z-index": "1000", padding: "4px 0", "min-width": "170px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startCreate("create-note", menu().folder)}>{t("notes.newNote")}</button>
            <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startCreate("create-schema", menu().folder)}>{t("notes.newSchema")}</button>
            <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startCreate("create-folder", menu().folder)}>{t("notes.newFolder")}</button>
            <Show when={menu().item}>
              {(item) => (<>
                <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
                <button style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut} onClick={() => startRename(item().path, item().name, menu().folder, item().type)}>{t("common.rename")}</button>
                <Show when={item().type === "file"}>
                  <button style={dangerStyle} onMouseEnter={hoverInDanger} onMouseLeave={hoverOut} onClick={() => handleDeleteFromMenu(item().path)}>{t("common.delete")}</button>
                </Show>
                <Show when={item().type === "folder"}>
                  <button style={dangerStyle} onMouseEnter={hoverInDanger} onMouseLeave={hoverOut} onClick={() => handleDeleteFolderFromMenu(item().path)}>{t("notes.deleteFolder")}</button>
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
    const label = action.mode === "create-folder" ? t("notes.folder") : action.mode === "create-schema" ? t("notes.schema") : action.mode === "create-note" ? t("notes.note") : "";
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
          placeholder={isRename ? t("notes.newName") : ""}
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
      <div style={{ display: "flex", "align-items": "center", gap: "4px", flex: "1", "min-width": "0", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={inlineName()}
          onInput={(e) => setInlineName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmInline(); if (e.key === "Escape") cancelInline(); }}
          style={{
            flex: "1", "min-width": "0",
            "font-size": "12px", "line-height": "1",
            padding: "0 4px",
            height: "18px",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            border: "1px solid var(--accent-primary)",
            "border-radius": "var(--radius-sm)",
            outline: "none",
          }}
          ref={(el) => setTimeout(() => { el.focus(); el.select(); }, 0)}
        />
        <button
          onClick={confirmInline}
          style={{ "font-size": "10px", padding: "1px 5px", "line-height": "1", "border-radius": "var(--radius-sm)", background: "var(--accent-primary)", color: "#fff", cursor: "pointer", "font-weight": "600", "flex-shrink": "0" }}
        >OK</button>
        <button onClick={cancelInline} style={{ "font-size": "12px", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", "line-height": "1", "flex-shrink": "0" }}>&times;</button>
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
          class="notes-folder-row"
          onClick={() => { if (!renaming()) store.toggleFolder(props.node.path); }}
          onContextMenu={(e) => showContextMenu(e, { folder: props.node.path, item: { type: "folder", path: props.node.path, name: props.node.name } })}
          style={{ "padding-left": `${6 + indent()}px` }}
        >
          <svg class={`notes-folder-chevron ${expanded() ? "notes-folder-chevron--open" : ""}`} width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="notes-folder-icon">{"\uD83D\uDCC1"}</span>
          <Show when={renaming()} fallback={
            <>
              <span class="notes-folder-name">{props.node.name}</span>
              <span class="notes-folder-count">{props.node.files.length + props.node.folders.length}</span>
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
        class={`notes-file-row ${isActive() && !renaming() ? "notes-file-row--active" : ""}`}
        onClick={() => { if (!renaming()) handleFileSelect(props.file.path); }}
        onContextMenu={(e) => showContextMenu(e, { folder: parentFolder(), item: { type: "file", path: props.file.path, name: props.file.name } })}
        style={{ "padding-left": `${6 + indent() + 16}px` }}
      >
        <span class={`notes-file-icon ${props.file.type === "excalidraw" ? "notes-file-icon--drawing" : ""}`}>
          {fileIcon(props.file.type)}
        </span>
        <Show when={renaming()} fallback={
          <>
            <span class="notes-file-name">{props.file.name}</span>
            <span class="notes-file-meta">{props.showPath ? props.file.path : formatSize(props.file.size)}</span>
          </>
        }>
          <InlineRenameInput />
        </Show>
      </div>
    );
  }

  // ─── Backlinks Component ───
  function BacklinksSection() {
    return (
      <div style={{
        "border-top": "1px solid var(--border-color)",
        padding: "12px 20px",
        "flex-shrink": "0",
        background: "var(--bg-elevated)",
      }}>
        <div style={{ "font-size": "11px", "font-weight": "600", color: "var(--text-secondary)", "margin-bottom": "8px", "text-transform": "uppercase", "letter-spacing": "0.5px" }}>
          Backlinks ({backlinks().length})
        </div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <For each={backlinks()}>
            {(note) => (
              <div
                onClick={() => { store.openFile(note.path); setSidebarOpen(false); }}
                style={{
                  "font-size": "12px",
                  color: "var(--accent-primary)",
                  cursor: "pointer",
                  padding: "3px 6px",
                  "border-radius": "var(--radius-sm)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {noteNameFromPath(note.path)}
                <span style={{ "font-size": "10px", color: "var(--text-muted)", "margin-left": "8px" }}>{note.path}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    );
  }

  // ─── Main View ───
  return (
    <Show when={!showSettings()} fallback={<SettingsPanel />}>
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>

      <div style={{ flex: "1", overflow: "hidden" }}>
      <Show when={notesMainTab() === "notes"}>
      <div class="notes-editor" onKeyDown={handleKeyDown}>
        {/* Toolbar */}
        <div class="notes-toolbar">
          <div class="notes-toolbar-left">
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
                {store.isPreview() ? t("notes.edit") : t("notes.preview")}
              </Button>
            </Show>
            <Show when={store.activeFile()}>
              <Button size="sm" variant="secondary" onClick={handleSaveFile} disabled={!store.isDirty()}>{t("notes.save")}</Button>
            </Show>
            <Button size="sm" variant="primary" onClick={() => store.gitSync()} disabled={store.isSyncing()}>{store.isSyncing() ? "Sync..." : "Sync"}</Button>
            <Show when={store.activeFile()}>
              <Button size="sm" variant="danger" onClick={async () => { if (await requestConfirm(`${t("common.delete")} "${store.activeFile()}" ?`)) store.deleteFile(store.activeFile()!); }}>{t("notes.delete")}</Button>
            </Show>
          </div>
        </div>

        {/* Editor area */}
        <div class="notes-editor-content">
          <Show when={store.activeFile()} fallback={
            <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center", color: "var(--text-muted)", "font-size": "14px" }}>{t("notes.selectOrCreate")}</div>
          }>
            <Show when={store.activeFileType() === "md"}>
              <Show when={store.isPreview()} fallback={
                <div style={{ flex: "1", display: "flex", "flex-direction": "column", position: "relative", overflow: "hidden" }}>
                  <MonacoEditor
                    value={store.noteContent()}
                    language="markdown"
                    path={store.activeFile() ?? undefined}
                    onChange={(val) => store.updateContent(val)}
                    style={{ flex: "1", "min-height": "0" }}
                  />
                  {/* Backlinks section in edit mode */}
                  <Show when={backlinks().length > 0}>
                    <BacklinksSection />
                  </Show>
                </div>
              }>
                <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
                  <div class="notes-preview" innerHTML={renderMarkdown(store.noteContent(), store.allFiles())} onClick={handlePreviewClick} style={{ flex: "1", "overflow-y": "auto" }} />
                  {/* Backlinks section in preview mode */}
                  <Show when={backlinks().length > 0}>
                    <BacklinksSection />
                  </Show>
                </div>
              </Show>
            </Show>
            <Show when={store.activeFileType() === "excalidraw"}>
              <div style={{ flex: "1", position: "relative", overflow: "hidden" }}>
                <Show when={isLoadingExcalidraw()}>
                  <div style={{ position: "absolute", inset: "0", display: "flex", "align-items": "center", "justify-content": "center", background: "var(--bg-base)", "z-index": "10" }}>
                    <CookieLoader message={t("notes.loadingExcalidraw")} />
                  </div>
                </Show>
                <div ref={setEditorContainer} style={{ width: "100%", height: "100%" }} />
              </div>
            </Show>
          </Show>
        </div>
      </div>

    </Show>
    <Show when={notesMainTab() === "bookmarks"}>
      <BookmarkView />
    </Show>
    <Show when={notesMainTab() === "snippets"}>
      <SnippetView />
    </Show>
    </div>
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

function renderMarkdown(text: string, allFiles?: NoteEntry[]): string {
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg-elevated);padding:12px;border-radius:var(--radius-md);overflow-x:auto;font-size:12px"><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-elevated);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:16px 0 8px">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:600;margin:16px 0 8px">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:700;margin:16px 0 8px">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Wiki-links: [[note name]] → clickable link (must run before standard markdown links)
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_match, name: string) => {
    const trimmed = name.trim();
    const exists = allFiles ? allFiles.some((f) => f.type === "md" && noteNameFromPath(f.path).toLowerCase() === trimmed.toLowerCase()) : true;
    if (exists) {
      return `<span data-wiki-link="${escapeHtml(trimmed)}" style="color:var(--accent-primary);cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px">${escapeHtml(trimmed)}</span>`;
    }
    return `<span data-wiki-link="${escapeHtml(trimmed)}" style="color:var(--cal-red);cursor:pointer;opacity:0.7;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px" title="Note introuvable">${escapeHtml(trimmed)}</span>`;
  });
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

/** Extract note display name from path: "folder/My Note.md" → "My Note" */
function noteNameFromPath(path: string): string {
  const filename = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  // Remove .md extension
  return filename.endsWith(".md") ? filename.slice(0, -3) : filename;
}
