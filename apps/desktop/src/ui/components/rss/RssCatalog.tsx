import { createSignal, For, Show, createMemo } from "solid-js";
import { RSS_CATALOG, type CatalogFeed, type CatalogSource } from "./rssCatalog";
import type { RssFeed } from "../../../application/stores/rssStore";
import { Button } from "../common/Button";

interface RssCatalogProps {
  existingFeeds: RssFeed[];
  onAdd: (input: { url: string; label: string; category?: string }) => Promise<unknown>;
  onClose: () => void;
}

export function RssCatalog(props: RssCatalogProps) {
  const [adding, setAdding] = createSignal<Set<string>>(new Set());
  const [added, setAdded] = createSignal<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");

  const existingUrls = createMemo(() => new Set(props.existingFeeds.map((f) => f.url)));

  // All unique categories across all sources
  const allCategories = createMemo(() => {
    const cats = new Set<string>();
    for (const source of RSS_CATALOG) {
      for (const feed of source.feeds) {
        cats.add(feed.category);
      }
    }
    return [...cats].sort();
  });

  // Filter feeds
  const filteredSources = createMemo(() => {
    const q = search().toLowerCase();
    const cat = filterCategory();

    return RSS_CATALOG.map((source) => ({
      ...source,
      feeds: source.feeds.filter((feed) => {
        if (cat && feed.category !== cat) return false;
        if (q && !feed.label.toLowerCase().includes(q) && !feed.url.toLowerCase().includes(q) && !(feed.description ?? "").toLowerCase().includes(q)) return false;
        return true;
      }),
    })).filter((s) => s.feeds.length > 0);
  });

  async function handleAdd(feed: CatalogFeed) {
    const url = feed.url;
    setAdding((prev) => new Set([...prev, url]));
    try {
      await props.onAdd({ url: feed.url, label: feed.label, category: feed.category });
      setAdded((prev) => new Set([...prev, url]));
    } finally {
      setAdding((prev) => { const next = new Set(prev); next.delete(url); return next; });
    }
  }

  function isExisting(url: string) {
    return existingUrls().has(url) || added().has(url);
  }

  return (
    <div style={{ padding: "20px", height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "14px", "flex-shrink": "0" }}>
        <h2 style={{ "font-size": "16px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>
          Catalogue de flux RSS
        </h2>
        <Button size="sm" variant="ghost" onClick={props.onClose}>Fermer</Button>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: "8px", "margin-bottom": "12px", "flex-shrink": "0" }}>
        <input
          type="text"
          placeholder="Rechercher..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style={{
            flex: "1",
            padding: "6px 10px",
            "border-radius": "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            "font-size": "12px",
            outline: "none",
          }}
        />
        <select
          value={filterCategory() ?? ""}
          onChange={(e) => setFilterCategory(e.target.value || null)}
          style={{
            padding: "6px 10px",
            "border-radius": "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            "font-size": "12px",
            cursor: "pointer",
          }}
        >
          <option value="">Toutes categories</option>
          <For each={allCategories()}>
            {(cat) => <option value={cat}>{cat}</option>}
          </For>
        </select>
      </div>

      {/* Feed list */}
      <div style={{ flex: "1", "overflow-y": "auto", "min-height": "0" }}>
        <For each={filteredSources()}>
          {(source: CatalogSource & { feeds: CatalogFeed[] }) => (
            <div style={{ "margin-bottom": "16px" }}>
              <div style={{
                "font-size": "13px",
                "font-weight": "600",
                color: "var(--text-primary)",
                "margin-bottom": "8px",
                padding: "4px 0",
                "border-bottom": "1px solid var(--border-color)",
              }}>
                {source.name}
              </div>

              <For each={source.feeds}>
                {(feed) => {
                  const existing = () => isExisting(feed.url);
                  const isAdding = () => adding().has(feed.url);

                  return (
                    <div style={{
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      padding: "8px 10px",
                      "border-radius": "var(--radius-sm)",
                      "margin-bottom": "2px",
                      background: existing() ? "var(--bg-surface)" : "transparent",
                      transition: "background 0.1s",
                    }}
                      onMouseEnter={(e) => { if (!existing()) e.currentTarget.style.background = "var(--bg-surface)"; }}
                      onMouseLeave={(e) => { if (!existing()) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ "min-width": "0", flex: "1" }}>
                        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                          <span style={{
                            "font-size": "12px",
                            "font-weight": "500",
                            color: existing() ? "var(--text-muted)" : "var(--text-primary)",
                          }}>
                            {feed.label}
                          </span>
                          <span style={{
                            "font-size": "10px",
                            padding: "1px 6px",
                            "border-radius": "var(--radius-sm)",
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                            "flex-shrink": "0",
                          }}>
                            {feed.category}
                          </span>
                        </div>
                        <Show when={feed.description}>
                          <div style={{
                            "font-size": "11px",
                            color: "var(--text-muted)",
                            "margin-top": "2px",
                          }}>
                            {feed.description}
                          </div>
                        </Show>
                      </div>

                      <Show when={existing()} fallback={
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAdd(feed)}
                          disabled={isAdding()}
                          style={{ "flex-shrink": "0", "margin-left": "8px" }}
                        >
                          {isAdding() ? "..." : "Ajouter"}
                        </Button>
                      }>
                        <span style={{
                          "font-size": "11px",
                          color: "var(--text-muted)",
                          "flex-shrink": "0",
                          "margin-left": "8px",
                        }}>
                          Actif
                        </span>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </For>

        <Show when={filteredSources().length === 0}>
          <div style={{ padding: "30px 0", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
            Aucun flux ne correspond a votre recherche.
          </div>
        </Show>
      </div>
    </div>
  );
}
