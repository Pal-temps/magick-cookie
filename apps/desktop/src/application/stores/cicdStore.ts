import { createSignal } from "solid-js";
import { api } from "../../infrastructure/api/apiClient";
import { useSecretsStore } from "./secretsStore";
import { safeGetJSON } from "../../infrastructure/storage";

// ─── Types ───

export type GitProvider = "github" | "gitlab";

export interface GitConnection {
  provider: GitProvider;
  domain: string; // "github.com" or "gitlab.example.com"
  token: string;
  username: string;
  repos: string[]; // "owner/repo" for GitHub, project IDs for GitLab
  enabled: boolean;
}

export interface PipelineRun {
  id: number | string;
  provider: GitProvider;
  repo: string;
  name: string;
  branch: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest {
  id: string;
  provider: GitProvider;
  repo: string;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  author: string;
  url: string;
  reviewRequested: boolean;
}

/** Link between a local project folder and a git remote repo */
export interface ProjectGitLink {
  projectName: string; // e.g. "api", "desktop"
  provider: GitProvider;
  repo: string; // "owner/repo" or project ID
  branch: string; // default branch
}

export interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  url: string;
  annotations: string[];
}

export interface Deployment {
  id: number;
  provider: GitProvider;
  repo: string;
  environment: string;
  ref: string;
  status: string;
  url: string;
  createdAt: string;
  creator: string;
}

export interface Release {
  id: number;
  provider: GitProvider;
  repo: string;
  tag: string;
  name: string;
  body: string;
  author: string;
  url: string;
  createdAt: string;
}

// ─── State ───

const [connections, setConnections] = createSignal<GitConnection[]>([]);
const [runs, setRuns] = createSignal<PipelineRun[]>([]);
const [prs, setPrs] = createSignal<PullRequest[]>([]);
const [deployments, setDeployments] = createSignal<Deployment[]>([]);
const [releases, setReleases] = createSignal<Release[]>([]);
const [selectedRun, setSelectedRun] = createSignal<PipelineRun | null>(null);
const [runJobs, setRunJobs] = createSignal<RunJob[]>([]);
const [loadingJobs, setLoadingJobs] = createSignal(false);
const [loading, setLoading] = createSignal(false);
const [activeProvider, setActiveProvider] = createSignal<GitProvider | "all">("all");
const [projectLinks, setProjectLinks] = createSignal<ProjectGitLink[]>(
  safeGetJSON<ProjectGitLink[]>(
    "cicd-project-links",
    [],
    (v): v is ProjectGitLink[] => Array.isArray(v),
  ),
);

// ─── Store ───

export function useCiCdStore() {
  const secrets = useSecretsStore();

  /** Load connections from the vault */
  async function loadConnections() {
    const conns: GitConnection[] = [];

    // GitHub
    const ghToken = await secrets.getAppSecret("github_token");
    const ghUsername = await secrets.getAppSecret("github_username");
    const ghReposRaw = await secrets.getAppSecret("github_repos");
    if (ghToken) {
      conns.push({
        provider: "github",
        domain: "github.com",
        token: ghToken,
        username: ghUsername || "",
        repos: ghReposRaw ? ghReposRaw.split(",").map((r) => r.trim()).filter(Boolean) : [],
        enabled: true,
      });
    }

    // GitLab
    const glToken = await secrets.getAppSecret("gitlab_token");
    const glDomain = await secrets.getAppSecret("gitlab_domain") || "gitlab.com";
    const glReposRaw = await secrets.getAppSecret("gitlab_repos");
    if (glToken) {
      conns.push({
        provider: "gitlab",
        domain: glDomain,
        token: glToken,
        username: "",
        repos: glReposRaw ? glReposRaw.split(",").map((r) => r.trim()).filter(Boolean) : [],
        enabled: true,
      });
    }

    setConnections(conns);
    return conns;
  }

  /** Save a connection to the vault */
  async function saveConnection(conn: GitConnection) {
    if (conn.provider === "github") {
      await secrets.setAppSecret("github_token", conn.token);
      await secrets.setAppSecret("github_username", conn.username);
      await secrets.setAppSecret("github_repos", conn.repos.join(","));
      // Also save to API backend for server-side sync
      try {
        await api.post("/github/config", { token: conn.token, username: conn.username, repos: conn.repos });
      } catch { /* API may not be running */ }
    } else {
      await secrets.setAppSecret("gitlab_token", conn.token);
      await secrets.setAppSecret("gitlab_domain", conn.domain);
      await secrets.setAppSecret("gitlab_repos", conn.repos.join(","));
    }
    await loadConnections();
  }

  async function removeConnection(provider: GitProvider) {
    if (provider === "github") {
      await secrets.setAppSecret("github_token", "");
      await secrets.setAppSecret("github_username", "");
      await secrets.setAppSecret("github_repos", "");
    } else {
      await secrets.setAppSecret("gitlab_token", "");
      await secrets.setAppSecret("gitlab_domain", "");
      await secrets.setAppSecret("gitlab_repos", "");
    }
    await loadConnections();
  }

  /** Fetch pipeline/workflow runs from all enabled connections */
  async function fetchRuns() {
    setLoading(true);
    const allRuns: PipelineRun[] = [];

    for (const conn of connections()) {
      if (!conn.enabled || !conn.token) continue;

      if (conn.provider === "github") {
        for (const repo of conn.repos) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${repo}/actions/runs?per_page=10`,
              { headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "magick-cookie" } },
            );
            if (!res.ok) continue;
            const json = await res.json() as any;
            for (const run of json.workflow_runs || []) {
              allRuns.push({
                id: run.id, provider: "github", repo, name: run.name,
                branch: run.head_branch, status: run.status, conclusion: run.conclusion,
                url: run.html_url, createdAt: run.created_at, updatedAt: run.updated_at,
              });
            }
          } catch { /* skip */ }
        }
      }

      if (conn.provider === "gitlab") {
        for (const projectId of conn.repos) {
          try {
            const baseUrl = conn.domain.startsWith("http") ? conn.domain : `https://${conn.domain}`;
            const res = await fetch(
              `${baseUrl}/api/v4/projects/${projectId}/pipelines?per_page=10`,
              { headers: { "PRIVATE-TOKEN": conn.token } },
            );
            if (!res.ok) continue;
            const pipelines = await res.json() as any[];
            // Get project name
            const projRes = await fetch(`${baseUrl}/api/v4/projects/${projectId}`, { headers: { "PRIVATE-TOKEN": conn.token } });
            const projName = projRes.ok ? ((await projRes.json()) as any).path_with_namespace : projectId;
            for (const p of pipelines) {
              allRuns.push({
                id: p.id, provider: "gitlab", repo: projName, name: `Pipeline #${p.id}`,
                branch: p.ref, status: p.status, conclusion: p.status === "success" ? "success" : p.status === "failed" ? "failure" : null,
                url: p.web_url, createdAt: p.created_at, updatedAt: p.updated_at,
              });
            }
          } catch { /* skip */ }
        }
      }
    }

    allRuns.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setRuns(allRuns);
    setLoading(false);
  }

  /** Fetch PRs/MRs from all connections */
  async function fetchPRs() {
    const allPrs: PullRequest[] = [];

    for (const conn of connections()) {
      if (!conn.enabled || !conn.token) continue;

      if (conn.provider === "github") {
        for (const repo of conn.repos) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${repo}/pulls?state=open&per_page=30`,
              { headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "magick-cookie" } },
            );
            if (!res.ok) continue;
            const data = await res.json() as any[];
            for (const pr of data) {
              allPrs.push({
                id: `gh-${pr.number}-${repo}`, provider: "github", repo, number: pr.number,
                title: pr.title, state: pr.draft ? "draft" : "open", draft: pr.draft,
                author: pr.user?.login, url: pr.html_url,
                reviewRequested: pr.requested_reviewers?.some((r: any) => r.login.toLowerCase() === conn.username.toLowerCase()) || false,
              });
            }
          } catch { /* skip */ }
        }
      }

      if (conn.provider === "gitlab") {
        for (const projectId of conn.repos) {
          try {
            const baseUrl = conn.domain.startsWith("http") ? conn.domain : `https://${conn.domain}`;
            const res = await fetch(
              `${baseUrl}/api/v4/projects/${projectId}/merge_requests?state=opened&per_page=30`,
              { headers: { "PRIVATE-TOKEN": conn.token } },
            );
            if (!res.ok) continue;
            const data = await res.json() as any[];
            for (const mr of data) {
              allPrs.push({
                id: `gl-${mr.iid}-${projectId}`, provider: "gitlab", repo: mr.references?.full || `${projectId}`,
                number: mr.iid, title: mr.title, state: mr.draft ? "draft" : "open", draft: mr.draft || false,
                author: mr.author?.username || "unknown", url: mr.web_url, reviewRequested: false,
              });
            }
          } catch { /* skip */ }
        }
      }
    }

    setPrs(allPrs);
  }

  const filteredRuns = () => {
    const p = activeProvider();
    if (p === "all") return runs();
    return runs().filter((r) => r.provider === p);
  };

  const filteredPRs = () => {
    const p = activeProvider();
    if (p === "all") return prs();
    return prs().filter((r) => r.provider === p);
  };

  // ─── Project ↔ Git links ───

  function linkProject(projectName: string, provider: GitProvider, repo: string, branch = "main") {
    setProjectLinks((prev) => {
      const filtered = prev.filter((l) => l.projectName !== projectName);
      const next = [...filtered, { projectName, provider, repo, branch }];
      localStorage.setItem("cicd-project-links", JSON.stringify(next));
      return next;
    });
  }

  function unlinkProject(projectName: string) {
    setProjectLinks((prev) => {
      const next = prev.filter((l) => l.projectName !== projectName);
      localStorage.setItem("cicd-project-links", JSON.stringify(next));
      return next;
    });
  }

  function getProjectLink(projectName: string): ProjectGitLink | undefined {
    return projectLinks().find((l) => l.projectName === projectName);
  }

  /** Get runs filtered by a specific project (via its git link) */
  function runsForProject(projectName: string): PipelineRun[] {
    const link = getProjectLink(projectName);
    if (!link) return [];
    return runs().filter((r) => r.repo.includes(link.repo));
  }

  // ─── Run jobs detail ───

  async function fetchRunJobs(run: PipelineRun) {
    setSelectedRun(run);
    setRunJobs([]);
    setLoadingJobs(true);
    try {
      const conn = connections().find((c) => c.provider === run.provider && c.enabled);
      if (!conn) return;

      if (run.provider === "github") {
        const res = await fetch(
          `https://api.github.com/repos/${run.repo}/actions/runs/${run.id}/jobs`,
          { headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github.v3+json" } },
        );
        if (!res.ok) return;
        const data = await res.json() as any;
        const jobs: RunJob[] = (data.jobs || []).map((j: any) => {
          const failedSteps = (j.steps || []).filter((s: any) => s.conclusion === "failure");
          const annotations = failedSteps.map((s: any) => `Step "${s.name}" failed`);
          const started = j.started_at ? new Date(j.started_at).getTime() : 0;
          const completed = j.completed_at ? new Date(j.completed_at).getTime() : 0;
          return {
            id: j.id, name: j.name, status: j.status, conclusion: j.conclusion,
            startedAt: j.started_at, completedAt: j.completed_at,
            duration: started && completed ? Math.round((completed - started) / 1000) : null,
            url: j.html_url, annotations,
          };
        });
        setRunJobs(jobs);
      }

      if (run.provider === "gitlab") {
        const baseUrl = conn.domain.startsWith("http") ? conn.domain : `https://${conn.domain}`;
        const projectId = conn.repos.find((r) => run.repo.includes(r)) || conn.repos[0];
        const res = await fetch(
          `${baseUrl}/api/v4/projects/${projectId}/pipelines/${run.id}/jobs`,
          { headers: { "PRIVATE-TOKEN": conn.token } },
        );
        if (!res.ok) return;
        const data = await res.json() as any[];
        const jobs: RunJob[] = data.map((j: any) => ({
          id: j.id, name: j.name, status: j.status, conclusion: j.status === "success" ? "success" : j.status === "failed" ? "failure" : null,
          startedAt: j.started_at, completedAt: j.finished_at,
          duration: j.duration ? Math.round(j.duration) : null,
          url: j.web_url, annotations: j.status === "failed" ? [`Job "${j.name}" failed (stage: ${j.stage})`] : [],
        }));
        setRunJobs(jobs);
      }
    } catch (e) {
      console.error("[cicd] Failed to fetch run jobs:", e);
    } finally {
      setLoadingJobs(false);
    }
  }

  // ─── Deployments ───

  async function fetchDeployments() {
    const allDeploys: Deployment[] = [];

    for (const conn of connections().filter((c) => c.enabled)) {
      if (conn.provider === "github") {
        for (const repo of conn.repos) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${repo}/deployments?per_page=20`,
              { headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github.v3+json" } },
            );
            if (!res.ok) continue;
            const deploys = await res.json() as any[];
            for (const d of deploys) {
              // Fetch latest status
              let status = "pending";
              try {
                const sRes = await fetch(
                  `https://api.github.com/repos/${repo}/deployments/${d.id}/statuses?per_page=1`,
                  { headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github.v3+json" } },
                );
                if (sRes.ok) {
                  const statuses = await sRes.json() as any[];
                  if (statuses[0]) status = statuses[0].state; // success, failure, pending, inactive, error
                }
              } catch { /* skip */ }
              allDeploys.push({
                id: d.id, provider: "github", repo, environment: d.environment,
                ref: d.ref || d.sha?.slice(0, 7) || "unknown", status,
                url: d.statuses_url ? `https://github.com/${repo}/deployments/${d.environment}` : "",
                createdAt: d.created_at, creator: d.creator?.login || "unknown",
              });
            }
          } catch { /* skip */ }
        }
      }

      if (conn.provider === "gitlab") {
        for (const projectId of conn.repos) {
          try {
            const baseUrl = conn.domain.startsWith("http") ? conn.domain : `https://${conn.domain}`;
            const res = await fetch(
              `${baseUrl}/api/v4/projects/${projectId}/environments?per_page=20`,
              { headers: { "PRIVATE-TOKEN": conn.token } },
            );
            if (!res.ok) continue;
            const envs = await res.json() as any[];
            for (const env of envs) {
              const ld = env.last_deployment;
              if (!ld) continue;
              allDeploys.push({
                id: ld.id, provider: "gitlab", repo: env.project?.path_with_namespace || String(projectId),
                environment: env.name, ref: ld.ref || ld.sha?.slice(0, 7) || "unknown",
                status: ld.status || "unknown", url: env.external_url || "",
                createdAt: ld.created_at, creator: ld.user?.username || "unknown",
              });
            }
          } catch { /* skip */ }
        }
      }
    }

    setDeployments(allDeploys);
  }

  // ─── Releases ───

  async function fetchReleases() {
    const allReleases: Release[] = [];

    for (const conn of connections().filter((c) => c.enabled)) {
      if (conn.provider === "github") {
        for (const repo of conn.repos) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${repo}/releases?per_page=10`,
              { headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github.v3+json" } },
            );
            if (!res.ok) continue;
            const data = await res.json() as any[];
            for (const r of data) {
              allReleases.push({
                id: r.id, provider: "github", repo, tag: r.tag_name, name: r.name || r.tag_name,
                body: (r.body || "").slice(0, 300), author: r.author?.login || "unknown",
                url: r.html_url, createdAt: r.published_at || r.created_at,
              });
            }
          } catch { /* skip */ }
        }
      }

      if (conn.provider === "gitlab") {
        for (const projectId of conn.repos) {
          try {
            const baseUrl = conn.domain.startsWith("http") ? conn.domain : `https://${conn.domain}`;
            const res = await fetch(
              `${baseUrl}/api/v4/projects/${projectId}/releases?per_page=10`,
              { headers: { "PRIVATE-TOKEN": conn.token } },
            );
            if (!res.ok) continue;
            const data = await res.json() as any[];
            for (const r of data) {
              allReleases.push({
                id: r.commit?.id ? parseInt(r.commit.id, 16) : 0, provider: "gitlab", repo: String(projectId),
                tag: r.tag_name, name: r.name || r.tag_name,
                body: (r.description || "").slice(0, 300), author: r.author?.username || "unknown",
                url: r._links?.self || "", createdAt: r.released_at || r.created_at,
              });
            }
          } catch { /* skip */ }
        }
      }
    }

    setReleases(allReleases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  return {
    connections,
    runs,
    prs,
    deployments,
    releases,
    selectedRun, setSelectedRun,
    runJobs,
    loadingJobs,
    loading,
    activeProvider,
    setActiveProvider,
    filteredRuns,
    filteredPRs,
    projectLinks,
    loadConnections,
    saveConnection,
    removeConnection,
    fetchRuns,
    fetchPRs,
    fetchRunJobs,
    fetchDeployments,
    fetchReleases,
    linkProject,
    unlinkProject,
    getProjectLink,
    runsForProject,
  };
}
