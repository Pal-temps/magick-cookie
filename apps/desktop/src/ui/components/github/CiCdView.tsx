import { createSignal, onMount, Show, For } from "solid-js";
import { api } from "../../../infrastructure/api/apiClient";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { openUrl } from "@tauri-apps/plugin-opener";

interface WorkflowRun {
  id: number;
  repo: string;
  name: string;
  branch: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

function statusBadge(status: string, conclusion: string | null) {
  if (status === "completed") {
    if (conclusion === "success") return { label: "success", bg: "#00b894", color: "#fff" };
    if (conclusion === "failure") return { label: "failure", bg: "#d63031", color: "#fff" };
    if (conclusion === "cancelled") return { label: "cancelled", bg: "#636e72", color: "#fff" };
    if (conclusion === "skipped") return { label: "skipped", bg: "#636e72", color: "#fff" };
    return { label: conclusion ?? "done", bg: "#636e72", color: "#fff" };
  }
  if (status === "in_progress") return { label: "running", bg: "#fdcb6e", color: "#2d3436" };
  if (status === "queued" || status === "waiting" || status === "pending") return { label: status, bg: "#b2bec3", color: "#2d3436" };
  return { label: status, bg: "#b2bec3", color: "#2d3436" };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortRepo(repo: string): string {
  const parts = repo.split("/");
  return parts.length > 1 ? parts[1] : repo;
}

export function CiCdView() {
  const [runs, setRuns] = createSignal<WorkflowRun[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);

  async function fetchRuns() {
    try {
      const data = await api.get<WorkflowRun[]>("/github/runs");
      setRuns(data);
    } catch (err) {
      console.error("[cicd] Failed to fetch runs:", err);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await fetchRuns();
    setRefreshing(false);
  }

  onMount(async () => {
    await fetchRuns();
    setLoading(false);
  });

  const groupedByRepo = () => {
    const map = new Map<string, WorkflowRun[]>();
    for (const run of runs()) {
      const list = map.get(run.repo) || [];
      list.push(run);
      map.set(run.repo, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  return (
    <div style={{ height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "8px 14px",
        "border-bottom": "1px solid var(--border-color)",
        "flex-shrink": "0",
      }}>
        <span style={{ "font-size": "14px", "font-weight": "600", color: "var(--text-primary)" }}>
          CI/CD — Workflow Runs
        </span>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
            {runs().length} runs
          </span>
          <Button size="sm" variant="secondary" onClick={refresh} disabled={refreshing()}>
            {refreshing() ? "..." : "Rafraichir"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <Show when={!loading()} fallback={
        <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
          <CookieLoader size={48} message="Chargement CI/CD..." />
        </div>
      }>
        <div style={{ flex: "1", overflow: "auto", padding: "8px 14px" }}>
          <Show when={runs().length > 0} fallback={
            <div style={{ padding: "40px 0", "text-align": "center", color: "var(--text-muted)", "font-size": "13px" }}>
              Aucun workflow run. Verifiez la configuration GitHub (token + repos).
            </div>
          }>
            <For each={groupedByRepo()}>
              {([repo, repoRuns]) => (
                <div style={{ "margin-bottom": "16px" }}>
                  {/* Repo header */}
                  <div style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    "margin-bottom": "6px",
                    padding: "4px 0",
                    "border-bottom": "1px solid var(--border-color)",
                  }}>
                    <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--text-primary)" }}>
                      {shortRepo(repo)}
                    </span>
                    <span style={{ "font-size": "11px", color: "var(--text-muted)" }}>
                      {repo}
                    </span>
                  </div>

                  {/* Runs table */}
                  <table style={{ width: "100%", "border-collapse": "collapse", "font-size": "12px" }}>
                    <thead>
                      <tr style={{ color: "var(--text-muted)", "text-align": "left" }}>
                        <th style={{ padding: "4px 8px", "font-weight": "500", "font-size": "11px" }}>Workflow</th>
                        <th style={{ padding: "4px 8px", "font-weight": "500", "font-size": "11px" }}>Branche</th>
                        <th style={{ padding: "4px 8px", "font-weight": "500", "font-size": "11px" }}>Statut</th>
                        <th style={{ padding: "4px 8px", "font-weight": "500", "font-size": "11px" }}>Date</th>
                        <th style={{ padding: "4px 8px", "font-weight": "500", "font-size": "11px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={repoRuns}>
                        {(run) => {
                          const badge = statusBadge(run.status, run.conclusion);
                          return (
                            <tr
                              style={{
                                "border-bottom": "1px solid var(--border-color)",
                                cursor: "pointer",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                              onClick={() => openUrl(run.url)}
                            >
                              <td style={{ padding: "6px 8px", color: "var(--text-primary)" }}>
                                {run.name}
                              </td>
                              <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>
                                <span style={{
                                  background: "var(--bg-elevated)",
                                  padding: "1px 6px",
                                  "border-radius": "var(--radius-sm)",
                                  "font-size": "11px",
                                  "font-family": "'JetBrains Mono', 'Fira Code', monospace",
                                }}>
                                  {run.branch}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "1px 8px",
                                  "border-radius": "8px",
                                  "font-size": "10px",
                                  "font-weight": "600",
                                  background: badge.bg,
                                  color: badge.color,
                                  "text-transform": "uppercase",
                                  "letter-spacing": "0.3px",
                                }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px", color: "var(--text-muted)", "font-size": "11px" }}>
                                {formatTime(run.updatedAt)}
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <span style={{ "font-size": "11px", color: "var(--text-muted)" }} title="Ouvrir dans le navigateur">
                                  &#8599;
                                </span>
                              </td>
                            </tr>
                          );
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}
