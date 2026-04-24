import { createSignal, For, Show, createMemo } from "solid-js";
import { RSS_CATALOG, type CatalogFeed, type CatalogSource } from "./catalogData";
import type { RssFeed } from "../../../application/stores/rssStore";
import { useT } from "../../../i18n/context";
import { Button } from "../common/Button";

interface RssCatalogProps {
  existingFeeds: RssFeed[];
  onAdd: (input: { url: string; label: string; category?: string }) => Promise<unknown>;
  onClose: () => void;
}

const LANG_LABEL: Record<string, string> = { fr: "FR", en: "EN", mixed: "FR/EN" };

export function RssCatalog(props: RssCatalogProps) {
  const { t } = useT();
  const [adding, setAdding] = createSignal<Set<string>>(new Set());
  const [added, setAdded] = createSignal<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());

  const existingUrls = createMemo(() => new Set(props.existingFeeds.map((f) => f.url)));

  const allCategories = createMemo(() => {
    const cats = new Set<string>();
    for (const source of RSS_CATALOG) {
      for (const feed of source.feeds) cats.add(feed.category);
    }
    return [...cats].sort();
  });

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

  function toggleCollapse(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

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
    <div style={{ padding: "16px 20px", height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "10px", "flex-shrink": "0" }}>
        <h2 style={{ "font-size": "15px", "font-weight": "600", color: "var(--text-primary)", margin: "0" }}>
          {t("rss.rssCatalog")}
        </h2>
        <Button size="sm" variant="ghost" onClick={props.onClose}>{t("rss.close")}</Button>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: "6px", "margin-bottom": "10px", "flex-shrink": "0" }}>
        <input
          type="text"
          placeholder={t("common.search") + "..."}
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style={{
            flex: "1",
            padding: "5px 8px",
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
            padding: "5px 8px",
            "border-radius": "var(--radius-sm)",
            border: "1px solid var(--border-color)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            "font-size": "12px",
            cursor: "pointer",
          }}
        >
          <option value="">{t("rss.allCategories")}</option>
          <For each={allCategories()}>
            {(cat) => <option value={cat}>{cat}</option>}
          </For>
        </select>
      </div>

      {/* Feed list */}
      <div style={{ flex: "1", "overflow-y": "auto", "min-height": "0" }}>
        <For each={filteredSources()}>
          {(source: CatalogSource & { feeds: CatalogFeed[] }) => {
            const isCollapsed = () => collapsed().has(source.name);
            const activeCount = () => source.feeds.filter((f) => isExisting(f.url)).length;

            return (
              <div style={{ "margin-bottom": "4px" }}>
                {/* Collapsible header */}
                <button
                  onClick={() => toggleCollapse(source.name)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    width: "100%",
                    padding: "6px 4px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    gap: "6px",
                    "text-align": "left",
                  }}
                >
                  <span style={{
                    "font-size": "10px",
                    color: "var(--text-muted)",
                    width: "12px",
                    "text-align": "center",
                    transition: "transform 0.15s",
                    transform: isCollapsed() ? "rotate(-90deg)" : "rotate(0deg)",
                  }}>&#9660;</span>
                  <span style={{
                    "font-size": "12px",
                    "font-weight": "600",
                    color: "var(--text-primary)",
                    flex: "1",
                  }}>
                    {source.name}
                  </span>
                  <span style={{
                    "font-size": "9px",
                    padding: "1px 5px",
                    "border-radius": "var(--radius-sm)",
                    background: source.lang === "fr" ? "#3b82f620" : source.lang === "en" ? "#10b98120" : "#f59e0b20",
                    color: source.lang === "fr" ? "#3b82f6" : source.lang === "en" ? "#10b981" : "#f59e0b",
                    "font-weight": "600",
                    "letter-spacing": "0.5px",
                  }}>
                    {LANG_LABEL[source.lang]}
                  </span>
                  <span style={{ "font-size": "10px", color: "var(--text-muted)" }}>
                    {activeCount() > 0 ? `${activeCount()}/` : ""}{source.feeds.length}
                  </span>
                </button>

                {/* Feeds */}
                <Show when={!isCollapsed()}>
                  <For each={source.feeds}>
                    {(feed) => {
                      const existing = () => isExisting(feed.url);
                      const isAdding = () => adding().has(feed.url);

                      return (
                        <div
                          style={{
                            display: "flex",
                            "align-items": "center",
                            padding: "3px 6px 3px 22px",
                            "border-radius": "var(--radius-sm)",
                            gap: "6px",
                            background: existing() ? "var(--bg-surface)" : "transparent",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { if (!existing()) e.currentTarget.style.background = "var(--bg-surface)"; }}
                          onMouseLeave={(e) => { if (!existing()) e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* Label + description inline */}
                          <span style={{
                            "font-size": "12px",
                            "font-weight": "500",
                            color: existing() ? "var(--text-muted)" : "var(--text-primary)",
                            "white-space": "nowrap",
                            "flex-shrink": "0",
                          }}>
                            {feed.label}
                          </span>
                          <Show when={feed.description}>
                            <span style={{
                              "font-size": "11px",
                              color: "var(--text-muted)",
                              overflow: "hidden",
                              "white-space": "nowrap",
                              "text-overflow": "ellipsis",
                              "min-width": "0",
                              flex: "1",
                            }}>
                              — {feed.description}
                            </span>
                          </Show>
                          <Show when={!feed.description}>
                            <span style={{ flex: "1" }} />
                          </Show>

                          {/* Action */}
                          <Show when={existing()} fallback={
                            <button
                              onClick={() => handleAdd(feed)}
                              disabled={isAdding()}
                              style={{
                                padding: "1px 8px",
                                "border-radius": "var(--radius-sm)",
                                border: "1px solid var(--border-color)",
                                background: "var(--bg-base)",
                                color: "var(--accent-color)",
                                "font-size": "11px",
                                cursor: isAdding() ? "default" : "pointer",
                                "flex-shrink": "0",
                                opacity: isAdding() ? "0.5" : "1",
                                transition: "background 0.1s",
                              }}
                              onMouseEnter={(e) => { if (!isAdding()) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                              onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-base)"}
                            >
                              {isAdding() ? "..." : "+"}
                            </button>
                          }>
                            <span style={{
                              "font-size": "10px",
                              color: "var(--text-muted)",
                              "flex-shrink": "0",
                              padding: "0 4px",
                            }}>
                              &#10003;
                            </span>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            );
          }}
        </For>

        <Show when={filteredSources().length === 0}>
          <div style={{ padding: "30px 0", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
            {t("rss.noMatchSearch")}
          </div>
        </Show>
      </div>
    </div>
  );
}
