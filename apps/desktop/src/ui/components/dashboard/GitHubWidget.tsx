import { createSignal, onMount, Show, For } from "solid-js";
import { useGitHubStore } from "../../../application/stores/githubStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";

const MAX_VISIBLE = 5;

export function GitHubWidget() {
  const { prs, config, isLoading, isSyncing, fetchPRs, fetchConfig, syncPRs } = useGitHubStore();
  const [expanded, setExpanded] = createSignal(false);

  onMount(() => {
    fetchConfig();
    fetchPRs();
  });

  const sortedPRs = () => {
    const list = [...prs()];
    // Review-requested first, then by updatedAt desc
    list.sort((a, b) => {
      if (a.reviewRequested && !b.reviewRequested) return -1;
      if (!a.reviewRequested && b.reviewRequested) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  };

  const visiblePRs = () => {
    const all = sortedPRs();
    return expanded() ? all : all.slice(0, MAX_VISIBLE);
  };

  const hiddenCount = () => Math.max(0, sortedPRs().length - MAX_VISIBLE);

  function repoShort(repo: string): string {
    const parts = repo.split("/");
    return parts.length > 1 ? parts[1] : repo;
  }

  function statusBadge(pr: { state: string; draft: boolean; reviewRequested: boolean }) {
    if (pr.reviewRequested) {
      return { label: "Review", bg: "var(--accent-primary)", color: "white" };
    }
    if (pr.draft) {
      return { label: "Draft", bg: "var(--bg-elevated)", color: "var(--text-muted)" };
    }
    return { label: "Open", bg: "#00b89433", color: "#00b894" };
  }

  async function handleOpenUrl(url: string) {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        "margin-bottom": "8px",
      }}>
        <Show when={prs().length > 0}>
          <span style={{
            "font-size": "11px",
            "font-weight": "600",
            background: "var(--accent-primary)",
            color: "white",
            padding: "1px 7px",
            "border-radius": "10px",
            "min-width": "18px",
            "text-align": "center",
          }}>
            {prs().length}
          </span>
        </Show>
        <div style={{ "margin-left": "auto" }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={syncPRs}
            disabled={isSyncing()}
          >
            {isSyncing() ? "..." : "Sync"}
          </Button>
        </div>
      </div>

      {/* No config */}
      <Show when={!config() && !isLoading()}>
        <div style={{
          "font-size": "12px",
          color: "var(--text-muted)",
          padding: "12px 0",
        }}>
          GitHub non configure.{" "}
          <span style={{
            color: "var(--accent-primary)",
            cursor: "pointer",
            "text-decoration": "underline",
          }}>
            Configurer dans les parametres
          </span>
        </div>
      </Show>

      {/* Loading */}
      <Show when={isLoading()}>
        <CookieLoader size={32} message="Chargement..." />
      </Show>

      {/* Empty state */}
      <Show when={config() && !isLoading() && prs().length === 0}>
        <div style={{
          "font-size": "12px",
          color: "var(--text-muted)",
          padding: "12px 0",
        }}>
          Aucune PR ouverte
        </div>
      </Show>

      {/* PR list */}
      <Show when={!isLoading() && prs().length > 0}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <For each={visiblePRs()}>
            {(pr) => {
              const badge = statusBadge(pr);
              return (
                <div
                  onClick={() => handleOpenUrl(pr.url)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "6px 8px",
                    "border-radius": "var(--radius-md)",
                    cursor: "pointer",
                    background: "var(--bg-elevated)",
                    "border-left": pr.reviewRequested
                      ? "3px solid var(--accent-primary)"
                      : "3px solid transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-hover, var(--bg-elevated))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                  }}
                >
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <div style={{
                      "font-size": "10px",
                      color: "var(--text-muted)",
                      "margin-bottom": "2px",
                    }}>
                      {repoShort(pr.repo)} #{pr.prNumber} &middot; {pr.author}
                    </div>
                    <div style={{
                      "font-size": "12px",
                      color: "var(--text-primary)",
                      "white-space": "nowrap",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                    }}>
                      {pr.title}
                    </div>
                  </div>
                  <span style={{
                    "font-size": "10px",
                    "font-weight": "600",
                    padding: "2px 6px",
                    "border-radius": "8px",
                    background: badge.bg,
                    color: badge.color,
                    "white-space": "nowrap",
                    "flex-shrink": "0",
                  }}>
                    {badge.label}
                  </span>
                </div>
              );
            }}
          </For>
        </div>

        {/* Show more / less */}
        <Show when={hiddenCount() > 0}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-primary)",
              "font-size": "11px",
              cursor: "pointer",
              padding: "6px 0 0",
              "text-align": "left",
            }}
          >
            {expanded() ? "Voir moins" : `+ ${hiddenCount()} autre${hiddenCount() > 1 ? "s" : ""}`}
          </button>
        </Show>
      </Show>
    </div>
  );
}
