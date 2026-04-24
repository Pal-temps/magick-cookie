import { For, Show, createSignal } from "solid-js";
import type { EditorTab } from "../../../application/stores/ideStore";
import { useT } from "../../../i18n/context";

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onCopyPath: (path: string) => void;
  displayNames?: Map<string, string>;
}

export function EditorTabs(props: EditorTabsProps) {
  const { t } = useT();
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number; tabId: string; path: string } | null>(null);

  function handleContextMenu(e: MouseEvent, tab: EditorTab) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id, path: tab.path });
    const close = () => { setContextMenu(null); document.removeEventListener("click", close); };
    document.addEventListener("click", close);
  }

  return (
    <div class="ide-tabs">
      <For each={props.tabs}>
        {(tab) => (
          <div
            class={`ide-tab ${tab.id === props.activeTabId ? "ide-tab--active" : ""}`}
            onClick={() => props.onSwitch(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                props.onClose(tab.id);
              }
            }}
            title={tab.path}
          >
            <Show when={tab.source === "snippet"}>
              <span class="ide-tab__icon" title="Snippet">S</span>
            </Show>
            <span class="ide-tab__name">{props.displayNames?.get(tab.id) ?? tab.name}</span>
            <Show when={tab.isDirty}>
              <span class="ide-tab__dirty" title={t("ide.unsaved")} />
            </Show>
            <button
              class="ide-tab__close"
              onClick={(e) => {
                e.stopPropagation();
                props.onClose(tab.id);
              }}
              title={t("ide.closeTab")}
            >
              &times;
            </button>
          </div>
        )}
      </For>

      <Show when={contextMenu()}>
        <div class="ide-context-menu" style={{ top: `${contextMenu()!.y}px`, left: `${contextMenu()!.x}px` }}>
          <div class="ide-context-item" onClick={() => { props.onClose(contextMenu()!.tabId); setContextMenu(null); }}>{t("ide.closeTab")}</div>
          <div class="ide-context-item" onClick={() => { props.onCloseOthers(contextMenu()!.tabId); setContextMenu(null); }}>{t("ide.closeOthers")}</div>
          <div class="ide-context-item" onClick={() => { props.onCloseAll(); setContextMenu(null); }}>{t("ide.closeAll")}</div>
          <div class="ide-context-sep" />
          <div class="ide-context-item" onClick={() => { props.onCopyPath(contextMenu()!.path); setContextMenu(null); }}>{t("ide.copyPath")}</div>
        </div>
      </Show>
    </div>
  );
}
