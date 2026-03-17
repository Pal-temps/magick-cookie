import { Show, For, createEffect } from "solid-js";
import { useCommandStore } from "../../../application/stores/commandStore";
import type { CommandResult } from "../../../application/stores/commandStore";

export function CommandPalette() {
  const { isOpen, query, selectedIndex, results, close, executeSelected, moveUp, moveDown, updateQuery } = useCommandStore();
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (isOpen() && inputRef) {
      setTimeout(() => inputRef!.focus(), 0);
    }
  });

  // Scroll selected item into view
  createEffect(() => {
    const idx = selectedIndex();
    if (!listRef) return;
    const item = listRef.querySelector(`[data-index="${idx}"]`) as HTMLElement | null;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  });

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveDown();
        break;
      case "ArrowUp":
        e.preventDefault();
        moveUp();
        break;
      case "Enter":
        e.preventDefault();
        executeSelected();
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  }

  function groupByCategory(items: CommandResult[]): { category: string; items: CommandResult[]; startIndex: number }[] {
    const groups: { category: string; items: CommandResult[]; startIndex: number }[] = [];
    let currentIndex = 0;
    for (const item of items) {
      const existing = groups.find((g) => g.category === item.category);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ category: item.category, items: [item], startIndex: currentIndex });
      }
      currentIndex++;
    }
    // Recalculate startIndex based on grouped order
    let idx = 0;
    for (const group of groups) {
      group.startIndex = idx;
      idx += group.items.length;
    }
    return groups;
  }

  // We need a flat index mapping since groups reorder items
  function getGlobalIndex(groups: { category: string; items: CommandResult[]; startIndex: number }[], groupIdx: number, itemIdx: number): number {
    let count = 0;
    for (let g = 0; g < groupIdx; g++) {
      count += groups[g].items.length;
    }
    return count + itemIdx;
  }

  return (
    <Show when={isOpen()}>
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "200",
          display: "flex",
          "justify-content": "center",
          "align-items": "flex-start",
          "padding-top": "20vh",
          "background-color": "rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        onKeyDown={onKeyDown}
      >
        <div
          style={{
            width: "100%",
            "max-width": "600px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            "border-radius": "var(--radius-lg, 12px)",
            "box-shadow": "0 16px 48px rgba(0, 0, 0, 0.4)",
            overflow: "hidden",
          }}
        >
          {/* Input */}
          <div
            style={{
              padding: "12px 16px",
              "border-bottom": "1px solid var(--border-color)",
              display: "flex",
              "align-items": "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query()}
              onInput={(e) => updateQuery(e.currentTarget.value)}
              placeholder="Rechercher une action, une tâche, un email..."
              style={{
                flex: "1",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                "font-size": "15px",
                "font-family": "inherit",
              }}
            />
            <kbd
              style={{
                padding: "2px 6px",
                "font-size": "11px",
                color: "var(--text-muted)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-color)",
                "border-radius": "var(--radius-sm, 4px)",
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            style={{
              "max-height": "400px",
              "overflow-y": "auto",
              padding: "8px 0",
            }}
          >
            <Show when={results().length > 0} fallback={
              <div style={{ padding: "24px 16px", "text-align": "center", color: "var(--text-muted)", "font-size": "14px" }}>
                Aucun résultat
              </div>
            }>
              {(() => {
                const groups = () => groupByCategory(results());
                return (
                  <For each={groups()}>
                    {(group, groupIdx) => (
                      <div>
                        <div
                          style={{
                            padding: "8px 16px 4px",
                            "font-size": "11px",
                            "font-weight": "600",
                            "text-transform": "uppercase",
                            "letter-spacing": "0.05em",
                            color: "var(--text-muted)",
                          }}
                        >
                          {group.category}
                        </div>
                        <For each={group.items}>
                          {(item, itemIdx) => {
                            const globalIdx = () => getGlobalIndex(groups(), groupIdx(), itemIdx());
                            return (
                              <div
                                data-index={globalIdx()}
                                onClick={() => { item.action(); close(); }}
                                style={{
                                  padding: "8px 16px",
                                  cursor: "pointer",
                                  display: "flex",
                                  "align-items": "center",
                                  gap: "12px",
                                  "background-color": selectedIndex() === globalIdx() ? "var(--bg-elevated)" : "transparent",
                                  transition: "background-color 0.1s",
                                }}
                                onMouseEnter={() => {
                                  // Update selected index on hover — we need to import setSelectedIndex
                                  // Instead, rely on the store returning it. We don't have direct access here,
                                  // so we skip hover-to-select for clean architecture.
                                }}
                              >
                                <Show when={item.icon}>
                                  <span style={{ "font-size": "16px", "flex-shrink": "0", width: "20px", "text-align": "center" }}>
                                    {item.icon}
                                  </span>
                                </Show>
                                <div style={{ flex: "1", "min-width": "0" }}>
                                  <div
                                    style={{
                                      color: "var(--text-primary)",
                                      "font-size": "14px",
                                      "white-space": "nowrap",
                                      overflow: "hidden",
                                      "text-overflow": "ellipsis",
                                    }}
                                  >
                                    {item.label}
                                  </div>
                                  <Show when={item.sublabel}>
                                    <div
                                      style={{
                                        color: "var(--text-muted)",
                                        "font-size": "12px",
                                        "margin-top": "2px",
                                        "white-space": "nowrap",
                                        overflow: "hidden",
                                        "text-overflow": "ellipsis",
                                      }}
                                    >
                                      {item.sublabel}
                                    </div>
                                  </Show>
                                </div>
                                <Show when={item.shortcut}>
                                  <kbd
                                    style={{
                                      padding: "2px 6px",
                                      "font-size": "11px",
                                      color: "var(--text-muted)",
                                      background: "var(--bg-elevated)",
                                      border: "1px solid var(--border-color)",
                                      "border-radius": "var(--radius-sm, 4px)",
                                      "flex-shrink": "0",
                                    }}
                                  >
                                    {item.shortcut}
                                  </kbd>
                                </Show>
                                <Show when={selectedIndex() === globalIdx()}>
                                  <kbd
                                    style={{
                                      padding: "2px 6px",
                                      "font-size": "11px",
                                      color: "var(--text-muted)",
                                      background: "var(--bg-surface)",
                                      border: "1px solid var(--border-color)",
                                      "border-radius": "var(--radius-sm, 4px)",
                                      "flex-shrink": "0",
                                    }}
                                  >
                                    &crarr;
                                  </kbd>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    )}
                  </For>
                );
              })()}
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
