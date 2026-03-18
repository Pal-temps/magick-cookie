import { createSignal, createEffect, For, Show } from "solid-js";
import { useRssStore, type RssFeed, type RssArticle } from "../../../application/stores/rssStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../common/Button";

export function RssView() {
  const {
    feeds, articles, selectedArticle, activeFeedId, setActiveFeedId,
    isLoading, unreadCount, fetchFeeds, fetchArticles, selectArticle,
    toggleStar, markAllRead, syncAll, addFeed, removeFeed, fetchUnreadCount,
  } = useRssStore();

  const [addingFeed, setAddingFeed] = createSignal(false);
  const [newUrl, setNewUrl] = createSignal("");
  const [newLabel, setNewLabel] = createSignal("");

  // Re-fetch articles when active feed changes
  createEffect(() => {
    const feedId = activeFeedId();
    fetchArticles({ feedId: feedId ?? undefined });
  });

  function handleSelectFeed(feedId: string | null) {
    setActiveFeedId(feedId);
    selectArticle(null);
  }

  async function handleAddFeed() {
    const url = newUrl().trim();
    const label = newLabel().trim();
    if (!url) return;
    await addFeed({ url, label: label || url });
    setNewUrl("");
    setNewLabel("");
    setAddingFeed(false);
  }

  async function handleRemoveFeed(id: string) {
    await removeFeed(id);
    await fetchUnreadCount();
  }

  // Group feeds by category
  const feedsByCategory = () => {
    const groups = new Map<string, RssFeed[]>();
    for (const feed of feeds()) {
      const cat = feed.category || "Sans categorie";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(feed);
    }
    return groups;
  };

  // Count unread per feed
  const unreadPerFeed = () => {
    const counts = new Map<string, number>();
    for (const a of articles()) {
      if (!a.isRead) {
        counts.set(a.feedId, (counts.get(a.feedId) || 0) + 1);
      }
    }
    return counts;
  };

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function feedLabel(feedId: string): string {
    return feeds().find((f) => f.id === feedId)?.label ?? "";
  }

  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    "border-radius": "var(--radius-sm)",
    border: "1px solid var(--border-color)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    "font-size": "13px",
    outline: "none",
    "box-sizing": "border-box" as const,
  };

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Left panel - feed list */}
      <div style={{
        width: "250px",
        "min-width": "250px",
        "border-right": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "12px", "border-bottom": "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "8px" }}>
            <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>Flux RSS</h3>
            <div style={{ display: "flex", gap: "4px" }}>
              <Button variant="ghost" size="sm" onClick={syncAll} disabled={isLoading()}>
                {isLoading() ? "..." : "Sync"}
              </Button>
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                Tout lu
              </Button>
            </div>
          </div>
        </div>

        {/* Feed list */}
        <div style={{ flex: "1", "overflow-y": "auto", padding: "4px 0" }}>
          {/* All articles */}
          <button
            onClick={() => handleSelectFeed(null)}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              width: "100%",
              padding: "8px 12px",
              border: "none",
              cursor: "pointer",
              "font-size": "13px",
              "font-weight": activeFeedId() === null ? "600" : "normal",
              color: activeFeedId() === null ? "var(--accent-color)" : "var(--text-primary)",
              background: activeFeedId() === null ? "var(--bg-elevated)" : "transparent",
              "text-align": "left",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { if (activeFeedId() !== null) e.currentTarget.style.background = "var(--bg-elevated)"; }}
            onMouseLeave={(e) => { if (activeFeedId() !== null) e.currentTarget.style.background = "transparent"; }}
          >
            <span>Tous les articles</span>
            <Show when={unreadCount() > 0}>
              <span style={{
                "font-size": "10px",
                padding: "1px 6px",
                "border-radius": "var(--radius-sm)",
                background: "var(--accent-color)",
                color: "#fff",
                "font-weight": "600",
              }}>{unreadCount()}</span>
            </Show>
          </button>

          {/* Grouped feeds */}
          <For each={[...feedsByCategory().entries()]}>
            {([category, categoryFeeds]) => (
              <div>
                <Show when={feeds().some((f) => f.category)}>
                  <div style={{
                    padding: "8px 12px 4px",
                    "font-size": "10px",
                    "font-weight": "600",
                    "text-transform": "uppercase",
                    color: "var(--text-muted)",
                    "letter-spacing": "0.5px",
                  }}>{category}</div>
                </Show>
                <For each={categoryFeeds}>
                  {(feed) => (
                    <div style={{ display: "flex", "align-items": "center", position: "relative" }}>
                      <button
                        onClick={() => handleSelectFeed(feed.id)}
                        style={{
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "space-between",
                          flex: "1",
                          padding: "6px 12px",
                          border: "none",
                          cursor: "pointer",
                          "font-size": "12px",
                          color: activeFeedId() === feed.id ? "var(--accent-color)" : "var(--text-primary)",
                          "font-weight": activeFeedId() === feed.id ? "600" : "normal",
                          background: activeFeedId() === feed.id ? "var(--bg-elevated)" : "transparent",
                          "text-align": "left",
                          overflow: "hidden",
                          "white-space": "nowrap",
                          "text-overflow": "ellipsis",
                          transition: "background 0.1s",
                          "min-width": "0",
                        }}
                        onMouseEnter={(e) => { if (activeFeedId() !== feed.id) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                        onMouseLeave={(e) => { if (activeFeedId() !== feed.id) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{feed.label}</span>
                        <Show when={unreadPerFeed().get(feed.id)}>
                          <span style={{
                            "font-size": "10px",
                            padding: "1px 5px",
                            "border-radius": "var(--radius-sm)",
                            background: "var(--bg-elevated)",
                            color: "var(--text-muted)",
                            "flex-shrink": "0",
                            "margin-left": "6px",
                          }}>{unreadPerFeed().get(feed.id)}</span>
                        </Show>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveFeed(feed.id); }}
                        title="Supprimer ce flux"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          "font-size": "12px",
                          color: "var(--text-muted)",
                          padding: "4px 6px",
                          "flex-shrink": "0",
                          opacity: "0",
                          transition: "opacity 0.15s, color 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger-color, #e74c3c)"; e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.opacity = "0"; }}
                        ref={(el) => {
                          const parent = el.parentElement;
                          if (parent) {
                            parent.addEventListener("mouseenter", () => el.style.opacity = "1");
                            parent.addEventListener("mouseleave", () => el.style.opacity = "0");
                          }
                        }}
                      >&#10005;</button>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>

        {/* Add feed form */}
        <div style={{ padding: "8px 12px", "border-top": "1px solid var(--border-color)" }}>
          <Show when={addingFeed()} fallback={
            <Button variant="ghost" size="sm" onClick={() => setAddingFeed(true)} style={{ width: "100%" }}>
              + Ajouter un flux
            </Button>
          }>
            <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
              <input
                type="url"
                placeholder="URL du flux RSS..."
                value={newUrl()}
                onInput={(e) => setNewUrl(e.currentTarget.value)}
                style={inputStyle}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddFeed(); if (e.key === "Escape") setAddingFeed(false); }}
                ref={(el) => setTimeout(() => el.focus(), 0)}
              />
              <input
                type="text"
                placeholder="Label (optionnel)"
                value={newLabel()}
                onInput={(e) => setNewLabel(e.currentTarget.value)}
                style={inputStyle}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddFeed(); if (e.key === "Escape") setAddingFeed(false); }}
              />
              <div style={{ display: "flex", gap: "4px" }}>
                <Button variant="primary" size="sm" onClick={handleAddFeed} style={{ flex: "1" }}>Ajouter</Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingFeed(false)}>Annuler</Button>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Right panel - article list */}
      <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
        {/* Article list header */}
        <div style={{
          padding: "12px 16px",
          "border-bottom": "1px solid var(--border-color)",
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
        }}>
          <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
            {activeFeedId() ? feedLabel(activeFeedId()!) : "Tous les articles"}
          </h3>
          <span style={{ "font-size": "12px", color: "var(--text-muted)" }}>
            {articles().length} article{articles().length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Article list */}
        <div style={{ flex: "1", "overflow-y": "auto" }}>
          <Show when={!isLoading()} fallback={
            <div style={{ padding: "40px 0", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
              Chargement...
            </div>
          }>
            <For each={articles()}>
              {(article) => (
                <div>
                  <div
                    onClick={() => selectArticle(selectedArticle()?.id === article.id ? null : article)}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      padding: "10px 16px",
                      "border-bottom": "1px solid var(--border-color)",
                      cursor: "pointer",
                      background: selectedArticle()?.id === article.id ? "var(--bg-elevated)" : "transparent",
                      transition: "background 0.1s",
                      gap: "10px",
                    }}
                    onMouseEnter={(e) => { if (selectedArticle()?.id !== article.id) e.currentTarget.style.background = "var(--bg-surface)"; }}
                    onMouseLeave={(e) => { if (selectedArticle()?.id !== article.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Unread dot */}
                    <span style={{
                      width: "8px",
                      height: "8px",
                      "border-radius": "50%",
                      "flex-shrink": "0",
                      background: article.isRead ? "transparent" : "var(--accent-color)",
                    }} />

                    {/* Title + meta */}
                    <div style={{ flex: "1", "min-width": "0" }}>
                      <div style={{
                        "font-size": "13px",
                        "font-weight": article.isRead ? "normal" : "600",
                        color: "var(--text-primary)",
                        "white-space": "nowrap",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                      }}>
                        {article.title ?? "(Sans titre)"}
                      </div>
                      <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px", display: "flex", gap: "8px" }}>
                        <span>{feedLabel(article.feedId)}</span>
                        <span>{formatDate(article.publishedAt)}</span>
                      </div>
                    </div>

                    {/* Star button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(article.id); }}
                      title={article.isStarred ? "Retirer des favoris" : "Ajouter aux favoris"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        "font-size": "16px",
                        color: article.isStarred ? "var(--accent-secondary, #f1c40f)" : "var(--text-muted)",
                        padding: "2px",
                        "flex-shrink": "0",
                        transition: "color 0.15s",
                      }}
                    >
                      {article.isStarred ? "★" : "☆"}
                    </button>
                  </div>

                  {/* Expanded description */}
                  <Show when={selectedArticle()?.id === article.id}>
                    <div style={{
                      padding: "12px 16px 12px 34px",
                      "border-bottom": "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                    }}>
                      <Show when={article.description}>
                        <div
                          style={{
                            "font-size": "12px",
                            color: "var(--text-secondary)",
                            "line-height": "1.5",
                            "margin-bottom": "10px",
                            "max-height": "200px",
                            "overflow-y": "auto",
                          }}
                          innerHTML={article.description ?? ""}
                        />
                      </Show>
                      <Show when={article.link}>
                        <button
                          onClick={() => openUrl(article.link!)}
                          style={{
                            padding: "4px 10px",
                            "border-radius": "var(--radius-sm)",
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-surface)",
                            color: "var(--accent-color)",
                            "font-size": "12px",
                            cursor: "pointer",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
                        >
                          Ouvrir dans le navigateur
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>

            <Show when={articles().length === 0}>
              <div style={{ padding: "40px 0", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
                {feeds().length === 0
                  ? "Aucun flux RSS. Ajoutez-en un pour commencer."
                  : "Aucun article."}
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
