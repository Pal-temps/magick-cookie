import { createSignal, onMount, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useCiCdStore, type GitConnection, type GitProvider } from "../../../application/stores/cicdStore";
import { useSecretsStore } from "../../../application/stores/secretsStore";
import { useWorkflowStore } from "../../../application/stores/workflowStore";
import { Button } from "../common/Button";
import { CookieLoader } from "../common/CookieLoader";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useT } from "../../../i18n/context";
import "../../styles/cicd.css";

const MONOREPO_ROOT = "C:/Users/bumbl/Documents/Perso/magick-cookie";

function statusBadge(status: string, conclusion: string | null) {
  if (status === "completed" || status === "success") {
    if (conclusion === "success" || status === "success") return { label: "success", cls: "cicd-badge--success" };
    if (conclusion === "failure") return { label: "failure", cls: "cicd-badge--failure" };
    return { label: conclusion ?? "done", cls: "cicd-badge--neutral" };
  }
  if (status === "in_progress" || status === "running" || status === "pending") return { label: status, cls: "cicd-badge--running" };
  if (status === "failed") return { label: "failure", cls: "cicd-badge--failure" };
  return { label: status, cls: "cicd-badge--neutral" };
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function shortRepo(repo: string): string {
  const parts = repo.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : repo;
}

export function CiCdView() {
  const store = useCiCdStore();
  const vault = useSecretsStore();
  const wf = useWorkflowStore();
  const { t } = useT();

  const [showConfig, setShowConfig] = createSignal(false);
  const [configProvider, setConfigProvider] = createSignal<GitProvider>("github");
  const [configToken, setConfigToken] = createSignal("");
  const [configDomain, setConfigDomain] = createSignal("github.com");
  const [configUsername, setConfigUsername] = createSignal("");
  const [configRepos, setConfigRepos] = createSignal("");
  const [activeTab, setActiveTab] = createSignal<"pipelines" | "prs" | "deploys" | "releases" | "hooks">("pipelines");
  const [expandedRelease, setExpandedRelease] = createSignal<number | null>(null);

  // Sidebar state
  const [selectedProject, setSelectedProject] = createSignal<string | null>(null); // null = all
  const [projects, setProjects] = createSignal<{ name: string; path: string; markers: string[] }[]>([]);
  const [linkDialog, setLinkDialog] = createSignal<{ projectName: string } | null>(null);
  const [linkProvider, setLinkProvider] = createSignal<GitProvider>("github");
  const [linkRepo, setLinkRepo] = createSignal("");
  const [linkBranch, setLinkBranch] = createSignal("main");

  onMount(async () => {
    await store.loadConnections();
    await wf.fetchWorkflows();
    // Scan projects (exclude internal app projects)
    const INTERNAL = new Set(["api", "desktop", "llm", "screenshot-cli"]);
    try {
      const scanned = await invoke<{ name: string; path: string; markers: string[] }[]>(
        "fs_scan_projects", { rootDirs: [MONOREPO_ROOT + "/apps", MONOREPO_ROOT + "/tools"] }
      );
      setProjects(scanned.filter((p) => !INTERNAL.has(p.name)));
    } catch { setProjects([]); }
    await Promise.all([store.fetchRuns(), store.fetchPRs(), store.fetchDeployments(), store.fetchReleases()]);
  });

  // Filtered data based on selected project
  const visibleRuns = () => {
    const proj = selectedProject();
    if (!proj) return store.filteredRuns();
    return store.runsForProject(proj);
  };

  const visiblePRs = () => {
    const proj = selectedProject();
    if (!proj) return store.filteredPRs();
    const link = store.getProjectLink(proj);
    if (!link) return [];
    return store.filteredPRs().filter((pr) => pr.repo.includes(link.repo));
  };

  // Project's workflow
  const projectWorkflow = () => {
    const proj = selectedProject();
    if (!proj) return null;
    // Check if there's a workflow assigned; fallback to active workflow
    return wf.activeWorkflow();
  };

  function openConfigFor(provider: GitProvider) {
    const conn = store.connections().find((c) => c.provider === provider);
    setConfigProvider(provider);
    setConfigToken(conn?.token || "");
    setConfigDomain(conn?.domain || (provider === "github" ? "github.com" : "gitlab.com"));
    setConfigUsername(conn?.username || "");
    setConfigRepos(conn?.repos.join(", ") || "");
    setShowConfig(true);
  }

  async function saveConfig() {
    const conn: GitConnection = {
      provider: configProvider(), domain: configDomain(), token: configToken(),
      username: configUsername(), repos: configRepos().split(",").map((r) => r.trim()).filter(Boolean), enabled: true,
    };
    await store.saveConnection(conn);
    setShowConfig(false);
    await Promise.all([store.fetchRuns(), store.fetchPRs()]);
  }

  async function refresh() {
    await Promise.all([store.fetchRuns(), store.fetchPRs(), store.fetchDeployments(), store.fetchReleases()]);
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
  }

  const ghConn = () => store.connections().find((c) => c.provider === "github");
  const glConn = () => store.connections().find((c) => c.provider === "gitlab");

  function openLinkDialog(projectName: string) {
    const existing = store.getProjectLink(projectName);
    setLinkProvider(existing?.provider ?? "github");
    setLinkRepo(existing?.repo ?? "");
    setLinkBranch(existing?.branch ?? "main");
    setLinkDialog({ projectName });
  }

  // Last run status for a project
  function projectStatus(name: string): { cls: string; label: string } | null {
    const runs = store.runsForProject(name);
    if (runs.length === 0) return null;
    return statusBadge(runs[0].status, runs[0].conclusion);
  }

  return (
    <div class="cicd-layout">
      {/* ═══ SIDEBAR ═══ */}
      <div class="cicd-sidebar">
        {/* Connections */}
        <div class="cicd-sidebar__section">
          <div class="cicd-sidebar__title">{t("cicd.connections")}</div>
          <div class="cicd-sidebar__conns">
            <button class={`cicd-sconn ${ghConn() ? "cicd-sconn--active" : ""}`} onClick={() => openConfigFor("github")}>
              <span class="cicd-sconn__dot" style={{ background: "#333" }} />
              <span class="cicd-sconn__name">GitHub</span>
              <span class="cicd-sconn__status">{ghConn() ? `${ghConn()!.repos.length}` : "—"}</span>
            </button>
            <button class={`cicd-sconn ${glConn() ? "cicd-sconn--active" : ""}`} onClick={() => openConfigFor("gitlab")}>
              <span class="cicd-sconn__dot" style={{ background: "#fc6d26" }} />
              <span class="cicd-sconn__name">GitLab</span>
              <span class="cicd-sconn__status">{glConn() ? `${glConn()!.repos.length}` : "—"}</span>
            </button>
          </div>
        </div>

        {/* Projects */}
        <div class="cicd-sidebar__section cicd-sidebar__section--grow">
          <div class="cicd-sidebar__title">{t("cicd.projects")}</div>
          <div class="cicd-sidebar__projects">
            <button
              class={`cicd-sproj ${selectedProject() === null ? "cicd-sproj--active" : ""}`}
              onClick={() => setSelectedProject(null)}
            >
              <span class="cicd-sproj__icon">●</span>
              <span class="cicd-sproj__name">{t("cicd.allProjects")}</span>
              <span class="cicd-sproj__count">{store.runs().length}</span>
            </button>
            <For each={projects()}>
              {(project) => {
                const link = () => store.getProjectLink(project.name);
                const status = () => projectStatus(project.name);
                return (
                  <button
                    class={`cicd-sproj ${selectedProject() === project.name ? "cicd-sproj--active" : ""}`}
                    onClick={() => setSelectedProject(project.name)}
                    onContextMenu={(e) => { e.preventDefault(); openLinkDialog(project.name); }}
                  >
                    <Show when={status()} fallback={<span class="cicd-sproj__icon">○</span>}>
                      <span class={`cicd-sproj__status-dot ${status()!.cls}`} />
                    </Show>
                    <span class="cicd-sproj__name">{project.name}</span>
                    <Show when={link()}>
                      <span class={`cicd-sproj__git cicd-sproj__git--${link()!.provider}`}>
                        {link()!.provider === "github" ? "GH" : "GL"}
                      </span>
                    </Show>
                    <Show when={!link()}>
                      <span class="cicd-sproj__nolink" title={t("cicd.linkToRepo")}>?</span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Hooks (from active workflow, for selected project) */}
        <Show when={selectedProject()}>
          <div class="cicd-sidebar__section">
            <div class="cicd-sidebar__title">{t("cicd.hooks")} IA</div>
            <Show when={projectWorkflow()} fallback={
              <div class="cicd-sidebar__empty">{t("ide.noWorkflow")}</div>
            }>
              {(workflow) => (
                <div class="cicd-sidebar__hooks">
                  <Show when={workflow().preCommit.length > 0}>
                    <div class="cicd-hook-group">
                      <span class="cicd-hook-group__label">Pre-commit</span>
                      <For each={workflow().preCommit}>
                        {(cmd) => (
                          <div class="cicd-hook-item">
                            <span class="cicd-hook-item__icon">{cmd.startsWith("file:") ? "📄" : "▶"}</span>
                            <span class="cicd-hook-item__cmd">{cmd.startsWith("file:") ? cmd.slice(5).split("/").pop() : cmd}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <Show when={workflow().postCommit.length > 0}>
                    <div class="cicd-hook-group">
                      <span class="cicd-hook-group__label">Post-commit</span>
                      <For each={workflow().postCommit}>
                        {(cmd) => (
                          <div class="cicd-hook-item">
                            <span class="cicd-hook-item__icon">{cmd.startsWith("file:") ? "📄" : "✔"}</span>
                            <span class="cicd-hook-item__cmd">{cmd.startsWith("file:") ? cmd.slice(5).split("/").pop() : cmd}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </Show>
      </div>

      {/* ═══ MAIN ═══ */}
      <div class="cicd-main">
        {/* Header */}
        <div class="cicd-header">
          <span class="cicd-header__title">
            {selectedProject() ? `CI/CD — ${selectedProject()}` : `CI/CD — ${t("cicd.allProjects")}`}
          </span>
          <div class="cicd-header__actions">
            <Show when={selectedProject() && !store.getProjectLink(selectedProject()!)}>
              <Button size="sm" variant="ghost" onClick={() => openLinkDialog(selectedProject()!)}>
                {t("cicd.linkToRepo")}
              </Button>
            </Show>
            <span class="cicd-header__count">{visibleRuns().length} runs</span>
            <Button size="sm" variant="secondary" onClick={refresh} disabled={store.loading()}>
              {store.loading() ? "..." : t("common.refresh")}
            </Button>
          </div>
        </div>

        {/* Tabs + filter */}
        <div class="cicd-tabs">
          <div class="cicd-tabs__left">
            <button class={`cicd-tab ${activeTab() === "pipelines" ? "cicd-tab--active" : ""}`} onClick={() => setActiveTab("pipelines")}>{t("cicd.pipelines")}</button>
            <button class={`cicd-tab ${activeTab() === "prs" ? "cicd-tab--active" : ""}`} onClick={() => setActiveTab("prs")}>{t("cicd.prs")}</button>
            <button class={`cicd-tab ${activeTab() === "deploys" ? "cicd-tab--active" : ""}`} onClick={() => setActiveTab("deploys")}>Deploys</button>
            <button class={`cicd-tab ${activeTab() === "releases" ? "cicd-tab--active" : ""}`} onClick={() => setActiveTab("releases")}>Releases</button>
            <button class={`cicd-tab ${activeTab() === "hooks" ? "cicd-tab--active" : ""}`} onClick={() => setActiveTab("hooks")}>{t("cicd.hooks")}</button>
          </div>
          <div class="cicd-tabs__right">
            <button class={`cicd-filter ${store.activeProvider() === "all" ? "cicd-filter--active" : ""}`} onClick={() => store.setActiveProvider("all")}>{t("common.all")}</button>
            <Show when={ghConn()}><button class={`cicd-filter ${store.activeProvider() === "github" ? "cicd-filter--active" : ""}`} onClick={() => store.setActiveProvider("github")}>GitHub</button></Show>
            <Show when={glConn()}><button class={`cicd-filter ${store.activeProvider() === "gitlab" ? "cicd-filter--active" : ""}`} onClick={() => store.setActiveProvider("gitlab")}>GitLab</button></Show>
          </div>
        </div>

        {/* Content */}
        <Show when={!store.loading()} fallback={<div class="cicd-loading"><CookieLoader size={48} message={t("common.loading")} /></div>}>
          <div class="cicd-content">
            {/* Pipelines */}
            <Show when={activeTab() === "pipelines"}>
              <Show when={visibleRuns().length > 0} fallback={
                <div class="cicd-empty">{selectedProject() && !store.getProjectLink(selectedProject()!) ? `${t("cicd.notConfigured")} — ${t("cicd.linkToRepo")}` : t("cicd.noPipeline")}</div>
              }>
                <table class="cicd-table"><thead><tr><th>Repo</th><th>Workflow</th><th>{t("cicd.branch")}</th><th>Status</th><th>{t("email.date")}</th><th></th></tr></thead>
                  <tbody>
                    <For each={visibleRuns()}>
                      {(run) => {
                        const badge = statusBadge(run.status, run.conclusion);
                        return (
                          <tr class={`cicd-row ${store.selectedRun()?.id === run.id ? "cicd-row--selected" : ""}`}
                            onClick={() => store.fetchRunJobs(run)}>
                            <td><span class={`cicd-provider-dot cicd-provider-dot--${run.provider}`} />{shortRepo(run.repo)}</td>
                            <td>{run.name}</td>
                            <td><code class="cicd-branch">{run.branch}</code></td>
                            <td><span class={`cicd-badge ${badge.cls}`}>{badge.label}</span></td>
                            <td class="cicd-date">{formatTime(run.updatedAt)}</td>
                            <td class="cicd-link" onClick={(e) => { e.stopPropagation(); openUrl(run.url); }}>↗</td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>

                {/* Job detail panel */}
                <Show when={store.selectedRun()}>
                  <div class="cicd-job-panel">
                    <div class="cicd-job-panel__header">
                      <span style={{ "font-weight": "600" }}>{store.selectedRun()!.name}</span>
                      <code class="cicd-branch">{store.selectedRun()!.branch}</code>
                      <span class={`cicd-badge ${statusBadge(store.selectedRun()!.status, store.selectedRun()!.conclusion).cls}`}>
                        {statusBadge(store.selectedRun()!.status, store.selectedRun()!.conclusion).label}
                      </span>
                      <button class="cicd-job-panel__close" onClick={() => store.setSelectedRun(null)}>&times;</button>
                    </div>
                    <Show when={store.loadingJobs()}>
                      <div style={{ padding: "12px", "text-align": "center" }}><CookieLoader size={24} /></div>
                    </Show>
                    <Show when={!store.loadingJobs() && store.runJobs().length > 0}>
                      <div class="cicd-job-list">
                        <For each={store.runJobs()}>
                          {(job) => {
                            const jBadge = statusBadge(job.status, job.conclusion);
                            return (
                              <div class="cicd-job-item">
                                <div class="cicd-job-item__row">
                                  <span class={`cicd-badge ${jBadge.cls}`}>{jBadge.label}</span>
                                  <span class="cicd-job-item__name">{job.name}</span>
                                  <span class="cicd-job-item__duration">{formatDuration(job.duration)}</span>
                                  <button class="cicd-link" onClick={() => openUrl(job.url)}>↗</button>
                                </div>
                                <Show when={job.annotations.length > 0}>
                                  <div class="cicd-job-errors">
                                    <For each={job.annotations}>
                                      {(ann) => <div class="cicd-job-error">{ann}</div>}
                                    </For>
                                  </div>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
              </Show>
            </Show>

            {/* PRs */}
            <Show when={activeTab() === "prs"}>
              <Show when={visiblePRs().length > 0} fallback={<div class="cicd-empty">{t("cicd.noPr")}</div>}>
                <table class="cicd-table"><thead><tr><th>Repo</th><th>#</th><th>{t("passwords.title")}</th><th>Author</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    <For each={visiblePRs()}>
                      {(pr) => (
                        <tr class="cicd-row" onClick={() => openUrl(pr.url)}>
                          <td><span class={`cicd-provider-dot cicd-provider-dot--${pr.provider}`} />{shortRepo(pr.repo)}</td>
                          <td class="cicd-pr-num">#{pr.number}</td>
                          <td>{pr.title}</td>
                          <td class="cicd-author">{pr.author}</td>
                          <td>
                            <span class={`cicd-badge ${pr.draft ? "cicd-badge--neutral" : "cicd-badge--success"}`}>{pr.draft ? "draft" : "open"}</span>
                            <Show when={pr.reviewRequested}><span class="cicd-badge cicd-badge--review">review</span></Show>
                          </td>
                          <td class="cicd-link">↗</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </Show>

            {/* Deploys tab */}
            <Show when={activeTab() === "deploys"}>
              <Show when={store.deployments().length > 0} fallback={<div class="cicd-empty">Aucun deployement trouve</div>}>
                <table class="cicd-table"><thead><tr><th>Repo</th><th>Environnement</th><th>Ref</th><th>Status</th><th>{t("email.date")}</th><th>Par</th></tr></thead>
                  <tbody>
                    <For each={store.deployments()}>
                      {(deploy) => {
                        const badge = statusBadge(deploy.status, deploy.status === "success" ? "success" : deploy.status === "failure" || deploy.status === "error" ? "failure" : null);
                        const envCls = deploy.environment.includes("prod") ? "cicd-env--prod" : deploy.environment.includes("stag") ? "cicd-env--staging" : "cicd-env--preview";
                        return (
                          <tr class="cicd-row" onClick={() => deploy.url && openUrl(deploy.url)}>
                            <td><span class={`cicd-provider-dot cicd-provider-dot--${deploy.provider}`} />{shortRepo(deploy.repo)}</td>
                            <td><span class={`cicd-env-badge ${envCls}`}>{deploy.environment}</span></td>
                            <td><code class="cicd-branch">{deploy.ref.slice(0, 12)}</code></td>
                            <td><span class={`cicd-badge ${badge.cls}`}>{badge.label}</span></td>
                            <td class="cicd-date">{formatTime(deploy.createdAt)}</td>
                            <td class="cicd-author">{deploy.creator}</td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </Show>
            </Show>

            {/* Releases tab */}
            <Show when={activeTab() === "releases"}>
              <Show when={store.releases().length > 0} fallback={<div class="cicd-empty">Aucune release trouvee</div>}>
                <table class="cicd-table"><thead><tr><th>Repo</th><th>Tag</th><th>Nom</th><th>Auteur</th><th>{t("email.date")}</th><th></th></tr></thead>
                  <tbody>
                    <For each={store.releases()}>
                      {(rel) => (<>
                        <tr class={`cicd-row ${expandedRelease() === rel.id ? "cicd-row--selected" : ""}`}
                          onClick={() => setExpandedRelease(expandedRelease() === rel.id ? null : rel.id)}>
                          <td><span class={`cicd-provider-dot cicd-provider-dot--${rel.provider}`} />{shortRepo(rel.repo)}</td>
                          <td><code class="cicd-branch">{rel.tag}</code></td>
                          <td>{rel.name}</td>
                          <td class="cicd-author">{rel.author}</td>
                          <td class="cicd-date">{formatTime(rel.createdAt)}</td>
                          <td class="cicd-link" onClick={(e) => { e.stopPropagation(); openUrl(rel.url); }}>↗</td>
                        </tr>
                        <Show when={expandedRelease() === rel.id && rel.body}>
                          <tr><td colspan="6" class="cicd-release-body"><pre>{rel.body}</pre></td></tr>
                        </Show>
                      </>)}
                    </For>
                  </tbody>
                </table>
              </Show>
            </Show>

            {/* Hooks tab */}
            <Show when={activeTab() === "hooks"}>
              <div class="cicd-hooks-view">
                <Show when={selectedProject()} fallback={
                  <div class="cicd-empty">{t("ide.selectProject")}</div>
                }>
                  <Show when={projectWorkflow()} fallback={
                    <div class="cicd-empty">{t("ide.noWorkflow")}</div>
                  }>
                    {(workflow) => (
                      <div class="cicd-hooks-detail">
                        <div class="cicd-hooks-detail__header">
                          <span class="cicd-hooks-detail__wf-name">{workflow().name}</span>
                          <span class="cicd-hooks-detail__wf-desc">{workflow().description}</span>
                        </div>
                        <div class="cicd-hooks-detail__sections">
                          <div class="cicd-hooks-detail__section">
                            <div class="cicd-hooks-detail__section-title">▶ Pre-commit ({workflow().preCommit.length})</div>
                            <For each={workflow().preCommit} fallback={<div class="cicd-hooks-detail__empty">{t("common.none")}</div>}>
                              {(cmd) => (
                                <div class="cicd-hooks-detail__item">
                                  <span>{cmd.startsWith("file:") ? "📄" : "⚡"}</span>
                                  <code>{cmd.startsWith("file:") ? cmd.slice(5) : cmd}</code>
                                </div>
                              )}
                            </For>
                          </div>
                          <div class="cicd-hooks-detail__section">
                            <div class="cicd-hooks-detail__section-title">✔ Post-commit ({workflow().postCommit.length})</div>
                            <For each={workflow().postCommit} fallback={<div class="cicd-hooks-detail__empty">{t("common.none")}</div>}>
                              {(cmd) => (
                                <div class="cicd-hooks-detail__item">
                                  <span>{cmd.startsWith("file:") ? "📄" : "⚡"}</span>
                                  <code>{cmd.startsWith("file:") ? cmd.slice(5) : cmd}</code>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </div>
                    )}
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Config dialog */}
      <Show when={showConfig()}>
        <div class="cicd-overlay" onClick={() => setShowConfig(false)}>
          <div class="cicd-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="cicd-dialog__header">
              <span>{t("cicd.configure")} {configProvider() === "github" ? "GitHub" : "GitLab"}</span>
              <button class="cicd-dialog__close" onClick={() => setShowConfig(false)}>&times;</button>
            </div>
            <div class="cicd-dialog__body">
              <Show when={configProvider() === "gitlab"}>
                <label class="cicd-field"><span class="cicd-field__label">{t("cicd.domain")}</span>
                  <input class="cicd-field__input" type="text" value={configDomain()} onInput={(e) => setConfigDomain(e.currentTarget.value)} placeholder="gitlab.com" />
                </label>
              </Show>
              <label class="cicd-field">
                <span class="cicd-field__label">{t("cicd.token")}</span>
                <div class="cicd-field__row">
                  <input class="cicd-field__input" type="password" value={configToken()} onInput={(e) => setConfigToken(e.currentTarget.value)}
                    placeholder={configProvider() === "github" ? "ghp_..." : "glpat-..."} style={{ flex: "1" }} />
                  <button class="cicd-field__gen-btn" disabled={!vault.isUnlocked()} title={vault.isUnlocked() ? t("cicd.generate") : t("cicd.vaultLocked")}
                    onClick={() => { const t = vault.generatePassword(40, { uppercase: true, lowercase: true, digits: true, symbols: false }); setConfigToken(t); }}>
                    🔑
                  </button>
                </div>
                <span class="cicd-field__hint">{vault.isUnlocked() ? `🔓 ${t("cicd.vaultActive")}` : `🔒 ${t("cicd.vaultLocked")}`}</span>
              </label>
              <Show when={configProvider() === "github"}>
                <label class="cicd-field"><span class="cicd-field__label">{t("cicd.username")}</span>
                  <input class="cicd-field__input" type="text" value={configUsername()} onInput={(e) => setConfigUsername(e.currentTarget.value)} placeholder="username" />
                </label>
              </Show>
              <label class="cicd-field">
                <span class="cicd-field__label">{configProvider() === "github" ? "Repos (owner/repo)" : "IDs de projets"}</span>
                <input class="cicd-field__input" type="text" value={configRepos()} onInput={(e) => setConfigRepos(e.currentTarget.value)}
                  placeholder={configProvider() === "github" ? "user/repo1, org/repo2" : "123, 456"} />
                <span class="cicd-field__hint">{t("cicd.separatedComma")}</span>
              </label>
            </div>
            <div class="cicd-dialog__footer">
              <Show when={store.connections().find((c) => c.provider === configProvider())}>
                <button class="cicd-dialog__btn cicd-dialog__btn--danger" onClick={async () => { await store.removeConnection(configProvider()); setShowConfig(false); }}>{t("common.delete")}</button>
              </Show>
              <div style={{ flex: "1" }} />
              <button class="cicd-dialog__btn" onClick={() => setShowConfig(false)}>{t("common.cancel")}</button>
              <button class="cicd-dialog__btn cicd-dialog__btn--primary" onClick={saveConfig} disabled={!configToken()}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      </Show>

      {/* Link dialog */}
      <Show when={linkDialog()}>
        <div class="cicd-overlay" onClick={() => setLinkDialog(null)}>
          <div class="cicd-dialog" onClick={(e) => e.stopPropagation()} style={{ width: "360px" }}>
            <div class="cicd-dialog__header">
              <span>{t("cicd.linkToRepo")} — {linkDialog()!.projectName}</span>
              <button class="cicd-dialog__close" onClick={() => setLinkDialog(null)}>&times;</button>
            </div>
            <div class="cicd-dialog__body">
              <label class="cicd-field"><span class="cicd-field__label">Provider</span>
                <select class="cicd-field__input" value={linkProvider()} onChange={(e) => setLinkProvider(e.currentTarget.value as GitProvider)}>
                  <option value="github">GitHub</option><option value="gitlab">GitLab</option>
                </select>
              </label>
              <label class="cicd-field"><span class="cicd-field__label">{linkProvider() === "github" ? "Repo (owner/repo)" : "ID projet"}</span>
                <input class="cicd-field__input" type="text" value={linkRepo()} onInput={(e) => setLinkRepo(e.currentTarget.value)} placeholder={linkProvider() === "github" ? "user/repo" : "12345"} />
              </label>
              <label class="cicd-field"><span class="cicd-field__label">{t("cicd.branch")}</span>
                <input class="cicd-field__input" type="text" value={linkBranch()} onInput={(e) => setLinkBranch(e.currentTarget.value)} placeholder="main" />
              </label>
            </div>
            <div class="cicd-dialog__footer">
              <Show when={store.getProjectLink(linkDialog()!.projectName)}>
                <button class="cicd-dialog__btn cicd-dialog__btn--danger" onClick={() => { store.unlinkProject(linkDialog()!.projectName); setLinkDialog(null); }}>{t("cicd.unlink")}</button>
              </Show>
              <div style={{ flex: "1" }} />
              <button class="cicd-dialog__btn" onClick={() => setLinkDialog(null)}>{t("common.cancel")}</button>
              <button class="cicd-dialog__btn cicd-dialog__btn--primary" disabled={!linkRepo().trim()} onClick={() => {
                store.linkProject(linkDialog()!.projectName, linkProvider(), linkRepo().trim(), linkBranch().trim() || "main");
                setLinkDialog(null);
              }}>{t("cicd.linkToRepo")}</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
