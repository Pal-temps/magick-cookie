import { Show, For, createSignal, createMemo } from "solid-js";
import { useNotesStore, type NoteEntry, type TreeNode } from "../../../application/stores/notesStore";
import { useBookmarkStore } from "../../../application/stores/bookmarkStore";
import { useSnippetStore } from "../../../application/stores/snippetStore";
import { useViewStore, type NotesMainTab } from "../../../application/stores/viewStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";
import { requestConfirm } from "../common/ConfirmDialog";
import { CollapsibleSection } from "../common/CollapsibleSection";
import "../../styles/notes.css";

interface ContextMenuState {
  x: number;
  y: number;
  folder: string;
  item?: { type: "file" | "folder"; path: string; name: string };
}

function hoverIn(e: MouseEvent) { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }
function hoverInDanger(e: MouseEvent) { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; }
function hoverOut(e: MouseEvent) { (e.currentTarget as HTMLElement).style.background = "transparent"; }

function inputStyle(): Record<string, string> {
  return { padding: "6px 10px", "border-radius": "var(--radius-md)", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-primary)", "font-size": "13px", outline: "none", "color-scheme": "dark" };
}

function fileIcon(type: "md" | "excalidraw"): string {
  return type === "excalidraw" ? "\u270F" : "\u2630";
}

export function NotesSidebarContent() {
  const store = useNotesStore();
  const bookmarkStore = useBookmarkStore();
  const snippetStore = useSnippetStore();
  const { notesMainTab, setNotesMainTab } = useViewStore();
  const { t } = useT();

  // ─── Notes tab state ───
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
    if (action.mode === "create-folder") await store.createFolder(name, action.folder);
    else if (action.mode === "create-schema") await store.createDrawing(name, action.folder);
    else if (action.mode === "create-note") await store.createNote(name, action.folder);
    else if (action.mode === "rename" && action.oldPath) {
      const dir = action.oldPath.includes("/") ? action.oldPath.slice(0, action.oldPath.lastIndexOf("/") + 1) : "";
      let newName = name;
      if (action.itemType === "file") {
        const dotIdx = action.oldPath.lastIndexOf(".");
        if (dotIdx > action.oldPath.lastIndexOf("/") && !name.includes(".")) newName = name + action.oldPath.slice(dotIdx);
      }
      const newPath = dir + newName;
      if (newPath !== action.oldPath) await store.renameFile(action.oldPath, newPath);
    }
    setInlineAction(null);
    setInlineName("");
  }

  function cancelInline() { setInlineAction(null); setInlineName(""); }

  async function handleDeleteFromMenu(path: string) {
    setCtxMenu(null);
    if (await requestConfirm(`Supprimer "${path}" ?`)) await store.deleteFile(path);
  }

  async function handleDeleteFolderFromMenu(path: string) {
    setCtxMenu(null);
    if (await requestConfirm(`Supprimer le dossier "${path}" et tout son contenu ?`)) await store.deleteFolder(path);
  }

  function isRenamingItem(path: string) {
    const a = inlineAction();
    return a && a.mode === "rename" && a.oldPath === path;
  }

  // ─── Inline Input ───
  function InlineInputRow(props: { folder: string }) {
    const action = inlineAction();
    if (!action || action.folder !== props.folder) return null;
    const isRename = action.mode === "rename";
    const label = action.mode === "create-folder" ? t("notes.folder") : action.mode === "create-schema" ? t("notes.schema") : action.mode === "create-note" ? t("notes.note") : "";
    return (
      <div style={{ padding: "3px 0 3px 4px", display: "flex", "align-items": "center", gap: "4px", overflow: "hidden", "min-width": "0" }} onClick={(e) => e.stopPropagation()}>
        <Show when={!isRename}><span style={{ "font-size": "10px", color: "var(--text-muted)", "font-weight": "600", "flex-shrink": "0" }}>{label}</span></Show>
        <input type="text" value={inlineName()} onInput={(e) => setInlineName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmInline(); if (e.key === "Escape") cancelInline(); }}
          placeholder={isRename ? t("notes.newName") : ""} style={{ ...inputStyle(), flex: "1", "font-size": "11px", padding: "3px 6px", "min-width": "0" }}
          ref={(el) => setTimeout(() => el.focus(), 0)} />
        <button onClick={confirmInline} style={{ "font-size": "11px", padding: "2px 8px", "border-radius": "var(--radius-sm)", background: "var(--accent-primary)", color: "#fff", cursor: "pointer", "font-weight": "600", "white-space": "nowrap", "flex-shrink": "0" }}>OK</button>
        <button onClick={cancelInline} style={{ "font-size": "14px", color: "var(--text-muted)", cursor: "pointer", padding: "0 4px", "line-height": "1", "flex-shrink": "0" }}>&times;</button>
      </div>
    );
  }

  function InlineRenameInput() {
    return (
      <div style={{ display: "flex", "align-items": "center", gap: "4px", flex: "1", "min-width": "0", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <input type="text" value={inlineName()} onInput={(e) => setInlineName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") confirmInline(); if (e.key === "Escape") cancelInline(); }}
          style={{ flex: "1", "min-width": "0", "font-size": "12px", "line-height": "1", padding: "0 4px", height: "18px", background: "var(--bg-base)", color: "var(--text-primary)", border: "1px solid var(--accent-primary)", "border-radius": "var(--radius-sm)", outline: "none" }}
          ref={(el) => setTimeout(() => { el.focus(); el.select(); }, 0)} />
        <button onClick={confirmInline} style={{ "font-size": "10px", padding: "1px 5px", "line-height": "1", "border-radius": "var(--radius-sm)", background: "var(--accent-primary)", color: "#fff", cursor: "pointer", "font-weight": "600", "flex-shrink": "0" }}>OK</button>
        <button onClick={cancelInline} style={{ "font-size": "12px", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", "line-height": "1", "flex-shrink": "0" }}>&times;</button>
      </div>
    );
  }

  // ─── Tree Nodes ───
  function FolderNode(props: { node: TreeNode; depth: number }) {
    const expanded = () => store.isFolderExpanded(props.node.path);
    const indent = () => props.depth * 16;
    const hasCreateInline = () => { const a = inlineAction(); return a && a.mode !== "rename" && a.folder === props.node.path; };
    const renaming = () => isRenamingItem(props.node.path);
    return (
      <div>
        <div data-ctx-item class="notes-folder-row"
          onClick={() => { if (!renaming()) store.toggleFolder(props.node.path); }}
          onContextMenu={(e) => showContextMenu(e, { folder: props.node.path, item: { type: "folder", path: props.node.path, name: props.node.name } })}
          style={{ "padding-left": `${6 + indent()}px` }}>
          <svg class={`notes-folder-chevron ${expanded() ? "notes-folder-chevron--open" : ""}`} width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="notes-folder-icon">{"\uD83D\uDCC1"}</span>
          <Show when={renaming()} fallback={<><span class="notes-folder-name">{props.node.name}</span><span class="notes-folder-count">{props.node.files.length + props.node.folders.length}</span></>}>
            <InlineRenameInput />
          </Show>
        </div>
        <Show when={expanded()}>
          <Show when={hasCreateInline()}><div style={{ "padding-left": `${6 + indent() + 16}px` }}><InlineInputRow folder={props.node.path} /></div></Show>
          <For each={props.node.folders}>{(child) => <FolderNode node={child} depth={props.depth + 1} />}</For>
          <For each={props.node.files}>{(file) => <FileNode file={file} depth={props.depth + 1} />}</For>
        </Show>
      </div>
    );
  }

  function FileNode(props: { file: NoteEntry; depth: number; showPath?: boolean }) {
    const indent = () => props.depth * 16;
    const isActive = () => store.activeFile() === props.file.path;
    const renaming = () => isRenamingItem(props.file.path);
    const parentFolder = () => { const idx = props.file.path.lastIndexOf("/"); return idx > 0 ? props.file.path.slice(0, idx) : ""; };
    function formatSize(bytes: number): string { return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1)} Ko`; }
    return (
      <div data-ctx-item class={`notes-file-row ${isActive() && !renaming() ? "notes-file-row--active" : ""}`}
        onClick={() => { if (!renaming()) store.openFile(props.file.path); }}
        onContextMenu={(e) => showContextMenu(e, { folder: parentFolder(), item: { type: "file", path: props.file.path, name: props.file.name } })}
        style={{ "padding-left": `${6 + indent() + 16}px` }}>
        <span class={`notes-file-icon ${props.file.type === "excalidraw" ? "notes-file-icon--drawing" : ""}`}>{fileIcon(props.file.type)}</span>
        <Show when={renaming()} fallback={<><span class="notes-file-name">{props.file.name}</span><span class="notes-file-meta">{props.showPath ? props.file.path : formatSize(props.file.size)}</span></>}>
          <InlineRenameInput />
        </Show>
      </div>
    );
  }

  // ─── Category sections with drag reorder ───
  function NotesTreeContent() {
    const WB_FOLDERS = new Set(["_ide", "_workflows", "_bookmarks", "_projects", "_snippets"]);
    const CONFIG_FOLDERS = new Set(["_config", "_secrets", "_mcp", "_sessions"]);
    const JOURNAL_FOLDERS = new Set(["_journal", "journal", "digests-rss", "_benchmarks", "_snapshots"]);
    const ALL_INTERNAL = new Set([...WB_FOLDERS, ...CONFIG_FOLDERS, ...JOURNAL_FOLDERS]);
    const WB_LABELS: Record<string, string> = { _ide: "IDE", _workflows: "Workflows", _bookmarks: t("bookmarks.title"), _projects: t("settings.projects"), _snippets: "Snippets" };
    const CONFIG_LABELS: Record<string, string> = { _config: "Config", _secrets: "Secrets", _mcp: "MCP Servers", _sessions: "Sessions AI" };
    const JOURNAL_LABELS: Record<string, string> = { _journal: "Journal", journal: "Journal", "digests-rss": "RSS Digests", _benchmarks: "Benchmarks", _snapshots: "Snapshots" };

    type NotesTab = "chocnotes" | "systeme";
    const [notesTab, setNotesTab] = createSignal<NotesTab>(
      (localStorage.getItem("notes-active-tab") as NotesTab) === "systeme" ? "systeme" : "chocnotes"
    );
    function switchNotesTab(tab: NotesTab) { setNotesTab(tab); localStorage.setItem("notes-active-tab", tab); }

    const userFolders = () => tree().folders.filter((f) => !ALL_INTERNAL.has(f.name));
    const wbFolders = () => tree().folders.filter((f) => WB_FOLDERS.has(f.name));
    const configFolders = () => tree().folders.filter((f) => CONFIG_FOLDERS.has(f.name));
    const journalFolders = () => tree().folders.filter((f) => JOURNAL_FOLDERS.has(f.name));

    function loadOrder(key: string, fallback: string[]): string[] {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    }
    const [chocOrder, setChocOrder] = createSignal(loadOrder("notes-cat-order-choc", ["notes", "workbench"]));
    const [sysOrder, setSysOrder] = createSignal(loadOrder("notes-cat-order-sys", ["config", "journals"]));

    const chocCats: Record<string, { id: string; render: () => any }> = {
      notes: { id: "notes", render: () => (
        <CollapsibleSection title={t("notes.categoryNotes")} defaultOpen={true}>
          <For each={userFolders()}>{(folder) => <FolderNode node={folder} depth={0} />}</For>
          <For each={tree().files}>{(file) => <FileNode file={file} depth={0} />}</For>
          <Show when={userFolders().length === 0 && tree().files.length === 0 && !inlineAction()}>
            <div style={{ padding: "12px 6px", "font-size": "11px", color: "var(--text-muted)" }}>{t("notes.rightClickCreate")}</div>
          </Show>
        </CollapsibleSection>
      )},
      workbench: { id: "workbench", render: () => (
        <CollapsibleSection title={t("notes.categoryWorkbench")} defaultOpen={true}>
          <For each={wbFolders()}>{(folder) => <FolderNode node={{ ...folder, name: WB_LABELS[folder.name] || folder.name }} depth={0} />}</For>
          <Show when={wbFolders().length === 0}>
            <div style={{ padding: "12px 6px", "font-size": "11px", color: "var(--text-muted)" }}>{t("notes.noItems")}</div>
          </Show>
        </CollapsibleSection>
      )},
    };

    const sysCats: Record<string, { id: string; render: () => any }> = {
      config: { id: "config", render: () => (
        <CollapsibleSection title={t("notes.categoryConfig")} defaultOpen={true}>
          <For each={configFolders()}>{(folder) => <FolderNode node={{ ...folder, name: CONFIG_LABELS[folder.name] || folder.name }} depth={0} />}</For>
          <Show when={configFolders().length === 0}>
            <div style={{ padding: "12px 6px", "font-size": "11px", color: "var(--text-muted)" }}>{t("notes.noItems")}</div>
          </Show>
        </CollapsibleSection>
      )},
      journals: { id: "journals", render: () => (
        <CollapsibleSection title={t("notes.categoryJournals")} defaultOpen={true}>
          <For each={journalFolders()}>{(folder) => <FolderNode node={{ ...folder, name: JOURNAL_LABELS[folder.name] || folder.name }} depth={0} />}</For>
          <Show when={journalFolders().length === 0}>
            <div style={{ padding: "12px 6px", "font-size": "11px", color: "var(--text-muted)" }}>{t("notes.noItems")}</div>
          </Show>
        </CollapsibleSection>
      )},
    };

    return (
      <>
        <div class="notes-tabs">
          <button class={`notes-tab ${notesTab() === "chocnotes" ? "notes-tab--active" : ""}`} onClick={() => switchNotesTab("chocnotes")}>{t("notes.chocNotes")}</button>
          <button class={`notes-tab ${notesTab() === "systeme" ? "notes-tab--active" : ""}`} onClick={() => switchNotesTab("systeme")}>{t("notes.system")}</button>
        </div>
        <div class="notes-sidebar-tree" onContextMenu={(e) => {
          if (!(e.target as HTMLElement).closest("[data-ctx-item]")) showContextMenu(e, { folder: "" });
        }}>
          <Show when={store.searchQuery()}>
            <For each={store.filteredFiles()}>{(file) => <FileNode file={file} depth={0} showPath />}</For>
            <Show when={store.filteredFiles().length === 0}>
              <div style={{ padding: "20px", "text-align": "center", "font-size": "12px", color: "var(--text-muted)" }}>{t("notes.noResult")}</div>
            </Show>
          </Show>
          <Show when={!store.searchQuery()}>
            <Show when={inlineAction()?.folder === ""}><div style={{ "padding-left": "6px" }}><InlineInputRow folder="" /></div></Show>
            <Show when={notesTab() === "chocnotes"}>
              <For each={chocOrder()}>{(catId) => { const cat = chocCats[catId]; return cat ? cat.render() : null; }}</For>
            </Show>
            <Show when={notesTab() === "systeme"}>
              <For each={sysOrder()}>{(catId) => { const cat = sysCats[catId]; return cat ? cat.render() : null; }}</For>
            </Show>
          </Show>
        </div>
      </>
    );
  }

  // ─── Context Menu (portal) ───
  function ContextMenuPortal() {
    const itemStyle = { display: "block", width: "100%", padding: "6px 14px", "text-align": "left" as const, "font-size": "12px", cursor: "pointer", color: "var(--text-primary)", "white-space": "nowrap" as const };
    const dangerStyle = { ...itemStyle, color: "var(--cal-red)" };
    return (
      <Show when={ctxMenu()}>
        {(menu) => (
          <div style={{ position: "fixed", left: `${menu().x}px`, top: `${menu().y}px`, background: "var(--bg-surface)", border: "1px solid var(--border-color)", "border-radius": "var(--radius-md)", "box-shadow": "0 4px 16px rgba(0,0,0,0.3)", "z-index": "1000", padding: "4px 0", "min-width": "170px" }}
            onClick={(e) => e.stopPropagation()}>
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

  return (
    <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden", "border-top": "1px solid var(--border-color)" }}
      onClick={() => setCtxMenu(null)}>
      {/* Main tabs */}
      <div class="notes-main-tabs">
        <button class={`notes-main-tab ${notesMainTab() === "notes" ? "notes-main-tab--active" : ""}`} onClick={() => setNotesMainTab("notes")}>Choc'Notes</button>
        <button class={`notes-main-tab ${notesMainTab() === "bookmarks" ? "notes-main-tab--active" : ""}`} onClick={() => setNotesMainTab("bookmarks")}>Crookies</button>
        <button class={`notes-main-tab ${notesMainTab() === "snippets" ? "notes-main-tab--active" : ""}`} onClick={() => setNotesMainTab("snippets")}>Snippets</button>
      </div>

      {/* Tab content */}
      <Show when={notesMainTab() === "notes"}>
        {/* Search */}
        <div class="notes-sidebar-search">
          <input type="text" placeholder={t("notes.searchPlaceholder")}
            value={store.searchQuery()} onInput={(e) => store.setSearchQuery(e.currentTarget.value)}
            style={{ ...inputStyle(), flex: "1", "min-width": "0" }} />
        </div>
        <NotesTreeContent />
      </Show>

      <Show when={notesMainTab() === "bookmarks"}>
        <div style={{ padding: "8px", display: "flex", "flex-direction": "column", gap: "6px" }}>
          <input type="text" placeholder="Rechercher..." value={bookmarkStore.filterQuery()} onInput={(e) => bookmarkStore.setFilterQuery(e.currentTarget.value)} style={inputStyle()} />
          <select value={bookmarkStore.filterCategory()} onChange={(e) => bookmarkStore.setFilterCategory(e.currentTarget.value)}
            style={{ ...inputStyle(), cursor: "pointer" }}>
            <option value="all">Toutes les categories</option>
            <For each={bookmarkStore.categories()}>{(cat) => <option value={cat.value}>{cat.label}</option>}</For>
          </select>
        </div>
      </Show>

      <Show when={notesMainTab() === "snippets"}>
        <div style={{ padding: "8px", display: "flex", "flex-direction": "column", gap: "4px" }}>
          <input type="text" placeholder="Rechercher..." value={snippetStore.filterQuery()} onInput={(e) => snippetStore.setFilterQuery(e.currentTarget.value)} style={inputStyle()} />
        </div>
        <div style={{ flex: "1", "overflow-y": "auto", padding: "0 4px" }}>
          <button
            class={`notes-file-row ${snippetStore.filterLanguage() === "all" && snippetStore.filterTag() === "all" && !snippetStore.filterFavorites() ? "notes-file-row--active" : ""}`}
            onClick={() => { snippetStore.setFilterLanguage("all"); snippetStore.setFilterTag("all"); snippetStore.setFilterFavorites(false); }}
            style={{ width: "100%", border: "none", "text-align": "left", cursor: "pointer", background: "none" }}>
            <span class="notes-file-name">Tous</span>
            <span class="notes-file-meta">{snippetStore.snippets().length}</span>
          </button>
          <button
            class={`notes-file-row ${snippetStore.filterFavorites() ? "notes-file-row--active" : ""}`}
            onClick={() => { snippetStore.setFilterFavorites(true); snippetStore.setFilterLanguage("all"); snippetStore.setFilterTag("all"); }}
            style={{ width: "100%", border: "none", "text-align": "left", cursor: "pointer", background: "none" }}>
            <span class="notes-file-name">Favoris</span>
            <span class="notes-file-meta">{snippetStore.favorites().length}</span>
          </button>
          <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
          {/* Tags */}
          <For each={snippetStore.allTags()}>
            {([tag, count]) => (
              <button
                class={`notes-file-row ${snippetStore.filterTag() === tag && !snippetStore.filterFavorites() ? "notes-file-row--active" : ""}`}
                onClick={() => { snippetStore.setFilterTag(tag); snippetStore.setFilterLanguage("all"); snippetStore.setFilterFavorites(false); }}
                style={{ width: "100%", border: "none", "text-align": "left", cursor: "pointer", background: "none" }}>
                <span class="notes-file-name" style={{ "font-size": "11px" }}>{tag}</span>
                <span class="notes-file-meta">{count}</span>
              </button>
            )}
          </For>
          <Show when={snippetStore.allTags().length > 0}>
            <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
          </Show>
          {/* Languages */}
          {(() => {
            const langs = () => {
              const map: Record<string, number> = {};
              for (const s of snippetStore.snippets()) { map[s.language] = (map[s.language] || 0) + 1; }
              return Object.entries(map).sort((a, b) => b[1] - a[1]);
            };
            return (
              <For each={langs()}>
                {([lang, count]) => (
                  <button
                    class={`notes-file-row ${snippetStore.filterLanguage() === lang && snippetStore.filterTag() === "all" && !snippetStore.filterFavorites() ? "notes-file-row--active" : ""}`}
                    onClick={() => { snippetStore.setFilterLanguage(lang); snippetStore.setFilterTag("all"); snippetStore.setFilterFavorites(false); }}
                    style={{ width: "100%", border: "none", "text-align": "left", cursor: "pointer", background: "none" }}>
                    <span class="notes-file-name" style={{ "font-family": "monospace", "font-size": "11px" }}>{lang}</span>
                    <span class="notes-file-meta">{count}</span>
                  </button>
                )}
              </For>
            );
          })()}
        </div>
      </Show>

      <ContextMenuPortal />
    </div>
  );
}
