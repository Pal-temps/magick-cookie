import { For, Show, createSignal } from "solid-js";
import type { TreeNode, FsEntry } from "../../../application/stores/ideStore";
import type { Snippet } from "../../../application/stores/snippetStore";
import { useT } from "../../../i18n/context";

interface FileExplorerProps {
  tree: TreeNode;
  snippets: Snippet[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onOpenFile: (entry: FsEntry) => void;
  onOpenSnippet: (snippet: Snippet) => void;
  onCreateFile: (folder: string) => void;
  onCreateFolder: (folder: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onCopyPath: (path: string) => void;
  activeFilePath: string | null;
}

function FileIcon(props: { name: string }) {
  const ext = props.name.split(".").pop()?.toLowerCase() ?? "";
  const iconMap: Record<string, string> = {
    ts: "TS", tsx: "TX", js: "JS", jsx: "JX", json: "{}",
    md: "M", css: "C", html: "H", rs: "R", py: "Py",
    go: "Go", sql: "Q", yaml: "Y", yml: "Y", toml: "T",
    excalidraw: "D", sh: "Sh", lua: "Lu", rb: "Rb",
  };
  return <span class="ide-file-icon">{iconMap[ext] ?? "F"}</span>;
}

// ─── Context menu helper ───

function useContextMenu() {
  const [pos, setPos] = createSignal<{ x: number; y: number } | null>(null);

  function open(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
    const close = () => { setPos(null); document.removeEventListener("click", close); };
    document.addEventListener("click", close);
  }

  function close() { setPos(null); }

  return { pos, open, close };
}

// ─── Folder node ───

function FolderNode(props: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onOpenFile: (entry: FsEntry) => void;
  onCreateFile: (folder: string) => void;
  onCreateFolder: (folder: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onCopyPath: (path: string) => void;
  activeFilePath: string | null;
}) {
  const { t } = useT();
  const isExpanded = () => props.node.path === "" || props.expanded.has(props.node.path);
  const folderCtx = useContextMenu();
  const [fileCtx, setFileCtx] = createSignal<{ x: number; y: number; file: FsEntry } | null>(null);

  function handleFileContext(e: MouseEvent, file: FsEntry) {
    e.preventDefault();
    e.stopPropagation();
    setFileCtx({ x: e.clientX, y: e.clientY, file });
    const close = () => { setFileCtx(null); document.removeEventListener("click", close); };
    document.addEventListener("click", close);
  }

  const indent = (extra: number) => `${(props.node.path === "" ? props.depth + extra : props.depth + 1 + extra) * 16 + 4}px`;

  return (
    <div>
      {/* Folder header (skip for root) */}
      <Show when={props.node.path !== ""}>
        <div
          class="ide-tree-folder"
          style={{ "padding-left": `${props.depth * 16 + 4}px` }}
          onClick={() => props.onToggle(props.node.path)}
          onContextMenu={(e) => folderCtx.open(e)}
        >
          <span class="ide-tree-arrow">{isExpanded() ? "▾" : "▸"}</span>
          <span class="ide-tree-folder-name">{props.node.name}</span>
        </div>
      </Show>

      {/* Folder context menu */}
      <Show when={folderCtx.pos()}>
        <div class="ide-context-menu" style={{ top: `${folderCtx.pos()!.y}px`, left: `${folderCtx.pos()!.x}px` }}>
          <div class="ide-context-item" onClick={() => { props.onCreateFile(props.node.path); folderCtx.close(); }}>{t("ide.newFile")}</div>
          <div class="ide-context-item" onClick={() => { props.onCreateFolder(props.node.path); folderCtx.close(); }}>{t("ide.newFolder")}</div>
          <Show when={props.node.path !== ""}>
            <div class="ide-context-sep" />
            <div class="ide-context-item" onClick={() => { props.onCopyPath(props.node.path); folderCtx.close(); }}>{t("ide.copyPath")}</div>
            <div class="ide-context-item ide-context-item--danger" onClick={() => { props.onDeleteFolder(props.node.path); folderCtx.close(); }}>{t("ide.deleteFolder")}</div>
          </Show>
        </div>
      </Show>

      {/* Children */}
      <Show when={isExpanded()}>
        <For each={props.node.folders}>
          {(child) => (
            <FolderNode
              node={child}
              depth={props.node.path === "" ? props.depth : props.depth + 1}
              expanded={props.expanded}
              onToggle={props.onToggle}
              onOpenFile={props.onOpenFile}
              onCreateFile={props.onCreateFile}
              onCreateFolder={props.onCreateFolder}
              onDeleteFile={props.onDeleteFile}
              onDeleteFolder={props.onDeleteFolder}
              onRenameFile={props.onRenameFile}
              onCopyPath={props.onCopyPath}
              activeFilePath={props.activeFilePath}
            />
          )}
        </For>
        <For each={props.node.files}>
          {(file) => (
            <div
              class={`ide-tree-file ${file.path === props.activeFilePath ? "ide-tree-file--active" : ""}`}
              style={{ "padding-left": indent(0) }}
              onClick={() => props.onOpenFile(file)}
              onContextMenu={(e) => handleFileContext(e, file)}
            >
              <FileIcon name={file.name} />
              <span class="ide-tree-file-name">{file.name}</span>
            </div>
          )}
        </For>
      </Show>

      {/* File context menu */}
      <Show when={fileCtx()}>
        <div class="ide-context-menu" style={{ top: `${fileCtx()!.y}px`, left: `${fileCtx()!.x}px` }}>
          <div class="ide-context-item" onClick={() => { props.onOpenFile(fileCtx()!.file); setFileCtx(null); }}>{t("common.open")}</div>
          <div class="ide-context-sep" />
          <div class="ide-context-item" onClick={() => { props.onCopyPath(fileCtx()!.file.path); setFileCtx(null); }}>{t("ide.copyPath")}</div>
          <div class="ide-context-item" onClick={() => { props.onRenameFile(fileCtx()!.file.path, fileCtx()!.file.name); setFileCtx(null); }}>{t("common.rename")}</div>
          <div class="ide-context-sep" />
          <div class="ide-context-item ide-context-item--danger" onClick={() => { props.onDeleteFile(fileCtx()!.file.path); setFileCtx(null); }}>{t("common.delete")}</div>
        </div>
      </Show>
    </div>
  );
}

// ─── Main FileExplorer ───

export function FileExplorer(props: FileExplorerProps) {
  const { t } = useT();
  const [snippetsExpanded, setSnippetsExpanded] = createSignal(false);
  const rootCtx = useContextMenu();

  return (
    <div class="ide-explorer" onContextMenu={(e) => {
      // Right-click on empty area = create at root
      if ((e.target as HTMLElement).classList.contains("ide-explorer") || (e.target as HTMLElement).classList.contains("ide-explorer__section")) {
        rootCtx.open(e);
      }
    }}>
      <div class="ide-explorer__header">{t("ide.explorer")}</div>

      {/* Project tree */}
      <div class="ide-explorer__section" style={{ flex: "1", "min-height": "0" }}>
        <FolderNode
          node={props.tree}
          depth={0}
          expanded={props.expandedFolders}
          onToggle={props.onToggleFolder}
          onOpenFile={props.onOpenFile}
          onCreateFile={props.onCreateFile}
          onCreateFolder={props.onCreateFolder}
          onDeleteFile={props.onDeleteFile}
          onDeleteFolder={props.onDeleteFolder}
          onRenameFile={props.onRenameFile}
          onCopyPath={props.onCopyPath}
          activeFilePath={props.activeFilePath}
        />
      </div>

      {/* Root context menu (empty area) */}
      <Show when={rootCtx.pos()}>
        <div class="ide-context-menu" style={{ top: `${rootCtx.pos()!.y}px`, left: `${rootCtx.pos()!.x}px` }}>
          <div class="ide-context-item" onClick={() => { props.onCreateFile(""); rootCtx.close(); }}>{t("ide.newFile")}</div>
          <div class="ide-context-item" onClick={() => { props.onCreateFolder(""); rootCtx.close(); }}>{t("ide.newFolder")}</div>
        </div>
      </Show>

      {/* Snippets virtual folder */}
      <Show when={props.snippets.length > 0}>
        <div class="ide-explorer__section">
          <div
            class="ide-tree-folder ide-tree-folder--virtual"
            style={{ "padding-left": "4px" }}
            onClick={() => setSnippetsExpanded((v) => !v)}
          >
            <span class="ide-tree-arrow">{snippetsExpanded() ? "▾" : "▸"}</span>
            <span class="ide-tree-folder-name">Snippets</span>
            <span class="ide-tree-badge">{props.snippets.length}</span>
          </div>
          <Show when={snippetsExpanded()}>
            <For each={props.snippets}>
              {(snippet) => {
                const ext = snippet.language === "text" ? "txt" : snippet.language;
                return (
                  <div
                    class="ide-tree-file"
                    style={{ "padding-left": "20px" }}
                    onClick={() => props.onOpenSnippet(snippet)}
                  >
                    <FileIcon name={`x.${ext}`} />
                    <span class="ide-tree-file-name">{snippet.title}</span>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}
