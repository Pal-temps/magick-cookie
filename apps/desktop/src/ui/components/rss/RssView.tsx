import { createSignal, createEffect, onMount, For, Show } from "solid-js";
import { useRssStore, type RssFeed, type RssArticle } from "../../../application/stores/rssStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { RssCatalog } from "./RssCatalog";

export function RssView() {
  const {
    feeds, articles, selectedArticle, activeFeedId, setActiveFeedId,
    isLoading, unreadCount, unreadPerFeed, fetchFeeds, fetchArticles, selectArticle,
    toggleStar, markAllRead, syncAll, addFeed, removeFeed, fetchFullContent, fetchUnreadCount, fetchUnreadCounts,
    digest, digestLoading, fetchDigest, generateDigest,
  } = useRssStore();

  const [addingFeed, setAddingFeed] = createSignal(false);
  const [showCatalog, setShowCatalog] = createSignal(false);
  const [showDigest, setShowDigest] = createSignal(false);
  const [loadingContent, setLoadingContent] = createSignal<string | null>(null);
  const [newUrl, setNewUrl] = createSignal("");
  const [newLabel, setNewLabel] = createSignal("");

  // Fetch cached digest + unread counts on mount
  onMount(() => { fetchDigest(); fetchUnreadCounts(); });

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

  // unreadPerFeed comes from the store (fetched via API, always up-to-date)

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
              <Button variant="secondary" size="sm" onClick={() => setShowDigest(true)}>
                Digest
              </Button>
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
                        <Show when={unreadPerFeed()[feed.id]}>
                          <span style={{
                            "font-size": "10px",
                            padding: "1px 6px",
                            "border-radius": "8px",
                            background: "var(--accent-primary)",
                            color: "#fff",
                            "font-weight": "600",
                            "flex-shrink": "0",
                            "margin-left": "6px",
                          }}>{unreadPerFeed()[feed.id]}</span>
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
            <div style={{ display: "flex", gap: "4px" }}>
              <Button variant="ghost" size="sm" onClick={() => setAddingFeed(true)} style={{ flex: "1" }}>
                + Ajouter
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowCatalog(true)} style={{ flex: "1" }}>
                Catalogue
              </Button>
            </div>
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

      {/* Right panel - article list, catalog, or digest */}
      <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
        <Show when={showDigest()}>
          <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
            <div style={{
              padding: "12px 16px",
              "border-bottom": "1px solid var(--border-color)",
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
            }}>
              <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
                Digest IA
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <Button variant="primary" size="sm" onClick={generateDigest} disabled={digestLoading()}>
                  {digestLoading() ? "Generation..." : "Generer"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDigest(false)}>
                  Fermer
                </Button>
              </div>
            </div>

            <Show when={digestLoading()}>
              <div style={{ padding: "40px", display: "flex", "justify-content": "center" }}>
                <CookieLoader size={40} message="Analyse des articles en cours..." />
              </div>
            </Show>

            <Show when={!digestLoading()}>
              <div style={{ flex: "1", "overflow-y": "auto", padding: "16px" }}>
                <Show when={digest()} fallback={
                  <div style={{ "text-align": "center", color: "var(--text-muted)", "font-size": "13px", padding: "40px 0" }}>
                    Aucun digest disponible. Cliquez sur "Generer" pour creer un resume IA de vos flux.
                  </div>
                }>
                  {(d) => (
                    <>
                      {/* Summary */}
                      <div style={{
                        padding: "12px 16px",
                        background: "rgba(99, 102, 241, 0.08)",
                        "border-left": "3px solid #6366f1",
                        "border-radius": "var(--radius-md)",
                        "margin-bottom": "16px",
                        "font-size": "13px",
                        "line-height": "1.5",
                        color: "var(--text-primary)",
                      }}>
                        <div style={{ "font-size": "11px", "font-weight": "600", color: "#6366f1", "margin-bottom": "4px" }}>
                          Resume — {d().totalUnread} articles non lus
                        </div>
                        {d().summary}
                      </div>

                      {/* Highlights */}
                      <Show when={d().highlights.length > 0}>
                        <h4 style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)", margin: "0 0 8px" }}>
                          A lire en priorite
                        </h4>
                        <div style={{ display: "flex", "flex-direction": "column", gap: "8px", "margin-bottom": "20px" }}>
                          <For each={d().highlights}>
                            {(h) => (
                              <div style={{
                                padding: "10px 14px",
                                background: "var(--bg-elevated)",
                                "border-radius": "var(--radius-md)",
                                border: "1px solid var(--border-color)",
                              }}>
                                <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", gap: "8px" }}>
                                  <div>
                                    <div style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>
                                      {h.title}
                                    </div>
                                    <div style={{ "font-size": "11px", color: "var(--text-muted)", "margin-top": "2px" }}>
                                      {h.feedLabel}
                                    </div>
                                    <div style={{ "font-size": "12px", color: "var(--text-secondary)", "margin-top": "4px", "line-height": "1.4" }}>
                                      {h.reason}
                                    </div>
                                  </div>
                                  <Show when={h.link}>
                                    <button
                                      onClick={() => openUrl(h.link!)}
                                      style={{
                                        "flex-shrink": "0",
                                        padding: "4px 8px",
                                        "border-radius": "var(--radius-sm)",
                                        border: "1px solid var(--border-color)",
                                        background: "var(--bg-surface)",
                                        color: "var(--accent-color)",
                                        "font-size": "11px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Ouvrir
                                    </button>
                                  </Show>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>

                      {/* Categories */}
                      <Show when={d().categories.length > 0}>
                        <h4 style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)", margin: "0 0 8px" }}>
                          Par thematique
                        </h4>
                        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
                          <For each={d().categories}>
                            {(cat) => (
                              <div style={{
                                padding: "8px 12px",
                                background: "var(--bg-elevated)",
                                "border-radius": "var(--radius-md)",
                                border: "1px solid var(--border-color)",
                                "min-width": "140px",
                              }}>
                                <div style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary)" }}>
                                  {cat.name}
                                  <span style={{ "font-weight": "normal", color: "var(--text-muted)", "margin-left": "6px" }}>
                                    ({cat.count})
                                  </span>
                                </div>
                                <div style={{ "font-size": "11px", color: "var(--text-secondary)", "margin-top": "2px" }}>
                                  {cat.topArticle}
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>

                      {/* Generated at */}
                      <div style={{ "margin-top": "20px", "font-size": "11px", color: "var(--text-muted)", "text-align": "right" }}>
                        Genere le {new Date(d().generatedAt).toLocaleString("fr-FR")}
                      </div>
                    </>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        </Show>
        <Show when={showCatalog() && !showDigest()}>
          <RssCatalog
            existingFeeds={feeds()}
            onAdd={async (input) => { await addFeed(input); await fetchUnreadCount(); }}
            onClose={() => setShowCatalog(false)}
          />
        </Show>
        <Show when={!showCatalog() && !showDigest()}>
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

                  {/* Expanded content */}
                  <Show when={selectedArticle()?.id === article.id}>
                    <div style={{
                      padding: "12px 16px 12px 34px",
                      "border-bottom": "1px solid var(--border-color)",
                      background: "var(--bg-elevated)",
                    }}>
                      {/* Show full content if available, otherwise description */}
                      <Show when={selectedArticle()?.content && selectedArticle()!.content!.length > 500} fallback={
                        <>
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
                            <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
                              <button
                                onClick={async () => {
                                  setLoadingContent(article.id);
                                  await fetchFullContent(article.id);
                                  setLoadingContent(null);
                                }}
                                disabled={loadingContent() === article.id}
                                style={{
                                  padding: "4px 10px",
                                  "border-radius": "var(--radius-sm)",
                                  border: "1px solid var(--border-color)",
                                  background: "var(--bg-surface)",
                                  color: "var(--accent-color)",
                                  "font-size": "12px",
                                  cursor: loadingContent() === article.id ? "default" : "pointer",
                                  transition: "background 0.1s",
                                  opacity: loadingContent() === article.id ? "0.6" : "1",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
                              >
                                {loadingContent() === article.id ? "Chargement..." : "Lire l'article"}
                              </button>
                              <button
                                onClick={() => openUrl(article.link!)}
                                style={{
                                  padding: "4px 10px",
                                  "border-radius": "var(--radius-sm)",
                                  border: "1px solid var(--border-color)",
                                  background: "var(--bg-surface)",
                                  color: "var(--text-muted)",
                                  "font-size": "12px",
                                  cursor: "pointer",
                                  transition: "background 0.1s",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
                              >
                                Ouvrir dans le navigateur
                              </button>
                            </div>
                          </Show>
                        </>
                      }>
                        <div
                          style={{
                            "font-size": "13px",
                            color: "var(--text-primary)",
                            "line-height": "1.6",
                            "margin-bottom": "10px",
                            "max-height": "60vh",
                            "overflow-y": "auto",
                          }}
                          innerHTML={selectedArticle()!.content!}
                        />
                        <Show when={article.link}>
                          <button
                            onClick={() => openUrl(article.link!)}
                            style={{
                              padding: "4px 10px",
                              "border-radius": "var(--radius-sm)",
                              border: "1px solid var(--border-color)",
                              background: "var(--bg-surface)",
                              color: "var(--text-muted)",
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
        </Show>
      </div>
    </div>
  );
}
