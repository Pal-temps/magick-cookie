import { createSignal } from "solid-js";
import { BookmarkView } from "../bookmarks/BookmarkView";
import { SnippetView } from "../snippets/SnippetView";

type LibraryTab = "bookmarks" | "snippets";

export function LibraryView() {
  const [tab, setTab] = createSignal<LibraryTab>("bookmarks");

  const tabs: { id: LibraryTab; label: string }[] = [
    { id: "bookmarks", label: "Signets" },
    { id: "snippets", label: "Snippets" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: "0",
        "border-bottom": "1px solid var(--border-color)",
        background: "var(--bg-surface)",
        "flex-shrink": "0",
      }}>
        {tabs.map((t) => (
          <button
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 20px",
              "font-size": "13px",
              "font-weight": tab() === t.id ? "600" : "normal",
              cursor: "pointer",
              border: "none",
              "border-bottom": tab() === t.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
              background: "transparent",
              color: tab() === t.id ? "var(--text-primary)" : "var(--text-secondary)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (tab() !== t.id) e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { if (tab() !== t.id) e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: "1", overflow: "hidden" }}>
        {tab() === "bookmarks" ? <BookmarkView /> : <SnippetView />}
      </div>
    </div>
  );
}
