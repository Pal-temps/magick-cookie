import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { useRssStore } from "../../../application/stores/rssStore";
import { useT } from "../../../i18n/context";
import { formatDate as formatIntlDate } from "../../../i18n/format";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../common/Button";
import { AiButton } from "../common/AiButton";
import { CookieLoader } from "../common/CookieLoader";
import { RssCatalog } from "./RssCatalog";
import "../../styles/rss.css";

export function RssView() {
  const rssStore = useRssStore();
  const {
    feeds, articles, selectedArticle, activeFeedId,
    isLoading, fetchArticles, selectArticle,
    toggleStar, markAllRead, syncAll, addFeed, fetchFullContent, fetchUnreadCount,
    digest, digestLoading, fetchDigest, generateDigest, saveDigestToNotes, digestSavedToNotes,
  } = rssStore;
  const { t, locale } = useT();

  const [showCatalog, setShowCatalog] = createSignal(false);
  const [showDigest, setShowDigest] = createSignal(false);
  const [loadingContent, setLoadingContent] = createSignal<string | null>(null);

  onMount(() => {
    // Ensure feeds + unread counts are loaded (deferred from App.tsx startup)
    if (feeds().length === 0) {
      rssStore.fetchFeeds();
      rssStore.fetchUnreadCount();
    }
    fetchDigest();
  });

  onCleanup(() => rssStore.clearBulkData());

  createEffect(() => {
    const feedId = activeFeedId();
    fetchArticles({ feedId: feedId ?? undefined });
  });

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    return formatIntlDate(new Date(dateStr), locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function feedLabel(feedId: string): string {
    return feeds().find((f) => f.id === feedId)?.label ?? "";
  }

  function closeArticle() {
    selectArticle(null);
  }

  return (
    <Show when={showCatalog()} fallback={
    <div class="rss">
      {/* Toolbar */}
      <div class="rss-toolbar">
        <div class="rss-toolbar__left">
          <Button size="sm" variant="secondary" onClick={() => setShowDigest((v) => !v)}>
            {showDigest() ? t("rss.close") : t("rss.digest")}
          </Button>
          <Button size="sm" variant="secondary" onClick={syncAll} disabled={isLoading()}>
            {isLoading() ? "..." : t("rss.sync")}
          </Button>
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            {t("rss.markAllRead")}
          </Button>
        </div>
        <div class="rss-toolbar__right">
          <Button size="sm" variant="ghost" onClick={() => setShowCatalog(true)}>
            {t("rss.catalog")}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <Show when={isLoading()}>
        <div class="rss-progress-bar" />
      </Show>

      {/* Body */}
      <div class="rss-body">
        {/* Main content area */}
        <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
          {/* Digest view */}
          <Show when={showDigest()}>
            <div class="rss-digest">
              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "16px" }}>
                <h3 style={{ margin: "0", "font-size": "16px", "font-weight": "600", color: "var(--text-primary)" }}>
                  {t("rss.aiDigest")}
                </h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  <AiButton variant="primary" size="sm" onClick={generateDigest} disabled={digestLoading()}>
                    {digestLoading() ? t("rss.generating") : t("rss.generate")}
                  </AiButton>
                  <Show when={digest() && (digest()!.summary || digest()!.highlights.length > 0)}>
                    <Button variant="secondary" size="sm" disabled={digestSavedToNotes()} onClick={async () => {
                      const path = await saveDigestToNotes();
                      if (path) alert(`${t("rss.savedInNotes")}: ${path}`);
                    }}>
                      {digestSavedToNotes() ? t("rss.saved") : t("rss.saveToNotes")}
                    </Button>
                  </Show>
                </div>
              </div>

              <Show when={digestLoading()}>
                <div style={{ padding: "40px", display: "flex", "justify-content": "center" }}>
                  <CookieLoader size={40} message={t("rss.analyzing")} />
                </div>
              </Show>

              <Show when={!digestLoading()}>
                <Show when={digest()} fallback={
                  <div style={{ "text-align": "center", color: "var(--text-muted)", "font-size": "13px", padding: "40px 0" }}>
                    {t("rss.noDigest")}
                  </div>
                }>
                  {(d) => (
                    <>
                      <div class="rss-digest__summary">
                        <div style={{ "font-size": "11px", "font-weight": "600", color: "#6366f1", "margin-bottom": "4px" }}>
                          {t("rss.summary")} — {d().totalUnread} {t("rss.unreadArticles")}
                        </div>
                        {d().summary}
                      </div>

                      <Show when={d().highlights.length > 0}>
                        <h4 class="rss-digest__section-title">{t("rss.readFirst")}</h4>
                        <For each={d().highlights}>
                          {(h) => (
                            <div class="rss-digest__highlight" onClick={() => h.link && openUrl(h.link)}>
                              <div class="rss-digest__highlight-title">{h.title}</div>
                              <div class="rss-digest__highlight-meta">{h.feedLabel} — {h.reason}</div>
                            </div>
                          )}
                        </For>
                      </Show>

                      <Show when={d().categories.length > 0}>
                        <h4 class="rss-digest__section-title" style={{ "margin-top": "20px" }}>{t("rss.byTheme")}</h4>
                        <div class="rss-digest__categories">
                          <For each={d().categories}>
                            {(cat) => (
                              <div class="rss-digest__category-card">
                                <div class="rss-digest__category-name">{cat.name} ({cat.count})</div>
                                <div class="rss-digest__category-count">{cat.topArticle}</div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>

                      <div class="rss-digest__timestamp">
                        {t("rss.generatedAt")} {new Date(d().generatedAt).toLocaleString(locale() === "fr" ? "fr-FR" : "en-US")}
                      </div>
                    </>
                  )}
                </Show>
              </Show>
            </div>
          </Show>

          {/* Article list */}
          <Show when={!showDigest()}>
            <div class="rss-article-list__header">
              <span>{activeFeedId() ? feedLabel(activeFeedId()!) : t("rss.allArticles")}</span>
              <span class="rss-article-list__count">
                {articles().length} article{articles().length !== 1 ? "s" : ""}
              </span>
            </div>

            <div class="rss-article-list">
              <Show when={!isLoading()} fallback={
                <div class="rss-article-list__empty">{t("rss.loading")}</div>
              }>
                <For each={articles()}>
                  {(article) => (
                    <div
                      class={`rss-article ${selectedArticle()?.id === article.id ? "rss-article--selected" : ""}`}
                      onClick={() => selectArticle(selectedArticle()?.id === article.id ? null : article)}
                    >
                      <div
                        class="rss-article__dot"
                        style={{ background: article.isRead ? "transparent" : "#3b82f6" }}
                      />
                      <div class="rss-article__content">
                        <div class={`rss-article__title ${!article.isRead ? "rss-article__title--unread" : ""}`}>
                          {article.title ?? t("rss.noTitle")}
                        </div>
                        <div class="rss-article__meta">
                          <span>{feedLabel(article.feedId)}</span>
                          <span>{formatDate(article.publishedAt)}</span>
                        </div>
                      </div>
                      <button
                        class={`rss-article__star ${article.isStarred ? "rss-article__star--active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleStar(article.id); }}
                        title={article.isStarred ? t("rss.removeStar") : t("rss.addStar")}
                      >
                        {article.isStarred ? "★" : "☆"}
                      </button>
                    </div>
                  )}
                </For>

                <Show when={articles().length === 0}>
                  <div class="rss-article-list__empty">
                    {feeds().length === 0 ? t("rss.noFeed") : t("rss.noArticle")}
                  </div>
                </Show>
              </Show>
            </div>
          </Show>

          {/* Article drawer */}
          <Show when={selectedArticle()}>
            <div class="rss-drawer-backdrop" onClick={closeArticle} />
            <div class="rss-drawer">
              <div class="rss-drawer__header">
                <button class="rss-drawer__back" onClick={closeArticle}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Retour
                </button>
                <div class="rss-drawer__actions">
                  <Button size="sm" variant="secondary"
                    onClick={async () => { setLoadingContent(selectedArticle()!.id); await fetchFullContent(selectedArticle()!.id); setLoadingContent(null); }}
                    disabled={loadingContent() === selectedArticle()?.id}
                  >
                    {loadingContent() === selectedArticle()?.id ? t("rss.loading") : t("rss.readArticle")}
                  </Button>
                  <Show when={selectedArticle()?.link}>
                    <Button size="sm" variant="ghost" onClick={() => openUrl(selectedArticle()!.link!)}>
                      {t("rss.openBrowser")}
                    </Button>
                  </Show>
                </div>
              </div>

              <h2 class="rss-drawer__title">{selectedArticle()!.title}</h2>
              <div class="rss-drawer__meta">
                <span>{feedLabel(selectedArticle()!.feedId)}</span>
                <span>{formatDate(selectedArticle()!.publishedAt)}</span>
              </div>

              <div class="rss-drawer__body">
                <Show when={selectedArticle()?.content && selectedArticle()!.content!.length > 500} fallback={
                  <div innerHTML={selectedArticle()?.description ?? ""} />
                }>
                  <div innerHTML={selectedArticle()!.content!} />
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
    }>
      <RssCatalog
        existingFeeds={feeds()}
        onAdd={async (input) => { await addFeed(input); await fetchUnreadCount(); }}
        onClose={() => setShowCatalog(false)}
      />
    </Show>
  );
}
